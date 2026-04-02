type AuditItem = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
  user: { name: string };
};

export function AuditTimeline({ items }: { items: AuditItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{item.action}</p>
            <p className="text-xs text-slate-500">{item.createdAt.toLocaleString()}</p>
          </div>
          <p className="text-xs text-slate-500">by {item.user.name}</p>
          {item.detail ? (
            <pre className="mt-2 overflow-x-auto text-xs text-slate-700">{item.detail}</pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}
