import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PaymentStatusPanel } from "@/app/pagamentos/[paymentId]/_components/payment-status-panel";
import { PrintQrCodeButton } from "@/app/pagamentos/[paymentId]/_components/print-qr-code-button";
import { getPaymentDetails } from "@/lib/data/payment";
import { buildPixQrCodeSvg } from "@/lib/payments/pix-qr";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  await connection();
  const { paymentId } = await params;
  const payment = await getPaymentDetails(paymentId);

  if (!payment) {
    notFound();
  }

  const isInfinitePayCheckout = payment.provider === "infinitepay";
  const checkoutUrl = isInfinitePayCheckout
    ? payment.providerReceiptUrl ?? payment.pixCopyPasteCode
    : null;
  const qrCodePayload = checkoutUrl ?? payment.pixCopyPasteCode;
  const qrCodeSvg = payment.pixQrCode?.startsWith("data:image/")
    ? null
    : qrCodePayload
      ? await buildPixQrCodeSvg(qrCodePayload)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-10 lg:px-12">
      <section className="rounded-[1.5rem] border border-border bg-surface px-4 py-6 shadow-sm sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              {isInfinitePayCheckout ? "Checkout InfinitePay" : "Checkout PIX"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {isInfinitePayCheckout
                ? "Link de pagamento com liberação automática."
                : "QR Code e cópia e cola com liberação automática."}
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Esta cobrança fica em acompanhamento automático. O saldo só deve
              ser liberado quando o gateway confirmar o pagamento.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900 sm:w-auto"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="payment-print-area rounded-[1.5rem] border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                {isInfinitePayCheckout ? "Pague pela InfinitePay" : "Pague com PIX"}
              </p>
              <h2 className="payment-print-only mt-2 text-2xl font-semibold text-slate-900">
                Pagamento ServeBox
              </h2>
            </div>
            {qrCodeSvg || payment.pixQrCode?.startsWith("data:image/") ? (
              <PrintQrCodeButton />
            ) : null}
          </div>
          <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
            {payment.pixQrCode?.startsWith("data:image/") ? (
              <Image
                src={payment.pixQrCode}
                alt={isInfinitePayCheckout ? "QR Code do checkout" : "QR Code PIX"}
                width={280}
                height={280}
                unoptimized
                className="mx-auto w-full max-w-[280px]"
              />
            ) : qrCodeSvg ? (
              <div
                aria-label={isInfinitePayCheckout ? "QR Code do checkout" : "QR Code PIX"}
                dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[1rem] border border-dashed border-slate-300 text-sm text-slate-500">
                QR Code indisponível
              </div>
            )}
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            {isInfinitePayCheckout
              ? "Escaneie o QR Code ou abra o link da InfinitePay. Assim que o gateway confirmar a cobrança, o status muda automaticamente."
              : "Escaneie o QR Code ou copie o código PIX. Assim que o gateway confirmar a cobrança, o status muda automaticamente."}
          </p>
          <div className="payment-print-only mt-6 space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Condominio:</span>{" "}
              {payment.condominiumName}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Item:</span>{" "}
              {payment.planName}
            </p>
            {payment.tubeBrandName ? (
              <p>
                <span className="font-semibold text-slate-900">Marca:</span>{" "}
                {payment.tubeBrandName}
              </p>
            ) : null}
            <p className="break-all font-mono text-xs">
              {qrCodePayload ?? "Codigo indisponivel"}
            </p>
          </div>
        </section>

        <PaymentStatusPanel
          initialPayment={{
            ...payment,
            pixExpiresAt: payment.pixExpiresAt?.toISOString() ?? null,
            paidAt: payment.paidAt?.toISOString() ?? null,
          }}
        />
      </section>
    </main>
  );
}
