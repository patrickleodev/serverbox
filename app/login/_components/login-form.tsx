'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setStoredAdminSessionToken } from "@/app/_components/admin-session-storage";
import { FloatingInput } from "@/app/_components/floating-field";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    setError(null);

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as {
        sessionToken?: string;
        error?: string;
      };

      if (!response.ok || !payload.sessionToken) {
        setError(payload.error ?? "Credenciais inválidas.");
        return;
      }

      setStoredAdminSessionToken(payload.sessionToken);
      router.replace("/dashboard");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <FloatingInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="admin@servebox.local"
      />

      <FloatingInput
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Sua senha de admin"
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Entrando..." : "Entrar como admin"}
      </button>
    </form>
  );
}
