import type { ContentChannelValue, ContentStatusValue } from "./constants";
import { stripUtm } from "./utm";

/**
 * Parser of `veegsoft-web/docs/marketing/posts-industrias.md`, the schedule of
 * the industries launch. Pure (text in, data out) so the CLI script and the
 * upload in the calendar share it, and so it can be tested without a database.
 *
 * What it relies on in the file:
 * - the «Cronograma» table: `| N | mar 1-dic-2026 | Industria | … |`, and the
 *   LinkedIn URL of the already published row as a markdown link;
 * - one `## N · Nombre` section per row, with `**Imágenes:**`, a LinkedIn code
 *   block (under `### LinkedIn`, or the first block when the section has no
 *   subheadings), the code block after `**🔗 Comentario:**`, and optionally
 *   `### Google Business Profile` with its block and the `**Botón…:**` URL.
 */

export type ImportedPost = {
  /** Stable key inside the file, e.g. "1-LINKEDIN_PERSONAL". */
  key: string;
  number: number;
  channel: ContentChannelValue;
  title: string;
  body: string;
  firstComment: string | null;
  linkUrl: string | null;
  /** Wall-clock reading in Ecuador, "yyyy-MM-ddTHH:mm". */
  scheduledLocal: string | null;
  status: ContentStatusValue;
  externalUrl: string | null;
  /** R2 keys of the library images, in order. */
  assetKeys: string[];
};

export type ImportedCampaign = {
  name: string;
  slug: string;
  startsOn: string | null;
  endsOn: string | null;
  posts: ImportedPost[];
};

/** Hour the file prescribes: «martes, 7:30–9:00 (Ecuador)». */
export const DEFAULT_POST_TIME = "07:30";

export const INDUSTRIAS_ASSET_PREFIX = "marketing/industrias/";

/** The launch carousel actually published (slides.html rendered to JPG). */
export const LAUNCH_ASSET_KEYS = [1, 2, 3].map(
  (n) => `marketing/linkedin-lanzamiento/veegsoft-industrias-${n}.jpg`,
);

const MONTHS: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

type ScheduleRow = { date: string; publishedUrl: string | null };

/** "mar 1-dic-2026" → "2026-12-01". */
export function parseSpanishDay(text: string) {
  const match = text.match(/(\d{1,2})-([a-záéíóú]{3})[a-z]*-(\d{4})/i);
  if (!match) return null;

  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;

  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function parseSchedule(lines: string[]) {
  const rows = new Map<number, ScheduleRow>();

  for (const line of lines) {
    const cells = line.split("|").map((cell) => cell.trim());
    // ["", "#", "Fecha", …, ""]
    if (cells.length < 4) continue;

    const number = Number(cells[1]);
    if (!Number.isInteger(number) || cells[1] === "") continue;

    const date = parseSpanishDay(cells[2]);
    if (!date) continue;

    const link = line.match(/\]\((https:\/\/www\.linkedin\.com\/[^)\s]+)\)/);
    rows.set(number, { date, publishedUrl: link?.[1] ?? null });
  }

  return rows;
}

/** Content of the first fenced block at or after `from`. */
function codeBlockAfter(lines: string[], from: number, until = lines.length) {
  let start = -1;

  for (let i = from; i < until; i++) {
    if (lines[i].trim().startsWith("```")) {
      if (start === -1) {
        start = i + 1;
      } else {
        return {
          text: lines.slice(start, i).join("\n").trim(),
          end: i,
        };
      }
    }
  }

  return null;
}

function findLine(lines: string[], test: (line: string) => boolean, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (test(lines[i])) return i;
  }
  return -1;
}

function backticked(line: string) {
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
}

/**
 * `manufactura/a.webp`, `b.webp` → both under manufactura/. The file lists the
 * folder only on the first image of each section.
 */
function imageKeys(line: string) {
  let folder = "";

  return backticked(line)
    .filter((path) => /\.(webp|jpe?g|png)$/i.test(path))
    .map((path) => {
      const slash = path.lastIndexOf("/");
      if (slash !== -1) folder = path.slice(0, slash);
      const file = slash === -1 ? path : path.slice(slash + 1);
      return `${INDUSTRIAS_ASSET_PREFIX}${folder ? `${folder}/` : ""}${file}`;
    });
}

