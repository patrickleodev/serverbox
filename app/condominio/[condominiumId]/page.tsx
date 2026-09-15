import Link from "next/link";
import { notFound } from "next/navigation";

import { CurrencyInput } from "@/app/_components/currency-input";
import { FloatingInput } from "@/app/_components/floating-field";
import { SessionTokenInput } from "@/app/_components/session-token-input";
import { SalesCharts } from "@/app/dashboard/[condominiumId]/_components/sales-charts";
import { SubmitButton } from "@/app/dashboard/_components/submit-button";
import {
  createPaymentAction,
  createManualSaleAction,
  createStandalonePurchaseAction,
  openStandalonePurchasePaymentAction,
  togglePaymentArchiveAction,
} from "@/app/dashboard/actions";
import { getAdminCondominiumDetails } from "@/lib/data/admin-dashboard";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export const dynamic = "force-dynamic";

export default async function CondominiumDashboardPage({
  params,
}: {
  params: Promise<{ condominiumId: string }>;
}) {
  const { condominiumId } = await params;
  const condominium = await getAdminCondominiumDetails(condominiumId);

  if (!condominium) {
    notFound();
  }

  const chartPayments = condominium.payments.map((payment) => ({
    id: payment.id,
    status: payment.status,
    planName: payment.planName,
    amountInCents: payment.amountInCents,
    ballQuantity: payment.ballQuantity,
    createdAt: payment.createdAt.toISOString(),
  }));
  const eligiblePlans = condominium.plans.filter(
    (plan) =>
      plan.monthlyBallAllowance > 0 &&
      plan.monthlyBallAllowance <= condominium.remainingBallStock,
  );
  const canCreatePayment = eligiblePlans.length > 0;
  const canCreateStandalonePayment =
    condominium.remainingBallStock > 0 && condominium.tubeStockByBrand.length > 0;
  const defaultTubeBrandId = condominium.tubeStockByBrand[0]?.tubeBrandId ?? "";
  const defaultStandaloneBallQuantity = 1;
  const defaultStandaloneAmountInCents = 500;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-10 lg:px-12">
      <section className="rounded-[1.5rem] border border-border bg-surface px-4 py-6 shadow-sm sm:px-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Dashboard do condomínio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {condominium.name}
          </h1>
          <p className="text-sm leading-7 text-slate-600">
            {condominium.city}, {condominium.state}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.25rem] border border-border bg-white p-5">
            <p className="text-sm text-slate-500">Estoque livre</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {condominium.availableBalls}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-white p-5">
            <p className="text-sm text-slate-500">Tubos vendidos</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {condominium.paidBalls}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-white p-5">
            <p className="text-sm text-slate-500">Faturamento confirmado</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {currencyFormatter.format(condominium.paidRevenueInCents / 100)}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-white p-5">
            <p className="text-sm text-slate-500">Estoque total</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {condominium.ballQuantity}
            </p>
          </div>
        </div>
        {condominium.tubeStockByBrand.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {condominium.tubeStockByBrand.map((entry) => (
              <span
                key={entry.tubeBrandId}
                className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {entry.tubeBrandName}: {entry.quantity} tubos
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <SalesCharts payments={chartPayments} />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">Quadras</h2>
            <div className="mt-5 space-y-3">
              {condominium.courtDetails.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                  Nenhuma quadra detalhada para este condomínio.
                </div>
              ) : (
                condominium.courtDetails.map((court) => (
                  <article
                    key={court.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-base font-semibold text-slate-900">
                      {court.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Marcas de tubos:{" "}
                      {court.tubeBrandNames?.length
                        ? court.tubeBrandNames.join(", ")
                        : court.tubeBrandName}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">Planos ativos</h2>
          <div className="mt-5 space-y-3">
            {condominium.plans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                Nenhum plano cadastrado para este condomínio.
              </div>
            ) : (
              condominium.plans.map((plan) => (
                <article
                  key={plan.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="text-base font-semibold text-slate-900">{plan.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {plan.monthlyBallAllowance} tubos/mês - {currencyFormatter.format(
                      plan.monthlyPriceInCents / 100,
                    )}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
        </div>

        <section className="rounded-[1.5rem] border border-border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Histórico de vendas</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Últimas transações do condomínio, com status e quantidade de tubos.
          </p>

          <div className="mt-5 space-y-3">
            {condominium.payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                Ainda não há vendas registradas para este condomínio.
              </div>
            ) : (
              condominium.payments.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{payment.reference}</p>
                      <p className="mt-1 text-sm text-slate-600">{payment.planName}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {currencyFormatter.format(payment.amountInCents / 100)} - {payment.ballQuantity} tubos
                        {payment.tubeBrandName ? ` - ${payment.tubeBrandName}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-3 text-right text-xs uppercase tracking-[0.18em] text-slate-500">
                      <p>{payment.isArchived ? "arquivada" : payment.status}</p>
                      <p className="mt-2 normal-case tracking-normal text-slate-600">
                        {dateFormatter.format(payment.createdAt)}
                      </p>
                      <form action={togglePaymentArchiveAction}>
                        <SessionTokenInput />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <input
                          type="hidden"
                          name="isArchived"
                          value={String(!payment.isArchived)}
                        />
                        <SubmitButton
                          idleLabel={payment.isArchived ? "Restaurar" : "Arquivar"}
                          pendingLabel="Salvando..."
                          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </form>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="rounded-[1.5rem] border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Cobranças
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Criar cobrança ou registrar venda
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            Use o checkout para pagamentos online ou registre vendas recebidas
            fora do QR Code.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <section className="rounded-[1.25rem] border border-border bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Compra avulsa fixa
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Cadastre valores recorrentes para vender tubos fora de um plano.
                </p>
              </div>
              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {condominium.standalonePurchases.length} salvas
              </span>
            </div>

            <form action={createStandalonePurchaseAction} className="mt-6 space-y-4">
              <SessionTokenInput />
              <input type="hidden" name="condominiumId" value={condominium.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <FloatingInput
                  label="Nome da compra"
                  name="name"
                  type="text"
                  placeholder="1 tubo - R$ 5"
                  className="bg-white"
                />
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Marca do tubo
                  </span>
                  <select
                    name="tubeBrandId"
                    disabled={!canCreateStandalonePayment}
                    defaultValue={defaultTubeBrandId}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  >
                    {condominium.tubeStockByBrand.length > 0 ? (
                      condominium.tubeStockByBrand.map((entry) => (
                        <option key={entry.tubeBrandId} value={entry.tubeBrandId}>
                          {entry.tubeBrandName} - {entry.quantity} tubos
                        </option>
                      ))
                    ) : (
                      <option value="">Sem marcas com estoque ativo</option>
                    )}
                  </select>
                </label>
                <FloatingInput
                  label="Quantidade de tubos"
                  name="ballQuantity"
                  type="number"
                  min={1}
                  max={condominium.remainingBallStock || undefined}
                  defaultValue={defaultStandaloneBallQuantity}
                  placeholder="Quantidade de tubos"
                  className="bg-white"
                />
                <CurrencyInput
                  label="Valor"
                  name="amountInCents"
                  defaultValueInCents={defaultStandaloneAmountInCents}
                  className="bg-white"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                {canCreateStandalonePayment
                  ? "A oferta fica salva para abrir novas cobranças com a mesma quantidade e valor."
                  : "Atualize o estoque real do condomínio com ao menos uma marca ativa para habilitar compra avulsa fixa."}
              </div>

              <SubmitButton
                idleLabel="Salvar e abrir QR Code"
                pendingLabel="Salvando..."
                disabled={!canCreateStandalonePayment}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </form>

            <div className="mt-6 space-y-3">
              {condominium.standalonePurchases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-white px-4 py-5 text-sm leading-7 text-slate-600">
                  Nenhuma compra avulsa fixa cadastrada para este condomínio.
                </div>
              ) : (
                condominium.standalonePurchases.map((offer) => (
                  <article
                    key={offer.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {offer.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {offer.tubeBrandName} - {offer.ballQuantity} tubos -{" "}
                          {currencyFormatter.format(offer.amountInCents / 100)}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {offer.availablePaymentCount > 0
                            ? `${offer.availablePaymentCount} cobrança(s) cabem no estoque`
                            : "Sem estoque disponível"}
                        </p>
                      </div>

                      {offer.openPaymentId ? (
                        <Link
                          href={`/pagamentos/${offer.openPaymentId}`}
                          className="inline-flex h-10 w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:w-auto"
                        >
                          Abrir QR Code
                        </Link>
                      ) : (
                        <form
                          action={openStandalonePurchasePaymentAction}
                          className="sm:min-w-40"
                        >
                          <SessionTokenInput />
                          <input
                            type="hidden"
                            name="condominiumId"
                            value={condominium.id}
                          />
                          <input
                            type="hidden"
                            name="standalonePurchaseId"
                            value={offer.id}
                          />
                          <SubmitButton
                            idleLabel="Gerar QR Code"
                            pendingLabel="Gerando..."
                            disabled={offer.availablePaymentCount <= 0}
                            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </form>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-border bg-slate-50 p-5">
            <h3 className="text-xl font-semibold text-slate-900">
              Venda manual
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Registre uma venda recebida fora do QR Code. Ela entra como paga e
              consome o estoque imediatamente.
            </p>

            <form action={createManualSaleAction} className="mt-6 space-y-4">
              <SessionTokenInput />
              <input type="hidden" name="condominiumId" value={condominium.id} />

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Marca do tubo
                </span>
                <select
                  name="tubeBrandId"
                  disabled={!canCreateStandalonePayment}
                  defaultValue={defaultTubeBrandId}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                >
                  {condominium.tubeStockByBrand.length > 0 ? (
                    condominium.tubeStockByBrand.map((entry) => (
                      <option key={entry.tubeBrandId} value={entry.tubeBrandId}>
                        {entry.tubeBrandName} - {entry.quantity} tubos
                      </option>
                    ))
                  ) : (
                    <option value="">Sem marcas com estoque ativo</option>
                  )}
                </select>
              </label>

              <FloatingInput
                label="Quantidade de tubos"
                name="ballQuantity"
                type="number"
                min={1}
                max={condominium.remainingBallStock || undefined}
                defaultValue={defaultStandaloneBallQuantity}
                placeholder="Quantidade de tubos"
                className="bg-white"
              />
              <CurrencyInput
                label="Valor recebido"
                name="amountInCents"
                defaultValueInCents={defaultStandaloneAmountInCents}
                className="bg-white"
              />

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                {canCreateStandalonePayment
                  ? "A venda será registrada como paga, sem criar checkout ou cobrança pendente."
                  : "Atualize o estoque real do condomínio para habilitar vendas manuais."}
              </div>

              <SubmitButton
                idleLabel="Registrar venda manual"
                pendingLabel="Registrando..."
                disabled={!canCreateStandalonePayment}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </form>
          </section>

          <section className="rounded-[1.25rem] border border-border bg-slate-50 p-5">
            <h3 className="text-xl font-semibold text-slate-900">
              Plano mensal/anual
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Escolha um plano já vinculado a este condomínio. A cobrança só é
              criada se a quantidade de tubos ainda couber no estoque livre.
            </p>

            <form action={createPaymentAction} className="mt-6 space-y-4">
              <SessionTokenInput />
              <input type="hidden" name="condominiumId" value={condominium.id} />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Plano</span>
                <select
                  name="planId"
                  disabled={!canCreatePayment}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  defaultValue={eligiblePlans[0]?.id ?? ""}
                >
                  {canCreatePayment ? (
                    eligiblePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - {plan.monthlyBallAllowance} tubos -{" "}
                        {currencyFormatter.format(plan.monthlyPriceInCents / 100)} -{" "}
                        {plan.availablePaymentCount} cobrança(s) cabem no estoque
                      </option>
                    ))
                  ) : (
                    <option value="">Sem planos habilitados para cobrança</option>
                  )}
                </select>
              </label>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                {canCreatePayment
                  ? "O checkout abre em seguida se o plano ainda couber no estoque real do condomínio."
                  : "Ajuste estoque ou cadastre um plano com tubos dentro do saldo livre."}
              </div>

              <SubmitButton
                idleLabel="Criar plano mensal/anual"
                pendingLabel="Criando..."
                disabled={!canCreatePayment}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
