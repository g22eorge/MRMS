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
    return rows.slice(0, 8);
  }, [clients, query]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Customer</p>
        {(selectedClient || mode === "new") ? (
          <button
            type="button"
            onClick={() => { onSelectClient(""); onModeChange("existing"); }}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Change
          </button>
        ) : (
          <Link href={clientsPageHref} className="text-xs font-semibold text-[var(--accent)] hover:underline">
            Client page
          </Link>
        )}
      </div>

      {selectedClient ? (
        /* Chosen existing client */
        <div className="mt-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2.5">
          <p className="truncate text-[0.8125rem] font-bold text-[var(--ink)]">{selectedClient.fullName}</p>
          <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">
            {[selectedClient.phone, selectedClient.email, selectedClient.organization].filter(Boolean).join(" - ") || "Client record"}
          </p>
        </div>
      ) : mode === "new" ? (
        /* Creating a new client — name prefilled from what was typed */
        <div className="mt-2 grid gap-2">
          {(
            [
              ["fullName", "Client name *"],
              ["phone", "Phone *"],
              ["email", "Email (optional)"],
              ["organization", "Organization (optional)"],
              ["address", "Address / location (optional)"],
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
          <p className="px-1 text-[0.6875rem] text-[var(--ink-muted)]">A new client will be created with this document.</p>
        </div>
      ) : (
        /* Smart search — one field for existing OR new */
        <div className="mt-2 space-y-2">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Type a name, phone, or company…"
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--accent)]/50"
          />
          {query.trim() ? (
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelectClient(client.id)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-left transition hover:border-[var(--accent)]/40"
                >
                  <span className="block truncate text-[0.8125rem] font-bold text-[var(--ink)]">{client.fullName}</span>
                  <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">
                    {[client.phone, client.email, client.organization].filter(Boolean).join(" - ") || "Client record"}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { onSelectClient(""); onNewClientChange({ fullName: query.trim() }); onModeChange("new"); }}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--accent)]/45 bg-[var(--accent)]/5 px-3 py-2 text-left transition hover:bg-[var(--accent)]/10"
              >
                <span className="text-[1rem] font-bold leading-none text-[var(--accent)]">+</span>
                <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-[var(--ink)]">
                  Add new customer <span className="text-[var(--ink-muted)]">&ldquo;{query.trim()}&rdquo;</span>
                </span>
              </button>
            </div>
          ) : (
            <p className="px-1 text-[0.75rem] text-[var(--ink-muted)]">Start typing to find a client — or add a new one.</p>
          )}
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
