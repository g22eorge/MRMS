"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { updateProfileAction, type UpdateProfileState } from "@/app/(app)/settings/profile/actions";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export function ProfileForm({
  name,
  email,
  role,
  phone,
}: {
  name: string;
  email: string;
  role: string;
  phone: string | null;
}) {
  const router = useRouter();
  const initialState: UpdateProfileState = {};
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-slate-500">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={80}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm text-slate-500">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={phone ?? ""}
          maxLength={30}
          placeholder="e.g. +2567..."
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <p className="mb-1 text-sm text-slate-500">Email</p>
        <p className="font-medium">{email}</p>
      </div>

      <div>
        <p className="mb-1 text-sm text-slate-500">Role</p>
        <p className="font-medium">{role}</p>
      </div>

      {state.error ? <p className="text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}

      <SaveButton />
    </form>
  );
}
