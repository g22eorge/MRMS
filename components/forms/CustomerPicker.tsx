"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ClientPickerOption, NewClientFields } from "@/lib/forms/line-items";

type CustomerPickerProps = {
  clients: ClientPickerOption[];
  mode: "existing" | "new";
  onModeChange: (mode: "existing" | "new") => void;
  query: string;
  onQueryChange: (query: string) => void;
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  newClient: NewClientFields;
  onNewClientChange: (patch: Partial<NewClientFields>) => void;
  clientsPageHref?: string;
};

export function CustomerPicker({
  clients,
  mode,
  onModeChange,
  query,
  onQueryChange,
  selectedClientId,
  onSelectClient,
  newClient,
  onNewClientChange,
  clientsPageHref = "/clients?create=1",
}: CustomerPickerProps) {
  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const rows = normalized
      ? clients.filter((client) =>
          [client.fullName, client.phone, client.email, client.organization, client.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : clients;
    return rows.slice(0, 18);
  }, [clients, query]);

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Customer</p>
        <Link href={clientsPageHref} className="text-xs font-semibold text-[var(--accent)] hover:underline">
          Client page
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1">
        {(["existing", "new"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => onModeChange(nextMode)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition ${
              mode === nextMode ? "bg-[var(--accent)] text-black" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {nextMode}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="mt-2 space-y-2">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search client, phone, address"
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => onSelectClient(client.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selectedClientId === client.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]/40"
                }`}
              >
                <span className="block truncate text-[13px] font-bold text-[var(--ink)]">{client.fullName}</span>
                <span className="block truncate text-[12px] text-[var(--ink-muted)]">
                  {[client.phone, client.email, client.organization].filter(Boolean).join(" - ") || "Client record"}
                </span>
                {client.address ? (
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-muted)]/75">{client.address}</span>
                ) : null}
              </button>
            ))}
            {!filteredClients.length ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-4 text-center text-xs text-[var(--ink-muted)]">
                No client found
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 grid gap-2">
          {(
            [
              ["fullName", "Client name *"],
              ["phone", "Phone *"],
              ["email", "Email"],
              ["organization", "Organization"],
              ["address", "Address / location"],
            ] as const
          ).map(([field, placeholder]) => (
            <input
              key={field}
              value={newClient[field]}
              onChange={(event) => onNewClientChange({ [field]: event.target.value })}
              placeholder={placeholder}
              className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50"
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function useCustomerPicker(clients: ClientPickerOption[]) {
  const [mode, setMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClient, setNewClient] = useState<NewClientFields>({
    fullName: "",
    phone: "",
    email: "",
    organization: "",
    address: "",
  });

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  return {
    mode,
    setMode,
    query,
    setQuery,
    selectedClientId,
    setSelectedClientId,
    newClient,
    setNewClient,
    selectedClient,
    patchNewClient: (patch: Partial<NewClientFields>) => setNewClient((prev) => ({ ...prev, ...patch })),
  };
}
