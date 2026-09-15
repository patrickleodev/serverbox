import "server-only";

import { getDataSource } from "@/lib/db/data-source";
import {
  BallInventoryMovementEntity,
  BallMovementKind,
} from "@/lib/db/entities/ball-inventory-movement.entity";
import {
  CondominiumEntity,
  type Condominium,
} from "@/lib/db/entities/condominium.entity";
import {
  CondominiumPaymentEntity,
  PaymentStatus,
  type CondominiumPayment,
} from "@/lib/db/entities/condominium-payment.entity";
import { TubeBrandEntity } from "@/lib/db/entities/tube-brand.entity";
import { type CondominiumPlan } from "@/lib/domain/condominium-plan";
import {
  getStandalonePurchaseOffers,
  type StandalonePurchaseOffer,
} from "@/lib/domain/standalone-purchase";
import {
  getActiveTubeStockEntries,
  sumActiveTubeStockEntries,
  type TubeStockEntry,
} from "@/lib/domain/tube-stock";
import {
  calculateRemainingBallStock,
  calculateStandalonePaymentCapacity,
  calculateStandalonePaymentCapacityForQuantity,
  findOpenStandaloneBallPayment,
  isOpenPendingPayment,
  sumOpenPendingBallQuantity,
  sumPaidBallQuantity,
} from "@/lib/payments/stock";

function sumBallsByStatus(
  payments: CondominiumPayment[],
  status: PaymentStatus,
) {
  return payments
    .filter((payment) => payment.status === status)
    .reduce((total, payment) => total + payment.ballQuantity, 0);
}

function sumAmountByStatus(
  payments: CondominiumPayment[],
  status: PaymentStatus,
) {
  return payments
    .filter((payment) => payment.status === status)
    .reduce((total, payment) => total + payment.amountInCents, 0);
}

function buildCondominiumStockSummary(condominium: Condominium) {
  const openStandalonePayment = findOpenStandaloneBallPayment(condominium.payments);
  const stockQuantity = sumActiveTubeStockEntries(
    condominium.tubeStockByBrand,
    condominium.courtDetails,
    condominium.ballQuantity,
  );

  return {
    stockLimit: stockQuantity,
    paidBalls: sumPaidBallQuantity(condominium.payments),
    pendingBalls: sumOpenPendingBallQuantity(condominium.payments),
    remainingBalls: calculateRemainingBallStock({
      stockQuantity,
      payments: condominium.payments,
    }),
    openStandalonePayment,
    openStandalonePaymentCapacity: openStandalonePayment
      ? calculateStandalonePaymentCapacity({
          stockQuantity,
          payments: condominium.payments,
          payment: openStandalonePayment,
        })
      : 0,
  };
}

function getAvailableStandalonePurchaseCount({
  stockQuantity,
  tubeStockByBrand,
  payments,
  offer,
  exceptPaymentId,
}: {
  stockQuantity: number;
  tubeStockByBrand: Array<TubeStockEntry & { tubeBrandName?: string }>;
  payments: CondominiumPayment[];
  offer: StandalonePurchaseOffer;
  exceptPaymentId?: string;
}) {
  const brandStockQuantity =
    tubeStockByBrand.find((entry) => entry.tubeBrandId === offer.tubeBrandId)
      ?.quantity ?? 0;
  const availableByTotalStock = calculateStandalonePaymentCapacityForQuantity({
    stockQuantity,
    payments,
    ballQuantity: offer.ballQuantity,
    exceptPaymentId,
  });
  const availableByBrand = calculateStandalonePaymentCapacityForQuantity({
    stockQuantity: brandStockQuantity,
    payments,
    ballQuantity: offer.ballQuantity,
    exceptPaymentId,
    tubeBrandId: offer.tubeBrandId,
  });

  return Math.min(availableByTotalStock, availableByBrand);
}

