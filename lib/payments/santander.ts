import "server-only";

import { readFile } from "node:fs/promises";
import https from "node:https";

import {
  PaymentMethod,
  PaymentStatus,
} from "@/lib/db/entities/condominium-payment.entity";
import type {
  CreatePixChargeInput,
  PaymentChargeSnapshot,
} from "@/lib/payments/types";

const SANTANDER_PROVIDER = "santander";
const DEFAULT_PIX_EXPIRATION_IN_SECONDS = 60 * 60;
const SANTANDER_SANDBOX_API_BASE_URL =
  "https://pix.santander.com.br/api/v1/sandbox";
const SANTANDER_SANDBOX_AUTH_URL =
  "https://pix.santander.com.br/auth/oauth/v2/token";
const SANTANDER_PRODUCTION_HOST = "https://trust-pix.santander.com.br";

type SantanderEnvironment = "sandbox" | "production";
type SantanderHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type SantanderRequestOptions = {
  method?: SantanderHttpMethod;
  path: string;
  searchParams?: Record<string, string | undefined>;
  body?: unknown;
};

type SantanderTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type SantanderCobStatus =
  | "ATIVA"
  | "CONCLUIDA"
  | "REMOVIDA_PELO_USUARIO_RECEBEDOR"
  | "REMOVIDA_PELO_PSP";

type SantanderCob = {
  calendario?: {
    criacao?: string;
    expiracao?: number;
  };
  txid?: string;
  status?: SantanderCobStatus;
  valor?: {
    original?: string;
  };
  pixCopiaECola?: string;
  location?: string;
  pix?: SantanderPix[];
};

export type SantanderPix = {
  endToEndId?: string;
  txid?: string;
  valor?: string;
  horario?: string;
  infoPagador?: string;
};

type SantanderWebhookPayload = {
  pix?: SantanderPix[];
};

type SantanderInfoAdicional = {
  nome: string;
  valor: string;
};

type MtlsCredentials = {
  cert: string | Buffer;
  key: string | Buffer;
  passphrase?: string;
};

type HttpJsonResponse<T> = {
  statusCode: number;
  payload: T | null;
  rawBody: string;
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let mtlsCredentialsPromise: Promise<MtlsCredentials> | null = null;

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function getSantanderEnvironment(): SantanderEnvironment {
  return getTrimmedEnv("SANTANDER_ENV") === "production" ? "production" : "sandbox";
}

function getSantanderHost() {
  const apiBaseUrl = getTrimmedEnv("SANTANDER_API_BASE_URL");

  if (apiBaseUrl) {
    return new URL(apiBaseUrl).origin;
  }

  return SANTANDER_PRODUCTION_HOST;
}

function getSantanderApiBaseUrl() {
  const apiBaseUrl = getTrimmedEnv("SANTANDER_API_BASE_URL");

  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/$/, "");
  }

  if (getSantanderEnvironment() === "sandbox") {
    return SANTANDER_SANDBOX_API_BASE_URL;
  }

  return `${getSantanderHost()}/api/v1`;
}

function getSantanderAuthUrl() {
  const authUrl = getTrimmedEnv("SANTANDER_AUTH_URL");

  if (authUrl) {
    return authUrl;
  }

  return getSantanderEnvironment() === "sandbox"
    ? SANTANDER_SANDBOX_AUTH_URL
    : `${getSantanderHost()}/auth/oauth/v2/token`;
}

function getSantanderClientId() {
  return getTrimmedEnv("SANTANDER_CLIENT_ID");
}

function getSantanderClientSecret() {
  return getTrimmedEnv("SANTANDER_CLIENT_SECRET");
}

function getSantanderPixKey() {
  return getTrimmedEnv("SANTANDER_PIX_KEY");
}

function hasSantanderCertConfig() {
  return Boolean(
    getTrimmedEnv("SANTANDER_CERT_PATH") ||
      getTrimmedEnv("SANTANDER_CERT_PEM") ||
      getTrimmedEnv("SANTANDER_CERT_PEM_BASE64"),
  );
}

function hasSantanderKeyConfig() {
  return Boolean(
    getTrimmedEnv("SANTANDER_KEY_PATH") ||
      getTrimmedEnv("SANTANDER_KEY_PEM") ||
      getTrimmedEnv("SANTANDER_KEY_PEM_BASE64"),
  );
}

