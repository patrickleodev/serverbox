'use client';

import { useEffect, useMemo, useState } from "react";

type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

type PaymentDetails = {
  id: string;
  reference: string;
  status: PaymentStatus;
  isArchived: boolean;
  amountInCents: number;
  ballQuantity: number;
  tubeBrandId: string | null;
  tubeBrandName: string | null;
  provider: string | null;
  providerPaymentId: string | null;
  providerReceiptUrl: string | null;
  providerDevMode: boolean | null;
  pixCopyPasteCode: string | null;
  pixExpiresAt: string | null;
  paidAt: string | null;
  condominiumName: string;
  planName: string;
};

type PaymentStatusPanelProps = {
  initialPayment: PaymentDetails;
};

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  failed: "Pagamento falhou",
  expired: "PIX expirado",
  refunded: "Pagamento estornado",
};

export function PaymentStatusPanel({
  initialPayment,
}: PaymentStatusPanelProps) {
  const [payment, setPayment] = useState(initialPayment);
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const checkoutUrl =
    payment.provider === "infinitepay"
      ? payment.providerReceiptUrl ?? payment.pixCopyPasteCode
      : null;
  const paymentCodeValue = checkoutUrl ?? payment.pixCopyPasteCode;
  const paymentCodeLabel = checkoutUrl ? "Link de checkout" : "Código cópia e cola";
  const copyButtonLabel = checkoutUrl ? "Copiar link" : "Copiar código";
  const canSimulatePayment =
    payment.provider === "abacatepay" && Boolean(payment.providerDevMode);

  useEffect(() => {
    if (payment.status !== "pending" || payment.isArchived) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/pagamentos/${payment.id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextPayment = (await response.json()) as PaymentDetails;
      setPayment(nextPayment);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [payment.id, payment.isArchived, payment.status]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  const expirationLabel = useMemo(() => {
    if (!payment.pixExpiresAt) {
      return "Sem expiração informada";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(payment.pixExpiresAt));
  }, [payment.pixExpiresAt]);

  const paidAtLabel = useMemo(() => {
    if (!payment.paidAt) {
      return null;
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(payment.paidAt));
  }, [payment.paidAt]);

  async function copyPixCode() {
    if (!paymentCodeValue) {
      return;
    }

    await navigator.clipboard.writeText(paymentCodeValue);
    setCopied(true);
  }

  async function simulatePayment() {
    setIsSimulating(true);

    try {
      const response = await fetch(`/api/pagamentos/${payment.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          simulate: true,
        }),
      });

      if (!response.ok) {
        return;
      }

      const nextPayment = (await response.json()) as PaymentDetails;
      setPayment({
        ...nextPayment,
        pixExpiresAt: nextPayment.pixExpiresAt,
        paidAt: nextPayment.paidAt,
      });
    } finally {
      setIsSimulating(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Status da cobrança
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
            {payment.isArchived ? "Cobrança arquivada" : statusLabels[payment.status]}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            {payment.isArchived
              ? "Esta cobrança foi arquivada e não será sincronizada automaticamente."
              : payment.status === "pending"
              ? checkoutUrl
                ? "Abra o checkout da InfinitePay. O saldo só deve ser liberado depois que o gateway confirmar o pagamento."
                : "O saldo só deve ser liberado depois que o gateway confirmar o pagamento deste PIX."
              : "A cobrança já recebeu um retorno definitivo do pagamento."}
          </p>
        </div>

        <span className="max-w-full break-all rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
          {payment.reference}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] border border-border bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Condomínio</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {payment.condominiumName}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-border bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Item</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {payment.planName}
          </p>
          {payment.tubeBrandName ? (
            <p className="mt-1 text-sm text-slate-600">
              Marca: {payment.tubeBrandName}
            </p>
          ) : null}
        </div>
        <div className="rounded-[1.25rem] border border-border bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Liberação</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {payment.isArchived
              ? "Arquivada"
              : payment.status === "paid"
                ? "Saldo liberado"
                : "Aguardando"}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{paymentCodeLabel}</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-900">
              {paymentCodeValue ?? "Código indisponível"}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {checkoutUrl ? (
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:w-auto"
              >
                Abrir checkout
              </a>
            ) : null}
            <button
              type="button"
              onClick={copyPixCode}
              disabled={!paymentCodeValue}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {copied ? "Copiado" : copyButtonLabel}
            </button>
          </div>
        </div>
      </div>

      {canSimulatePayment ? (
        <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Ambiente de desenvolvimento do gateway
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Você pode simular a confirmação para testar a liberação do saldo.
              </p>
            </div>
            <button
              type="button"
              onClick={simulatePayment}
              disabled={
                isSimulating || payment.status !== "pending" || payment.isArchived
              }
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSimulating ? "Simulando..." : "Simular pagamento"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Valor</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(payment.amountInCents / 100)}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Expira em</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {expirationLabel}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Confirmado em</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {paidAtLabel ?? "Aguardando"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Gateway</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {payment.provider ?? "Não informado"}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">ID no gateway</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900">
            {payment.providerPaymentId ?? "Aguardando"}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Recibo</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {payment.providerReceiptUrl ? (
              <a
                href={payment.providerReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Abrir recibo
              </a>
            ) : (
              "Indisponível"
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