function buildStandalonePurchaseSummaries({
  condominium,
  stockQuantity,
  tubeStockByBrand,
}: {
  condominium: Condominium;
  stockQuantity: number;
  tubeStockByBrand: Array<TubeStockEntry & { tubeBrandName?: string }>;
}) {
  return getStandalonePurchaseOffers(condominium.standalonePurchases)
    .filter((offer) => offer.isActive)
    .map((offer) => {
      const openPayment = findOpenStandaloneBallPayment(condominium.payments, {
        tubeBrandId: offer.tubeBrandId,
        standalonePurchaseId: offer.id,
      });
      const stockEntry = tubeStockByBrand.find(
        (entry) => entry.tubeBrandId === offer.tubeBrandId,
      );

      return {
        ...offer,
        tubeBrandName:
          stockEntry?.tubeBrandName ?? offer.tubeBrandName ?? "Marca selecionada",
        openPaymentId: openPayment?.id ?? null,
        availablePaymentCount: getAvailableStandalonePurchaseCount({
          stockQuantity,
          tubeStockByBrand,
          payments: condominium.payments,
          offer,
          exceptPaymentId: openPayment?.id,
        }),
      };
    });
}

export async function getAdminDashboardData() {
  const dataSource = await getDataSource();
  const condominiumRepository = dataSource.getRepository(CondominiumEntity);
  const paymentRepository = dataSource.getRepository(CondominiumPaymentEntity);
  const movementRepository = dataSource.getRepository(BallInventoryMovementEntity);
  const brandRepository = dataSource.getRepository(TubeBrandEntity);

  const condominiums = await condominiumRepository.find({
    relations: {
      primaryAdmin: true,
      courtDetails: { tubeBrand: true, tubeBrands: true },
      payments: true,
      ballMovements: { payment: true },
    },
    order: {
      createdAt: "ASC",
    },
  });

  const payments = await paymentRepository.find({
    relations: {
      condominium: true,
    },
    order: {
      createdAt: "DESC",
    },
  });

  const movements = await movementRepository.find({
    relations: {
      condominium: true,
      payment: true,
    },
    order: {
      createdAt: "DESC",
    },
  });

  const stockByCondominiumId = new Map(
    condominiums.map((condominium) => [
      condominium.id,
      buildCondominiumStockSummary(condominium),
    ]),
  );

  const allPlans = condominiums.flatMap((condominium) => {
    const stockSummary = stockByCondominiumId.get(condominium.id);
    const remainingBallStock = stockSummary?.remainingBalls ?? 0;

    return condominium.plans.map((plan: CondominiumPlan) => ({
      id: plan.id,
      name: plan.name,
      condominiumId: condominium.id,
      condominiumName: condominium.name,
      monthlyBallAllowance: plan.monthlyBallAllowance,
      monthlyPriceInCents: plan.monthlyPriceInCents,
      remainingBallStock,
      availablePaymentCount:
        plan.monthlyBallAllowance > 0
          ? Math.floor(remainingBallStock / plan.monthlyBallAllowance)
          : 0,
    }));
  });
  const tubeBrands = await brandRepository.find({
    order: {
      name: "ASC",
    },
  });

  const condominiumPerformance = condominiums.map((condominium) => ({
    id: condominium.id,
    name: condominium.name,
    paidBalls: sumBallsByStatus(condominium.payments, PaymentStatus.PAID),
    paidRevenueInCents: sumAmountByStatus(
      condominium.payments,
      PaymentStatus.PAID,
    ),
  }));

  const topCondominiumBySales = condominiumPerformance.reduce(
    (top, current) => {
      if (!top) {
        return current;
      }

      if (current.paidBalls > top.paidBalls) {
        return current;
      }

      if (
        current.paidBalls === top.paidBalls &&
        current.paidRevenueInCents > top.paidRevenueInCents
      ) {
        return current;
      }

      return top;
    },
    null as
      | (typeof condominiumPerformance)[number]
      | null,
  );

  const brandById = new Map(tubeBrands.map((brand) => [brand.id, brand]));

  return {
    summary: {
      totalAvailableBalls: condominiums.reduce(
        (total, condominium) =>
          total + (stockByCondominiumId.get(condominium.id)?.remainingBalls ?? 0),
        0,
      ),
      confirmedBalls: condominiums.reduce(
        (total, condominium) =>
          total + (stockByCondominiumId.get(condominium.id)?.paidBalls ?? 0),
        0,
      ),
      pendingBalls: condominiums.reduce(
        (total, condominium) =>
          total + (stockByCondominiumId.get(condominium.id)?.pendingBalls ?? 0),
        0,
      ),
      creditedBalls: movements
        .filter((movement) => movement.kind === BallMovementKind.CREDIT)
        .reduce((total, movement) => total + movement.quantity, 0),
      totalRevenueInCents: payments
        .filter((payment) => payment.status === PaymentStatus.PAID)
        .reduce((total, payment) => total + payment.amountInCents, 0),
      topCondominiumBySales,
    },
    plans: allPlans,
    condominiums: condominiums.map((condominium: Condominium) => {
      const stockSummary = stockByCondominiumId.get(condominium.id);
      const recentPayments = [...condominium.payments]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 3);
      const tubeStockByBrand = getActiveTubeStockEntries(
        condominium.tubeStockByBrand,
        condominium.courtDetails,
      )
        .map((entry) => {
          const tubeBrand = brandById.get(entry.tubeBrandId);

          return tubeBrand
            ? {
                ...entry,
                tubeBrandName: tubeBrand.name,
              }
            : null;
        })
        .filter((entry) => entry !== null);
      const stockQuantity = sumActiveTubeStockEntries(
        condominium.tubeStockByBrand,
        condominium.courtDetails,
        condominium.ballQuantity,
      );

      return {
        id: condominium.id,
        name: condominium.name,
        city: condominium.city,
        state: condominium.state,
        courts: condominium.courtDetails?.length || condominium.courts,
        courtDetails: [...(condominium.courtDetails ?? [])]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((court) => {
            const tubeBrands =
              court.tubeBrands && court.tubeBrands.length > 0
                ? court.tubeBrands
                : [court.tubeBrand];

            return {
              id: court.id,
              name: court.name,
              tubeBrandName: court.tubeBrand.name,
              tubeBrandNames: tubeBrands.map((brand) => brand.name),
            };
          }),
        ballQuantity: stockQuantity,
        tubeStockByBrand,
        administratorName: condominium.primaryAdmin.name,
        availableBalls: stockSummary?.remainingBalls ?? 0,
        remainingBallStock: stockSummary?.remainingBalls ?? 0,
        committedBalls:
          (stockSummary?.paidBalls ?? 0) + (stockSummary?.pendingBalls ?? 0),
        pendingBalls: stockSummary?.pendingBalls ?? 0,
        paidBalls: stockSummary?.paidBalls ?? 0,
        plans: condominium.plans.map((plan: CondominiumPlan) => ({
          id: plan.id,
          name: plan.name,
        })),
        standalonePurchases: buildStandalonePurchaseSummaries({
          condominium,
          stockQuantity,
          tubeStockByBrand,
        }).map((offer) => ({
          id: offer.id,
          name: offer.name,
          amountInCents: offer.amountInCents,
          ballQuantity: offer.ballQuantity,
          tubeBrandId: offer.tubeBrandId,
          tubeBrandName: offer.tubeBrandName,
          openPaymentId: offer.openPaymentId,
          availablePaymentCount: offer.availablePaymentCount,
        })),
        standalonePayment: stockSummary?.openStandalonePayment
          ? {
              id: stockSummary.openStandalonePayment.id,
              amountInCents: stockSummary.openStandalonePayment.amountInCents,
              ballQuantity: stockSummary.openStandalonePayment.ballQuantity,
              tubeBrandId: stockSummary.openStandalonePayment.tubeBrandId,
              tubeBrandName: stockSummary.openStandalonePayment.tubeBrandName,
              availablePaymentCount: stockSummary.openStandalonePaymentCapacity,
            }
          : null,
        recentPayments: recentPayments.map((payment) => ({
          id: payment.id,
          reference: payment.reference,
          status: payment.status,
          planName: payment.planName || "Plano antigo",
          ballQuantity: payment.ballQuantity,
          tubeBrandId: payment.tubeBrandId,
          tubeBrandName: payment.tubeBrandName,
          amountInCents: payment.amountInCents,
        })),
      };
    }),
    pendingPayments: payments
      .filter(isOpenPendingPayment)
      .map((payment: CondominiumPayment) => ({
        id: payment.id,
        reference: payment.reference,
        condominiumName: payment.condominium.name,
        planName: payment.planName || "Plano antigo",
        amountInCents: payment.amountInCents,
        ballQuantity: payment.ballQuantity,
        tubeBrandId: payment.tubeBrandId,
        tubeBrandName: payment.tubeBrandName,
        method: payment.method,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        pixExpiresAt: payment.pixExpiresAt,
        verifiedAt: payment.verifiedAt,
        providerDevMode: payment.providerDevMode,
      })),
  };
}

