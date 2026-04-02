"use client";

import Image from "next/image";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

type Photo = {
  id: string;
  url: string;
  label: string | null;
};

export function PhotoUploader({
  jobId,
  photos,
  canDelete,
}: {
  jobId: string;
  photos: Photo[];
  canDelete: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
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
            window.location.reload();
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <select name="label" className="rounded-md border border-slate-300 px-2 py-1">
          <option value="before">Before</option>
          <option value="during">During</option>
          <option value="after">After</option>
          <option value="other">Other</option>
        </select>
        <input name="files" type="file" accept="image/png,image/jpeg,image/webp" multiple required />
        <button disabled={isPending} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white">
          Upload
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        {photos.map((photo) => (
          <div key={photo.id} className="rounded-lg border border-slate-200 bg-white p-2">
            <Image src={photo.url} alt={photo.label ?? "job photo"} width={320} height={160} className="h-40 w-full rounded object-cover" />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-600">{photo.label ?? "-"}</span>
              {canDelete ? (
                <form
                  action={async () => {
                    const res = await fetch(`/api/upload?id=${photo.id}`, { method: "DELETE" });
                    if (!res.ok) {
                      toast.error("Delete failed");
                      return;
                    }
                    window.location.reload();
                  }}
                >
                  <button
                    type="submit"
                    onClick={(event) => {
                      if (!window.confirm("Delete this photo?")) {
                        event.preventDefault();
                      }
                    }}
                    className="text-xs text-rose-700"
                  >
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
