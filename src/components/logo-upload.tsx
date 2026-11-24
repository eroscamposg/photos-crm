"use client";
import { useState } from "react";
export function LogoUpload() {
  const [status, setStatus] = useState<string | null>(null);
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-stone-700">Logo</span>
      <input
        type="file"
        accept="image/jpeg,image/webp,image/png"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setStatus("Requesting upload");
          const presign = await fetch("/api/uploads/presign", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || "image/jpeg",
              byteSize: file.size,
              purpose: "logo",
            }),
          });
          const payload = await presign.json();
          if (!presign.ok) {
            setStatus(payload.error ?? "Could not start upload");
            return;
          }
          const put = await fetch(payload.url, {
            method: "PUT",
            headers: { "content-type": payload.contentType },
            body: file,
          });
          if (!put.ok) {
            setStatus("Storage rejected the logo.");
            return;
          }
          const saved = await fetch("/api/uploads/logo", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key: payload.key }),
          });
          const body = await saved.json();
          setStatus(
            saved.ok
              ? "Logo saved. Refresh to see it."
              : (body.error ?? "Could not save logo"),
          );
        }}
      />
      {status ? <span className="text-muted">{status}</span> : null}
    </label>
  );
}
