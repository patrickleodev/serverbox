import "server-only";

import { getDataSource } from "@/lib/db/data-source";
import {
  CondominiumPaymentEntity,
  PaymentStatus,
  type CondominiumPayment,
} from "@/lib/db/entities/condominium-payment.entity";
import { syncPixPayment } from "@/lib/payments/settle-payment";

function hasPaymentExpired(payment: CondominiumPayment) {
  return (
    payment.status === PaymentStatus.PENDING &&
    payment.pixExpiresAt !== null &&
    payment.pixExpiresAt.getTime() <= Date.now()
  );
}

async function expirePaymentIfNeeded(payment: CondominiumPayment) {
  if (!hasPaymentExpired(payment)) {
    return payment;
  }

  const dataSource = await getDataSource();
  const paymentRepository = dataSource.getRepository(CondominiumPaymentEntity);

  payment.status = PaymentStatus.EXPIRED;

  return paymentRepository.save(payment);
}

export async function getPaymentDetails(paymentId: string) {
  const dataSource = await getDataSource();
  const paymentRepository = dataSource.getRepository(CondominiumPaymentEntity);

  const payment = await paymentRepository.findOne({
    where: { id: paymentId },
    relations: {
      condominium: true,
    },
  });

  if (!payment) {
    return null;
  }

  const syncedPayment =
    payment.status === PaymentStatus.PENDING && !payment.isArchived
      ? await syncPixPayment({ paymentId })
      : payment;
  const freshPayment = await expirePaymentIfNeeded(syncedPayment ?? payment);

  return {
    id: freshPayment.id,
    reference: freshPayment.reference,
    status: freshPayment.status,
    isArchived: freshPayment.isArchived,
    method: freshPayment.method,
    amountInCents: freshPayment.amountInCents,
    ballQuantity: freshPayment.ballQuantity,
    tubeBrandId: freshPayment.tubeBrandId,
    tubeBrandName: freshPayment.tubeBrandName,
    provider: freshPayment.provider,
    providerPaymentId: freshPayment.providerPaymentId,
    providerReceiptUrl: freshPayment.providerReceiptUrl,
    providerDevMode: freshPayment.providerDevMode,
    pixTransactionId: freshPayment.pixTransactionId,
    pixQrCode: freshPayment.pixQrCode,
    pixCopyPasteCode: freshPayment.pixCopyPasteCode,
    pixExpiresAt: freshPayment.pixExpiresAt,
    paidAt: freshPayment.paidAt,
    verifiedAt: freshPayment.verifiedAt,
    condominiumName: freshPayment.condominium.name,
    planName: freshPayment.planName || "Plano antigo",
  };
}
