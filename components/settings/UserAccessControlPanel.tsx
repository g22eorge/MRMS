"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type RoleOption = {
  value: string;
  label: string;
  description: string;
};

type PermissionOption = {
  key: string;
  group: string;
  action: string;
  label: string;
  description: string;
  permission?: string;
  mutable: boolean;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-premium rounded-lg px-4 py-2 text-sm"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

type Props = {
  userId: string;
  queryText: string;
  initialRole: string;
  initialPermissions: string[];
  roleOptions: RoleOption[];
  roleDefaultPermissions: Record<string, string[]>;
  roleDefaultCapabilities: Record<string, string[]>;
  permissions: PermissionOption[];
  saveAction: (formData: FormData) => Promise<void>;
};

export function UserAccessControlPanel({
  userId,
  queryText,
  initialRole,
  initialPermissions,
  roleOptions,
  roleDefaultPermissions,
  saveAction,
}: Props) {
  const [role, setRole] = useState(initialRole || "OPS");
  // The role is self-sufficient: it fully defines this user's permissions.
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    () => new Set(initialPermissions),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const uniqueRoleOptions = useMemo(() => {
    const seen = new Set<string>();
    return roleOptions.filter((option) => {
      if (!option.value || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [roleOptions]);

  return (
    <>
    <ConfirmDialog
      open={confirmOpen}
      title="Apply access changes?"
      description="This will update the user's role and permissions. Changes take effect on their next action."
      confirmLabel="Save Changes"
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => {
        setConfirmOpen(false);
        formRef.current?.requestSubmit();
      }}
    />
    <form
      ref={formRef}
      action={saveAction}
      className="space-y-4"
      onSubmit={(event) => {
        const changedRole = role !== initialRole;
        const next = Array.from(selectedPermissions).sort().join("|");
        const prev = [...initialPermissions].sort().join("|");
        const changedPermissions = next !== prev;
        if ((changedRole || changedPermissions) && !confirmOpen) {
          event.preventDefault();
          setConfirmOpen(true);
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="q" value={queryText ?? ""} />
      <input type="hidden" name="role" value={role} />

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 panel-shadow">
        <label htmlFor="role-select" className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Role</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              id="role-select"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setSelectedPermissions(new Set(roleDefaultPermissions[event.target.value] ?? []));
              }}
              className="appearance-none rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] py-2 pl-3 pr-9 text-[0.875rem] font-semibold text-[var(--ink)] outline-none transition focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/15"
            >
              {uniqueRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden="true">▾</span>
          </div>
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-[var(--ink-muted)]">
            {uniqueRoleOptions.find((option) => option.value === role)?.description ?? "Sets this person's default permissions."}
          </p>
        </div>
      </section>

      {/* The role fully defines access; its default permissions submit with the form. */}
      {Array.from(selectedPermissions).map((permission) => (
        <input key={permission} type="hidden" name="permissions" value={permission} />
      ))}

      <div className="flex items-center justify-end">
        <SaveButton />
      </div>
    </form>
    </>
  );
}