function firstUrl(text: string) {
  return text.match(/https?:\/\/\S+/)?.[0] ?? null;
}

/** Splits «text + URL» blocks: the URL becomes linkUrl, the rest the comment. */
function splitComment(text: string) {
  const url = firstUrl(text);
  if (!url) return { comment: text.trim() || null, linkUrl: null };

  const comment = text
    .split("\n")
    .filter((line) => !line.includes(url))
    .join("\n")
    .trim();

  return { comment: comment || null, linkUrl: stripUtm(url) };
}

export function parsePostsIndustrias(markdown: string): ImportedCampaign {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const schedule = parseSchedule(lines);
  const posts: ImportedPost[] = [];

  const sectionStarts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^##\s+\d+\s*·/.test(line));

  if (!schedule.size || !sectionStarts.length) {
    throw new Error(
      "El archivo no tiene la tabla de cronograma ni secciones «## N · …».",
    );
  }

  sectionStarts.forEach(({ line, index }, position) => {
    const end = sectionStarts[position + 1]?.index ?? lines.length;
    const section = lines.slice(index, end);
    const header = line.match(/^##\s+(\d+)\s*·\s*(.+?)\s*(\(.*\))?$/);
    if (!header) return;

    const number = Number(header[1]);
    const name = header[2].trim();
    const row = schedule.get(number);
    const scheduledLocal = row ? `${row.date}T${DEFAULT_POST_TIME}` : null;

    const imagesLine = section.find((l) => l.startsWith("**Imágenes:**")) ?? "";
    const images = imageKeys(imagesLine);

    const linkedInHeading = findLine(section, (l) => /^###\s+LinkedIn/i.test(l));
    const gbpHeading = findLine(section, (l) =>
      /^###\s+Google Business Profile/i.test(l),
    );
    const hasSubheadings = findLine(section, (l) => l.startsWith("### ")) !== -1;

    // LinkedIn
    const linkedInFrom = linkedInHeading !== -1 ? linkedInHeading : 0;
    const linkedInUntil = gbpHeading !== -1 ? gbpHeading : section.length;
    const linkedIn =
      linkedInHeading !== -1 || !hasSubheadings
        ? codeBlockAfter(section, linkedInFrom, linkedInUntil)
        : null;

    if (linkedIn) {
      const commentLabel = findLine(
        section,
        (l) => l.includes("Comentario:**"),
        linkedIn.end,
      );
      const commentBlock =
        commentLabel !== -1 && commentLabel < linkedInUntil
          ? codeBlockAfter(section, commentLabel, linkedInUntil)
          : null;
      const { comment, linkUrl } = splitComment(commentBlock?.text ?? "");
      const published = Boolean(row?.publishedUrl);

      posts.push({
        key: `${number}-LINKEDIN_PERSONAL`,
        number,
        channel: "LINKEDIN_PERSONAL",
        title: `${name} · LinkedIn`,
        body: linkedIn.text,
        firstComment: comment,
        linkUrl,
        scheduledLocal,
        status: published ? "PUBLICADO" : "BORRADOR",
        externalUrl: row?.publishedUrl ?? null,
        assetKeys: number === 0 && !images.length ? LAUNCH_ASSET_KEYS : images,
      });
    }

    // Google Business Profile: one image, the 3D render (first in the list).
    if (gbpHeading !== -1) {
      const gbp = codeBlockAfter(section, gbpHeading);
      if (gbp) {
        const buttonLine = section.find(
          (l, i) => i > gbp.end && l.startsWith("**Botón"),
        );
        const buttonUrl = buttonLine ? firstUrl(backticked(buttonLine).join(" ")) : null;

        posts.push({
          key: `${number}-GBP`,
          number,
          channel: "GBP",
          title: `${name} · GBP`,
          body: gbp.text,
          firstComment: null,
          linkUrl: buttonUrl ? stripUtm(buttonUrl) : null,
          scheduledLocal,
          status: "BORRADOR",
          externalUrl: null,
          assetKeys: images.slice(0, 1),
        });
      }
    }
  });

  const dates = [...schedule.values()].map((row) => row.date).sort();

  return {
    name: "Lanzamiento industrias",
    // Same utm_campaign the links of the file already used.
    slug: "industrias",
    startsOn: dates[0] ?? null,
    endsOn: dates.at(-1) ?? null,
    posts,
  };
}
