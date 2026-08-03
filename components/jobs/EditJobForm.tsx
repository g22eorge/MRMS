"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateJobEditAction } from "@/app/(app)/jobs/[id]/edit/actions";

type EditJobFormProps = {
  job: {
    id: string;
    jobNumber: string;
    brand: string;
    model: string;
    serialOrImei: string | null;
    technicianNotes: string | null;
    issueDescription: string;
  };
  returnTo: string;
};

export function EditJobForm({ job, returnTo }: EditJobFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit Job {job.jobNumber}</h1>
      <form
        action={(formData) => {
          startTransition(async () => {
            const res = await updateJobEditAction(formData);
            if (res.error) {
              toast.error(res.error);
              return;
            }

            if (!res.redirectTo) {
              toast.error("Could not determine redirect path");
              return;
            }

            toast.success("Job updated");
            router.push(res.redirectTo);
            router.refresh();
          });
        }}
        className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 panel-shadow md:grid-cols-2"
      >
        <input type="hidden" name="id" value={job.id} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--ink-muted)]">Brand <span className="text-red-500">*</span></span>
          <input
            name="brand"
            defaultValue={job.brand}
            required
            placeholder="e.g. Apple, Samsung, HP"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--ink-muted)]">Model <span className="text-red-500">*</span></span>
          <input
            name="model"
            defaultValue={job.model}
            required
            placeholder="e.g. iPhone 11, Galaxy A12"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--ink-muted)]">Serial / IMEI <span className="font-normal">(optional)</span></span>
          <input
            name="serialOrImei"
            defaultValue={job.serialOrImei ?? ""}
            placeholder="Serial or IMEI number"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--ink-muted)]">Technician notes <span className="font-normal">(optional)</span></span>
          <textarea
            name="technicianNotes"
            defaultValue={job.technicianNotes ?? ""}
            placeholder="Internal notes for the repair team"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block font-medium text-[var(--ink-muted)]">What&apos;s wrong <span className="font-normal">(in the customer&apos;s words)</span> <span className="text-red-500">*</span></span>
          <textarea
            name="issueDescription"
            defaultValue={job.issueDescription}
            required
            placeholder="e.g. Screen cracked, won't turn on"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
          />
        </label>
        <div className="md:col-span-2 flex gap-2">
          <button
            disabled={isPending}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-white disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <Link href={returnTo} className="rounded-md border border-[var(--line)] px-3 py-2">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
