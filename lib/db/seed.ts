import { AdministratorEntity } from "@/lib/db/entities/administrator.entity";
import { hashPassword } from "@/lib/auth/password";
import {
  BallInventoryMovementEntity,
  BallMovementKind,
} from "@/lib/db/entities/ball-inventory-movement.entity";
import { CondominiumCourtEntity } from "@/lib/db/entities/condominium-court.entity";
import { CondominiumEntity } from "@/lib/db/entities/condominium.entity";
import {
  CondominiumPaymentEntity,
  PaymentMethod,
  PaymentStatus,
  PaymentVerificationSource,
  type CondominiumPayment,
} from "@/lib/db/entities/condominium-payment.entity";
import { TubeBrandEntity, type TubeBrand } from "@/lib/db/entities/tube-brand.entity";
import { PlanTier } from "@/lib/domain/condominium-plan";
import type { TubeStockEntry } from "@/lib/domain/tube-stock";
import { Like, type DataSource } from "typeorm";

const administratorSeed = {
  name: "Operação ServeBox",
  email: "admin@servebox.local",
};
const LEGACY_ADMIN_EMAIL = "admin@serverbox.local";

const DEV_SEED_REFERENCE_PREFIX = "dev-seed-";
const DEV_SEED_REASON_PREFIX = "DEV_SEED:";

const tubeBrandSeeds = ["Babolat", "Wilson"];

const developmentCondominiumSeeds = [
  {
    key: "aurora",
    name: "Condomínio Jardim Aurora",
    city: "São Paulo",
    state: "SP",
    courts: 3,
    courtBrandNames: ["Wilson", "Tecnifibre", "Wilson"],
    ballQuantity: 180,
    plans: [
      {
        id: "dev-plan-aurora-basic",
        slug: "aurora-basico",
        name: "Plano Básico Aurora",
        tier: PlanTier.BASIC,
        description: "Reposição mensal para quadras de uso moderado.",
        monthlyBallAllowance: 80,
        monthlyPriceInCents: 13990,
        overagePriceInCents: 169,
        isActive: true,
      },
      {
        id: "dev-plan-aurora-plus",
        slug: "aurora-plus",
        name: "Plano Plus Aurora",
        tier: PlanTier.INTERMEDIATE,
        description: "Mais bolas para picos de utilização durante torneios.",
        monthlyBallAllowance: 120,
        monthlyPriceInCents: 19990,
        overagePriceInCents: 159,
        isActive: true,
      },
    ],
  },
  {
    key: "bosque",
    name: "Condomínio Bosque das Quadras",
    city: "Campinas",
    state: "SP",
    courts: 2,
    courtBrandNames: ["Wilson", "Tecnifibre"],
    ballQuantity: 120,
    plans: [
      {
        id: "dev-plan-bosque-smart",
        slug: "bosque-smart",
        name: "Plano Smart Bosque",
        tier: PlanTier.BASIC,
        description: "Cobertura enxuta para operação diária das quadras.",
        monthlyBallAllowance: 60,
        monthlyPriceInCents: 10990,
        overagePriceInCents: 179,
        isActive: true,
      },
      {
        id: "dev-plan-bosque-premium",
        slug: "bosque-premium",
        name: "Plano Premium Bosque",
        tier: PlanTier.PREMIUM,
        description: "Foco em alta disponibilidade e reposição acelerada.",
        monthlyBallAllowance: 100,
        monthlyPriceInCents: 16990,
        overagePriceInCents: 149,
        isActive: true,
      },
    ],
  },
  {
    key: "mares",
    name: "Condomínio Pátio dos Mares",
    city: "Santos",
    state: "SP",
    courts: 4,
    courtBrandNames: ["Wilson", "Tecnifibre", "Wilson", "Tecnifibre"],
    ballQuantity: 240,
    plans: [
      {
        id: "dev-plan-mares-club",
        slug: "mares-club",
        name: "Plano Club Mares",
        tier: PlanTier.INTERMEDIATE,
        description: "Volume mensal para condomínios com agenda intensa.",
        monthlyBallAllowance: 140,
        monthlyPriceInCents: 22990,
        overagePriceInCents: 149,
        isActive: true,
      },
      {
        id: "dev-plan-mares-pro",
        slug: "mares-pro",
        name: "Plano Pro Mares",
        tier: PlanTier.PREMIUM,
        description: "Plano completo para múltiplas quadras com alta rotação.",
        monthlyBallAllowance: 180,
        monthlyPriceInCents: 27990,
        overagePriceInCents: 139,
        isActive: true,
      },
    ],
  },
];

