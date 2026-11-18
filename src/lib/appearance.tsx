"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { deleteBlob, getBlob, prepareImage, putBlob, UnsupportedImageError } from "./media-store";

export type Background =
  | { type: "default" }
  | { type: "color"; color: string }
  /** `dim` is how opaque the app surfaces are over the photo (0.4 – 0.95). */
  | { type: "image"; dim: number };

export type Appearance = { accent: string | null; background: Background };

export const ACCENTS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Pink", value: "#ec4899" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Red", value: "#ef4444" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Slate", value: "#64748b" },
];

export const BACKGROUNDS = [
  { name: "Paper", value: "#fbf8f1" },
  { name: "Mint", value: "#eaf6ee" },
  { name: "Sky", value: "#eaf3fb" },
  { name: "Lavender", value: "#f1eefb" },
  { name: "Rose", value: "#fcedf1" },
  { name: "Slate", value: "#1e293b" },
  { name: "Charcoal", value: "#18181b" },
  { name: "Midnight", value: "#0b1020" },
  { name: "Forest", value: "#0f1f17" },
  { name: "Plum", value: "#1f1226" },
];

const STORAGE_KEY = "folio-appearance-v1";
const IMAGE_ID = "folio-theme-background";
const DEFAULT: Appearance = { accent: null, background: { type: "default" } };

const HEX = /^#[0-9a-f]{6}$/i;

/** Perceived brightness 0–1 of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const isDarkColor = (hex: string) => luminance(hex) < 0.45;
const readableOn = (hex: string) => (luminance(hex) > 0.55 ? "#111111" : "#ffffff");

const OVERRIDDEN = [
  "--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground",
  "--primary", "--primary-foreground", "--secondary", "--secondary-foreground", "--muted",
  "--muted-foreground", "--accent", "--accent-foreground", "--border", "--input", "--ring",
  "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
  "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
  "--folio-bg-image",
];

function applyAppearance(a: Appearance, systemDark: boolean, imageUrl: string | null) {
  const style = document.documentElement.style;
  OVERRIDDEN.forEach((p) => style.removeProperty(p));
  const set = (vars: Record<string, string>) => Object.entries(vars).forEach(([k, v]) => style.setProperty(k, v));

  if (a.accent && HEX.test(a.accent)) {
    const on = readableOn(a.accent);
    set({
      "--primary": a.accent,
      "--primary-foreground": on,
      "--sidebar-primary": a.accent,
      "--sidebar-primary-foreground": on,
      "--ring": a.accent,
      "--sidebar-ring": a.accent,
    });
  }

  const bg = a.background;
  if (bg.type === "color" && HEX.test(bg.color)) {
    const fg = isDarkColor(bg.color) ? "#f4f4f5" : "#18181b";
    const mix = (bgPct: number) => `color-mix(in oklab, ${bg.color} ${bgPct}%, ${fg})`;
    set({
      "--background": bg.color,
      "--foreground": fg,
      "--card": mix(94),
      "--card-foreground": fg,
      "--popover": mix(95),
      "--popover-foreground": fg,
      "--secondary": mix(90),
      "--secondary-foreground": fg,
      "--muted": mix(90),
      "--muted-foreground": `color-mix(in oklab, ${fg} 62%, ${bg.color})`,
      "--accent": mix(88),
      "--accent-foreground": fg,
      "--border": mix(85),
      "--input": mix(82),
      "--sidebar": mix(96),
      "--sidebar-foreground": fg,
      "--sidebar-accent": mix(88),
      "--sidebar-accent-foreground": fg,
      "--sidebar-border": mix(85),
    });
  } else if (bg.type === "image" && imageUrl) {
    // Surfaces become translucent so the photo shows through; popovers stay solid.
    const base = systemDark ? "#0c0c0f" : "#ffffff";
    const fg = systemDark ? "#f4f4f5" : "#18181b";
    const veil = (pct: number) => `color-mix(in srgb, ${base} ${Math.round(pct * 100)}%, transparent)`;
    const tint = (pct: number) => `color-mix(in srgb, ${fg} ${pct}%, transparent)`;
    set({
      "--folio-bg-image": `url("${imageUrl}")`,
      "--background": veil(bg.dim * 0.55),
      "--card": veil(bg.dim),
      "--popover": `color-mix(in srgb, ${base} 96%, ${fg})`,
      "--sidebar": veil(bg.dim),
      "--secondary": tint(10),
      "--muted": tint(10),
      "--accent": tint(14),
      "--sidebar-accent": tint(14),
      "--muted-foreground": `color-mix(in srgb, ${fg} 70%, transparent)`,
      "--border": tint(18),
      "--input": tint(22),
      "--sidebar-border": tint(18),
    });
  }
}

function load(): Appearance {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Appearance | null;
    if (parsed && "background" in parsed) return { ...DEFAULT, ...parsed };
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return DEFAULT;
}

type Store = {
  appearance: Appearance;
  setAccent: (accent: string | null) => void;
  setBackgroundColor: (color: string) => void;
  /** Resolves to an error message, or null on success. */
  setBackgroundImage: (file: File) => Promise<string | null>;
  setDim: (dim: number) => void;
  clearBackground: () => void;
  reset: () => void;
};