async function readPemSecret({
  label,
  pathName,
  pemName,
  base64Name,
}: {
  label: string;
  pathName: string;
  pemName: string;
  base64Name: string;
}) {
  const pem = getTrimmedEnv(pemName);

  if (pem) {
    return pem.replace(/\\n/g, "\n");
  }

  const base64 = getTrimmedEnv(base64Name);

  if (base64) {
    return Buffer.from(base64, "base64").toString("utf8");
  }

  const filePath = getTrimmedEnv(pathName);

  if (filePath) {
    return readFile(/* turbopackIgnore: true */ filePath, "utf8");
  }

  throw new Error(`${label} nao configurado.`);
}

async function getMtlsCredentials(): Promise<MtlsCredentials> {
  if (!mtlsCredentialsPromise) {
    mtlsCredentialsPromise = Promise.all([
      readPemSecret({
        label: "SANTANDER_CERT_PATH ou SANTANDER_CERT_PEM",
        pathName: "SANTANDER_CERT_PATH",
        pemName: "SANTANDER_CERT_PEM",
        base64Name: "SANTANDER_CERT_PEM_BASE64",
      }),
      readPemSecret({
        label: "SANTANDER_KEY_PATH ou SANTANDER_KEY_PEM",
        pathName: "SANTANDER_KEY_PATH",
        pemName: "SANTANDER_KEY_PEM",
        base64Name: "SANTANDER_KEY_PEM_BASE64",
      }),
    ]).then(([cert, key]) => ({
      cert,
      key,
      passphrase: getTrimmedEnv("SANTANDER_KEY_PASSPHRASE") ?? undefined,
    }));
  }

  return mtlsCredentialsPromise;
}

function assertSantanderConfigured() {
  if (!getSantanderClientId()) {
    throw new Error("SANTANDER_CLIENT_ID nao configurado.");
  }

  if (!getSantanderClientSecret()) {
    throw new Error("SANTANDER_CLIENT_SECRET nao configurado.");
  }

  if (!getSantanderPixKey()) {
    throw new Error("SANTANDER_PIX_KEY nao configurado.");
  }

  if (!hasSantanderCertConfig()) {
    throw new Error("Certificado Santander nao configurado.");
  }

  if (!hasSantanderKeyConfig()) {
    throw new Error("Chave privada Santander nao configurada.");
  }
}

function buildSantanderUrl(
  path: string,
  searchParams?: Record<string, string | undefined>,
) {
  const normalizedPath = path.replace(/^\//, "");
  const url = new URL(normalizedPath, `${getSantanderApiBaseUrl()}/`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url;
}

function parseJsonPayload<T>(rawBody: string): T | null {
  if (!rawBody.trim()) {
    return null;
  }

  return JSON.parse(rawBody) as T;
}

async function requestJson<T>({
  url,
  method,
  headers,
  body,
}: {
  url: URL;
  method: SantanderHttpMethod;
  headers: Record<string, string>;
  body?: string;
}): Promise<HttpJsonResponse<T>> {
  const credentials = await getMtlsCredentials();

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        cert: credentials.cert,
        key: credentials.key,
        passphrase: credentials.passphrase,
        headers: {
          Accept: "application/json",
          ...headers,
          ...(body ? { "Content-Length": String(Buffer.byteLength(body)) } : {}),
        },
        timeout: 30_000,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");

          try {
            resolve({
              statusCode: response.statusCode ?? 0,
              payload: parseJsonPayload<T>(rawBody),
              rawBody,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("Tempo esgotado ao comunicar com o Santander."));
    });
    request.on("error", reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function extractSantanderError(payload: unknown, rawBody: string) {
  if (!payload || typeof payload !== "object") {
    return rawBody || "Falha ao comunicar com o Santander.";
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.message,
    record.mensagem,
    record.detail,
    record.detalhe,
    record.title,
    record.error_description,
    record.error,
  ];

  return (
    candidates.find((value): value is string => typeof value === "string") ||
    rawBody ||
    "Falha ao comunicar com o Santander."
  );
}

async function getSantanderAccessToken() {
  assertSantanderConfigured();

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = getSantanderClientId();
  const clientSecret = getSantanderClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Santander nao configuradas.");
  }

  const formBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  }).toString();
  const response = await requestJson<SantanderTokenResponse>({
    url: new URL(getSantanderAuthUrl()),
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      client_id: clientId,
      client_secret: clientSecret,
    },
    body: formBody,
  });

  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    !response.payload?.access_token
  ) {
    throw new Error(extractSantanderError(response.payload, response.rawBody));
  }

  cachedToken = {
    accessToken: response.payload.access_token,
    expiresAt: Date.now() + (response.payload.expires_in ?? 900) * 1000,
  };

  return cachedToken.accessToken;
}

