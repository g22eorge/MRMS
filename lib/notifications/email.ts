import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function emailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.REPAIR_REQUEST_ALERT_EMAIL && process.env.RESEND_FROM);
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
}) {
  const resend = getResend();
  if (!resend) {
    return { success: false as const, error: "Email not configured" };
  }

  const from = process.env.RESEND_FROM;
  if (!from) {
    return { success: false as const, error: "Missing RESEND_FROM" };
  }

  try {
    const res = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    // resend returns { data, error }
    type ResendSendResult = { data?: { id?: string } | null; error?: { message?: string } | string | null };
    const result = res as unknown as ResendSendResult;

    if (result.error) {
      const message = typeof result.error === "string" ? result.error : result.error.message;
      return { success: false as const, error: String(message ?? result.error) };
    }

    const id = result.data?.id;
    return { success: true as const, messageId: typeof id === "string" ? id : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: message };
  }
}
