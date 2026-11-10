import "server-only";

/**
 * The only email Ivan OS sends: a Stakeholder's sign-in code (Q35), through
 * Resend from Ivan's domain. Without RESEND_API_KEY, development prints the code
 * in the server console instead; production refuses.
 */

const FROM = process.env.DISCOVERY_EMAIL_FROM ?? "Ivan Díaz <codigo@ivanandresdiaz.com>";

export function emailAvailable() {
  return Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV !== "production";
}

export async function sendCodeEmail(input: {
  to: string;
  code: string;
  discoveryTitle: string;
  language: "es" | "en";
  minutes: number;
}) {
  const es = input.language === "es";
  const subject = es
    ? `Tu código para ${input.discoveryTitle}: ${input.code}`
    : `Your code for ${input.discoveryTitle}: ${input.code}`;
  const text = es
    ? `Hola,\n\nIvan Díaz te invitó a contarle cómo es tu trabajo para "${input.discoveryTitle}".\n\nTu código es ${input.code}. Vence en ${input.minutes} minutos.\n\nSi no lo pediste, ignora este correo.`
    : `Hi,\n\nIvan Díaz invited you to tell him how your work goes for "${input.discoveryTitle}".\n\nYour code is ${input.code}. It expires in ${input.minutes} minutes.\n\nIf you didn't ask for it, ignore this email.`;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.info(`[discovery] code for ${input.to}: ${input.code} (no RESEND_API_KEY, not sent)`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [input.to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend refused the email: ${res.status} ${await res.text()}`);
}
