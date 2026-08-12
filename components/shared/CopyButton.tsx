"use client";

export function CopyButton({ text, label = "Copy", title, className = "btn-premium-secondary rounded px-2 py-0.5 text-[0.6875rem]" }: { text: string; label?: string; title?: string; className?: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(`${window.location.origin}${text}`)}
      title={title}
      className={className}
    >
      {label}
    </button>
  );
}