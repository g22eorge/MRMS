export type PageLoadingVariant = "default" | "detail" | "list" | "table";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--panel-strong)] ${className}`} />;
}

export function PageLoadingState({ variant = "default" }: { variant?: PageLoadingVariant }) {
  if (variant === "table") {
    return (
      <div className="space-y-2 p-2">
        <Block className="h-10" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Block key={index} className="h-12" />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="space-y-4 p-2">
        <Block className="h-14" />
        <div className="flex flex-wrap gap-2">
          <Block className="h-9 w-24" />
          <Block className="h-9 w-24" />
          <Block className="h-9 w-24" />
        </div>
        <Block className="h-80" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-4 p-2">
        <Block className="h-20" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Block key={index} className="h-9 w-24 shrink-0" />
          ))}
        </div>
        <Block className="h-48" />
        <Block className="h-36" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <Block className="h-16" />
      <div className="grid gap-3 md:grid-cols-3">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <Block className="h-72" />
    </div>
  );
}
