"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, ImagePlus, Monitor, Moon, Palette, RotateCcw, Sun, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCENTS, BACKGROUNDS, useAppearance } from "@/lib/appearance";
import { cn } from "@/lib/utils";

function Swatch({
  color,
  label,
  selected,
  onClick,
}: {
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-full border border-black/10 shadow-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-white/20",
        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
      )}
      style={{ backgroundColor: color }}
    >
      {selected && <Check className="size-4 text-white mix-blend-difference" />}
    </button>
  );
}

/** A rainbow swatch that opens the browser's native colour picker. */
function CustomColor({
  label,
  value,
  active,
  onChange,
}: {
  label: string;
  value: string;
  active: boolean;
  onChange: (hex: string) => void;
}) {
  return (
    <label
      title={label}
      className={cn(
        "relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black/10 shadow-sm transition-transform hover:scale-105 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring dark:border-white/20",
        active && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
      )}
      style={{
        background: active
          ? value
          : "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #ec4899, #ef4444)",
      }}
    >
      <span className="sr-only">{label}</span>
      {active && <Check className="size-4 text-white mix-blend-difference" />}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

export function AppearanceDialog() {
  const [open, setOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const a = useAppearance();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const bg = a.appearance.background;
  const customAccent = a.appearance.accent && !ACCENTS.some((c) => c.value === a.appearance.accent);
  const customBg = bg.type === "color" && !BACKGROUNDS.some((c) => c.value === bg.color);
  const modes = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <>
      <Button variant="ghost" size="icon" title="Customize theme" aria-label="Customize theme" onClick={() => setOpen(true)}>
        <Palette className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make it yours</DialogTitle>
            <DialogDescription>Pick your colours and background. Changes apply instantly.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Section title="Mode">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {modes.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    aria-pressed={theme === key}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors",
                      theme === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Accent colour">
              <div className="flex flex-wrap items-center gap-2.5">
                {ACCENTS.map((c) => (
                  <Swatch
                    key={c.value}
                    color={c.value}
                    label={c.name}
                    selected={a.appearance.accent === c.value}
                    onClick={() => a.setAccent(c.value)}
                  />
                ))}
                <CustomColor
                  label="Custom accent colour"
                  value={a.appearance.accent ?? "#6366f1"}
                  active={!!customAccent}
                  onChange={a.setAccent}
                />
              </div>
            </Section>

            <Section title="Background">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={a.clearBackground}
                  aria-pressed={bg.type === "default"}
                  title="Default"
                  className={cn(
                    "flex h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted",
                    bg.type === "default" && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  )}
                >
                  Default
                </button>
                {BACKGROUNDS.map((c) => (
                  <Swatch
                    key={c.value}
                    color={c.value}
                    label={c.name}
                    selected={bg.type === "color" && bg.color === c.value}
                    onClick={() => a.setBackgroundColor(c.value)}
                  />
                ))}
                <CustomColor
                  label="Custom background colour"
                  value={bg.type === "color" ? bg.color : "#f5f5f4"}
                  active={customBg}
                  onChange={a.setBackgroundColor}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> {bg.type === "image" ? "Change photo" : "Use my own photo"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setError(await a.setBackgroundImage(file));
                  }}
                />
              </div>

              {bg.type === "image" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dim" className="text-xs text-muted-foreground">
                    Photo visibility
                  </label>
                  {/* Higher opacity = more solid panels = more readable text, less photo. */}
                  <input
                    id="dim"
                    type="range"
                    min={0.4}
                    max={0.95}
                    step={0.05}
                    value={bg.dim}
                    onChange={(e) => a.setDim(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>More photo</span>
                    <span>More readable</span>
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}
            </Section>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={a.reset}>
                <RotateCcw /> Reset to default
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
