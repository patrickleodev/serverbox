import "reflect-metadata";
import "server-only";

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";
import ormConfigFile from "@/ormconfig.json";
import { AdministratorEntity } from "@/lib/db/entities/administrator.entity";
import { BallInventoryMovementEntity } from "@/lib/db/entities/ball-inventory-movement.entity";
import { CondominiumClientAccessEntity } from "@/lib/db/entities/condominium-client-access.entity";
import { CondominiumClientSessionEntity } from "@/lib/db/entities/condominium-client-session.entity";
import { CondominiumCourtEntity } from "@/lib/db/entities/condominium-court.entity";
import { CondominiumEntity } from "@/lib/db/entities/condominium.entity";
import { CondominiumPaymentEntity } from "@/lib/db/entities/condominium-payment.entity";
import { AdminSessionEntity } from "@/lib/db/entities/admin-session.entity";
import { SuggestionEntity } from "@/lib/db/entities/suggestion.entity";
import { TubeBrandEntity } from "@/lib/db/entities/tube-brand.entity";
import { seedDatabase } from "@/lib/db/seed";
import { getTubeStockEntries } from "@/lib/domain/tube-stock";
import { DataSource, type DataSourceOptions } from "typeorm";

declare global {
  var __serverboxDataSourceCache:
    | {
        version: string;
        promise: Promise<DataSource>;
      }
    | undefined;
}

const DATA_SOURCE_SCHEMA_VERSION = "2026-08-19-suggestions";

const entities = [
  AdministratorEntity,
  TubeBrandEntity,
  CondominiumEntity,
  CondominiumClientAccessEntity,
  CondominiumClientSessionEntity,
  CondominiumCourtEntity,
  CondominiumPaymentEntity,
  BallInventoryMovementEntity,
  AdminSessionEntity,
  SuggestionEntity,
];

type OrmConfig = {
  type?: "postgres" | "better-sqlite3";
  url?: string;
  database?: string;
  synchronize?: boolean;
  ssl?: {
    rejectUnauthorized?: boolean;
  };
};

function getOrmConfig() {
  return ormConfigFile as OrmConfig;
}

const ormConfig = getOrmConfig();

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.SUPABASE_DATABASE_URL?.trim() ||
    ormConfig.url?.trim()
  );
}

// Prefer sqlite during local development unless explicitly forced to use
// Postgres. This avoids accidentally using a production Postgres URL placed
// in `.env.local` and triggering concurrent Postgres queries during dev.
function resolveDatabaseUrlForEnvironment() {
  const url = getDatabaseUrl();

  if (!url) return undefined;

  const isDev = process.env.NODE_ENV !== "production" && !isVercelRuntime();

  if (isDev && process.env.FORCE_POSTGRES !== "true") {
    return undefined;
  }

  return url;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function isProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function getDatabasePath() {
  const databaseFilename = ormConfig.database ?? process.env.DB_FILENAME ?? "serverbox.sqlite";

  return isVercelRuntime()
    ? path.join("/tmp", "serverbox", databaseFilename)
    : path.join(process.cwd(), "data", databaseFilename);
}

async function resetLegacyDatabaseIfNeeded(databasePath: string) {
  let database: Database.Database | null = null;

  try {
    database = new Database(databasePath, { fileMustExist: true });
    const tableInfo = database
      .prepare("PRAGMA table_info('condominiums')")
      .all() as Array<{ name: string }>;
    const hasLegacySubscriptionsTable = Boolean(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'subscriptions'",
        )
        .get(),
    );
    const hasLegacyPlanTable = Boolean(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'plans'",
        )
        .get(),
    );
    const hasPaymentTable = Boolean(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'condominium_payments'",
        )
        .get(),
    );
    const hasInventoryTable = Boolean(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ball_inventory_movements'",
        )
        .get(),
    );
    const hasPrimaryAdminId = tableInfo.some(
      (column) => column.name === "primaryAdminId",
    );
    const paymentTableInfo = hasPaymentTable
      ? (database
          .prepare("PRAGMA table_info('condominium_payments')")
          .all() as Array<{ name: string }>)
      : [];
    const hasPixTransactionId = paymentTableInfo.some(
      (column) => column.name === "pixTransactionId",
    );
    const hasPixQrCode = paymentTableInfo.some(
      (column) => column.name === "pixQrCode",
    );
    const hasPixCopyPasteCode = paymentTableInfo.some(
      (column) => column.name === "pixCopyPasteCode",
    );
    const hasPixExpiresAt = paymentTableInfo.some(
      (column) => column.name === "pixExpiresAt",
    );
    const hasVerifiedAt = paymentTableInfo.some(
      (column) => column.name === "verifiedAt",
    );
    const hasVerificationSource = paymentTableInfo.some(
      (column) => column.name === "verificationSource",
    );
    const hasPlansColumnOnCondominiums = tableInfo.some(
      (column) => column.name === "plans",
    );
    const hasPlanId = paymentTableInfo.some((column) => column.name === "planId");
    const hasPlanName = paymentTableInfo.some((column) => column.name === "planName");

    database.close();
    database = null;

    if (
      hasLegacySubscriptionsTable ||
      hasLegacyPlanTable ||
      !hasPrimaryAdminId ||
      !hasPlansColumnOnCondominiums ||
      !hasPaymentTable ||
      !hasInventoryTable ||
      !hasPlanId ||
      !hasPlanName ||
      !hasPixTransactionId ||
      !hasPixQrCode ||
      !hasPixCopyPasteCode ||
      !hasPixExpiresAt ||
      !hasVerifiedAt ||
      !hasVerificationSource
    ) {
      await rm(databasePath, { force: true });
      await rm(`${databasePath}-journal`, { force: true });
    }
  } catch {
    if (database) {
      database.close();
    }
  }
}

