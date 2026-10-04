"use client";

import { useState } from "react";

import { CustomerPicker } from "@/components/forms/CustomerPicker";
import type { ClientPickerOption, NewClientFields } from "@/lib/forms/line-items";

/**
 * Customer search + hidden inputs for the POS sale customer form.
 *
 * Lives inside a server `<form action={setSaleClientAction}>` (same pattern
 * as PosAddItemFields): the visible picker is stateful, the form posts the
 * picked state as hidden fields. Clearing the pick (Change) and saving
 * detaches the customer back to walk-in.
 */
export function PosCustomerFields({
  initialClientId,
  clients,
}: {
  initialClientId: string;
  clients: ClientPickerOption[];
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [newClient, setNewClient] = useState<NewClientFields>({
    fullName: "",
    phone: "",
    email: "",
    organization: "",
    address: "",
  });

  return (
    <>
      <CustomerPicker
        clients={clients}
        mode={mode}
        onModeChange={setMode}
        query={query}
        onQueryChange={setQuery}
        selectedClientId={selectedClientId}
        onSelectClient={setSelectedClientId}
        newClient={newClient}
        onNewClientChange={(patch) => setNewClient((prev) => ({ ...prev, ...patch }))}
      />
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="clientMode" value={mode} />
      <input type="hidden" name="newClientFullName" value={newClient.fullName} />
      <input type="hidden" name="newClientPhone" value={newClient.phone} />
      <input type="hidden" name="newClientEmail" value={newClient.email} />
      <input type="hidden" name="newClientOrganization" value={newClient.organization} />
      <input type="hidden" name="newClientAddress" value={newClient.address} />
    </>
  );
}
