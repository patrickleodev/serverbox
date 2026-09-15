import crypto from "node:crypto";

import {
  PaymentMethod,
  PaymentStatus,
} from "@/lib/db/entities/condominium-payment.entity";
import type {
  CreatePixChargeInput,
  PaymentChargeSnapshot,
} from "@/lib/payments/types";

const ABACATEPAY_API_BASE_URL =
  process.env.ABACATEPAY_API_BASE_URL?.trim() || "https://api.abacatepay.com/v2";
const ABACATEPAY_PROVIDER = "abacatepay";
const ABACATEPAY_DEFAULT_PIX_EXPIRATION_IN_SECONDS = 60 * 60;

export type AbacatePayProviderName = typeof ABACATEPAY_PROVIDER;

type AbacatePayRequestOptions = {
  method?: "GET" | "POST";
  path: string;
  searchParams?: Record<string, string | undefined>;
  body?: unknown;
};

type AbacatePayTransparentStatus =
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "REFUNDED"
  | "FAILED";

type AbacatePayTransparent = {
  id: string;
  amount?: number;
  amountInCents?: number;
  status: AbacatePayTransparentStatus;
  devMode?: boolean;
  brCode?: string | null;
  brCodeBase64?: string | null;
  platformFee?: number;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
  receiptUrl?: string | null;
  metadata?: Record<string, string>;
  externalId?: string | null;
};

type CreateAbacatePixChargeInput = CreatePixChargeInput;

export type AbacatePayChargeSnapshot = PaymentChargeSnapshot & {
  provider: typeof ABACATEPAY_PROVIDER;
  providerRawStatus: AbacatePayTransparentStatus;
};

export type AbacatePayWebhookPayload = {
  event: string;
  apiVersion?: number;
  devMode: boolean;
  data?: {
    transparent?: AbacatePayTransparent;
    id?: string;
    amount?: number;
    amountInCents?: number;
    status?: AbacatePayTransparentStatus;
    devMode?: boolean;
    brCode?: string | null;
    brCodeBase64?: string | null;
    expiresAt?: string | null;
    receiptUrl?: string | null;
    metadata?: Record<string, string>;
    externalId?: string | null;
    payerInformation?: {
      method?: string;
      PIX?: {
        name?: string;
        taxId?: string;
        isSameAsCustomer?: boolean;
      };
    };
  };
};

function getAbacatePayApiKey() {
  return process.env.ABACATEPAY_API_KEY?.trim() || null;
}

function getAbacatePayWebhookSecret() {
  return process.env.ABACATEPAY_WEBHOOK_SECRET?.trim() || null;
}

function getAbacatePayPublicWebhookKey() {
  return process.env.ABACATEPAY_PUBLIC_WEBHOOK_KEY?.trim() || null;
}

function isDevelopmentRuntime() {
  return process.env.NODE_ENV === "development";
}

function isAuthOrKeyError(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();

  return (
    normalizedMessage.includes("invalid or inactive api key") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("api key") ||
    normalizedMessage.includes("chave")
  );
}

function buildDevelopmentTransparentCharge(
  input: CreateAbacatePixChargeInput,
): AbacatePayTransparent {
  return {
    id: `dev-${input.reference}`,
    amount: input.amountInCents,
    status: "PENDING",
    devMode: true,
    brCode: `DEV-SERVEBOX-PIX:${input.reference}:${input.amountInCents}`,
    brCodeBase64: null,
    expiresAt: new Date(
      Date.now() + ABACATEPAY_DEFAULT_PIX_EXPIRATION_IN_SECONDS * 1000,
    ).toISOString(),
    receiptUrl: null,
    metadata: {
      reference: input.reference,
      ...input.metadata,
    },
    externalId: input.reference,
  };
}

