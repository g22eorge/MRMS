interface WhatsAppConfig {
  businessNumber: string;
  provider: string;
  accessToken: string;
  phoneNumberId: string;
}

function getConfig(): WhatsAppConfig | null {
  const businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER;
  const provider = process.env.WHATSAPP_PROVIDER;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!businessNumber || !accessToken || !phoneNumberId) {
    console.warn("[WhatsApp] Missing configuration - notifications disabled");
    return null;
  }

  return {
    businessNumber,
    provider: provider || "meta",
    accessToken,
    phoneNumberId,
  };
}

export function whatsappIsConfigured() {
  return Boolean(getConfig());
}

export async function whatsappHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  if (!config) return { ok: false, error: "WhatsApp not configured" };

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}?fields=id`, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `WhatsApp health failed: ${response.status} ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function sendRepairRequestConfirmation(
  phone?: string,
  customerName?: string,
  requestNumber?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!phone || !customerName || !requestNumber) {
    return { success: false, error: "Missing required parameters" };
  }
  const config = getConfig();
  if (!config) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const message = `Hello ${customerName},\n\nThank you for submitting your repair request (${requestNumber}).\n\nWe have received your device and will contact you shortly to confirm the diagnosis and timeline.\n\nBest regards,\nEagle Info Solutions`;

  return sendCustomWhatsAppMessage(phone, message);
}

export async function sendIntakeApprovalNotification(
  phone: string,
  customerName: string,
  requestNumber: string,
  preferredDate?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "WhatsApp not configured" };
  }

  let message = `Hello ${customerName},\n\nYour repair request (${requestNumber}) has been APPROVED.\n\n`;
  
  if (preferredDate) {
    message += `Your preferred drop-off date is: ${preferredDate}\n\n`;
  }
  
  message += `Please bring your device to our shop at your convenience.\n\nBest regards,\nEagle Info Solutions`;

  return sendCustomWhatsAppMessage(phone, message);
}

export async function sendIntakeRejectionNotification(
  phone: string,
  customerName: string,
  requestNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const message = `Hello ${customerName},\n\nUnfortunately, we are unable to process your repair request (${requestNumber}) at this time.\n\nPlease contact us for more information.\n\nBest regards,\nEagle Info Solutions`;

  return sendCustomWhatsAppMessage(phone, message);
}

export async function sendJobCreatedNotification(
  phone: string,
  customerName: string,
  jobNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const message = `Hello ${customerName},\n\nYour device has been registered as Job #${jobNumber}.\n\nWe will update you as the repair progresses.\n\nBest regards,\nEagle Info Solutions`;

  return sendCustomWhatsAppMessage(phone, message);
}

export async function sendJobCompletionNotification(
  phone: string,
  customerName: string,
  jobNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const message = `Hello ${customerName},\n\nGreat news! Your device (Job #${jobNumber}) is ready for pickup.\n\nPlease visit our shop to collect your device.\n\nBest regards,\nEagle Info Solutions`;

  return sendCustomWhatsAppMessage(phone, message);
}

export async function sendCustomWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: string }> {
  return sendWhatsAppMessageInternal({ to, message });
}

async function sendWhatsAppMessageInternal({
  to,
  message,
}: {
  to?: string;
  message?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: string }> {
  if (!to || !message) {
    return { success: false, error: "Missing to or message" };
  }
  const config = getConfig();
  if (!config) {
    return { success: false, error: "WhatsApp not configured" };
  }

  try {
    // WhatsApp Cloud API expects international digits only (no leading "+", no spaces).
    const normalizedPhone = normalizeWhatsAppRecipient(to);
    
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[WhatsApp] API error:", response.status, errorText);

      // Best-effort parse Meta error payload
      let metaCode: string | undefined;
      try {
        const parsed = JSON.parse(errorText);
        const code = parsed?.error?.code;
        if (typeof code === "number" || typeof code === "string") metaCode = String(code);
      } catch {
        // ignore
      }

      return {
        success: false,
        errorCode: metaCode,
        error: `WhatsApp API error: ${response.status} ${errorText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const messageId = data.messages?.[0]?.id;

    if (messageId) {
      console.log("[WhatsApp] Message sent:", messageId);
      return { success: true, messageId };
    }

    return { success: false, error: "No message ID returned" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] Send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

function normalizeWhatsAppRecipient(input: string): string {
  const digits = input.replace(/\D+/g, "");

  // Uganda convenience: allow 0xxxxxxxxx or +256xxxxxxxxx inputs.
  if (digits.startsWith("256")) return digits;
  if (digits.length === 10 && digits.startsWith("0")) return `256${digits.slice(1)}`;

  return digits;
}
