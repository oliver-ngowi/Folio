"use client";

import * as React from "react";
import {
  Check,
  ImageIcon,
  ImagePlus,
  Mic,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { uid, type Attachment } from "@/lib/notes-store";
import {
  UnsupportedImageError,
  formatBytes,
  formatDuration,
  prepareImage,
  putBlob,
  useMediaUrl,
} from "@/lib/media-store";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 10 * 60;

type Status = { type: "info" | "error"; text: string } | null;

/* ------------------------------------------------------------------ */
/* Intake: turning files / recordings into stored attachments          */
/* ------------------------------------------------------------------ */

export function useMediaIntake(onAdd: (a: Attachment) => void) {
  const [status, setStatus] = React.useState<Status>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const flash = React.useCallback((type: "info" | "error", text: string) => {
    clearTimeout(timer.current);
    setStatus({ type, text });
    if (type === "info") timer.current = setTimeout(() => setStatus(null), 4000);
  }, []);

  const addImages = React.useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        flash("error", "That file isn’t a photo. Choose a JPG, PNG, GIF or WebP image.");
        return;
      }
      let added = 0;
      let tooBig = 0;
      const unsupported: string[] = [];
      for (const file of images) {
        if (file.size > MAX_IMAGE_BYTES) {
          tooBig++;
          continue;
        }
        try {
          const blob = await prepareImage(file);
          const id = uid();
          await putBlob(id, blob);
          onAdd({ id, kind: "image", name: file.name || "Pasted photo", size: blob.size, createdAt: Date.now() });
          added++;
        } catch (e) {
          if (e instanceof UnsupportedImageError) {
            unsupported.push(`“${file.name}” is really ${e.detected}`);
            continue;
          }
          flash("error", "Couldn’t save the photo — your browser storage may be full or blocked.");
          return;
        }
      }
      if (tooBig) flash("error", `${tooBig} photo${tooBig > 1 ? "s were" : " was"} over 25 MB and skipped.`);
      else if (unsupported.length)
        flash(
          "error",
          `Couldn’t read ${unsupported.join("; ")}, which this browser can’t display. Convert it to JPG or PNG and try again.`,
        );
      else flash("info", `${added} photo${added > 1 ? "s" : ""} added`);
    },
    [flash, onAdd],
  );

  const addRecording = React.useCallback(
    async (blob: Blob, duration: number) => {
      try {
        const id = uid();
        await putBlob(id, blob);
        const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        onAdd({
          id,
          kind: "audio",
          name: `Voice note · ${time}`,
          size: blob.size,
          duration,
          createdAt: Date.now(),
        });
        flash("info", "Voice note saved");
      } catch {
        flash("error", "Couldn’t save the recording — your browser storage may be full or blocked.");
      }
    },
    [flash, onAdd],
  );

  return { status, flash, addImages, addRecording };
}

/* ------------------------------------------------------------------ */
/* Toolbar: Add photo / Record voice                                   */
/* ------------------------------------------------------------------ */

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

function micErrorMessage(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow it in your browser’s site settings, then try again.";
  if (name === "NotFoundError") return "No microphone was found. Connect one and try again.";
  return "Couldn’t start recording. Check your microphone and try again.";
}

