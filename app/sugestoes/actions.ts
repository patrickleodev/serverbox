'use server';

import { revalidatePath } from "next/cache";

import { getDataSource } from "@/lib/db/data-source";
import { SuggestionEntity } from "@/lib/db/entities/suggestion.entity";
import { sendSuggestionNotification } from "@/lib/email/resend";

const RESIDENT_NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 254;
const CONDOMINIUM_NAME_MAX_LENGTH = 160;
const SUGGESTION_MAX_LENGTH = 200;

type SuggestionFieldErrors = {
  residentName?: string;
  email?: string;
  condominiumName?: string;
  message?: string;
};

export type CreateSuggestionActionState = {
  success: boolean;
  message: string | null;
  fieldErrors: SuggestionFieldErrors;
};

function normalizeSingleLineField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function normalizeSuggestionMessage(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function validateRequiredText(
  value: string,
  label: string,
  maxLength: number,
) {
  if (!value) {
    return `${label} é obrigatório.`;
  }

  if (value.length > maxLength) {
    return `${label} deve ter no máximo ${maxLength} caracteres.`;
  }

  return null;
}

function validateEmail(value: string) {
  const requiredError = validateRequiredText(
    value,
    "E-mail para contato",
    EMAIL_MAX_LENGTH,
  );

  if (requiredError) {
    return requiredError;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Informe um e-mail válido.";
  }

  return null;
}

export async function createSuggestionAction(
  _previousState: CreateSuggestionActionState,
  formData: FormData,
): Promise<CreateSuggestionActionState> {
  const residentName = normalizeSingleLineField(formData.get("residentName"));
  const email = normalizeSingleLineField(formData.get("email"));
  const condominiumName = normalizeSingleLineField(
    formData.get("condominiumName"),
  );
  const suggestionMessage = normalizeSuggestionMessage(formData.get("message"));
  const fieldErrors: SuggestionFieldErrors = {};

  const residentNameError = validateRequiredText(
    residentName,
    "Nome",
    RESIDENT_NAME_MAX_LENGTH,
  );
  const emailError = validateEmail(email);
  const condominiumNameError = validateRequiredText(
    condominiumName,
    "Condomínio",
    CONDOMINIUM_NAME_MAX_LENGTH,
  );
  const suggestionMessageError = validateRequiredText(
    suggestionMessage,
    "Sugestão",
    SUGGESTION_MAX_LENGTH,
  );

  if (residentNameError) {
    fieldErrors.residentName = residentNameError;
  }

  if (emailError) {
    fieldErrors.email = emailError;
  }

  if (condominiumNameError) {
    fieldErrors.condominiumName = condominiumNameError;
  }

  if (suggestionMessageError) {
    fieldErrors.message = suggestionMessageError;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Confira os campos destacados e tente novamente.",
      fieldErrors,
    };
  }

  const dataSource = await getDataSource();
  const suggestionRepository = dataSource.getRepository(SuggestionEntity);

  await suggestionRepository.save({
    residentName,
    email,
    condominiumName,
    message: suggestionMessage,
  });

  try {
    await sendSuggestionNotification({
      residentName,
      email,
      condominiumName,
      message: suggestionMessage,
    });
  } catch (error) {
    console.error("[suggestions] notification email failed", error);

    return {
      success: false,
      message:
        "Sugestão registrada, mas não foi possível enviar o e-mail de notificação.",
      fieldErrors: {},
    };
  }

  revalidatePath("/sugestoes");

  return {
    success: true,
    message: "Sugestão enviada. Obrigado por ajudar a melhorar a ServeBox.",
    fieldErrors: {},
  };
}
