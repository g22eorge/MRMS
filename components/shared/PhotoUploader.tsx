"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type Photo = {
  id: string;
  url: string;
  label: string | null;
  visibility?: string | null;
};

export function PhotoUploader({
  jobId,
  photos,
  canDelete,
  canManageVisibility = false,
}: {
  jobId: string;
  photos: Photo[];
  canDelete: boolean;
  canManageVisibility?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDelete(photoId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/upload?id=${photoId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      router.refresh();
    });
  }

  function toggleVisibility(photoId: string, next: "CLIENT" | "INTERNAL") {
    startTransition(async () => {
      const res = await fetch(`/api/upload?id=${photoId}&visibility=${next}`, { method: "PATCH" });
      if (!res.ok) {
        toast.error("Could not update visibility");
        return;
      }
      toast.success(next === "CLIENT" ? "Now visible to the client" : "Hidden from the client");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete photo?"
        description="This photo will be permanently removed from the job record. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />

      <form
        ref={formRef}
        action={(formData) => {
          startTransition(async () => {
            formData.append("jobId", jobId);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (!res.ok) {
              toast.error("Upload failed");
              return;
            }
            toast.success("Uploaded");
            formRef.current?.reset();
            router.refresh();
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <select name="label" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-sm outline-none">
          <option value="before">Before</option>
          <option value="during">During</option>
          <option value="after">After</option>
          <option value="other">Other</option>
        </select>
        <input name="files" type="file" accept="image/png,image/jpeg,image/webp" multiple required />
        {canManageVisibility ? (
          <label className="flex items-center gap-1.5 text-sm text-[var(--ink-muted)]">
            <input name="visibility" type="checkbox" value="CLIENT" className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Visible to client
          </label>
        ) : null}
        <button disabled={isPending} className="btn-premium rounded-lg px-3 py-2 text-sm disabled:opacity-60">
          Upload
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        {photos.map((photo) => {
          const isClient = photo.visibility === "CLIENT";
          return (
            <div key={photo.id} className="rounded-xl bg-[var(--panel-strong)] p-2">
              <Image src={photo.url} alt={photo.label ?? "job photo"} width={320} height={160} className="h-40 w-full rounded object-cover" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--ink-muted)]">{photo.label ?? "-"}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${isClient ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--panel)] text-[var(--ink-muted)]"}`}>
                  {isClient ? "Client" : "Internal"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                {canManageVisibility ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleVisibility(photo.id, isClient ? "INTERNAL" : "CLIENT")}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    {isClient ? "Hide from client" : "Show to client"}
                  </button>
                ) : <span />}
                {canDelete ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setConfirmDeleteId(photo.id)}
                    className="text-xs text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
