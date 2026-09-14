import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_SUGGESTIONS_RECIPIENT = "serveboxsuporte@gmail.com";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";

type SuggestionNotification = {
  residentName: string;
  email: string;
  condominiumName: string;
  message: string;
};

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() || null;
}

export async function sendSuggestionNotification(
  suggestion: SuggestionNotification,
) {
  const apiKey = getTrimmedEnv("RESEND_API_KEY");

  if (!apiKey) {
    throw new Error("RESEND_API_KEY nao configurada.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getTrimmedEnv("RESEND_FROM_EMAIL") || DEFAULT_FROM_EMAIL,
      to: [
        getTrimmedEnv("SUGGESTIONS_NOTIFICATION_EMAIL") ||
          DEFAULT_SUGGESTIONS_RECIPIENT,
      ],
      reply_to: suggestion.email,
      subject: `Nova sugestao de ${suggestion.residentName}`,
      text: [
        `Nome: ${suggestion.residentName}`,
        `E-mail: ${suggestion.email}`,
        `Condominio: ${suggestion.condominiumName}`,
        "",
        "Sugestao:",
        suggestion.message,
      ].join("\n"),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      responseBody || `Resend retornou o status ${response.status}.`,
    );
  }
}