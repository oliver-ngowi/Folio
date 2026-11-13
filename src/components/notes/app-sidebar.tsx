"use client";

import * as React from "react";
import {
  FileText,
  FolderClosed,
  FolderPlus,
  House,
  Inbox,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Folder, Note, View } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

export const NOTE_DRAG_TYPE = "application/x-folio-note";

type Props = {
  folders: Folder[];
  notes: Note[];
  view: View;
  onViewChange: (v: View) => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onEditFolder: (f: Folder) => void;
  onDeleteFolder: (f: Folder) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
};

export function AppSidebar({
  folders,
  notes,
  view,
  onViewChange,
  onNewNote,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveNote,
}: Props) {
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);

  const count = (pred: (n: Note) => boolean) => notes.filter(pred).length;

  // Props that turn a sidebar entry into a drop zone for dragged notes.
  const dropProps = (key: string, folderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(NOTE_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(NOTE_DRAG_TYPE);
      setDropTarget(null);
      if (id) {
        e.preventDefault();
        onMoveNote(id, folderId);
      }
    },
  });

  const dropClass = (key: string) =>
    dropTarget === key && "bg-primary/10 ring-2 ring-primary/50 ring-inset";

  const isActive = (v: View) =>
    v.type === view.type && (v.type !== "folder" || (view.type === "folder" && v.id === view.id));

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <NotebookPen className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">Folio</p>
            <p className="text-xs text-muted-foreground">Notes, neatly filed</p>
          </div>
        </div>
        <Button onClick={onNewNote} className="w-full justify-start gap-2" size="lg">
          <Plus className="size-4" />
          New note
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive({ type: "home" })}
                  onClick={() => onViewChange({ type: "home" })}
                >
                  <House />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive({ type: "all" })}
                  onClick={() => onViewChange({ type: "all" })}
                >
                  <FileText />
                  <span>All notes</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{notes.length}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive({ type: "pinned" })}
                  onClick={() => onViewChange({ type: "pinned" })}
                >
                  <Pin />
                  <span>Pinned</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{count((n) => n.pinned)}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive({ type: "unfiled" })}
                  onClick={() => onViewChange({ type: "unfiled" })}
                  className={cn(dropClass("unfiled"))}
                  {...dropProps("unfiled", null)}
                >
                  <Inbox />
                  <span>Unfiled</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{count((n) => n.folderId === null)}</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupAction title="New folder" onClick={onNewFolder}>
            <FolderPlus />
            <span className="sr-only">New folder</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {folders.length === 0 && (
                <li className="px-2 py-3">
                  <button
                    onClick={onNewFolder}
                    className="w-full rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    Create your first folder
                  </button>
                </li>
              )}
              {folders.map((f) => (
                <SidebarMenuItem key={f.id}>
                  <SidebarMenuButton
                    isActive={isActive({ type: "folder", id: f.id })}
                    onClick={() => onViewChange({ type: "folder", id: f.id })}
                    className={cn(dropClass(f.id))}
                    {...dropProps(f.id, f.id)}
                  >
                    <FolderClosed style={{ color: f.color }} className="fill-current/20" />
                    <span className="truncate">{f.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="peer-hover/menu-button:opacity-0 group-hover/menu-item:opacity-0">
                    {count((n) => n.folderId === f.id)}
                  </SidebarMenuBadge>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<SidebarMenuAction showOnHover />}>
                      <MoreHorizontal />
                      <span className="sr-only">Folder options</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem onClick={() => onEditFolder(f)}>
                        <Pencil /> Rename / recolour
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDeleteFolder(f)}>
                        <Trash2 /> Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex-row items-center justify-between border-t p-3">
        <p className="px-1 text-xs text-muted-foreground">Saved in this browser</p>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
