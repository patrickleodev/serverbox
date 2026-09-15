import "server-only";

import { randomUUID } from "node:crypto";

import { getDataSource } from "@/lib/db/data-source";
import {
  AdministratorEntity,
  type Administrator,
} from "@/lib/db/entities/administrator.entity";
import {
  AdminSessionEntity,
  type AdminSession,
} from "@/lib/db/entities/admin-session.entity";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

type SessionPayload = {
  adminId: string;
  expiresAt: number;
};

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

export async function createAdminSession(adminId: string) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const sessionToken = randomUUID();

  const dataSource = await getDataSource();
  const sessionRepository = dataSource.getRepository(AdminSessionEntity);

  await sessionRepository.save({
    id: sessionToken,
    adminId,
    expiresAt: new Date(expiresAt),
  } as AdminSession);

  return {
    sessionToken,
    expiresAt,
  };
}

export async function deleteAdminSession(sessionToken: string) {
  if (!sessionToken) {
    return;
  }

  const dataSource = await getDataSource();
  const sessionRepository = dataSource.getRepository(AdminSessionEntity);

  await sessionRepository.delete({ id: sessionToken });
}

export function getSessionTokenFromRequest(request: Request) {
  const authorizationHeader = request.headers.get("authorization") ?? "";

  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim() || null;
  }

  const customHeader = request.headers.get("x-servebox-session-token") ?? "";

  if (customHeader.trim()) {
    return customHeader.trim();
  }

  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("sessionToken")?.trim();

    return sessionToken || null;
  } catch {
    return null;
  }
}

export async function getAdminSessionFromToken(sessionToken: string | null | undefined) {
  if (!sessionToken) {
    return null;
  }

  const dataSource = await getDataSource();
  const sessionRepository = dataSource.getRepository(AdminSessionEntity);
  const session = await sessionRepository.findOneBy({ id: sessionToken });

  if (!session) {
    return null;
  }

  if (isExpired(session.expiresAt)) {
    await sessionRepository.delete({ id: sessionToken });
    return null;
  }

  return {
    adminId: session.adminId,
    expiresAt: session.expiresAt.getTime(),
  } satisfies SessionPayload;
}

export async function getAuthenticatedAdminFromToken(
  sessionToken: string | null | undefined,
): Promise<Administrator | null> {
  const session = await getAdminSessionFromToken(sessionToken);

  if (!session?.adminId) {
    return null;
  }

  const dataSource = await getDataSource();
  const administratorRepository = dataSource.getRepository(AdministratorEntity);

  return administratorRepository.findOneBy({ id: session.adminId });
}

export async function requireAuthenticatedAdminFromToken(
  sessionToken: string | null | undefined,
) {
  const administrator = await getAuthenticatedAdminFromToken(sessionToken);

  if (!administrator) {
    throw new Error("Não autenticado.");
  }

  return administrator;
}

export async function requireAuthenticatedAdminFromFormData(
  formData: FormData,
  fieldName = "sessionToken",
) {
  const sessionToken = String(formData.get(fieldName) ?? "").trim();

  return requireAuthenticatedAdminFromToken(sessionToken || null);
}
