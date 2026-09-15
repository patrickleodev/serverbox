'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LogoutButton } from "@/app/_components/logout-button";
import { ThemeSwitcher } from "@/app/_components/theme-switcher";

const navigationItems = [
  { href: "/dashboard", label: "Visão geral", icon: DashboardIcon },
  { href: "/sobre-nos", label: "Sobre nós", icon: InfoIcon },
  { href: "/sugestoes", label: "Sugestões", icon: FeedbackIcon },
];

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 4.5h6v6h-6v-6Zm9 0h6v10h-6v-10Zm-9 9h6v6h-6v-6Zm9 4h6v2h-6v-2Z" />
    </svg>
  );
}

function BuildingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 20.5V6.5l7-2v16m0 0h-7m7 0h8m-2-10v10m-7-10h7m-5 3h1m-1 3h1m-4-3h1m-1 3h1" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10.5v5m0-9v.01" />
    </svg>
  );
}

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17H9l-4.5 3.5V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8.5 10h7m-7 3h4.5" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 4.5h3a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3" />
      <path d="M9 16.5 4.5 12 9 7.5" />
      <path d="M4.5 12h10.5" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6.75 9.75 5.25 5.25 5.25-5.25" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3.25-6.92" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

type AppSidebarProps = {
  condominiums: Array<{
    id: string;
    name: string;
  }>;
};

export function AppSidebar({ condominiums }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isRefreshing, startRefreshing] = useTransition();
  const [isCondominiumOpenOverride, setIsCondominiumOpenOverride] = useState<
    boolean | null
  >(null);

  const isCondominiumSectionActive =
    pathname.startsWith("/condominio/") || pathname === "/gerenciar-condominios";
  const isCondominiumOpen =
    isCondominiumOpenOverride ?? isCondominiumSectionActive;

  const toggleCondominiumOpen = () => {
    setIsCondominiumOpenOverride(!isCondominiumOpen);
  };

  const refreshData = () => {
    startRefreshing(() => {
      router.refresh();
    });
  };

  return (
    <>
      <aside className="app-sidebar hidden lg:fixed lg:top-4 lg:bottom-4 lg:left-4 lg:z-30 lg:flex lg:w-[18.5rem] lg:flex-col lg:gap-6 lg:overflow-y-auto lg:rounded-[1.75rem] lg:border lg:border-border lg:bg-white/90 lg:px-5 lg:py-6 lg:backdrop-blur">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            ServeBox
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Navegação
          </h2>
        </div>

        <ThemeSwitcher />

        <button
          type="button"
          onClick={refreshData}
          disabled={isRefreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshIcon className="size-4 shrink-0" />
          {isRefreshing ? "Atualizando..." : "Atualizar dados"}
        </button>

        <nav className="flex flex-col gap-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-[1rem] border px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border-amber-200 bg-amber-100 text-amber-950"
                    : "border-border bg-surface text-slate-700 hover:border-slate-900 hover:text-slate-900"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="rounded-[1rem] border border-border bg-surface p-1">
            <button
              type="button"
              onClick={toggleCondominiumOpen}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-[0.8rem] px-3 py-2 text-sm font-medium transition ${
                isCondominiumSectionActive
                  ? "bg-amber-100 text-amber-950"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
              aria-expanded={isCondominiumOpen}
              aria-controls="sidebar-condominiums-list"
            >
              <BuildingsIcon className="size-4 shrink-0" />
              <span className="flex-1 text-left">Condomínios</span>
              <ChevronDownIcon
                className={`size-4 shrink-0 transition ${isCondominiumOpen ? "rotate-180" : "rotate-0"}`}
              />
            </button>

            {isCondominiumOpen ? (
              <div
                id="sidebar-condominiums-list"
                className="mt-1 space-y-1 px-1 pb-1"
              >
                <Link
                  href="/gerenciar-condominios"
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    pathname === "/gerenciar-condominios"
                      ? "bg-amber-50 text-amber-900"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  Gerenciar condomínios
                </Link>

                {condominiums.length === 0 ? (
                  <p className="rounded-lg px-3 py-2 text-xs text-slate-500">
                    Nenhum condomínio disponível.
                  </p>
                ) : (
                  condominiums.map((condominium) => {
                    const condominiumHref = `/condominio/${condominium.id}`;
                    const isCondominiumActive = pathname === condominiumHref;

                    return (
                      <Link
                        key={condominium.id}
                        href={condominiumHref}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          isCondominiumActive
                            ? "bg-amber-50 text-amber-900"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {condominium.name}
                      </Link>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </nav>

        <LogoutButton className="mt-auto inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500" />
      </aside>

      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-10">
          <ThemeSwitcher compact />

          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-amber-200 bg-amber-100 text-amber-950"
                    : "border-border bg-white text-slate-700"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={toggleCondominiumOpen}
              className={`inline-flex h-[2.625rem] cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                isCondominiumSectionActive
                  ? "border-amber-200 bg-amber-100 text-amber-950"
                  : "border-border bg-white text-slate-700"
              }`}
              aria-expanded={isCondominiumOpen}
              aria-controls="mobile-condominiums-list"
            >
              <BuildingsIcon className="size-4 shrink-0" />
              Condomínios
              <ChevronDownIcon
                className={`size-4 shrink-0 transition ${isCondominiumOpen ? "rotate-180" : "rotate-0"}`}
              />
            </button>

            {isCondominiumOpen ? (
              <div
                id="mobile-condominiums-list"
                className="absolute left-0 top-[3.1rem] z-30 min-w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
              >
                <Link
                  href="/gerenciar-condominios"
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    pathname === "/gerenciar-condominios"
                      ? "bg-amber-50 text-amber-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  Gerenciar condomínios
                </Link>

                {condominiums.length === 0 ? (
                  <p className="rounded-lg px-3 py-2 text-xs text-slate-500">
                    Nenhum condomínio disponível.
                  </p>
                ) : (
                  condominiums.map((condominium) => {
                    const condominiumHref = `/condominio/${condominium.id}`;
                    const isCondominiumActive = pathname === condominiumHref;

                    return (
                      <Link
                        key={condominium.id}
                        href={condominiumHref}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          isCondominiumActive
                            ? "bg-amber-50 text-amber-900"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {condominium.name}
                      </Link>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={refreshData}
            disabled={isRefreshing}
            className="inline-flex h-[2.625rem] items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon className="size-4 shrink-0" />
            {isRefreshing ? "Atualizando..." : "Atualizar"}
          </button>

          <LogoutButton className="inline-flex h-[2.625rem] cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
            <LogoutIcon className="size-4 shrink-0" />
            Sair
          </LogoutButton>
        </div>
      </div>
    </>
  );
}
