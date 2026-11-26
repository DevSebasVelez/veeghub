// Pure script helpers (no acorn): safe to import from client components.

export const BEAT_TYPES = ["hook", "caso", "giro", "pantalla", "cierre"] as const;
export type BeatType = (typeof BEAT_TYPES)[number];

export type Beat = { tipo: BeatType; voz: string; motion?: string };

export const BEAT_LABELS: Record<BeatType, string> = {
  hook: "Gancho",
  caso: "El caso",
  giro: "El giro",
  pantalla: "La solución",
  cierre: "Cierre",
};

export const WORDS_PER_SECOND = 2.5;

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function spokenStats(beats: Beat[]) {
  const words = beats.reduce((total, beat) => total + countWords(beat.voz), 0);
  return { words, seconds: Math.round(words / WORDS_PER_SECOND) };
}

export function voiceText(beats: Beat[], alternativeHook?: string | null) {
  return beats
    .map((beat) => (beat.tipo === "hook" && alternativeHook ? alternativeHook : beat.voz))
    .join("\n\n");
}

/** Full script for the clipboard: voice and motion per beat. */
export function scriptText(idea: { title: string; beats: Beat[] }) {
  const body = idea.beats
    .map((beat) => {
      const lines = [`${BEAT_LABELS[beat.tipo].toUpperCase()}`, `[Voz]: ${beat.voz}`];
      if (beat.motion) lines.push(`[Motion]: ${beat.motion}`);
      return lines.join("\n");
    })
    .join("\n\n");
  return `${idea.title}\n\n${body}`;
}

/** Reads a stored `beats` JSON defensively. */
export function readBeats(value: unknown): Beat[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const beat = item as Partial<Beat>;
    if (!beat || typeof beat.voz !== "string" || !BEAT_TYPES.includes(beat.tipo as BeatType)) return [];
    return [{ tipo: beat.tipo as BeatType, voz: beat.voz, ...(beat.motion ? { motion: beat.motion } : {}) }];
  });
}