export async function getAdminCondominiumDetails(condominiumId: string) {
  const dataSource = await getDataSource();
  const condominiumRepository = dataSource.getRepository(CondominiumEntity);
  const brandRepository = dataSource.getRepository(TubeBrandEntity);

  const condominium = await condominiumRepository.findOne({
    where: { id: condominiumId },
    relations: {
      primaryAdmin: true,
      courtDetails: { tubeBrand: true, tubeBrands: true },
      payments: true,
      ballMovements: { payment: true },
    },
  });

  if (!condominium) {
    return null;
  }

  const tubeBrands = await brandRepository.find({
    order: {
      name: "ASC",
    },
  });

  const sortedPayments = [...condominium.payments].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
  const stockSummary = buildCondominiumStockSummary(condominium);
  const brandById = new Map(tubeBrands.map((brand) => [brand.id, brand]));
  const tubeStockByBrand = getActiveTubeStockEntries(
    condominium.tubeStockByBrand,
    condominium.courtDetails,
  )
    .map((entry) => {
      const tubeBrand = brandById.get(entry.tubeBrandId);

      return tubeBrand
        ? {
            ...entry,
            tubeBrandName: tubeBrand.name,
          }
        : null;
    })
    .filter((entry) => entry !== null);
  const stockQuantity = sumActiveTubeStockEntries(
    condominium.tubeStockByBrand,
    condominium.courtDetails,
    condominium.ballQuantity,
  );

  return {
    id: condominium.id,
    name: condominium.name,
    city: condominium.city,
    state: condominium.state,
    courts: condominium.courtDetails?.length || condominium.courts,
    courtDetails: [...(condominium.courtDetails ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((court) => {
        const tubeBrands =
          court.tubeBrands && court.tubeBrands.length > 0
            ? court.tubeBrands
            : [court.tubeBrand];

        return {
          id: court.id,
          name: court.name,
          tubeBrandName: court.tubeBrand.name,
          tubeBrandNames: tubeBrands.map((brand) => brand.name),
        };
      }),
    ballQuantity: stockQuantity,
    tubeStockByBrand,
    administratorName: condominium.primaryAdmin.name,
    availableBalls: stockSummary.remainingBalls,
    remainingBallStock: stockSummary.remainingBalls,
    committedBalls: stockSummary.paidBalls + stockSummary.pendingBalls,
    paidBalls: stockSummary.paidBalls,
    pendingBalls: stockSummary.pendingBalls,
    paidRevenueInCents: sumAmountByStatus(condominium.payments, PaymentStatus.PAID),
    pendingRevenueInCents: sumAmountByStatus(
      condominium.payments,
      PaymentStatus.PENDING,
    ),
    plans: condominium.plans.map((plan: CondominiumPlan) => ({
      id: plan.id,
      name: plan.name,
      monthlyBallAllowance: plan.monthlyBallAllowance,
      monthlyPriceInCents: plan.monthlyPriceInCents,
      availablePaymentCount:
        plan.monthlyBallAllowance > 0
          ? Math.floor(stockSummary.remainingBalls / plan.monthlyBallAllowance)
          : 0,
    })),
    standalonePurchases: buildStandalonePurchaseSummaries({
      condominium,
      stockQuantity,
      tubeStockByBrand,
    }).map((offer) => ({
      id: offer.id,
      name: offer.name,
      amountInCents: offer.amountInCents,
      ballQuantity: offer.ballQuantity,
      tubeBrandId: offer.tubeBrandId,
      tubeBrandName: offer.tubeBrandName,
      openPaymentId: offer.openPaymentId,
      availablePaymentCount: offer.availablePaymentCount,
    })),
    standalonePayment: stockSummary.openStandalonePayment
      ? {
          id: stockSummary.openStandalonePayment.id,
          amountInCents: stockSummary.openStandalonePayment.amountInCents,
      ballQuantity: stockSummary.openStandalonePayment.ballQuantity,
      tubeBrandId: stockSummary.openStandalonePayment.tubeBrandId,
      tubeBrandName: stockSummary.openStandalonePayment.tubeBrandName,
      availablePaymentCount: stockSummary.openStandalonePaymentCapacity,
        }
      : null,
    payments: sortedPayments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      status: payment.status,
      isArchived: payment.isArchived,
      planName: payment.planName || "Plano antigo",
      amountInCents: payment.amountInCents,
      ballQuantity: payment.ballQuantity,
      tubeBrandId: payment.tubeBrandId,
      tubeBrandName: payment.tubeBrandName,
      createdAt: payment.createdAt,
    })),
  };
}