const developmentPaymentSeeds = [
  {
    reference: "dev-seed-aurora-6m-paid",
    condominiumKey: "aurora",
    planId: "dev-plan-aurora-basic",
    status: PaymentStatus.PAID,
    amountInCents: 13990,
    ballQuantity: 80,
    monthOffset: -6,
    day: 7,
  },
  {
    reference: "dev-seed-aurora-4m-paid",
    condominiumKey: "aurora",
    planId: "dev-plan-aurora-plus",
    status: PaymentStatus.PAID,
    amountInCents: 19990,
    ballQuantity: 120,
    monthOffset: -4,
    day: 9,
  },
  {
    reference: "dev-seed-aurora-2m-pending",
    condominiumKey: "aurora",
    planId: "dev-plan-aurora-plus",
    status: PaymentStatus.PENDING,
    amountInCents: 19990,
    ballQuantity: 120,
    monthOffset: -2,
    day: 13,
  },
  {
    reference: "dev-seed-bosque-5m-paid",
    condominiumKey: "bosque",
    planId: "dev-plan-bosque-smart",
    status: PaymentStatus.PAID,
    amountInCents: 10990,
    ballQuantity: 60,
    monthOffset: -5,
    day: 12,
  },
  {
    reference: "dev-seed-bosque-3m-failed",
    condominiumKey: "bosque",
    planId: "dev-plan-bosque-premium",
    status: PaymentStatus.FAILED,
    amountInCents: 16990,
    ballQuantity: 100,
    monthOffset: -3,
    day: 5,
  },
  {
    reference: "dev-seed-bosque-1m-pending",
    condominiumKey: "bosque",
    planId: "dev-plan-bosque-premium",
    status: PaymentStatus.PENDING,
    amountInCents: 16990,
    ballQuantity: 100,
    monthOffset: -1,
    day: 17,
  },
  {
    reference: "dev-seed-mares-4m-paid",
    condominiumKey: "mares",
    planId: "dev-plan-mares-club",
    status: PaymentStatus.PAID,
    amountInCents: 22990,
    ballQuantity: 140,
    monthOffset: -4,
    day: 22,
  },
  {
    reference: "dev-seed-mares-2m-expired",
    condominiumKey: "mares",
    planId: "dev-plan-mares-pro",
    status: PaymentStatus.EXPIRED,
    amountInCents: 27990,
    ballQuantity: 180,
    monthOffset: -2,
    day: 3,
  },
  {
    reference: "dev-seed-mares-current-paid",
    condominiumKey: "mares",
    planId: "dev-plan-mares-pro",
    status: PaymentStatus.PAID,
    amountInCents: 27990,
    ballQuantity: 180,
    monthOffset: 0,
    day: 6,
  },
];

const developmentDebitMovements = [
  { condominiumKey: "aurora", quantity: 95, reason: "Consumo técnico de aulas e jogos livres" },
  { condominiumKey: "bosque", quantity: 45, reason: "Consumo de treino semanal" },
  { condominiumKey: "mares", quantity: 120, reason: "Consumo de torneio interno" },
];

function getSeedAdminPasswordHash() {
  const password = process.env.ADMIN_DEFAULT_PASSWORD?.trim() || "admin123456";

  return hashPassword(password);
}

async function seedTubeBrands(dataSource: DataSource) {
  const brandRepository = dataSource.getRepository(TubeBrandEntity);
  const brandByName = new Map<string, TubeBrand>();

  for (const name of tubeBrandSeeds) {
    const existingBrand = await brandRepository.findOneBy({ name });
    const brand = existingBrand ?? (await brandRepository.save({ name }));

    brandByName.set(brand.name, brand);
  }

  return brandByName;
}

function isDevelopmentSeedEnabled() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const seedMode = process.env.DEV_ALWAYS_SEED?.trim().toLowerCase();

  return seedMode !== "0" && seedMode !== "false";
}

