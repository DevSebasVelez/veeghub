import { parse, type Expression, type Node, type Program } from "acorn";

/**
 * Parser of the five «Banco de Ideas» HTML files (plan F2). Pure: no database,
 * so it runs in tests, in the CLI script and in the upload action.
 *
 * - Files 1-4 declare `const rawScripts = [...]` inside a <script>. The literal
 *   is read from acorn's syntax tree: only arrays, objects, strings and
 *   numbers are accepted. Nothing in the file is ever executed (no eval).
 * - File 5 carries its data as JSON in `<script id="reel-data">`.
 *
 * Both shapes end up as `beats[]` (hook, caso, giro, pantalla, cierre).
 */

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

export type ImportedIdea = {
  source: string;
  legacyId: number;
  title: string;
  sector: string | null;
  category: string | null;
  format: string;
  priority: number | null;
  audience: string | null;
  beats: Beat[];
  visualPrompt: string | null;
  notes: string | null;
  meta: Record<string, unknown> | null;
  words: number;
  seconds: number;
};

/** What each legacy file is. The name is matched by its leading number. */
const LEGACY_FILES: Record<string, { category: string; format: string }> = {
  "1": { category: "Principales", format: "Reel corto" },
  "2": { category: "Largos enterprise", format: "Reel largo" },
  "3": { category: "Ventas rápidas", format: "Reel corto" },
  "4": { category: "Universales", format: "Reel corto" },
  "5": { category: "Ingeniería e IA aplicada", format: "Reel corto" },
};

/** ≈2,5 palabras por segundo hablando a cámara (plan F4). */
export const WORDS_PER_SECOND = 2.5;

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function spokenStats(beats: Beat[]) {
  const words = beats.reduce((total, beat) => total + countWords(beat.voz), 0);
  return { words, seconds: Math.round(words / WORDS_PER_SECOND) };
}

// ─── Safe literal evaluation ────────────────────────────────────────────────

type Literal = string | number | boolean | null | Literal[] | { [key: string]: Literal };

function literal(node: Node | null): Literal {
  if (!node) return null;
  const n = node as Expression;

  switch (n.type) {
    case "ArrayExpression":
      return n.elements.map((element) => {
        if (element?.type === "SpreadElement") throw new Error("Spread no permitido");
        return literal(element);
      });
    case "ObjectExpression":
      return Object.fromEntries(
        n.properties.map((property) => {
          if (property.type !== "Property" || property.computed || property.kind !== "init") {
            throw new Error("Propiedad no permitida");
          }
          const key =
            property.key.type === "Identifier"
              ? property.key.name
              : property.key.type === "Literal"
                ? String(property.key.value)
                : null;
          if (key === null) throw new Error("Clave no permitida");
          return [key, literal(property.value)];
        }),
      );
    case "Literal":
      if (n.value instanceof RegExp || typeof n.value === "bigint") throw new Error("Literal no permitido");
      return n.value as Literal;
    case "TemplateLiteral":
      if (n.expressions.length) throw new Error("Plantilla con expresiones no permitida");
      return n.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
    case "UnaryExpression":
      if (n.operator === "-" && n.argument.type === "Literal" && typeof n.argument.value === "number") {
        return -n.argument.value;
      }
      throw new Error("Operador no permitido");
    default:
      throw new Error(`Expresión no permitida: ${n.type}`);
  }
}

function findRawScripts(program: Program): Literal | undefined {
  for (const statement of program.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.type === "Identifier" && declaration.id.name === "rawScripts") {
        return literal(declaration.init ?? null);
      }
    }
  }
  return undefined;
}

function inlineScripts(html: string) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

// ─── Normalizers ────────────────────────────────────────────────────────────

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function legacyInfo(fileName: string) {
  const info = LEGACY_FILES[fileName.trim().charAt(0)];
  if (!info) throw new Error(`«${fileName}» no es uno de los 5 archivos del banco de ideas.`);
  return info;
}

