import {
  PaymentStatus,
  type CondominiumPayment,
} from "@/lib/db/entities/condominium-payment.entity";

export const STANDALONE_BALL_PURCHASE_PLAN_NAME = "Compra avulsa de tubos";
export const STANDALONE_PURCHASE_PAYMENT_PLAN_ID_PREFIX = "standalone-offer:";

type StockPayment = Pick<
  CondominiumPayment,
  | "id"
  | "planId"
  | "planName"
  | "status"
  | "isArchived"
  | "amountInCents"
  | "ballQuantity"
  | "tubeBrandId"
  | "tubeBrandName"
  | "pixExpiresAt"
  | "createdAt"
>;

export function isStandaloneBallPayment(
  payment: Pick<CondominiumPayment, "planId" | "planName">,
) {
  return (
    payment.planId?.startsWith("standalone-") ||
    payment.planName === STANDALONE_BALL_PURCHASE_PLAN_NAME
  );
}

export function buildStandalonePurchasePaymentPlanId({
  standalonePurchaseId,
  reference,
}: {
  standalonePurchaseId: string;
  reference: string;
}) {
  return `${STANDALONE_PURCHASE_PAYMENT_PLAN_ID_PREFIX}${standalonePurchaseId}:${reference}`;
}

export function getStandalonePurchaseIdFromPayment(
  payment: Pick<CondominiumPayment, "planId">,
) {
  if (!payment.planId?.startsWith(STANDALONE_PURCHASE_PAYMENT_PLAN_ID_PREFIX)) {
    return null;
  }

  const [, standalonePurchaseId] = payment.planId.split(":");

  return standalonePurchaseId || null;
}

export function hasPendingPaymentExpired(payment: Pick<StockPayment, "status" | "pixExpiresAt">) {
  return (
    payment.status === PaymentStatus.PENDING &&
    payment.pixExpiresAt !== null &&
    payment.pixExpiresAt.getTime() <= Date.now()
  );
}

export function isOpenPendingPayment(
  payment: Pick<StockPayment, "status" | "isArchived" | "pixExpiresAt">,
) {
  return (
    !payment.isArchived &&
    payment.status === PaymentStatus.PENDING &&
    !hasPendingPaymentExpired(payment)
  );
}

export function isStockCommitment(
  payment: Pick<StockPayment, "status" | "isArchived" | "pixExpiresAt">,
) {
  return payment.status === PaymentStatus.PAID || isOpenPendingPayment(payment);
}

export function sumCommittedBallQuantity(
  payments: StockPayment[],
  options: { exceptPaymentId?: string; tubeBrandId?: string } = {},
) {
  return payments
    .filter((payment) => payment.id !== options.exceptPaymentId)
    .filter((payment) =>
      options.tubeBrandId ? payment.tubeBrandId === options.tubeBrandId : true,
    )
    .filter(isStockCommitment)
    .reduce((total, payment) => total + payment.ballQuantity, 0);
}

export function sumPaidBallQuantity(payments: StockPayment[]) {
  return payments
    .filter((payment) => payment.status === PaymentStatus.PAID)
    .reduce((total, payment) => total + payment.ballQuantity, 0);
}

export function sumOpenPendingBallQuantity(payments: StockPayment[]) {
  return payments
    .filter(isOpenPendingPayment)
    .reduce((total, payment) => total + payment.ballQuantity, 0);
}

export function calculateRemainingBallStock({
  stockQuantity,
  payments,
  exceptPaymentId,
  tubeBrandId,
}: {
  stockQuantity: number;
  payments: StockPayment[];
  exceptPaymentId?: string;
  tubeBrandId?: string;
}) {
  const normalizedStock = Number.isFinite(stockQuantity)
    ? Math.max(0, stockQuantity)
    : 0;

  return Math.max(
    normalizedStock -
      sumCommittedBallQuantity(payments, { exceptPaymentId, tubeBrandId }),
    0,
  );
}

export function calculateStandalonePaymentCapacity({
  stockQuantity,
  payments,
  payment,
  tubeBrandId,
}: {
  stockQuantity: number;
  payments: StockPayment[];
  payment: StockPayment;
  tubeBrandId?: string;
}) {
  return calculateStandalonePaymentCapacityForQuantity({
    stockQuantity,
    payments,
    ballQuantity: payment.ballQuantity,
    exceptPaymentId: payment.id,
    tubeBrandId,
  });
}

export function calculateStandalonePaymentCapacityForQuantity({
  stockQuantity,
  payments,
  ballQuantity,
  exceptPaymentId,
  tubeBrandId,
}: {
  stockQuantity: number;
  payments: StockPayment[];
  ballQuantity: number;
  exceptPaymentId?: string;
  tubeBrandId?: string;
}) {
  if (!Number.isFinite(ballQuantity) || ballQuantity <= 0) {
    return 0;
  }

  const stockAvailableForThisPayment = calculateRemainingBallStock({
    stockQuantity,
    payments,
    exceptPaymentId,
    tubeBrandId,
  });

  return Math.floor(stockAvailableForThisPayment / ballQuantity);
}

export function findOpenStandaloneBallPayment(
  payments: StockPayment[],
  options: { tubeBrandId?: string; standalonePurchaseId?: string } = {},
) {
  return payments
    .filter(isStandaloneBallPayment)
    .filter((payment) =>
      options.tubeBrandId ? payment.tubeBrandId === options.tubeBrandId : true,
    )
    .filter((payment) =>
      options.standalonePurchaseId
        ? getStandalonePurchaseIdFromPayment(payment) === options.standalonePurchaseId
        : true,
    )
    .filter(isOpenPendingPayment)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}
