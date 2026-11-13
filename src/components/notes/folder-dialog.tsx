"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOLDER_COLORS, type Folder } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog renames/recolors this folder, otherwise it creates one. */
  folder?: Folder | null;
  defaultColor: string;
  onSubmit: (name: string, color: string) => void;
};

export function FolderDialog({ open, onOpenChange, folder, defaultColor, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Mounted only while open, so the form state resets every time. */}
        <FolderForm
          folder={folder}
          defaultColor={defaultColor}
          onCancel={() => onOpenChange(false)}
          onSubmit={(n, c) => {
            onSubmit(n, c);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FolderForm({
  folder,
  defaultColor,
  onCancel,
  onSubmit,
}: {
  folder?: Folder | null;
  defaultColor: string;
  onCancel: () => void;
  onSubmit: (name: string, color: string) => void;
}) {
  const [name, setName] = React.useState(folder?.name ?? "");
  const [color, setColor] = React.useState(folder?.color ?? defaultColor);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  };

  return (
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{folder ? "Edit folder" : "New folder"}</DialogTitle>
            <DialogDescription>
              Folders group related notes together. Pick a colour to spot them quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="folder-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              maxLength={40}
              placeholder="e.g. Projects"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Colour</span>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    color === c && "ring-2 ring-foreground/60",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {folder ? "Save" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
  );
}
