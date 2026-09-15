'use server';

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedAdminFromFormData } from "@/lib/auth/session";
import { getDataSource } from "@/lib/db/data-source";
import { CondominiumPaymentEntity } from "@/lib/db/entities/condominium-payment.entity";
import {
  createCondominiumPayment,
  createManualSale,
  createStandaloneBallPaymentFromOffer,
  createStandaloneBallPayment,
  createStandalonePurchaseOffer,
} from "@/lib/payments/create-payment";

function parsePositiveInteger(value: FormDataEntryValue | null, fieldLabel: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new Error(`${fieldLabel} inválido.`);
  }

  return parsed;
}

function parseCurrencyToCents(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} inválido.`);
  }

  const digits = value.replace(/\D/g, "");
  const parsed = Number(digits);

  if (!digits || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} inválido.`);
  }

  return parsed;
}

function getPaymentGatewayConfigurationMessage(message: string) {
  if (message === "PAYMENT_DEFAULT_CUSTOMER_CELLPHONE nao configurado.") {
    return "Configure PAYMENT_DEFAULT_CUSTOMER_CELLPHONE no .env.local para criar cobrancas neste gateway.";
  }

  if (message === "PAYMENT_DEFAULT_CUSTOMER_TAX_ID nao configurado.") {
    return "Configure PAYMENT_DEFAULT_CUSTOMER_TAX_ID no .env.local para criar cobrancas neste gateway.";
  }

  if (
    message.includes("SANTANDER") ||
    message.includes("ABACATEPAY") ||
    message.includes("INFINITEPAY") ||
    message.includes("PAYMENT_PROVIDER")
  ) {
    return message;
  }

  return null;
}

