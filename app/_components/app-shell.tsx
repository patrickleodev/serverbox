'use client';

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  clearStoredAdminSessionToken,
  clearStoredAdminSessionTokenIfCurrent,
  useClientHydrated,
  useStoredAdminSessionToken,
} from "@/app/_components/admin-session-storage";
import { AppSidebar } from "@/app/_components/app-sidebar";

type AppShellProps = {
  children: React.ReactNode;
  condominiums: Array<{
    id: string;
    name: string;
  }>;
};

const hiddenSidebarPaths = ["/login", "/cliente/login"];

const publicPaths = ["/", "/login", "/sobre-nos", "/sugestoes"];

type SessionState = "checking" | "authenticated" | "public";

function shouldHideSidebar(pathname: string) {
  return (
    hiddenSidebarPaths.includes(pathname) ||
    pathname.startsWith("/cliente") ||
    pathname.startsWith("/pagamentos")
  );
}

function isPublicPath(pathname: string) {
  return (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/cliente") ||
    pathname.startsWith("/pagamentos")
  );
}

export function AppShell({ children, condominiums }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isClientHydrated = useClientHydrated();
  const sessionToken = useStoredAdminSessionToken();
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  useEffect(() => {
    let cancelled = false;
    const publicPath = isPublicPath(pathname);
    const validatedSessionToken = sessionToken;

    async function clearServerSession(tokenToClear: string) {
      if (tokenToClear) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionToken: tokenToClear }),
        }).catch(() => undefined);
      }
    }

    async function clearSessionAndRedirect(message: string) {
      await clearServerSession(validatedSessionToken);

      if (validatedSessionToken) {
        clearStoredAdminSessionTokenIfCurrent(validatedSessionToken);
      } else {
        clearStoredAdminSessionToken();
      }

      if (!cancelled) {
        window.alert(message);
        router.replace("/login");
      }
    }

    async function clearSessionAndShowPublicPage() {
      await clearServerSession(validatedSessionToken);
      clearStoredAdminSessionTokenIfCurrent(validatedSessionToken);

      if (!cancelled) {
        setSessionState("public");
      }
    }

    async function validateSession() {
      if (!isClientHydrated) {
        setSessionState("checking");
        return;
      }

      if (!sessionToken) {
        if (publicPath) {
          setSessionState("public");
          return;
        }

        await clearSessionAndRedirect(
          "Sua sessao administrativa nao foi encontrada. Faca login novamente.",
        );
        return;
      }

      setSessionState("checking");

      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        headers: {
          "x-servebox-session-token": sessionToken,
        },
      }).catch(() => null);

      if (!response?.ok) {
        if (publicPath) {
          await clearSessionAndShowPublicPage();
          return;
        }

        await clearSessionAndRedirect(
          "Sua sessao administrativa expirou ou nao e mais valida. Faca login novamente.",
        );
        return;
      }

      if (cancelled) {
        return;
      }

      if (pathname === "/login") {
        router.replace("/dashboard");
        return;
      }

      setSessionState("authenticated");
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [isClientHydrated, pathname, router, sessionToken]);

  if (sessionState === "checking") {
    return null;
  }

  if (sessionState === "public") {
    return <>{children}</>;
  }

  if (shouldHideSidebar(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <AppSidebar condominiums={condominiums} />
      <div className="min-w-0 lg:pl-[21rem]">{children}</div>
    </div>
  );
}
