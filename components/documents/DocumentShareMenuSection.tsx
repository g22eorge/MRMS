import { MenuActionButton, MenuActionLink, MenuSection } from "@/components/shared/RowActionsMenu";

type DocumentShareMenuSectionProps = {
  hiddenFieldName: string;
  hiddenFieldValue: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  whatsAppAction: (formData: FormData) => void | Promise<void>;
  emailAction: (formData: FormData) => void | Promise<void>;
  whatsAppLabel?: string;
  emailLabel?: string;
  waLinkHref?: string | null;
  waLinkLabel?: string;
};

export function DocumentShareMenuSection({
  hiddenFieldName,
  hiddenFieldValue,
  recipientPhone,
  recipientEmail,
  whatsAppAction,
  emailAction,
  whatsAppLabel = "Send via WhatsApp",
  emailLabel = "Email document",
  waLinkHref,
  waLinkLabel = "Open WhatsApp Link",
}: DocumentShareMenuSectionProps) {
  return (
    <>
      <MenuSection label="Share" />
      {recipientPhone ? (
        <form action={whatsAppAction}>
          <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
          <MenuActionButton icon="whatsapp" tone="success">
            {whatsAppLabel}
          </MenuActionButton>
        </form>
      ) : (
        <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">
          WhatsApp unavailable
        </span>
      )}
      {recipientEmail ? (
        <form action={emailAction}>
          <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
          <MenuActionButton icon="open">{emailLabel}</MenuActionButton>
        </form>
      ) : (
        <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">
          Email unavailable
        </span>
      )}
      {waLinkHref ? (
        <MenuActionLink href={waLinkHref} external icon="whatsapp" tone="success">
          {waLinkLabel}
        </MenuActionLink>
      ) : null}
    </>
  );
}
