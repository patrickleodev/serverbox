import {
  PaymentMethod,
  PaymentStatus,
} from "@/lib/db/entities/condominium-payment.entity";
import type {
  CreatePixChargeInput,
  PaymentChargeSnapshot,
} from "@/lib/payments/types";

const INFINITEPAY_PROVIDER = "infinitepay";
const CHECKOUT_LINKS_API_URL = "https://api.checkout.infinitepay.io/links";
const PAYMENT_CHECK_API_URL = "https://api.checkout.infinitepay.io/payment_check";

type InfinitePayCheckoutLinkResponse = {
  id?: string;
  status?: string;
  url?: string;
  link?: string;
  checkout_url?: string;
  slug?: string;
  [key: string]: unknown;
};

type InfinitePayPaymentCheckResponse = {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  transaction_nsu?: string;
  order_nsu?: string;
  slug?: string;
  receipt_url?: string;
  message?: string | null;
  [key: string]: unknown;
};

export type InfinitePayWebhookPayload = {
  invoice_slug?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  transaction_nsu?: string;
  order_nsu?: string;
  receipt_url?: string;
  items?: unknown[];
  paid?: boolean;
  success?: boolean;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

function getInfinitePayTag() {
  return process.env.INFINITEPAY_TAG?.trim() || null;
}

function getInfinitePayWebhookSecret() {
  return process.env.INFINITEPAY_WEBHOOK_SECRET?.trim() || null;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getAppBaseUrl() {
  const configuredUrl =
    process.env.PAYMENT_APP_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "")}`;
  }

  return "http://localhost:3000";
}

function buildWebhookUrl() {
  const url = new URL("/api/webhooks/infinitepay", getAppBaseUrl());
  const secret = getInfinitePayWebhookSecret();

  if (secret) {
    url.searchParams.set("webhookSecret", secret);
  }

  return url.toString();
}

function buildRedirectUrl() {
  return new URL("/dashboard", getAppBaseUrl()).toString();
}

function buildCheckoutUrl(
  response: InfinitePayCheckoutLinkResponse,
  handle: string,
) {
  const directUrl = [response.url, response.link, response.checkout_url].find(
    (value) => typeof value === "string" && value.trim(),
  );

  if (directUrl) {
    return directUrl.trim();
  }

  if (typeof response.slug === "string" && response.slug.trim()) {
    return `https://checkout.infinitepay.io/${handle}/${response.slug.trim()}`;
  }

  return null;
}

function buildCheckoutDescription(
  reference: string,
  metadata: CreatePixChargeInput["metadata"],
) {
  const paymentType = metadata?.paymentType?.replace(/_/g, " ");
  const tubeBrandName = metadata?.tubeBrandName;
  const ballQuantity = metadata?.ballQuantity;
  const parts = [
    "ServeBox",
    paymentType,
    tubeBrandName,
    ballQuantity ? `${ballQuantity} tubos` : null,
    reference,
  ].filter(Boolean);

  return parts.join(" - ").slice(0, 255);
}

async function createCheckoutLink(body: Record<string, unknown>) {
  const response = await fetch(CHECKOUT_LINKS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as InfinitePayCheckoutLinkResponse) : {};

  if (!response.ok) {
    throw new Error(
      `InfinitePay retornou erro ao criar checkout (${response.status}): ${text}`,
    );
  }

  return payload;
}

function toAmountInCents(value: unknown, fallbackAmountInCents?: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof fallbackAmountInCents === "number") {
    return fallbackAmountInCents;
  }

  throw new Error("InfinitePay retornou um pagamento sem valor.");
}

function hasPaidAmount(payload: {
  amount?: number;
  paid_amount?: number;
  paid?: boolean;
  success?: boolean;
  transaction_nsu?: string;
}) {
  if (payload.paid === true) {
    return true;
  }

  if (
    typeof payload.amount === "number" &&
    Number.isFinite(payload.amount) &&
    typeof payload.paid_amount === "number" &&
    Number.isFinite(payload.paid_amount)
  ) {
    return payload.paid_amount >= payload.amount;
  }

  return payload.success === true && Boolean(payload.transaction_nsu);
}

function buildSnapshotFromProviderPayload({
  providerPaymentId,
  payload,
  fallbackAmountInCents,
  fallbackCheckoutUrl,
}: {
  providerPaymentId: string;
  payload: InfinitePayPaymentCheckResponse | InfinitePayWebhookPayload;
  fallbackAmountInCents?: number;
  fallbackCheckoutUrl?: string | null;
}): PaymentChargeSnapshot {
  const paid = hasPaidAmount(payload);
  const rawStatus = paid ? "PAID" : "PENDING";

  return {
    provider: INFINITEPAY_PROVIDER,
    providerPaymentId,
    providerRawStatus: rawStatus,
    providerReceiptUrl:
      typeof payload.receipt_url === "string" && payload.receipt_url.trim()
        ? payload.receipt_url
        : fallbackCheckoutUrl ?? null,
    providerDevMode: false,
    method: PaymentMethod.PIX,
    status: paid ? PaymentStatus.PAID : PaymentStatus.PENDING,
    amountInCents: toAmountInCents(payload.amount, fallbackAmountInCents),
    pixTransactionId:
      typeof payload.transaction_nsu === "string" && payload.transaction_nsu.trim()
        ? payload.transaction_nsu
        : null,
    pixQrCode: null,
    pixCopyPasteCode: fallbackCheckoutUrl ?? null,
    pixExpiresAt: null,
  };
}