function getAbacatePayApiBaseUrl() {
  const baseUrl = ABACATEPAY_API_BASE_URL;

  if (!baseUrl.includes("/v1") && !baseUrl.includes("/v2")) {
    throw new Error(
      "ABACATEPAY_API_BASE_URL inválida. Use uma URL da API v1 ou v2 da AbacatePay.",
    );
  }

  return baseUrl;
}

function getAbacatePayApiVersion() {
  return getAbacatePayApiBaseUrl().includes("/v1") ? "v1" : "v2";
}

function buildUrl(path: string, searchParams?: Record<string, string | undefined>) {
  const url = new URL(path, `${getAbacatePayApiBaseUrl()}/`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url;
}

async function requestAbacatePay<T>({
  method = "GET",
  path,
  searchParams,
  body,
}: AbacatePayRequestOptions): Promise<T> {
  const apiKey = getAbacatePayApiKey();

  if (!apiKey) {
    throw new Error("ABACATEPAY_API_KEY não configurada.");
  }

  const response = await fetch(buildUrl(path, searchParams), {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string } | string | null;
    success?: boolean;
  };

  if (!response.ok || !payload.data) {
    const errorMessage =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message || "Falha ao comunicar com a AbacatePay.";

    throw new Error(errorMessage);
  }

  return payload.data;
}

function mapAbacateStatus(status: string): PaymentStatus {
  switch (status) {
    case "PAID":
      return PaymentStatus.PAID;
    case "EXPIRED":
      return PaymentStatus.EXPIRED;
    case "REFUNDED":
      return PaymentStatus.REFUNDED;
    case "FAILED":
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PENDING;
  }
}

function buildChargeSnapshot(
  transparent: AbacatePayTransparent,
  fallbackAmountInCents?: number,
): AbacatePayChargeSnapshot {
  const maybeAmount = transparent.amountInCents ?? transparent.amount ?? fallbackAmountInCents;

  if (typeof maybeAmount !== "number" || !Number.isFinite(maybeAmount)) {
    throw new Error("AbacatePay retornou um pagamento sem valor.");
  }

  const amountInCents = maybeAmount;

  return {
    provider: ABACATEPAY_PROVIDER,
    providerPaymentId: transparent.id,
    providerRawStatus: transparent.status,
    providerReceiptUrl: transparent.receiptUrl ?? null,
    providerDevMode: Boolean(transparent.devMode),
    method: PaymentMethod.PIX,
    status: mapAbacateStatus(transparent.status),
    amountInCents,
    pixTransactionId: null,
    pixQrCode: transparent.brCodeBase64 ?? null,
    pixCopyPasteCode: transparent.brCode ?? null,
    pixExpiresAt: transparent.expiresAt ? new Date(transparent.expiresAt) : null,
  };
}

export function isAbacatePayConfigured() {
  return Boolean(getAbacatePayApiKey());
}

export function getAbacatePayProviderName(): AbacatePayProviderName {
  return ABACATEPAY_PROVIDER;
}

export async function createAbacatePixCharge({
  amountInCents,
  reference,
  customer,
  metadata,
}: CreateAbacatePixChargeInput) {
  const version = getAbacatePayApiVersion();
  const customerPayload = {
    name: customer.name,
    email: customer.email,
    ...(customer.cellphone ? { cellphone: customer.cellphone } : {}),
    ...(customer.taxId ? { taxId: customer.taxId } : {}),
  };

  const body: Record<string, unknown> =
    version === "v1"
      ? {
          amount: amountInCents,
          expiresIn: ABACATEPAY_DEFAULT_PIX_EXPIRATION_IN_SECONDS,
          description: `Pagamento ${reference}`.slice(0, 37),
          customer: customerPayload,
          metadata: {
            externalId: reference,
            reference,
            ...metadata,
          },
        }
      : {
          method: "PIX",
          data: {
            amount: amountInCents,
            description: `Pagamento ${reference}`,
            customer: customerPayload,
            metadata: {
              reference,
              ...metadata,
            },
          },
        };

  const transparent = await requestAbacatePay<AbacatePayTransparent>({
    method: "POST",
    path: version === "v1" ? "pixQrCode/create" : "transparents/create",
    body,
  }).catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isDevelopmentRuntime() && isAuthOrKeyError(errorMessage)) {
      console.warn(
        "[abacatepay] falling back to development PIX charge because the API key is invalid, inactive, or unavailable",
      );

      return buildDevelopmentTransparentCharge({
        amountInCents,
        reference,
        customer,
        metadata: metadata ?? {},
      });
    }

    throw error;
  });

  console.log("[abacatepay] create charge response", transparent);

  return buildChargeSnapshot(transparent);
}

