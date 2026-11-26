"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Video,
  X,
} from "lucide-react";

import { setIdeaStage } from "@/lib/admin/actions/marketing/actions";
import { BEAT_LABELS, type Beat } from "@/lib/marketing/idea-script";
import { cn } from "@/lib/utils";

type Settings = { font: number; speed: number; mirror: boolean; countdown: number };

const DEFAULTS: Settings = { font: 44, speed: 40, mirror: false, countdown: 3 };
const KEY = "veeghub:teleprompter";
const FONT = { min: 24, max: 96, step: 4 };
const SPEED = { min: 10, max: 150, step: 5 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Settings live in localStorage and are shared by every idea, like the HTML visor.
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Settings = DEFAULTS;

function readSettings(): Settings {
  const raw = localStorage.getItem(KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<Settings>;
    cached = {
      font: clamp(Number(parsed.font) || DEFAULTS.font, FONT.min, FONT.max),
      speed: clamp(Number(parsed.speed) || DEFAULTS.speed, SPEED.min, SPEED.max),
      mirror: parsed.mirror === true,
      countdown: [0, 3, 5].includes(Number(parsed.countdown)) ? Number(parsed.countdown) : DEFAULTS.countdown,
    };
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

function writeSettings(next: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: settings last for this page only.
    cachedRaw = JSON.stringify(next);
    cached = next;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function IconButton({
  label,
  onClick,
  children,
  active,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-white/90 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60",
        active && "bg-white/15 text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Teleprompter({
  idea,
  prevHref,
  nextHref,
  backHref,
}: {
  idea: { id: string; title: string; beats: Beat[]; alternativeHook: string | null; stage: string };
  prevHref: string | null;
  nextHref: string | null;
  backHref: string;
}) {
  const router = useRouter();
  const settings = useSyncExternalStore(subscribe, readSettings, () => DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [useAlt, setUseAlt] = useState(false);
  const [marking, setMarking] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const frame = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const update = useCallback((patch: Partial<Settings>) => writeSettings({ ...readSettings(), ...patch }), []);

  const stop = useCallback(() => {
    setPlaying(false);
    setCount(null);
  }, []);

  const start = useCallback(() => {
    const el = area.current;
    if (!el) return;
    if (el.scrollTop >= el.scrollHeight - el.clientHeight - 2) el.scrollTop = 0;
    const seconds = readSettings().countdown;
    if (seconds) setCount(seconds);
    else setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (playing || count !== null) stop();
    else start();
  }, [playing, count, start, stop]);

  const restart = useCallback(() => {
    stop();
    if (area.current) area.current.scrollTop = 0;
  }, [stop]);

  // Countdown 3-2-1, then roll.
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      const timer = setTimeout(() => {
        setCount(null);
        setPlaying(true);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCount((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  // Scroll loop at `speed` px/s, independent of the frame rate.
  useEffect(() => {
    const el = area.current;
    if (!playing || !el) return;
    let last: number | null = null;
    position.current = el.scrollTop;

    function tick(time: number) {
      if (!el) return;
      if (last !== null) position.current += (Math.min(time - last, 100) / 1000) * readSettings().speed;
      last = time;
      el.scrollTop = position.current;
      if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [playing]);

  // Keep the phone screen on while reading.
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let released = false;
    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        if (released) lock.release();
        else wakeLock.current = lock;
      })
      .catch(() => null);
    return () => {
      released = true;
      wakeLock.current?.release().catch(() => null);
      wakeLock.current = null;
    };
  }, [playing]);

  useEffect(() => {
    const onHide = () => document.hidden && stop();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stop]);

  // The admin page behind must not scroll while the prompter is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      const s = readSettings();
      switch (event.key) {
        case " ":
          event.preventDefault();
          toggle();
          break;
        case "ArrowUp":
          event.preventDefault();
          update({ speed: clamp(s.speed + SPEED.step, SPEED.min, SPEED.max) });
          break;
        case "ArrowDown":
          event.preventDefault();
          update({ speed: clamp(s.speed - SPEED.step, SPEED.min, SPEED.max) });
          break;
        case "+":
        case "=":
          update({ font: clamp(s.font + FONT.step, FONT.min, FONT.max) });
          break;
        case "-":
          update({ font: clamp(s.font - FONT.step, FONT.min, FONT.max) });
          break;
        case "m":
        case "M":
          update({ mirror: !s.mirror });
          break;
        case "r":
        case "R":
          restart();
          break;
        case "Escape":
          router.push(backHref);
          break;
        case "ArrowLeft":
          if (prevHref) router.push(prevHref);
          break;
        case "ArrowRight":
          if (nextHref) router.push(nextHref);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, restart, update, router, backHref, prevHref, nextHref]);

  async function markRecorded() {
    setMarking(true);
    try {
      const result = await setIdeaStage(idea.id, "GRABADO");
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo marcar.");
        return;
      }
      toast.success("Marcada como grabada.");
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  const rolling = playing || count !== null;
  const beats = idea.beats.map((beat) =>
    beat.tipo === "hook" && useAlt && idea.alternativeHook ? { ...beat, voz: idea.alternativeHook } : beat,
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Teleprompter: ${idea.title}`}
    >
      <header
        className={cn(
          "flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] transition-opacity",
          playing && "opacity-30 hover:opacity-100",
        )}
      >
        <IconButton label="Cerrar teleprompter" onClick={() => router.push(backHref)}>
          <X className="size-5" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-white/80">{idea.title}</h1>
        {idea.stage !== "GRABADO" && idea.stage !== "EDITADO" && idea.stage !== "PUBLICADO" ? (
          <button
            type="button"
            onClick={markRecorded}
            disabled={marking}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            <Video className="size-4" />
            <span className="max-sm:sr-only">Marcar grabado</span>
          </button>
        ) : null}
        {prevHref ? (
          <Link href={prevHref} aria-label="Idea anterior" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10">
            <ChevronLeft className="size-5" />
          </Link>
        ) : null}
        {nextHref ? (
          <Link href={nextHref} aria-label="Idea siguiente" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10">
            <ChevronRight className="size-5" />
          </Link>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {/* Reading line: keep the eyes here. */}
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-10 flex items-center" aria-hidden>
          <span className="h-0 w-0 border-y-[10px] border-l-[14px] border-y-transparent border-l-emerald-400" />
          <span className="h-px flex-1 bg-emerald-400/30" />
        </div>

        <div
          ref={area}
          tabIndex={0}
          onClick={toggle}
          onWheel={() => playing && stop()}
          onTouchMove={() => playing && stop()}
          className="h-full overflow-y-auto overscroll-contain px-5 outline-none [scrollbar-width:none] sm:px-12 [&::-webkit-scrollbar]:hidden"
          aria-label="Texto del guion. Toca para iniciar o pausar."
        >
          <div
            className={cn("mx-auto max-w-4xl pb-[75vh] pt-[30vh]", settings.mirror && "-scale-x-100")}
            style={{ fontSize: settings.font, lineHeight: 1.35 }}
          >
            {beats.map((beat, index) => (
              <section key={index} className="mb-[1.2em]">
                <p className="mb-1 font-sans text-xs font-medium uppercase tracking-widest text-white/40" style={{ fontSize: 12 }}>
                  {BEAT_LABELS[beat.tipo]}
                </p>
                <p className="font-medium">{beat.voz}</p>
              </section>
            ))}
            <p className="text-white/40" style={{ fontSize: Math.max(16, settings.font * 0.5) }}>
              — Fin —
            </p>
          </div>
        </div>

        {count !== null && count > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60" aria-live="assertive">
            <span className="text-[30vmin] font-semibold tabular-nums">{count}</span>
          </div>
        ) : null}
      </div>

      <footer
        className={cn(
          "border-t border-white/10 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 transition-opacity",
          playing && "opacity-30 hover:opacity-100",
        )}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-1 gap-y-2">
          <IconButton label="Volver al inicio" onClick={restart}>
            <RotateCcw className="size-5" />
          </IconButton>
          <button
            type="button"
            onClick={toggle}
            className="flex h-12 min-w-32 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {rolling ? <Pause className="size-5" /> : <Play className="size-5" />}
            {rolling ? "Pausar" : "Iniciar"}
          </button>

          <div className="flex items-center rounded-full bg-white/5" role="group" aria-label="Velocidad">
            <IconButton label="Más lento" onClick={() => update({ speed: clamp(settings.speed - SPEED.step, SPEED.min, SPEED.max) })}>
              <Minus className="size-4" />
            </IconButton>
            <span className="w-14 text-center text-xs tabular-nums text-white/80" aria-live="polite">
              <span className="sr-only">Velocidad </span>
              {settings.speed}
              <span className="block text-[10px] text-white/40">vel.</span>
            </span>
            <IconButton label="Más rápido" onClick={() => update({ speed: clamp(settings.speed + SPEED.step, SPEED.min, SPEED.max) })}>
              <Plus className="size-4" />
            </IconButton>
          </div>

          <div className="flex items-center rounded-full bg-white/5" role="group" aria-label="Tamaño de letra">
            <IconButton label="Letra más chica" onClick={() => update({ font: clamp(settings.font - FONT.step, FONT.min, FONT.max) })}>
              <span className="text-sm font-semibold">A-</span>
            </IconButton>
            <span className="w-12 text-center text-xs tabular-nums text-white/80" aria-live="polite">
              <span className="sr-only">Letra </span>
              {settings.font}
              <span className="block text-[10px] text-white/40">px</span>
            </span>
            <IconButton label="Letra más grande" onClick={() => update({ font: clamp(settings.font + FONT.step, FONT.min, FONT.max) })}>
              <span className="text-base font-semibold">A+</span>
            </IconButton>
          </div>

          <IconButton label="Espejo horizontal" active={settings.mirror} onClick={() => update({ mirror: !settings.mirror })}>
            <FlipHorizontal2 className="size-5" />
          </IconButton>

          <button
            type="button"
            onClick={() => update({ countdown: settings.countdown === 0 ? 3 : settings.countdown === 3 ? 5 : 0 })}
            className="flex h-11 items-center rounded-full px-3 text-xs text-white/80 hover:bg-white/10"
            aria-label={`Cuenta regresiva: ${settings.countdown ? `${settings.countdown} segundos` : "sin cuenta"}`}
          >
            {settings.countdown ? `${settings.countdown} s antes` : "Sin cuenta"}
          </button>

          {idea.alternativeHook ? (
            <button
              type="button"
              onClick={() => setUseAlt((value) => !value)}
              aria-pressed={useAlt}
              className={cn(
                "flex h-11 items-center rounded-full px-3 text-xs text-white/80 hover:bg-white/10",
                useAlt && "bg-white/15 text-white",
              )}
            >
              {useAlt ? "Gancho alternativo" : "Gancho principal"}
            </button>
          ) : null}
        </div>
        <p className="mt-1 hidden text-center text-[11px] text-white/40 sm:block">
          Espacio iniciar/pausar · ↑↓ velocidad · +/− letra · M espejo · R inicio · ←→ otra idea · Esc salir
        </p>
      </footer>
    </div>
  );
}
