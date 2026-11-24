"use client";
import { useState } from "react";
import { Button } from "@/components/ui";

export function Uploader() {
  const [items, setItems] = useState<{ name: string; status: string }[]>([]);
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const update = (status: string) =>
        setItems((current) => {
          const next = current.filter((item) => item.name !== file.name);
          return [...next, { name: file.name, status }];
        });
      update("Requesting upload");
      try {
        const presign = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            byteSize: file.size,
            purpose: "asset",
          }),
        });
        const payload = await presign.json();
        if (!presign.ok) {
          update(payload.error ?? "Could not start upload");
          continue;
        }
        update("Uploading to storage");
        const put = await fetch(payload.url, {
          method: "PUT",
          headers: { "content-type": payload.contentType },
          body: file,
        });
        if (!put.ok) {
          update("Storage rejected the file. Check R2 CORS.");
          continue;
        }
        const complete = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId: payload.assetId }),
        });
        const done = await complete.json();
        update(
          complete.ok
            ? "Queued for the worker"
            : (done.error ?? "Could not queue"),
        );
      } catch (error) {
        update(error instanceof Error ? error.message : "Upload failed");
      }
    }
  }
  return (
    <div className="grid gap-3">
      <label className="grid cursor-pointer gap-2 rounded-2xl border border-dashed border-stone-400 bg-white/60 px-4 py-8 text-center">
        <span className="font-medium">Add JPEG, WebP, or HEIC</span>
        <span className="text-sm text-muted">
          The browser uploads straight to storage. This server does not proxy
          the bytes.
        </span>
        <input
          className="hidden"
          type="file"
          accept="image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          onChange={(event) => onFiles(event.target.files)}
        />
      </label>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
          >
            <span className="truncate">{item.name}</span>
            <span className="text-muted">{item.status}</span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="line"
        onClick={() => window.location.reload()}
      >
        Refresh library
      </Button>
    </div>
  );
}
