import "reflect-metadata";

import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DataSource, type DataSourceOptions } from "typeorm";

import { AdminSessionEntity } from "../lib/db/entities/admin-session.entity";
import { AdministratorEntity } from "../lib/db/entities/administrator.entity";
import { BallInventoryMovementEntity } from "../lib/db/entities/ball-inventory-movement.entity";
import { CondominiumClientAccessEntity } from "../lib/db/entities/condominium-client-access.entity";
import { CondominiumClientSessionEntity } from "../lib/db/entities/condominium-client-session.entity";
import { CondominiumCourtEntity } from "../lib/db/entities/condominium-court.entity";
import { CondominiumPaymentEntity } from "../lib/db/entities/condominium-payment.entity";
import { CondominiumEntity } from "../lib/db/entities/condominium.entity";
import { SuggestionEntity } from "../lib/db/entities/suggestion.entity";
import { TubeBrandEntity } from "../lib/db/entities/tube-brand.entity";

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
const DEFAULT_ADMIN_NAME = "Operacao ServeBox";
const DEFAULT_ADMIN_EMAIL = "admin@servebox.local";
const LEGACY_ADMIN_EMAIL = "admin@serverbox.local";
const DEFAULT_TUBE_BRANDS = ["Wilson", "Tecnifibre"];
const KEY_LENGTH = 64;

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.SUPABASE_DATABASE_URL?.trim()
  );
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${salt}:${hash}`;
}

async function seedMinimumProductionData(dataSource: DataSource) {
  const administratorRepository = dataSource.getRepository(AdministratorEntity);
  const brandRepository = dataSource.getRepository(TubeBrandEntity);
  const adminEmail =
    process.env.ADMIN_DEFAULT_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
  const adminName =
    process.env.ADMIN_DEFAULT_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD?.trim();

  for (const brandName of DEFAULT_TUBE_BRANDS) {
    const existingBrand = await brandRepository.findOneBy({ name: brandName });

    if (!existingBrand) {
      await brandRepository.save({ name: brandName });
    }
  }

  const existingAdministrator = await administratorRepository.findOneBy({
    email: adminEmail,
  });

  if (existingAdministrator) {
    return;
  }

  const legacyAdministrator = await administratorRepository.findOneBy({
    email: LEGACY_ADMIN_EMAIL,
  });

  if (legacyAdministrator) {
    legacyAdministrator.email = adminEmail;
    await administratorRepository.save(legacyAdministrator);
    return;
  }

  if (!adminPassword) {
    throw new Error(
      "ADMIN_DEFAULT_PASSWORD must be configured to create the initial administrator.",
    );
  }

  await administratorRepository.save({
    name: adminName,
    email: adminEmail,
    passwordHash: hashPassword(adminPassword),
  });
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.production.local"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  if (process.env.CONFIRM_SCHEMA_SYNC !== "true") {
    throw new Error("Set CONFIRM_SCHEMA_SYNC=true to synchronize the schema.");
  }

  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, SUPABASE_DB_URL, or SUPABASE_DATABASE_URL must be configured.",
    );
  }

  if (!databaseUrl.startsWith("postgres")) {
    throw new Error("Production schema sync only supports Postgres URLs.");
  }

  const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    synchronize: true,
    uuidExtension: "pgcrypto",
    entities,
  };
  const dataSource = new DataSource(dataSourceOptions);

  try {
    console.log("Connecting to Postgres...");
    await dataSource.initialize();
    console.log("Schema synchronized.");

    console.log("Running minimum seed...");
    await seedMinimumProductionData(dataSource);
    console.log("Minimum seed completed.");
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
