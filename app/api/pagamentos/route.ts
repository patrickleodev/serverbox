import { getDataSource } from "@/lib/db/data-source";
import {
  CondominiumPaymentEntity,
  PaymentMethod,
  type CondominiumPayment,
} from "@/lib/db/entities/condominium-payment.entity";
import {
  createCondominiumPayment,
  createStandaloneBallPaymentFromOffer,
  createStandaloneBallPayment,
} from "@/lib/payments/create-payment";

type CreatePaymentPayload = {
  planId?: string;
  standalonePurchaseId?: string;
  condominiumId?: string;
  tubeBrandId?: string;
  ballQuantity?: number;
  amountInCents?: number;
  method?: string;
};

function isProviderConfigurationMessage(message: string) {
  return (
    message.includes("ABACATEPAY") ||
    message.includes("SANTANDER") ||
    message.includes("INFINITEPAY") ||
    message.includes("PAYMENT_") ||
    message.includes("certificado") ||
    message.includes("Chave privada")
  );
}

function normalizeErrorMessage(message: string) {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function GET() {
  const dataSource = await getDataSource();
  const paymentRepository = dataSource.getRepository(CondominiumPaymentEntity);

  const payments = await paymentRepository.find({
    relations: {
      condominium: true,
    },
    order: {
      createdAt: "DESC",
    },
  });

  return Response.json(
    payments.map((payment: CondominiumPayment) => ({
      id: payment.id,
      reference: payment.reference,
      status: payment.status,
      isArchived: payment.isArchived,
      method: payment.method,
      amountInCents: payment.amountInCents,
      ballQuantity: payment.ballQuantity,
      tubeBrandId: payment.tubeBrandId,
      tubeBrandName: payment.tubeBrandName,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      providerRawStatus: payment.providerRawStatus,
      providerReceiptUrl: payment.providerReceiptUrl,
      providerDevMode: payment.providerDevMode,
      pixTransactionId: payment.pixTransactionId,
      pixQrCode: payment.pixQrCode,
      pixCopyPasteCode: payment.pixCopyPasteCode,
      pixExpiresAt: payment.pixExpiresAt,
      paidAt: payment.paidAt,
      verifiedAt: payment.verifiedAt,
      verificationSource: payment.verificationSource,
      condominium: {
        id: payment.condominium.id,
        name: payment.condominium.name,
      },
      plan: {
        id: payment.planId,
        name: payment.planName,
      },
    })),
  );
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreatePaymentPayload;

  if (payload.method && payload.method !== PaymentMethod.PIX) {
    return Response.json(
      { error: "Somente pagamentos PIX sao suportados." },
      { status: 400 },
    );
  }

  try {
    const payment = payload.planId
      ? await createCondominiumPayment({
          planId: payload.planId,
          condominiumId: payload.condominiumId,
        })
      : payload.standalonePurchaseId
        ? await createStandaloneBallPaymentFromOffer({
            condominiumId: String(payload.condominiumId ?? ""),
            standalonePurchaseId: payload.standalonePurchaseId,
          })
        : await createStandaloneBallPayment({
            condominiumId: String(payload.condominiumId ?? ""),
            tubeBrandId: String(payload.tubeBrandId ?? ""),
            ballQuantity: Number(payload.ballQuantity),
            amountInCents: Number(payload.amountInCents),
          });

    return Response.json(payment, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar plano mensal/anual.";
    const normalizedMessage = normalizeErrorMessage(message);

    if (
      normalizedMessage === "plano nao encontrado." ||
      normalizedMessage === "plano nao pertence ao condominio informado." ||
      normalizedMessage === "condominio nao encontrado." ||
      normalizedMessage === "compra avulsa fixa nao encontrada." ||
      normalizedMessage === "pagamento avulso em aberto nao encontrado."
    ) {
      return Response.json({ error: message }, { status: 404 });
    }

    if (
      message.startsWith("Estoque insuficiente") ||
      normalizedMessage ===
        "estoque insuficiente para reutilizar o qr code avulso aberto deste condominio."
    ) {
      return Response.json({ error: message }, { status: 409 });
    }

    if (
      message === "Plano precisa ter uma quantidade de tubos maior que zero." ||
      message === "Referencia de pagamento invalida para o Santander. Use um txid alfanumerico de 26 a 35 caracteres."
    ) {
      return Response.json({ error: message }, { status: 400 });
    }

    if (isProviderConfigurationMessage(message)) {
      return Response.json({ error: message }, { status: 503 });
    }

    return Response.json({ error: message }, { status: 400 });
  }
}