async function requestSantander<T>({
  method = "GET",
  path,
  searchParams,
  body,
}: SantanderRequestOptions): Promise<T> {
  const clientId = getSantanderClientId();

  if (!clientId) {
    throw new Error("SANTANDER_CLIENT_ID nao configurado.");
  }

  const accessToken = await getSantanderAccessToken();
  const response = await requestJson<T>({
    url: buildSantanderUrl(path, searchParams),
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Application-Key": clientId,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.statusCode < 200 || response.statusCode >= 300 || !response.payload) {
    throw new Error(extractSantanderError(response.payload, response.rawBody));
  }

  return response.payload;
}

function onlyDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || "";
}

function getDefaultPayerTaxId() {
  return (
    getTrimmedEnv("SANTANDER_DEFAULT_PAYER_TAX_ID") ||
    getTrimmedEnv("PAYMENT_DEFAULT_CUSTOMER_TAX_ID")
  );
}

function getPayerName(customer: CreatePixChargeInput["customer"]) {
  return (
    getTrimmedEnv("SANTANDER_DEFAULT_PAYER_NAME") ||
    customer.name.trim() ||
    "ServeBox"
  );
}

function buildDebtor(customer: CreatePixChargeInput["customer"]) {
  const taxId = onlyDigits(customer.taxId || getDefaultPayerTaxId());
  const name = getPayerName(customer);

  if (taxId.length === 11) {
    return {
      cpf: taxId,
      nome: name,
    };
  }

  if (taxId.length === 14) {
    return {
      cnpj: taxId,
      nome: name,
    };
  }

  throw new Error(
    "SANTANDER_DEFAULT_PAYER_TAX_ID ou PAYMENT_DEFAULT_CUSTOMER_TAX_ID deve ter CPF ou CNPJ valido.",
  );
}

function formatAmountInReais(amountInCents: number) {
  return (amountInCents / 100).toFixed(2);
}

function parseAmountInCents(value: string | undefined, fallbackAmountInCents?: number) {
  if (!value) {
    return fallbackAmountInCents;
  }

  const amount = Number(value.replace(",", "."));

  if (!Number.isFinite(amount)) {
    return fallbackAmountInCents;
  }

  return Math.round(amount * 100);
}

function getPixExpirationInSeconds() {
  const value = Number(getTrimmedEnv("SANTANDER_PIX_EXPIRATION_SECONDS"));

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_PIX_EXPIRATION_IN_SECONDS;
  }

  return Math.floor(value);
}

function buildPixExpiration(calendario: SantanderCob["calendario"]) {
  const expiration = calendario?.expiracao;
  const createdAt = calendario?.criacao ? new Date(calendario.criacao) : new Date();

  if (!expiration || !Number.isFinite(expiration)) {
    return null;
  }

  return new Date(createdAt.getTime() + expiration * 1000);
}

function mapSantanderStatus(status: string | undefined): PaymentStatus {
  switch (status) {
    case "CONCLUIDA":
      return PaymentStatus.PAID;
    case "REMOVIDA_PELO_USUARIO_RECEBEDOR":
    case "REMOVIDA_PELO_PSP":
      return PaymentStatus.EXPIRED;
    default:
      return PaymentStatus.PENDING;
  }
}

function getCobPixTransactionId(cob: SantanderCob, webhookPix?: SantanderPix) {
  return webhookPix?.endToEndId ?? cob.pix?.[0]?.endToEndId ?? null;
}

