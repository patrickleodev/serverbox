import type { Metadata } from "next";
import Link from "next/link";

import { SuggestionForm } from "@/app/sugestoes/_components/suggestion-form";

export const metadata: Metadata = {
  title: "Sugestões | ServeBox",
  description:
    "Envie sugestões para melhorar a experiência ServeBox no seu condomínio.",
};

export default function SugestoesPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-12">
      <section className="flex flex-col justify-center">
        <div className="inline-flex w-max rounded-full border border-border bg-surface-strong px-4 py-2 text-sm font-medium text-slate-700">
          Sugestões
        </div>

        <div className="mt-7 max-w-2xl space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Conte o que deixaria a ServeBox melhor para o seu condomínio.
          </h1>
          <p className="text-base leading-8 text-slate-600 sm:text-lg">
            Sua ideia fica registrada para a equipe avaliar melhorias no serviço,
            na reposição dos tubos e na experiência de uso das quadras.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/sobre-nos"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          >
            Voltar para Sobre nós
          </Link>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Enviar sugestão
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Preencha os dados abaixo para registrar sua mensagem.
          </p>
        </div>

        <SuggestionForm />
      </section>
    </main>
  );
}
