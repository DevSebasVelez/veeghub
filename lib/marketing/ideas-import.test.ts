import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { parseIdeasHtml, readBeats, scriptText, spokenStats, voiceText } from "./ideas-import";

const LEGACY = `<html><body><script>
  let other = 1;
  const rawScripts = [
    // comentario
    {
      id: 101,
      sector: "Salud & Clínicas",
      title: \`Agenda sin \${"x"}\`.length ? "Agenda caída" : "",
    },
  ];
</script></body></html>`;

const LEGACY_OK = `<html><body>
<script src="https://cdn.tailwindcss.com"></script>
<script>
  const rawScripts = [
    {
      id: 101,
      sector: "Salud & Clínicas",
      title: "La agenda que se cae",
      hook_voice: "Tu agenda se cae cada lunes.",
      hook_motion: "AGENDA CAÍDA",
      caso_voice: "Una clínica perdía tres citas.",
      caso_motion: "3 citas perdidas",
      giro_voice: "No es el personal.",
      giro_motion: "Problema: proceso",
      pantalla_voice: "Un sistema confirma solo.",
      pantalla_motion: "Recordatorios automáticos",
      cierre_voice: "Ordena tu semana.",
      prompt: 'Dashboard con "citas"',
    },
  ];
  function render() { rawScripts.forEach(() => {}); }
</script></body></html>`;

const REEL_DATA = `<html><body><script id="reel-data" type="application/json">[
  {"id": 401, "title": "Antes de prometer", "category": "Criterio", "priority": 1,
   "audience": "Gerencia · Taller metalmecánico",
   "voice": ["Gancho.", "Caso largo aquí.", "Giro.", "Solución.", "Cierre."],
   "alternative": "Otro gancho.", "visual": ["Escena 1", "Escena 2"],
   "note": "Datos anónimos.", "prompt": "Crear motion", "words": 9, "seconds": 4,
   "offer": "Planificador"}
]</script></body></html>`;

test("files 1-4: reads rawScripts without running it", () => {
  const [idea] = parseIdeasHtml("2-reels-largos-enterprise.html", LEGACY_OK);

  assert.equal(idea.legacyId, 101);
  assert.equal(idea.source, "2-reels-largos-enterprise.html");
  assert.equal(idea.format, "Reel largo");
  assert.equal(idea.category, "Largos enterprise");
  assert.equal(idea.sector, "Salud & Clínicas");
  assert.deepEqual(
    idea.beats.map((beat) => beat.tipo),
    ["hook", "caso", "giro", "pantalla", "cierre"],
  );
  assert.equal(idea.beats[0].motion, "AGENDA CAÍDA");
  assert.equal(idea.beats[4].motion, undefined);
  assert.equal(idea.visualPrompt, 'Dashboard con "citas"');
  assert.equal(idea.words, 22);
  assert.equal(idea.seconds, 9);
});

test("files 1-4: refuses anything that is not a plain literal", () => {
  assert.throws(() => parseIdeasHtml("1-reels-principales.html", LEGACY), /no permitid/);

  const sneaky = `<script>const rawScripts = [(() => { globalThis.__pwned = 1; return {}; })()];</script>`;
  assert.throws(() => parseIdeasHtml("1-reels-principales.html", sneaky), /no permitid/);
  assert.equal((globalThis as Record<string, unknown>).__pwned, undefined);
});

test("file 5: reel-data JSON, sector from the audience, extras in meta", () => {
  const [idea] = parseIdeasHtml("/tmp/x/5-reels-ingenieria-ia-aplicada.html", REEL_DATA);

  assert.equal(idea.legacyId, 401);
  assert.equal(idea.sector, "Taller metalmecánico");
  assert.equal(idea.priority, 1);
  assert.equal(idea.category, "Criterio");
  assert.equal(idea.notes, "Datos anónimos.");
  assert.equal(idea.words, 9);
  assert.equal(idea.beats.length, 5);
  assert.equal(idea.beats[3].tipo, "pantalla");
  assert.deepEqual(idea.meta, { alternative: "Otro gancho.", visual: ["Escena 1", "Escena 2"], offer: "Planificador" });
});

test("rejects unknown files and files without scripts", () => {
  assert.throws(() => parseIdeasHtml("otro.html", LEGACY_OK), /no es uno de los 5/);
  assert.throws(() => parseIdeasHtml("3-reels.html", "<p>nada</p>"), /no encontré/);
});

test("voice text uses the alternative hook when asked", () => {
  const beats = readBeats([
    { tipo: "hook", voz: "A" },
    { tipo: "cierre", voz: "B" },
    { tipo: "otro", voz: "C" },
  ]);
  assert.equal(beats.length, 2);
  assert.equal(voiceText(beats), "A\n\nB");
  assert.equal(voiceText(beats, "Z"), "Z\n\nB");
  assert.match(scriptText({ title: "T", beats }), /^T\n\nGANCHO\n\[Voz\]: A/);
  assert.deepEqual(spokenStats(beats), { words: 2, seconds: 1 });
});

// The real files live outside the repo; check them when they are on this machine.
const BANCO = join(homedir(), "Documents/VEEG SOFT/MARKETING/Banco de Ideas");
const FILES = [
  ["1-reels-principales.html", 65],
  ["2-reels-largos-enterprise.html", 20],
  ["3-reels-ventas-rapidas.html", 12],
  ["4-reels-universales.html", 12],
  ["5-reels-ingenieria-ia-aplicada.html", 90],
] as const;

test("real banco de ideas: 199 reels, five beats each", { skip: !existsSync(BANCO) }, () => {
  let total = 0;
  for (const [file, expected] of FILES) {
    const ideas = parseIdeasHtml(file, readFileSync(join(BANCO, file), "utf8"));
    assert.equal(ideas.length, expected, file);
    assert.equal(new Set(ideas.map((idea) => idea.legacyId)).size, expected, `${file}: ids únicos`);
    for (const idea of ideas) assert.equal(idea.beats.length, 5, `${file} #${idea.legacyId}`);
    total += ideas.length;
  }
  assert.equal(total, 199);
});
