export default function AppLoading() {
  return (
    <div className="space-y-4 p-2">
      <div className="h-20 animate-pulse rounded-2xl bg-[var(--panel-strong)]" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--panel-strong)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--panel-strong)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--panel-strong)]" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[var(--panel-strong)]" />
    </div>
  );
}
