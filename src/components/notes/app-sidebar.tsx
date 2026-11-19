"use client";

import * as React from "react";
import {
  CalendarDays,
  CircleCheck,
  FileText,
  FolderClosed,
  FolderPlus,
  House,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  NotebookText,
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
import { Logo } from "@/components/logo";
import { AppearanceDialog } from "@/components/appearance-dialog";
import { useAuth } from "@/lib/auth";
import { KIND_META, type Folder, type Kind, type Note, type View } from "@/lib/notes-store";
import { cn } from "@/lib/utils";

export const NOTE_DRAG_TYPE = "application/x-folio-note";

const NAV: { view: View; label: string; Icon: React.ComponentType }[] = [
  { view: { type: "home" }, label: "Home", Icon: House },
  { view: { type: "notes" }, label: "Notes", Icon: FileText },
  { view: { type: "journal" }, label: "Journal", Icon: NotebookText },
  { view: { type: "tasks" }, label: "Tasks", Icon: CircleCheck },
  { view: { type: "calendar" }, label: "Calendar", Icon: CalendarDays },
];

type Props = {
  folders: Folder[];
  notes: Note[];
  view: View;
  onViewChange: (v: View) => void;
  onNewEntry: (kind: Kind) => void;
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
  onNewEntry,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveNote,
}: Props) {
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const auth = useAuth();

  const count = (pred: (n: Note) => boolean) => notes.filter(pred).length;
  const openTasks = count((n) => n.kind === "task" && !n.done);

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
          <Logo className="size-10 shrink-0 drop-shadow-sm" />
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">Folio</p>
            <p className="text-xs text-muted-foreground">Notes, neatly filed</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="w-full justify-start gap-2" size="lg" />}>
            <Plus className="size-4" />
            New
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            {(["note", "journal", "task"] as Kind[]).map((k) => (
              <DropdownMenuItem key={k} onClick={() => onNewEntry(k)}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: KIND_META[k].color }} />
                {k === "journal" ? "Journal entry" : KIND_META[k].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ view: v, label, Icon }) => (
                <SidebarMenuItem key={v.type}>
                  <SidebarMenuButton isActive={isActive(v)} onClick={() => onViewChange(v)}>
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {v.type === "tasks" && openTasks > 0 && <SidebarMenuBadge>{openTasks}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
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
                    {count((n) => n.kind === "note" && n.folderId === f.id)}
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

      <SidebarFooter className="flex-row items-center justify-between gap-1 border-t p-3">
        <p className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground" title={auth.session?.user.email}>
          {auth.enabled ? (auth.session?.user.email ?? "Signed in") : "Saved in this browser"}
        </p>
        {auth.enabled && (
          <Button variant="ghost" size="icon-sm" title="Sign out" aria-label="Sign out" onClick={() => void auth.signOut()}>
            <LogOut />
          </Button>
        )}
        <AppearanceDialog />
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