export async function checkAbacatePixCharge(
  providerPaymentId: string,
  fallbackAmountInCents?: number,
) {
  const version = getAbacatePayApiVersion();

  const transparent = await requestAbacatePay<AbacatePayTransparent>({
    path: version === "v1" ? "pixQrCode/check" : "transparents/check",
    searchParams: {
      id: providerPaymentId,
    },
  });

  return buildChargeSnapshot(transparent, fallbackAmountInCents);
}

export async function simulateAbacatePixCharge(providerPaymentId: string) {
  const version = getAbacatePayApiVersion();

  const transparent = await requestAbacatePay<AbacatePayTransparent>({
    method: "POST",
    path:
      version === "v1" ? "pixQrCode/simulate-payment" : "transparents/simulate-payment",
    searchParams: {
      id: providerPaymentId,
    },
    body: {
      metadata: {},
    },
  });

  return buildChargeSnapshot(transparent);
}

export function verifyAbacatePayWebhook({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string;
  signature: string | null;
  secret: string | null;
}) {
  const expectedSecret = getAbacatePayWebhookSecret();

  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return false;
  }

  const publicKey = getAbacatePayPublicWebhookKey();

  if (!publicKey || !signature) {
    return true;
  }

  const expectedSignature = crypto
    .createHmac("sha256", publicKey)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
  const providedSignature = Buffer.from(signature);
  const normalizedExpectedSignature = Buffer.from(expectedSignature);

  return (
    normalizedExpectedSignature.length === providedSignature.length &&
    crypto.timingSafeEqual(normalizedExpectedSignature, providedSignature)
  );
}

function getWebhookTransparent(payload: AbacatePayWebhookPayload) {
  if (payload.data?.transparent) {
    return payload.data.transparent;
  }

  if (
    !payload.data?.id ||
    !payload.data.status ||
    (payload.data.amount === undefined && payload.data.amountInCents === undefined)
  ) {
    return null;
  }

  return {
    id: payload.data.id,
    amount: payload.data.amount ?? payload.data.amountInCents,
    status: payload.data.status,
    devMode: payload.data.devMode ?? payload.devMode,
    brCode: payload.data.brCode ?? null,
    brCodeBase64: payload.data.brCodeBase64 ?? null,
    expiresAt: payload.data.expiresAt ?? null,
    receiptUrl: payload.data.receiptUrl ?? null,
    metadata: payload.data.metadata,
    externalId: payload.data.externalId ?? null,
  } satisfies AbacatePayTransparent;
}

export function getAbacatePayWebhookReference(payload: AbacatePayWebhookPayload) {
  const transparent = getWebhookTransparent(payload);

  return (
    transparent?.metadata?.reference ??
    transparent?.metadata?.externalId ??
    transparent?.externalId ??
    null
  );
}

export function getAbacatePayWebhookProviderPaymentId(
  payload: AbacatePayWebhookPayload,
) {
  return getWebhookTransparent(payload)?.id ?? null;
}

export function getAbacatePayWebhookSnapshot(payload: AbacatePayWebhookPayload) {
  const transparent = getWebhookTransparent(payload);

  if (!transparent) {
    return null;
  }

  return buildChargeSnapshot(transparent);
}