function getPaymentActionError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const gatewayMessage = getPaymentGatewayConfigurationMessage(message);

  if (gatewayMessage) {
    return new Error(gatewayMessage);
  }

  if (message === "ABACATEPAY_DEFAULT_CUSTOMER_CELLPHONE não configurado.") {
    return new Error(
      "Configure ABACATEPAY_DEFAULT_CUSTOMER_CELLPHONE no .env.local para criar cobranças na AbacatePay.",
    );
  }

  if (message === "ABACATEPAY_DEFAULT_CUSTOMER_TAX_ID não configurado.") {
    return new Error(
      "Configure ABACATEPAY_DEFAULT_CUSTOMER_TAX_ID no .env.local para criar cobranças na AbacatePay.",
    );
  }

  if (message === "ABACATEPAY_API_BASE_URL inválida. Use uma URL da API v1 ou v2 da AbacatePay.") {
    return new Error(
      "A ABACATEPAY_API_BASE_URL do .env.local precisa apontar para uma URL válida da AbacatePay, como https://api.abacatepay.com/v1 ou https://api.abacatepay.com/v2.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export async function createPaymentAction(formData: FormData) {
  await requireAuthenticatedAdminFromFormData(formData);

  const planId = String(formData.get("planId") ?? "");
  const condominiumId = String(formData.get("condominiumId") ?? "");
  let paymentId = "";

  if (!planId) {
    throw new Error("Plano é obrigatório para criar pagamento.");
  }

  try {
    const payment = await createCondominiumPayment({
      planId,
      condominiumId: condominiumId || undefined,
    });

    paymentId = payment.id;
  } catch (error) {
    throw getPaymentActionError(error, "Falha ao criar plano mensal/anual.");
  }

  revalidatePath("/dashboard");
  if (condominiumId) {
    revalidatePath(`/condominio/${condominiumId}`);
  }
  redirect(`/pagamentos/${paymentId}`);
}

export async function togglePaymentArchiveAction(formData: FormData) {
  await requireAuthenticatedAdminFromFormData(formData);

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const isArchived = String(formData.get("isArchived") ?? "") === "true";

  if (!paymentId) {
    throw new Error("Cobrança inválida.");
  }

  const dataSource = await getDataSource();
  const paymentRepository = dataSource.getRepository(CondominiumPaymentEntity);
  const payment = await paymentRepository.findOne({
    where: { id: paymentId },
    relations: { condominium: true },
  });

  if (!payment) {
    throw new Error("Cobrança não encontrada.");
  }

  payment.isArchived = isArchived;
  await paymentRepository.save(payment);

  revalidatePath("/dashboard");
  revalidatePath(`/condominio/${payment.condominium.id}`);
}

export async function createStandalonePaymentAction(formData: FormData) {
  await requireAuthenticatedAdminFromFormData(formData);

  const condominiumId = String(formData.get("condominiumId") ?? "");
  const tubeBrandId = String(formData.get("tubeBrandId") ?? "");

  if (!condominiumId) {
    throw new Error("Condomínio é obrigatório para criar compra avulsa.");
  }

  if (!tubeBrandId) {
    throw new Error("Marca de tubos é obrigatória para criar compra avulsa.");
  }

  const ballQuantity = parsePositiveInteger(
    formData.get("ballQuantity"),
    "Quantidade de tubos",
  );
  const amountInCents = parseCurrencyToCents(
    formData.get("amountInCents"),
    "Valor",
  );
  let paymentId = "";

  try {
    const payment = await createStandaloneBallPayment({
      condominiumId,
      tubeBrandId,
      ballQuantity,
      amountInCents,
    });

    paymentId = payment.id;
  } catch (error) {
    throw getPaymentActionError(error, "Falha ao criar compra avulsa.");
  }

  revalidatePath("/dashboard");
  revalidatePath(`/condominio/${condominiumId}`);
  redirect(`/pagamentos/${paymentId}`);
}

export async function createManualSaleAction(formData: FormData) {
  await requireAuthenticatedAdminFromFormData(formData);

  const condominiumId = String(formData.get("condominiumId") ?? "");
  const tubeBrandId = String(formData.get("tubeBrandId") ?? "");
  const ballQuantity = parsePositiveInteger(
    formData.get("ballQuantity"),
    "Quantidade de tubos",
  );
  const amountInCents = parseCurrencyToCents(
    formData.get("amountInCents"),
    "Valor",
  );

  await createManualSale({
    condominiumId,
    tubeBrandId,
    ballQuantity,
    amountInCents,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/condominio/${condominiumId}`);
}

export async function createStandalonePurchaseAction(formData: FormData) {
  await requireAuthenticatedAdminFromFormData(formData);

  const condominiumId = String(formData.get("condominiumId") ?? "");
  const tubeBrandId = String(formData.get("tubeBrandId") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!condominiumId) {
    throw new Error("Condomínio é obrigatório para criar compra avulsa fixa.");
  }

  if (!tubeBrandId) {
    throw new Error("Marca de tubos é obrigatória para criar compra avulsa fixa.");
  }

  const ballQuantity = parsePositiveInteger(
    formData.get("ballQuantity"),
    "Quantidade de tubos",
  );
  const amountInCents = parseCurrencyToCents(
    formData.get("amountInCents"),
    "Valor",
  );
  let paymentId = "";

  try {
    const offer = await createStandalonePurchaseOffer({
      condominiumId,
      tubeBrandId,
      ballQuantity,
      amountInCents,
      name,
    });
    const payment = await createStandaloneBallPaymentFromOffer({
      condominiumId,
      standalonePurchaseId: offer.id,
    });

    paymentId = payment.id;
  } catch (error) {
    throw getPaymentActionError(
      error,
      "Falha ao criar compra avulsa fixa.",
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/condominio/${condominiumId}`);
  redirect(`/pagamentos/${paymentId}`);
}

export async function openStandalonePurchasePaymentAction(formData: FormData) {
  await requireAuthenticatedAdminFromFormData(formData);

  const condominiumId = String(formData.get("condominiumId") ?? "");
  const standalonePurchaseId = String(formData.get("standalonePurchaseId") ?? "");

  if (!condominiumId) {
    throw new Error("Condomínio é obrigatório para abrir compra avulsa fixa.");
  }

  if (!standalonePurchaseId) {
    throw new Error("Compra avulsa fixa é obrigatória para abrir QR Code.");
  }

  let paymentId = "";

  try {
    const payment = await createStandaloneBallPaymentFromOffer({
      condominiumId,
      standalonePurchaseId,
    });

    paymentId = payment.id;
  } catch (error) {
    throw getPaymentActionError(
      error,
      "Falha ao abrir compra avulsa fixa.",
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/condominio/${condominiumId}`);
  redirect(`/pagamentos/${paymentId}`);
}