export function MediaToolbar({
  intake,
}: {
  intake: ReturnType<typeof useMediaIntake>;
}) {
  const { status, flash, addImages, addRecording } = intake;
  const [recording, setRecording] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const startRecording = () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      flash("error", "Voice recording isn’t supported in this browser.");
      return;
    }
    setRecording(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <VoiceRecorder
            onDone={(blob, seconds) => {
              setRecording(false);
              void addRecording(blob, seconds);
            }}
            onCancel={() => setRecording(false)}
            onError={(msg) => {
              setRecording(false);
              flash("error", msg);
            }}
          />
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus /> Add photo
            </Button>
            <Button variant="outline" size="sm" onClick={startRecording}>
              <Mic /> Record voice
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Tip: you can also paste or drop photos into the note.
            </span>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void addImages(files);
          }}
        />
      </div>
      <div aria-live="polite" role="status" className="min-h-0">
        {status && (
          <p
            className={cn(
              "flex items-start gap-1.5 text-sm",
              status.type === "error" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {status.type === "error" ? (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0" />
            )}
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}

function VoiceRecorder({
  onDone,
  onCancel,
  onError,
}: {
  onDone: (blob: Blob, seconds: number) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [ready, setReady] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const discard = React.useRef(false);
  const startedAt = React.useRef(0);

  const finish = React.useEffectEvent(onDone);
  const fail = React.useEffectEvent(onError);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    const chunks: Blob[] = [];
    // A previous run's cleanup (e.g. React dev double-mount) may have set this.
    discard.current = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const mimeType = pickMimeType();
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (discard.current) return;
          if (chunks.length === 0) {
            fail("Nothing was recorded. Check your microphone and try again.");
            return;
          }
          const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
          finish(blob, (Date.now() - startedAt.current) / 1000);
        };
        startedAt.current = Date.now();
        rec.start();
        setReady(true);
      } catch (e) {
        if (!cancelled) fail(micErrorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      discard.current = true;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      else stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAt.current) / 1000;
      setElapsed(secs);
      if (secs >= MAX_RECORDING_SECONDS && recorder.current?.state === "recording") recorder.current.stop();
    }, 250);
    return () => clearInterval(id);
  }, [ready]);

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const cancel = () => {
    discard.current = true;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    onCancel();
  };

  return (
    <div
      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2"
      role="group"
      aria-label="Voice recorder"
    >
      {ready ? (
        <>
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-red-500" />
          </span>
          <span className="text-sm font-medium">Recording</span>
          <span className="text-sm tabular-nums text-muted-foreground" aria-live="off">
            {formatDuration(elapsed)} / {formatDuration(MAX_RECORDING_SECONDS)}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">Waiting for microphone permission…</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={cancel}>
          <X /> Cancel
        </Button>
        <Button size="sm" onClick={stop} disabled={!ready}>
          <Square className="fill-current" /> Stop &amp; save
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attachment list: photos grid + voice players                        */
/* ------------------------------------------------------------------ */

export function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}) {
  const [toRemove, setToRemove] = React.useState<Attachment | null>(null);
  const [preview, setPreview] = React.useState<Attachment | null>(null);

  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => a.kind === "image");
  const audios = attachments.filter((a) => a.kind === "audio");

  return (
    <section aria-label="Attachments" className="flex flex-col gap-4">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((a) => (
            <li key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
              <PhotoThumb attachment={a} onOpen={() => setPreview(a)} />
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute top-1.5 right-1.5 shadow-sm"
                aria-label={`Remove photo ${a.name}`}
                title="Remove photo"
                onClick={() => setToRemove(a)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {audios.length > 0 && (
        <ul className="flex flex-col gap-2">
          {audios.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Mic className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {a.duration ? formatDuration(a.duration) : ""} · {formatBytes(a.size)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${a.name}`}
                  title="Remove voice note"
                  onClick={() => setToRemove(a)}
                >
                  <Trash2 />
                </Button>
              </div>
              <AudioPlayer attachment={a} />
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove this {toRemove?.kind === "audio" ? "voice note" : "photo"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              “{toRemove?.name}” will be deleted from this note. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => toRemove && onRemove(toRemove.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[min(90vw,60rem)] sm:max-w-3xl">
          <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
          <DialogDescription className="sr-only">Full-size photo preview</DialogDescription>
          {preview && <PhotoFull attachment={preview} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PhotoThumb({ attachment, onOpen }: { attachment: Attachment; onOpen: () => void }) {
  const { url, failed } = useMediaUrl(attachment.id);
  const [broken, setBroken] = React.useState(false);
  if (failed || broken)
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
        <TriangleAlert className="size-5" /> Photo unavailable
      </div>
    );
  if (!url) return <div className="size-full animate-pulse bg-muted" aria-label="Loading photo" />;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open photo ${attachment.name}`}
      className="size-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={attachment.name} className="size-full object-cover" onError={() => setBroken(true)} />
    </button>
  );
}

function PhotoFull({ attachment }: { attachment: Attachment }) {
  const { url, failed } = useMediaUrl(attachment.id);
  const [broken, setBroken] = React.useState(false);
  if (failed || broken) return <p className="text-sm text-muted-foreground">This photo is no longer available.</p>;
  if (!url) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={attachment.name}
      className="max-h-[70vh] w-full rounded-lg object-contain"
      onError={() => setBroken(true)}
    />
  );
}

const BAR_COUNT = 56;
const SPEEDS = [1, 1.5, 2];

/** Downsamples a decoded recording into BAR_COUNT peak values between 0 and 1. */
async function computePeaks(url: string): Promise<number[] | null> {
  try {
    const data = await (await fetch(url)).arrayBuffer();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const buffer = await ctx.decodeAudioData(data);
      const samples = buffer.getChannelData(0);
      const step = Math.max(1, Math.floor(samples.length / BAR_COUNT));
      const peaks = Array.from({ length: BAR_COUNT }, (_, i) => {
        let max = 0;
        for (let j = i * step; j < Math.min(samples.length, (i + 1) * step); j++) {
          max = Math.max(max, Math.abs(samples[j]));
        }
        return max;
      });
      const top = Math.max(...peaks, 0.001);
      return peaks.map((p) => p / top);
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}

function AudioPlayer({ attachment }: { attachment: Attachment }) {
  const { url, failed } = useMediaUrl(attachment.id);
  const audio = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [mediaDuration, setMediaDuration] = React.useState(0);
  const [peaks, setPeaks] = React.useState<number[] | null>(null);
  const [speed, setSpeed] = React.useState(1);

  // MediaRecorder files often report an infinite duration; fall back to the recorded length.
  const duration = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : (attachment.duration ?? 0);

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    computePeaks(url).then((p) => !cancelled && setPeaks(p));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return <p className="text-xs text-muted-foreground">This recording is no longer available.</p>;
  if (!url) return <div className="h-12 animate-pulse rounded-lg bg-muted" />;

  const seek = (to: number) => {
    const el = audio.current;
    if (!el) return;
    const next = Math.min(Math.max(0, to), duration || to);
    el.currentTime = next;
    setTime(next);
  };

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      // Restart from the top if the recording already finished.
      if (duration && el.currentTime >= duration - 0.05) el.currentTime = 0;
      void el.play().catch(() => setPlaying(false));
    } else el.pause();
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  const progress = duration ? Math.min(1, time / duration) : 0;
  const bars = peaks ?? Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + 0.2 * Math.sin(i / 3));

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setMediaDuration(el.duration);
          // Chrome quirk: force the real duration of MediaRecorder webm files to be computed.
          if (el.duration === Infinity) {
            el.currentTime = 1e101;
            el.ontimeupdate = () => {
              el.ontimeupdate = null;
              el.currentTime = 0;
              setMediaDuration(el.duration);
            };
          }
        }}
        onDurationChange={(e) => setMediaDuration(e.currentTarget.duration)}
      />

      <Button
        size="icon"
        className="size-9 shrink-0 rounded-full"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
      </Button>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Seek ${attachment.name}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
        className="flex h-10 min-w-0 flex-1 cursor-pointer touch-none items-center gap-[2px] rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => e.buttons && seekFromPointer(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(time + 5);
          else if (e.key === "ArrowLeft") seek(time - 5);
          else return;
          e.preventDefault();
        }}
      >
        {bars.map((p, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors",
              (i + 0.5) / BAR_COUNT <= progress ? "bg-primary" : "bg-muted-foreground/30",
            )}
            style={{ height: `${Math.max(12, p * 100)}%` }}
          />
        ))}
      </div>

      <span className="w-[5.5rem] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {formatDuration(time)} / {formatDuration(duration)}
      </span>

      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon-sm" onClick={() => seek(time - 5)} aria-label="Back 5 seconds" title="Back 5s">
          <RotateCcw />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => seek(time + 5)} aria-label="Forward 5 seconds" title="Forward 5s">
          <RotateCw />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-10 px-0 text-xs tabular-nums"
          onClick={cycleSpeed}
          aria-label={`Playback speed ${speed}x`}
          title="Playback speed"
        >
          {speed}×
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tiny indicators for lists                                           */
/* ------------------------------------------------------------------ */

export function AttachmentBadges({ attachments }: { attachments: Attachment[] }) {
  const photos = attachments.filter((a) => a.kind === "image").length;
  const voices = attachments.filter((a) => a.kind === "audio").length;
  if (!photos && !voices) return null;
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      {photos > 0 && (
        <span className="flex items-center gap-0.5" title={`${photos} photo${photos > 1 ? "s" : ""}`}>
          <ImageIcon className="size-3.5" />
          {photos}
        </span>
      )}
      {voices > 0 && (
        <span className="flex items-center gap-0.5" title={`${voices} voice note${voices > 1 ? "s" : ""}`}>
          <Mic className="size-3.5" />
          {voices}
        </span>
      )}
    </span>
  );
}
