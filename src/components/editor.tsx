"use client";
import { useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui";
import { PRESETS, previewFilter, type EditRecipe } from "@/lib/recipe";
import { saveRecipe } from "@/server/actions";

export function Editor({
  galleryId,
  assetId,
  imageUrl,
  initial,
}: {
  galleryId: string;
  assetId: string;
  imageUrl: string;
  initial: EditRecipe;
}) {
  const [recipe, setRecipe] = useState<EditRecipe>(initial);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(4 / 5);
  const [status, setStatus] = useState<string | null>(null);
  const filter = useMemo(() => previewFilter(recipe), [recipe]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="relative h-[70vh] overflow-hidden rounded-2xl bg-stone-900">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={recipe.rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area: Area, pixels: Area) =>
            setRecipe((current) => ({
              ...current,
              crop: {
                x: pixels.x,
                y: pixels.y,
                width: pixels.width,
                height: pixels.height,
              },
            }))
          }
          style={{ mediaStyle: { filter } }}
        />
      </div>
      <div className="grid content-start gap-4">
        <label className="grid gap-1 text-sm">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            [4 / 5, "4:5"],
            [1, "1:1"],
            [3 / 2, "3:2"],
            [16 / 9, "16:9"],
          ].map(([value, label]) => (
            <Button
              key={String(label)}
              type="button"
              variant={aspect === value ? "solid" : "line"}
              onClick={() => setAspect(Number(value))}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 90, 180, 270].map((rotation) => (
            <Button
              key={rotation}
              type="button"
              variant={recipe.rotation === rotation ? "solid" : "line"}
              onClick={() =>
                setRecipe((current) => ({
                  ...current,
                  rotation: rotation as 0 | 90 | 180 | 270,
                }))
              }
            >
              {rotation}°
            </Button>
          ))}
        </div>
        {(["exposure", "contrast", "saturation"] as const).map((key) => (
          <label key={key} className="grid gap-1 text-sm capitalize">
            {key} ({recipe[key]})
            <input
              type="range"
              min={-100}
              max={100}
              value={recipe[key]}
              onChange={(event) =>
                setRecipe((current) => ({
                  ...current,
                  [key]: Number(event.target.value),
                  preset: "custom",
                }))
              }
            />
          </label>
        ))}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(
            (preset) => (
              <Button
                key={preset}
                type="button"
                variant={recipe.preset === preset ? "solid" : "line"}
                onClick={() =>
                  setRecipe((current) => ({
                    ...current,
                    ...PRESETS[preset],
                    preset,
                  }))
                }
              >
                {preset}
              </Button>
            ),
          )}
        </div>
        <Button
          type="button"
          onClick={async () => {
            setStatus("Saving");
            const result = await saveRecipe({ galleryId, assetId, recipe });
            setStatus(
              "error" in result && result.error
                ? result.error
                : "Queued. The original file stays untouched.",
            );
          }}
        >
          Save edit
        </Button>
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </div>
    </div>
  );
}
