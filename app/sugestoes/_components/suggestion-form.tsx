'use client';

import { useActionState, useEffect, useRef } from "react";

import { FloatingInput, FloatingTextarea } from "@/app/_components/floating-field";
import { FormSubmitButton } from "@/app/_components/form-submit-button";
import {
  createSuggestionAction,
  type CreateSuggestionActionState,
} from "@/app/sugestoes/actions";

const initialState: CreateSuggestionActionState = {
  success: false,
  message: null,
  fieldErrors: {},
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-2 text-sm leading-6 text-rose-700">
      {message}
    </p>
  );
}

export function SuggestionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    createSuggestionAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  const residentNameErrorId = "residentName-error";
  const emailErrorId = "suggestion-email-error";
  const condominiumNameErrorId = "condominiumName-error";
  const messageErrorId = "suggestion-message-error";

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <div>
        <FloatingInput
          label="Nome"
          name="residentName"
          autoComplete="name"
          placeholder="Seu nome"
          maxLength={120}
          required
          aria-invalid={Boolean(state.fieldErrors.residentName) || undefined}
          aria-describedby={
            state.fieldErrors.residentName ? residentNameErrorId : undefined
          }
        />
        <FieldError
          id={residentNameErrorId}
          message={state.fieldErrors.residentName}
        />
      </div>

      <div>
        <FloatingInput
          label="E-mail para contato"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          maxLength={254}
          required
          aria-invalid={Boolean(state.fieldErrors.email) || undefined}
          aria-describedby={
            state.fieldErrors.email ? emailErrorId : undefined
          }
        />
        <FieldError id={emailErrorId} message={state.fieldErrors.email} />
      </div>

      <div>
        <FloatingInput
          label="Condomínio"
          name="condominiumName"
          autoComplete="organization"
          placeholder="Nome do condomínio"
          maxLength={160}
          required
          aria-invalid={Boolean(state.fieldErrors.condominiumName) || undefined}
          aria-describedby={
            state.fieldErrors.condominiumName ? condominiumNameErrorId : undefined
          }
        />
        <FieldError
          id={condominiumNameErrorId}
          message={state.fieldErrors.condominiumName}
        />
      </div>

      <div>
        <FloatingTextarea
          label="Sugestão"
          name="message"
          placeholder="Escreva sua sugestão"
          maxLength={200}
          required
          aria-invalid={Boolean(state.fieldErrors.message) || undefined}
          aria-describedby={
            state.fieldErrors.message ? messageErrorId : undefined
          }
        />
        <FieldError id={messageErrorId} message={state.fieldErrors.message} />
      </div>

      {state.message ? (
        <p
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
            state.success
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <FormSubmitButton
        idleLabel="Enviar sugestão"
        pendingLabel="Enviando sugestão..."
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-60 sm:w-auto"
      />
    </form>
  );
}
