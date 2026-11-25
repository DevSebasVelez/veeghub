import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  LAUNCH_ASSET_KEYS,
  parsePostsIndustrias,
  parseSpanishDay,
} from "./import-industrias";

const FIXTURE = `
## Cronograma

| # | Fecha | Industria | LinkedIn | GBP | Estado |
|---|---|---|---|---|---|
| 0 | mié 25-nov-2026 | Lanzamiento | ✅ [publicado](https://www.linkedin.com/feed/update/urn:li:activity:1/) | — | ✅ |
| 1 | mar 1-dic-2026 | Manufactura | ⬜ | ⬜ | pendiente |
| — | 22 y 29-dic | (pausa) | — | — | — |

---

## 0 · Lanzamiento (sólo LinkedIn)

**Imágenes:** collage.

\`\`\`
Hoy lanzamos.

#VeegSoft
\`\`\`

**🔗 Comentario:**
\`\`\`
Las 9 industrias 👇
https://veegsoft.com/industrias?utm_source=linkedin&utm_medium=social&utm_campaign=industrias
\`\`\`

---

## 1 · Manufactura

**Imágenes:** \`manufactura/planta.webp\`, \`despiece.webp\`

### LinkedIn
\`\`\`
"El rendimiento real del lote…" 🏭
\`\`\`
**🔗 Comentario:**
\`\`\`
El recorrido 👇
https://veegsoft.com/industrias/manufactura?utm_source=linkedin&utm_medium=social&utm_campaign=industrias
\`\`\`

### Google Business Profile
\`\`\`
Software para manufactura.
\`\`\`
**Botón «Más información»:** \`https://veegsoft.com/industrias/manufactura?utm_source=gbp&utm_medium=organic&utm_campaign=industrias\`
`;

test("parseSpanishDay lee el formato del cronograma", () => {
  assert.equal(parseSpanishDay("mar 1-dic-2026"), "2026-12-01");
  assert.equal(parseSpanishDay("mar 9-feb-2027"), "2027-02-09");
  assert.equal(parseSpanishDay("22 y 29-dic"), null);
});

test("parsePostsIndustrias arma LinkedIn y GBP con su fecha", () => {
  const campaign = parsePostsIndustrias(FIXTURE);

  assert.equal(campaign.slug, "industrias");
  assert.equal(campaign.startsOn, "2026-11-25");
  assert.equal(campaign.endsOn, "2026-12-01");
  assert.deepEqual(
    campaign.posts.map((post) => post.key),
    ["0-LINKEDIN_PERSONAL", "1-LINKEDIN_PERSONAL", "1-GBP"],
  );

  const [launch, linkedIn, gbp] = campaign.posts;

  assert.equal(launch.status, "PUBLICADO");
  assert.equal(launch.externalUrl, "https://www.linkedin.com/feed/update/urn:li:activity:1/");
  assert.deepEqual(launch.assetKeys, LAUNCH_ASSET_KEYS);
  assert.equal(launch.firstComment, "Las 9 industrias 👇");
  assert.equal(launch.linkUrl, "https://veegsoft.com/industrias");

  assert.equal(linkedIn.status, "BORRADOR");
  assert.equal(linkedIn.scheduledLocal, "2026-12-01T07:30");
  assert.equal(linkedIn.body, '"El rendimiento real del lote…" 🏭');
  assert.deepEqual(linkedIn.assetKeys, [
    "marketing/industrias/manufactura/planta.webp",
    "marketing/industrias/manufactura/despiece.webp",
  ]);

  assert.equal(gbp.body, "Software para manufactura.");
  assert.equal(gbp.linkUrl, "https://veegsoft.com/industrias/manufactura");
  assert.equal(gbp.firstComment, null);
  assert.deepEqual(gbp.assetKeys, ["marketing/industrias/manufactura/planta.webp"]);
});

test("parsePostsIndustrias rechaza un archivo sin cronograma", () => {
  assert.throws(() => parsePostsIndustrias("# Nada"), /cronograma/);
});

// The real file lives in the sibling repo; checked when it is around.
const REAL = "../veegsoft-web/docs/marketing/posts-industrias.md";

test("el archivo real da 19 posts (10 LinkedIn + 9 GBP)", { skip: !existsSync(REAL) }, () => {
  const campaign = parsePostsIndustrias(readFileSync(REAL, "utf8"));
  const linkedIn = campaign.posts.filter((p) => p.channel === "LINKEDIN_PERSONAL");
  const gbp = campaign.posts.filter((p) => p.channel === "GBP");

  assert.equal(linkedIn.length, 10);
  assert.equal(gbp.length, 9);
  assert.equal(campaign.endsOn, "2027-02-09");
  assert.ok(campaign.posts.every((p) => p.body.length > 50));
  assert.ok(campaign.posts.every((p) => p.linkUrl?.startsWith("https://veegsoft.com/")));
  assert.ok(campaign.posts.every((p) => p.scheduledLocal));
  assert.ok(gbp.every((p) => p.body.length <= 1500));
  assert.ok(linkedIn.every((p) => p.firstComment && !p.firstComment.includes("http")));
  assert.ok(campaign.posts.every((p) => p.assetKeys.length > 0));
});