export function getInfinitePayProviderName() {
  return INFINITEPAY_PROVIDER;
}

export function isInfinitePayConfigured() {
  return Boolean(getInfinitePayTag());
}

export async function createInfinitePayCheckoutCharge({
  amountInCents,
  reference,
  metadata,
}: CreatePixChargeInput) {
  const handle = getInfinitePayTag();

  if (!handle) {
    throw new Error("INFINITEPAY_TAG nao configurada.");
  }

  const body: Record<string, unknown> = {
    handle,
    items: [
      {
        quantity: 1,
        price: amountInCents,
        description: buildCheckoutDescription(reference, metadata),
      },
    ],
    order_nsu: reference,
    metadata: {
      reference,
      ...metadata,
    },
    webhook_url: buildWebhookUrl(),
    redirect_url: buildRedirectUrl(),
  };

  const response = await createCheckoutLink(body);
  const checkoutUrl = buildCheckoutUrl(response, handle);

  if (!checkoutUrl) {
    throw new Error("InfinitePay nao retornou uma URL de checkout.");
  }

  return {
    provider: INFINITEPAY_PROVIDER,
    providerPaymentId: reference,
    providerRawStatus:
      typeof response.status === "string" && response.status.trim()
        ? response.status
        : "CREATED",
    providerReceiptUrl: checkoutUrl,
    providerDevMode: false,
    method: PaymentMethod.PIX,
    status: PaymentStatus.PENDING,
    amountInCents,
    pixTransactionId:
      typeof response.slug === "string" && response.slug.trim()
        ? response.slug
        : null,
    pixQrCode: null,
    pixCopyPasteCode: checkoutUrl,
    pixExpiresAt: null,
  } satisfies PaymentChargeSnapshot;
}

export async function checkInfinitePayCheckoutCharge(
  providerPaymentId: string,
  fallbackAmountInCents?: number,
) {
  const handle = getInfinitePayTag();

  if (!handle) {
    throw new Error("INFINITEPAY_TAG nao configurada.");
  }

  try {
    const response = await fetch(PAYMENT_CHECK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        order_nsu: providerPaymentId,
      }),
      cache: "no-store",
    });

    const text = await response.text();
    const payload = text
      ? (JSON.parse(text) as InfinitePayPaymentCheckResponse)
      : {};

    if (!response.ok) {
      console.warn("[infinitepay] payment_check returned a non-OK response", {
        status: response.status,
        body: text,
      });

      return buildSnapshotFromProviderPayload({
        providerPaymentId,
        payload: { amount: fallbackAmountInCents, success: false },
        fallbackAmountInCents,
      });
    }

    return buildSnapshotFromProviderPayload({
      providerPaymentId,
      payload,
      fallbackAmountInCents,
    });
  } catch (error) {
    console.warn(
      "[infinitepay] payment_check failed; keeping payment pending",
      error instanceof Error ? error.message : String(error),
    );

    return buildSnapshotFromProviderPayload({
      providerPaymentId,
      payload: { amount: fallbackAmountInCents, success: false },
      fallbackAmountInCents,
    });
  }
}

export function verifyInfinitePayWebhook({
  secret,
}: {
  secret: string | null;
}) {
  const expectedSecret = getInfinitePayWebhookSecret();

  return !expectedSecret || secret === expectedSecret;
}

export function getInfinitePayWebhookReference(payload: InfinitePayWebhookPayload) {
  const metadataReference = payload.metadata?.reference;

  if (typeof payload.order_nsu === "string" && payload.order_nsu.trim()) {
    return payload.order_nsu.trim();
  }

  if (typeof metadataReference === "string" && metadataReference.trim()) {
    return metadataReference.trim();
  }

  return null;
}

export function getInfinitePayWebhookTransactionId(
  payload: InfinitePayWebhookPayload,
) {
  return typeof payload.transaction_nsu === "string" &&
    payload.transaction_nsu.trim()
    ? payload.transaction_nsu.trim()
    : null;
}

export function getInfinitePayWebhookAmountInCents(
  payload: InfinitePayWebhookPayload,
) {
  return typeof payload.amount === "number" && Number.isFinite(payload.amount)
    ? Math.round(payload.amount)
    : null;
}

export function getInfinitePayWebhookSnapshot({
  payload,
  providerPaymentId,
  fallbackAmountInCents,
}: {
  payload: InfinitePayWebhookPayload;
  providerPaymentId: string;
  fallbackAmountInCents: number;
}) {
  return buildSnapshotFromProviderPayload({
    providerPaymentId,
    payload,
    fallbackAmountInCents,
  });
}