function createDataSourceOptions(): DataSourceOptions {
  const databaseUrl = resolveDatabaseUrlForEnvironment();

  if (databaseUrl) {
    // For safety, only enable TypeORM `synchronize` for Postgres when an
    // explicit environment flag is set. This avoids TypeORM running
    // parallel schema-sync queries during app startup which can trigger
    // pg's deprecation warning when the DB client is reused concurrently.
    const allowSynchronize = process.env.TYPEORM_ALLOW_SYNCHRONIZE === "true";

    return {
      type: "postgres",
      url: databaseUrl,
      ssl: ormConfig.ssl ?? {
        rejectUnauthorized: false,
      },
      uuidExtension: "pgcrypto",
      synchronize: allowSynchronize && Boolean(ormConfig.synchronize),
      entities,
    };
  }

  return {
    type: "better-sqlite3",
    database: databaseUrl ?? getDatabasePath(),
    synchronize: ormConfig.synchronize ?? true,
    entities,
  };
}

async function ensurePostgresRuntimeSchema(dataSource: DataSource) {
  if (dataSource.options.type !== "postgres") {
    return;
  }

  await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS tube_brands (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name character varying NOT NULL UNIQUE,
      "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(`
    ALTER TABLE condominiums
    ADD COLUMN IF NOT EXISTS "tubeStockByBrand" text NOT NULL DEFAULT '[]'
  `);
  await dataSource.query(`
    ALTER TABLE condominiums
    ADD COLUMN IF NOT EXISTS "standalonePurchases" text NOT NULL DEFAULT '[]'
  `);
  await dataSource.query(`
    ALTER TABLE IF EXISTS condominium_payments
    ADD COLUMN IF NOT EXISTS "tubeBrandId" character varying
  `);
  await dataSource.query(`
    ALTER TABLE IF EXISTS condominium_payments
    ADD COLUMN IF NOT EXISTS "tubeBrandName" character varying
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS condominium_client_accesses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username character varying NOT NULL UNIQUE,
      "displayName" character varying,
      "passwordHash" character varying NOT NULL,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
      "condominiumId" uuid NOT NULL,
      CONSTRAINT "FK_condominium_client_accesses_condominium"
        FOREIGN KEY ("condominiumId")
        REFERENCES condominiums(id)
        ON DELETE CASCADE
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_client_accesses_condominium"
      ON condominium_client_accesses ("condominiumId")
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS condominium_client_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "accessId" uuid NOT NULL,
      "condominiumId" uuid NOT NULL,
      "expiresAt" timestamp without time zone NOT NULL,
      "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
      CONSTRAINT "FK_condominium_client_sessions_access"
        FOREIGN KEY ("accessId")
        REFERENCES condominium_client_accesses(id)
        ON DELETE CASCADE,
      CONSTRAINT "FK_condominium_client_sessions_condominium"
        FOREIGN KEY ("condominiumId")
        REFERENCES condominiums(id)
        ON DELETE CASCADE
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_client_sessions_access"
      ON condominium_client_sessions ("accessId")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_client_sessions_condominium"
      ON condominium_client_sessions ("condominiumId")
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS condominium_courts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name character varying NOT NULL,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
      "condominiumId" uuid NOT NULL,
      "tubeBrandId" uuid NOT NULL,
      CONSTRAINT "FK_condominium_courts_condominium"
        FOREIGN KEY ("condominiumId")
        REFERENCES condominiums(id)
        ON DELETE CASCADE,
      CONSTRAINT "FK_condominium_courts_tube_brand"
        FOREIGN KEY ("tubeBrandId")
        REFERENCES tube_brands(id)
        ON DELETE RESTRICT
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_courts_condominium"
      ON condominium_courts ("condominiumId")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_courts_tube_brand"
      ON condominium_courts ("tubeBrandId")
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS condominium_court_tube_brands (
      "courtId" uuid NOT NULL,
      "tubeBrandId" uuid NOT NULL,
      CONSTRAINT "PK_condominium_court_tube_brands"
        PRIMARY KEY ("courtId", "tubeBrandId"),
      CONSTRAINT "FK_condominium_court_tube_brands_court"
        FOREIGN KEY ("courtId")
        REFERENCES condominium_courts(id)
        ON DELETE CASCADE,
      CONSTRAINT "FK_condominium_court_tube_brands_tube_brand"
        FOREIGN KEY ("tubeBrandId")
        REFERENCES tube_brands(id)
        ON DELETE RESTRICT
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_court_tube_brands_court"
      ON condominium_court_tube_brands ("courtId")
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_condominium_court_tube_brands_tube_brand"
      ON condominium_court_tube_brands ("tubeBrandId")
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "residentName" character varying(120) NOT NULL,
      email character varying(254),
      "condominiumName" character varying(160) NOT NULL,
      message text NOT NULL,
      "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(`
    ALTER TABLE suggestions
      ADD COLUMN IF NOT EXISTS email character varying(254)
  `);
  await dataSource.query(`
    INSERT INTO condominium_court_tube_brands ("courtId", "tubeBrandId")
    SELECT id, "tubeBrandId"
    FROM condominium_courts
    WHERE "tubeBrandId" IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}

async function backfillCourtTubeBrands(dataSource: DataSource) {
  if (dataSource.options.type === "postgres") {
    await dataSource.query(`
      INSERT INTO condominium_court_tube_brands ("courtId", "tubeBrandId")
      SELECT id, "tubeBrandId"
      FROM condominium_courts
      WHERE "tubeBrandId" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    return;
  }

  await dataSource.query(`
    INSERT OR IGNORE INTO condominium_court_tube_brands ("courtId", "tubeBrandId")
    SELECT id, "tubeBrandId"
    FROM condominium_courts
    WHERE "tubeBrandId" IS NOT NULL
  `);
}

async function backfillCondominiumTubeStock(dataSource: DataSource) {
  const condominiumRepository = dataSource.getRepository(CondominiumEntity);
  const brandRepository = dataSource.getRepository(TubeBrandEntity);
  const condominiums = await condominiumRepository.find({
    relations: {
      courtDetails: {
        tubeBrand: true,
      },
    },
  });
  const defaultBrand = await brandRepository.findOne({
    where: {},
    order: {
      name: "ASC",
    },
  });

  for (const condominium of condominiums) {
    if (
      getTubeStockEntries(condominium.tubeStockByBrand).length > 0 ||
      !Number.isFinite(condominium.ballQuantity) ||
      condominium.ballQuantity <= 0
    ) {
      continue;
    }

    const sortedCourts = [...(condominium.courtDetails ?? [])].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
    const tubeBrand = sortedCourts[0]?.tubeBrand ?? defaultBrand;

    if (!tubeBrand) {
      continue;
    }

    condominium.tubeStockByBrand = [
      {
        tubeBrandId: tubeBrand.id,
        quantity: condominium.ballQuantity,
      },
    ];

    await condominiumRepository.save(condominium);
  }
}

async function createDataSource() {
  const databaseUrl = resolveDatabaseUrlForEnvironment();

  if (!databaseUrl) {
    if (isVercelRuntime() && !isProductionBuild()) {
      throw new Error(
        "DATABASE_URL nao configurada para o ambiente de producao. Configure a URL do Supabase para que o schema seja criado no banco correto.",
      );
    }

    const databasePath = getDatabasePath();
    await mkdir(path.dirname(databasePath), { recursive: true });
    await resetLegacyDatabaseIfNeeded(databasePath);
  }

  const initialize = async () => {
    const dataSource = new DataSource(createDataSourceOptions());

    await dataSource.initialize();
    await ensurePostgresRuntimeSchema(dataSource);
    await backfillCourtTubeBrands(dataSource);
    await backfillCondominiumTubeStock(dataSource);
    await seedDatabase(dataSource);

    return dataSource;
  };

  return initialize();
}

export async function getDataSource(): Promise<DataSource> {
  const cached = globalThis.__serverboxDataSourceCache;

  if (!cached || cached.version !== DATA_SOURCE_SCHEMA_VERSION) {
    if (cached) {
      cached.promise
        .then(async (dataSource) => {
          if (dataSource.isInitialized) {
            await dataSource.destroy();
          }
        })
        .catch(() => {
          return;
        });
    }

    globalThis.__serverboxDataSourceCache = {
      version: DATA_SOURCE_SCHEMA_VERSION,
      promise: createDataSource(),
    };
  }

  return globalThis.__serverboxDataSourceCache!.promise;
}
