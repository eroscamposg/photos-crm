export const PRESETS = {
  none: { exposure: 0, contrast: 0, saturation: 0 },
  warm: { exposure: 8, contrast: 10, saturation: 18 },
  cool: { exposure: 0, contrast: 8, saturation: -12 },
  mono: { exposure: 4, contrast: 15, saturation: -100 },
  film: { exposure: -6, contrast: 18, saturation: -15 },
} as const;

export type PresetId = keyof typeof PRESETS | "custom";

export type CropPixels = { x: number; y: number; width: number; height: number };

export type EditRecipe = {
  crop: CropPixels | null;
  rotation: 0 | 90 | 180 | 270;
  exposure: number;
  contrast: number;
  saturation: number;
  preset: PresetId;
};

export const emptyRecipe = (): EditRecipe => ({
  crop: null,
  rotation: 0,
  exposure: 0,
  contrast: 0,
  saturation: 0,
  preset: "none",
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeRecipe(input: unknown): EditRecipe {
  const raw = (input ?? {}) as Partial<EditRecipe>;
  const rotation = raw.rotation;
  const crop = raw.crop;
  const preset = raw.preset;
  const known = preset && preset in PRESETS ? preset : preset === "custom" ? "custom" : "none";
  return {
    crop:
      crop &&
      Number.isFinite(crop.x) &&
      Number.isFinite(crop.y) &&
      Number.isFinite(crop.width) &&
      Number.isFinite(crop.height) &&
      crop.width > 1 &&
      crop.height > 1
        ? {
            x: Math.max(0, Math.round(crop.x)),
            y: Math.max(0, Math.round(crop.y)),
            width: Math.min(20000, Math.round(crop.width)),
            height: Math.min(20000, Math.round(crop.height)),
          }
        : null,
    rotation: rotation === 90 || rotation === 180 || rotation === 270 ? rotation : 0,
    exposure: clamp(Number(raw.exposure) || 0, -100, 100),
    contrast: clamp(Number(raw.contrast) || 0, -100, 100),
    saturation: clamp(Number(raw.saturation) || 0, -100, 100),
    preset: known,
  };
}

export function previewFilter(recipe: EditRecipe) {
  const brightness = 1 + recipe.exposure / 200;
  const contrast = 1 + recipe.contrast / 150;
  const saturate = Math.max(0, 1 + recipe.saturation / 100);
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
}

export function sharpAdjustments(recipe: EditRecipe) {
  return {
    brightness: 1 + recipe.exposure / 200,
    contrast: 1 + recipe.contrast / 150,
    saturation: Math.max(0, 1 + recipe.saturation / 100),
  };
}