const Ctx = React.createContext<Store | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [appearance, setAppearance] = React.useState<Appearance>(DEFAULT);
  const [loaded, setLoaded] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Read after mount (not in useState) so server and client first renders match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppearance(load());
    setLoaded(true);
  }, []);

  const [imageRev, setImageRev] = React.useState(0);
  const hasImage = appearance.background.type === "image";
  React.useEffect(() => {
    if (!hasImage) return;
    let cancelled = false;
    let created: string | null = null;
    getBlob(IMAGE_ID).then((blob) => {
      if (cancelled || !blob) return;
      created = URL.createObjectURL(blob);
      setImageUrl(created);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
      setImageUrl(null);
    };
  }, [hasImage, imageRev]);

  React.useEffect(() => {
    if (!loaded) return;
    applyAppearance(appearance, resolvedTheme === "dark", imageUrl);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      /* storage full or blocked */
    }
  }, [appearance, imageUrl, resolvedTheme, loaded]);

  const store = React.useMemo<Store>(
    () => ({
      appearance,
      setAccent: (accent) => setAppearance((a) => ({ ...a, accent })),
      setBackgroundColor: (color) => {
        // Keep dark: variants (text colours etc.) in step with the chosen background.
        setTheme(isDarkColor(color) ? "dark" : "light");
        setAppearance((a) => ({ ...a, background: { type: "color", color } }));
      },
      setBackgroundImage: async (file) => {
        if (!file.type.startsWith("image/")) return "Choose an image file (JPG, PNG, WebP).";
        try {
          await putBlob(IMAGE_ID, await prepareImage(file));
        } catch (e) {
          return e instanceof UnsupportedImageError
            ? "This browser can’t display that image. Try a JPG or PNG."
            : "Couldn’t save the image — browser storage may be full.";
        }
        setImageRev((r) => r + 1);
        setAppearance((a) => ({
          ...a,
          background: { type: "image", dim: a.background.type === "image" ? a.background.dim : 0.8 },
        }));
        return null;
      },
      setDim: (dim) =>
        setAppearance((a) => (a.background.type === "image" ? { ...a, background: { type: "image", dim } } : a)),
      clearBackground: () => {
        if (appearance.background.type === "image") void deleteBlob(IMAGE_ID);
        setAppearance((a) => ({ ...a, background: { type: "default" } }));
      },
      reset: () => {
        if (appearance.background.type === "image") void deleteBlob(IMAGE_ID);
        setAppearance(DEFAULT);
      },
    }),
    [appearance, setTheme],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useAppearance() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