function buildChargeSnapshot({
  cob,
  fallbackTxid,
  fallbackAmountInCents,
  webhookPix,
}: {
  cob: SantanderCob;
  fallbackTxid: string;
  fallbackAmountInCents?: number;
  webhookPix?: SantanderPix;
}): PaymentChargeSnapshot {
  const amountInCents = parseAmountInCents(
    cob.valor?.original,
    fallbackAmountInCents,
  );

  if (typeof amountInCents !== "number" || !Number.isFinite(amountInCents)) {
    throw new Error("Santander retornou uma cobranca sem valor.");
  }

  return {
    provider: SANTANDER_PROVIDER,
    providerPaymentId: cob.txid ?? fallbackTxid,
    providerRawStatus: cob.status ?? "ATIVA",
    providerReceiptUrl: null,
    providerDevMode: getSantanderEnvironment() !== "production",
    method: PaymentMethod.PIX,
    status: mapSantanderStatus(cob.status),
    amountInCents,
    pixTransactionId: getCobPixTransactionId(cob, webhookPix),
    pixQrCode: null,
    pixCopyPasteCode: cob.pixCopiaECola ?? null,
    pixExpiresAt: buildPixExpiration(cob.calendario),
  };
}

function assertValidSantanderTxid(reference: string) {
  if (!/^[a-zA-Z0-9]{26,35}$/.test(reference)) {
    throw new Error(
      "Referencia de pagamento invalida para o Santander. Use um txid alfanumerico de 26 a 35 caracteres.",
    );
  }
}

function buildSolicitacaoPagador(
  reference: string,
  metadata: CreatePixChargeInput["metadata"],
) {
  const paymentType = metadata?.paymentType
    ? ` ${metadata.paymentType.replace(/_/g, " ")}`
    : "";

  return `ServeBox${paymentType} ${reference}`.slice(0, 140);
}

function buildInfoAdicionais(
  reference: string,
  metadata: CreatePixChargeInput["metadata"],
): SantanderInfoAdicional[] {
  const paymentType = metadata?.paymentType?.replace(/_/g, " ");
  const entries: Array<[string, string | undefined]> = [
    ["Referencia", reference],
    ["Condominio", metadata?.condominiumName],
    ["Tipo", paymentType],
    ["Marca", metadata?.tubeBrandName],
    ["Tubos", metadata?.ballQuantity],
  ];

  return entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .slice(0, 9)
    .map(([nome, valor]) => ({
      nome: nome.slice(0, 50),
      valor: valor.slice(0, 150),
    }));
}

export type SantanderWebhookPixPayload = SantanderWebhookPayload;

export function isSantanderConfigured() {
  return Boolean(
    getSantanderClientId() &&
      getSantanderClientSecret() &&
      getSantanderPixKey() &&
      hasSantanderCertConfig() &&
      hasSantanderKeyConfig(),
  );
}

export function getSantanderProviderName() {
  return SANTANDER_PROVIDER;
}

export async function createSantanderPixCharge({
  amountInCents,
  reference,
  customer,
  metadata,
}: CreatePixChargeInput) {
  assertSantanderConfigured();
  assertValidSantanderTxid(reference);

  const pixKey = getSantanderPixKey();

  if (!pixKey) {
    throw new Error("SANTANDER_PIX_KEY nao configurado.");
  }

  const infoAdicionais = buildInfoAdicionais(reference, metadata);
  const cob = await requestSantander<SantanderCob>({
    method: "PUT",
    path: `/cob/${reference}`,
    body: {
      calendario: {
        expiracao: getPixExpirationInSeconds(),
      },
      devedor: buildDebtor(customer),
      valor: {
        original: formatAmountInReais(amountInCents),
      },
      chave: pixKey,
      solicitacaoPagador: buildSolicitacaoPagador(reference, metadata),
      ...(infoAdicionais.length > 0 ? { infoAdicionais } : {}),
    },
  });

  return buildChargeSnapshot({
    cob,
    fallbackTxid: reference,
    fallbackAmountInCents: amountInCents,
  });
}

export async function checkSantanderPixCharge(
  providerPaymentId: string,
  fallbackAmountInCents?: number,
  webhookPix?: SantanderPix,
) {
  assertSantanderConfigured();

  const cob = await requestSantander<SantanderCob>({
    path: `/cob/${providerPaymentId}`,
  });

  return buildChargeSnapshot({
    cob,
    fallbackTxid: providerPaymentId,
    fallbackAmountInCents,
    webhookPix,
  });
}
