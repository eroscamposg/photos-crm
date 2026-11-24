"use client";
import { useState } from "react";
export function DownloadButton({
  token,
  assetId,
  tier,
  label,
}: {
  token: string;
  assetId: string;
  tier: "preview" | "web" | "original";
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="text-sm underline-offset-4 hover:underline"
        type="button"
        onClick={async () => {
          setError(null);
          const response = await fetch(`/api/g/${token}/download`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ assetId, tier }),
          });
          const body = await response.json();
          if (!response.ok) {
            setError(body.error ?? "Download failed");
            return;
          }
          window.location.href = body.url;
        }}
      >
        {label}
      </button>
      {error ? <p className="text-xs text-red-800">{error}</p> : null}
    </div>
  );
}