function buildFixtureDate(monthOffset: number, day: number, hour = 10) {
  const now = new Date();
  const base = new Date(
    now.getFullYear(),
    now.getMonth() + monthOffset,
    1,
    hour,
    0,
    0,
    0,
  );
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(day, lastDay));

  return base;
}

async function seedDevelopmentDatabase(
  dataSource: DataSource,
  administratorId: string,
  brandByName: Map<string, TubeBrand>,
) {
  const condominiumRepository = dataSource.getRepository(CondominiumEntity);
  const courtRepository = dataSource.getRepository(CondominiumCourtEntity);
  const paymentRepository = dataSource.getRepository(CondominiumPaymentEntity);
  const movementRepository = dataSource.getRepository(BallInventoryMovementEntity);

  const devPayments = await paymentRepository.find({
    where: {
      reference: Like(`${DEV_SEED_REFERENCE_PREFIX}%`),
    },
  });

  if (devPayments.length > 0) {
    const paymentIds = devPayments.map((payment) => payment.id);

    await movementRepository
      .createQueryBuilder()
      .delete()
      .from("ball_inventory_movements")
      .where("paymentId IN (:...paymentIds)", { paymentIds })
      .execute();

    await paymentRepository.delete(paymentIds);
  }

  await movementRepository
    .createQueryBuilder()
    .delete()
    .from("ball_inventory_movements")
    .where("reason LIKE :seedPrefix", { seedPrefix: `${DEV_SEED_REASON_PREFIX}%` })
    .execute();

  const condominiumByKey = new Map<string, { id: string; plans: Array<{ id: string; name: string }> }>();

  function buildTubeStockByBrand(fixture: (typeof developmentCondominiumSeeds)[number]) {
    const brandNames = Array.from(new Set(fixture.courtBrandNames));

    if (brandNames.length === 0) {
      return [] satisfies TubeStockEntry[];
    }

    const baseQuantity = Math.floor(fixture.ballQuantity / brandNames.length);
    let remainingQuantity = fixture.ballQuantity % brandNames.length;

    return brandNames
      .map((brandName) => {
        const tubeBrand = brandByName.get(brandName);
        const quantity = baseQuantity + (remainingQuantity > 0 ? 1 : 0);
        remainingQuantity = Math.max(remainingQuantity - 1, 0);

        return tubeBrand
          ? {
              tubeBrandId: tubeBrand.id,
              quantity,
            }
          : null;
      })
      .filter((entry) => entry !== null);
  }

  for (const fixture of developmentCondominiumSeeds) {
    const existingCondominium = await condominiumRepository.findOne({
      where: {
        name: fixture.name,
        city: fixture.city,
        state: fixture.state,
      },
      relations: {
        primaryAdmin: true,
      },
    });

    const plans = fixture.plans.map((plan) => ({
      ...plan,
      createdByAdminId: administratorId,
      createdByName: administratorSeed.name,
    }));

    const condominium = await condominiumRepository.save({
      id: existingCondominium?.id,
      name: fixture.name,
      city: fixture.city,
      state: fixture.state,
      courts: fixture.courts,
      ballQuantity: fixture.ballQuantity,
      tubeStockByBrand: buildTubeStockByBrand(fixture),
      plans,
      primaryAdmin: {
        id: administratorId,
      },
    });

    await courtRepository
      .createQueryBuilder()
      .delete()
      .from("condominium_court_tube_brands")
      .where(
        '"courtId" IN (SELECT id FROM condominium_courts WHERE "condominiumId" = :condominiumId)',
        { condominiumId: condominium.id },
      )
      .execute();

    await courtRepository
      .createQueryBuilder()
      .delete()
      .from("condominium_courts")
      .where("condominiumId = :condominiumId", { condominiumId: condominium.id })
      .execute();

    await courtRepository.save(
      fixture.courtBrandNames.map((brandName, index) => {
        const tubeBrand = brandByName.get(brandName) ?? brandByName.values().next().value;

        if (!tubeBrand) {
          throw new Error("Nenhuma marca de tubos cadastrada para seed.");
        }

        return {
          name: `Quadra ${index + 1}`,
          sortOrder: index,
          condominium,
          tubeBrand,
          tubeBrands: [tubeBrand],
        };
      }),
    );

    condominiumByKey.set(fixture.key, condominium);
  }

  const savedPayments: CondominiumPayment[] = [];

  for (const fixture of developmentPaymentSeeds) {
    const condominium = condominiumByKey.get(fixture.condominiumKey);

    if (!condominium) {
      continue;
    }

    const plan = condominium.plans.find((entry) => entry.id === fixture.planId);

    if (!plan) {
      continue;
    }

    const createdAt = buildFixtureDate(fixture.monthOffset, fixture.day);
    const paidAt =
      fixture.status === PaymentStatus.PAID
        ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 18)
        : null;
    const isPending = fixture.status === PaymentStatus.PENDING;
    const isVerified = !isPending;

    const payment = await paymentRepository.save({
      condominium,
      planId: plan.id,
      planName: plan.name,
      reference: fixture.reference,
      method: PaymentMethod.PIX,
      status: fixture.status,
      amountInCents: fixture.amountInCents,
      ballQuantity: fixture.ballQuantity,
      provider: "abacatepay",
      providerPaymentId: `${fixture.reference}-provider`,
      providerRawStatus: fixture.status.toUpperCase(),
      providerReceiptUrl:
        fixture.status === PaymentStatus.PAID
          ? `https://sandbox.abacatepay.com/receipt/${fixture.reference}`
          : null,
      providerDevMode: true,
      pixTransactionId: `${fixture.reference}-pix`,
      pixQrCode: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${fixture.reference}`,
      pixCopyPasteCode: `00020126580014BR.GOV.BCB.PIX0136${fixture.reference}520400005303986540${String(
        (fixture.amountInCents / 100).toFixed(2),
      ).replace(".", "")}5802BR5909SERVEBOX6009SAOPAULO62070503***6304ABCD`,
      pixExpiresAt: isPending
        ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 72)
        : null,
      paidAt,
      verifiedAt: isVerified
        ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 24)
        : null,
      verificationSource: isVerified
        ? PaymentVerificationSource.STATUS_CHECK
        : null,
      createdAt,
      updatedAt: createdAt,
    });

    savedPayments.push(payment);
  }

  for (const payment of savedPayments) {
    if (payment.status !== PaymentStatus.PAID) {
      continue;
    }

    await movementRepository.save({
      condominium: payment.condominium,
      payment,
      kind: BallMovementKind.CREDIT,
      quantity: payment.ballQuantity,
      reason: `${DEV_SEED_REASON_PREFIX} Crédito liberado para ${payment.reference}`,
      createdAt: payment.paidAt ?? payment.createdAt,
    });
  }

  for (const debitFixture of developmentDebitMovements) {
    const condominium = condominiumByKey.get(debitFixture.condominiumKey);

    if (!condominium) {
      continue;
    }

    await movementRepository.save({
      condominium,
      payment: null,
      kind: BallMovementKind.DEBIT,
      quantity: debitFixture.quantity,
      reason: `${DEV_SEED_REASON_PREFIX} ${debitFixture.reason}`,
      createdAt: new Date(),
    });
  }
}

export async function seedDatabase(dataSource: DataSource) {
  const administratorRepository = dataSource.getRepository(AdministratorEntity);
  const brandByName = await seedTubeBrands(dataSource);

  let administrator = await administratorRepository.findOneBy({
    email: administratorSeed.email,
  });

  if (!administrator) {
    const legacyAdministrator = await administratorRepository.findOneBy({
      email: LEGACY_ADMIN_EMAIL,
    });

    if (legacyAdministrator) {
      legacyAdministrator.email = administratorSeed.email;
      administrator = await administratorRepository.save(legacyAdministrator);
    }
  }

  if (!administrator) {
    administrator = await administratorRepository.save({
      ...administratorSeed,
      passwordHash: getSeedAdminPasswordHash(),
    });
  } else if (!administrator.passwordHash) {
    administrator.passwordHash = getSeedAdminPasswordHash();
    administrator = await administratorRepository.save(administrator);
  }

  if (isDevelopmentSeedEnabled()) {
    await seedDevelopmentDatabase(dataSource, administrator.id, brandByName);
  }
}