/** Files 1-4: flat `<beat>_voice` / `<beat>_motion` fields. */
function fromRawScript(source: string, raw: Record<string, Literal>): ImportedIdea {
  const { category, format } = legacyInfo(source);
  const beats = BEAT_TYPES.map((tipo) => {
    const motion = text(raw[`${tipo}_motion`]);
    return { tipo, voz: text(raw[`${tipo}_voice`]) ?? "", ...(motion ? { motion } : {}) };
  }).filter((beat) => beat.voz);

  if (typeof raw.id !== "number" || !text(raw.title)) {
    throw new Error(`${source}: un guion no tiene id o título.`);
  }

  return {
    source,
    legacyId: raw.id,
    title: text(raw.title)!,
    sector: text(raw.sector),
    category,
    format,
    priority: null,
    audience: null,
    beats,
    visualPrompt: text(raw.prompt),
    notes: null,
    meta: null,
    ...spokenStats(beats),
  };
}

/** File 5: `voice[]` in beat order, `visual[]` as a sequence, extras to `meta`. */
function fromReelData(source: string, raw: Record<string, Literal>): ImportedIdea {
  const { format } = legacyInfo(source);
  const voices = Array.isArray(raw.voice) ? raw.voice.map((v) => text(v) ?? "") : [];
  const beats = voices
    .slice(0, BEAT_TYPES.length)
    .map((voz, index) => ({ tipo: BEAT_TYPES[index], voz }))
    .filter((beat) => beat.voz);

  if (typeof raw.id !== "number" || !text(raw.title)) {
    throw new Error(`${source}: un guion no tiene id o título.`);
  }

  const audience = text(raw.audience);
  // «Gerencia y responsables de operaciones · Taller metalmecánico»: the sector is after the dot.
  const sector = audience?.includes("·") ? audience.split("·").pop()!.trim() : null;
  const stats = spokenStats(beats);

  const { category, priority, note, prompt, words, seconds } = raw;
  const OWN = new Set(["id", "title", "category", "priority", "audience", "voice", "note", "prompt", "words", "seconds"]);
  const rest = Object.fromEntries(Object.entries(raw).filter(([key]) => !OWN.has(key)));

  return {
    source,
    legacyId: raw.id,
    title: text(raw.title)!,
    sector,
    category: text(category),
    format,
    priority: typeof priority === "number" ? priority : null,
    audience,
    beats,
    visualPrompt: text(prompt),
    notes: text(note),
    // alternative (gancho alternativo), visual[], offer, benefit, paid_closing, day…
    meta: Object.keys(rest).length ? rest : null,
    words: typeof words === "number" ? words : stats.words,
    seconds: typeof seconds === "number" ? seconds : stats.seconds,
  };
}

/** Reads one of the five HTML files. Throws with a readable message when it cannot. */
export function parseIdeasHtml(fileName: string, html: string): ImportedIdea[] {
  const source = fileName.split(/[\\/]/).pop()!.trim();
  legacyInfo(source);

  const reelData = html.match(/<script[^>]*\bid=["']reel-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (reelData) {
    const data = JSON.parse(reelData[1]) as unknown;
    if (!Array.isArray(data)) throw new Error(`${source}: #reel-data no es una lista.`);
    return data.map((raw) => fromReelData(source, raw as Record<string, Literal>));
  }

  for (const code of inlineScripts(html)) {
    let program: Program;
    try {
      program = parse(code, { ecmaVersion: "latest", sourceType: "script" });
    } catch {
      continue;
    }
    const raw = findRawScripts(program);
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) throw new Error(`${source}: rawScripts no es una lista.`);
    return raw.map((item) => fromRawScript(source, item as Record<string, Literal>));
  }

  throw new Error(`${source}: no encontré los guiones (ni rawScripts ni #reel-data).`);
}

/** The text read to camera, one beat per paragraph. Uses the alternative hook when asked. */
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
