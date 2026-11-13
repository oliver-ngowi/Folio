# Folio

A note taker that can be used to journal your experience and bucketlist allowing one to attach pictures and record audio.

Built with [Next.js](https://nextjs.org), Tailwind CSS and [shadcn/ui](https://ui.shadcn.com), with the app shell based on the free *Dashboard Shell 01* sidebar layout from [Shadcn Space](https://shadcnspace.com).

## Features

- **Home** – search all notes from one big search bar, or tap **Write** to start a note instantly. Recent notes have a `…` menu with Edit and Delete.
- **Folders** – group notes into colour-coded folders; rename, recolour or delete them. Deleting a folder moves its notes to *Unfiled*. Drag a note onto a folder to move it.
- **Photos** – add, paste or drag-and-drop pictures into a note. Large photos are resized automatically; click one to view it full size.
- **Voice notes** – record audio straight from the microphone and play it back inside the note.
- **Pin, search and sort** notes; light and dark mode; works on phones.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Voice recording needs microphone permission, and works on `localhost` or any HTTPS site.

## Where data lives

Everything is stored privately **in the browser**: note text in `localStorage`, photos and recordings in IndexedDB. There is no server or account, so notes do not sync between devices, and clearing site data erases them.

## Deploying

No environment variables are needed. The easiest option is [Vercel](https://vercel.com/new): import this repository and deploy with the default Next.js settings. Any host that runs `npm run build` and `npm start` also works.

```bash
npm run build
npm start
```

## Project layout

- `src/components/notes/` – sidebar, home screen, note list, editor, attachments
- `src/lib/notes-store.tsx` – notes and folders state with persistence
- `src/lib/media-store.ts` – IndexedDB storage for photos and recordings
- `src/components/ui/` – shadcn/ui components
