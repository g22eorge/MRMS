export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function modalPanelClassName(size: ModalSize = "md", extra = ""): string {
  return [
    "panel-shadow relative z-10 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]",
    SIZE_CLASSES[size],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
