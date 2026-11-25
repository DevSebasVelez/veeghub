# Plan: Módulo de Marketing — centro de contenido de VeegSoft

**Creado:** 2026-11-25
**Estado:** 🟡 F1 y F3 hechas en `feat/mkt-f1-fundaciones` (2026-11-25), sin desplegar
**Rama sugerida:** `feat/marketing`, con una sub-rama por fase (`feat/mkt-f1-fundaciones`, etc.)
**Origen:** sesión de `veegsoft-web` del 2026-11-25 (lanzamiento de las 9 páginas de industria y primer post de LinkedIn publicado a mano desde Claude Code)

---

## 0. Para retomar en otra sesión

**Lee primero** el §1 (objetivo), el §3 (decisiones tomadas, que no se vuelven a discutir) y la fase en curso. Cada fase se puede hacer por separado: dice qué hay que hacer fuera del código (LinkedIn, Google, Anthropic), qué se programa y cómo saber que terminó.

**Antes de escribir código:** `AGENTS.md` (este Next no es el que conoces: lee `node_modules/next/dist/docs/`) y `docs/runbooks/fechas-y-zona-horaria.md`. Una publicación programada es un **instante**: se ancla a `America/Guayaquil`.

### Tablero de fases

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| **F1** | Fundaciones: modelos, navegación, directrices de marca y biblioteca de recursos | — | 🟡 hecho, sin desplegar |
| **F2** | Banco de ideas: importar los ~199 reels, CRUD, estados y teleprompter | F1 | ⬜ |
| **F3** | Calendario y planificador: publicaciones por canal, cronograma, «hoy toca» y recordatorios push y email | F1 | 🟡 hecho, sin desplegar |
| **F4** | Generador con IA (Anthropic): ideas, guiones, copys por canal y plan semanal, siempre con las directrices | F1 (+F2/F3 para usar sus datos) | ⬜ |
| **F5** | Creativos: plantillas de imagen (carrusel 4:5, GBP, OG) renderizadas en el servidor | F1, F4 | ⬜ |
| **F6** | Publicación por API: LinkedIn (perfil), Facebook/Instagram (Meta) y Google Business Profile, con aprobación humana | F3 + trámites | ⬜ |
| **F7** | Métricas y estrategia: UTM, GA4, leads por pieza y asesor IA de estrategia | F3, F6 | ⬜ |

Orden recomendado: **F1 → F3 → F2 → F4 → F5 → F6 → F7.** F3 va antes que F2 porque el calendario es lo que evita olvidar las publicaciones, que es el dolor de hoy. Los trámites de F6 conviene iniciarlos ya, porque las aprobaciones tardan.

### Regla de oro del módulo

> **Nada se publica sin un clic humano de «Aprobar».** La IA propone y programa borradores; un post solo sale cuando está en estado `APROBADO` y llega su hora. Es la misma filosofía que el `PAUSED` del gestor de campañas.

---

## 1. Objetivo

Que VeegHub sea el centro de operaciones del marketing de VeegSoft. Hoy cada pieza vive en un lugar distinto: los guiones en HTML sueltos, los posts en un `.md` del repo web, las imágenes en el scratchpad de una sesión de Claude y las fechas en la memoria de Sebastián. Para publicar, hay que abrir una sesión de Claude Code y pedirlo.

El módulo tiene que:
1. **Planificar:** un calendario editorial por canal que recuerde qué toca publicar y cuándo.
2. **Guardar:** el banco de ideas y guiones de reels, con su teleprompter, en una sola base consultable, en lugar de un HTML nuevo por tanda.
3. **Generar:** ideas, guiones, copys y planes con IA, siempre dentro de las directrices de VeegSoft.
4. **Crear:** imágenes de carrusel y posts con plantillas de marca, como las del lanzamiento de industrias.
5. **Publicar:** directo a LinkedIn, Meta y GBP cuando haya API, y si no, «copiar y abrir» con un recordatorio.
6. **Medir:** qué pieza trajo visitas y leads, usando los UTM y el CRM de leads que ya existe.

## 2. Qué existe hoy (insumos)

| Insumo | Dónde | Qué es |
|---|---|---|
| Banco de reels | `~/Documents/VEEG SOFT/MARKETING/Banco de Ideas/*.html` | 5 archivos y ~199 reels. Archivos 1–4: array `rawScripts` con `{id, sector, title, hook_voice, hook_motion, caso_voice, caso_motion, giro_voice, giro_motion, pantalla_voice, pantalla_motion, cierre_voice, prompt}`. Archivo 5: JSON en `<script id="reel-data">` (90 reels) con otra forma: `{id, title, category, kind, priority, purpose, audience, voice[], alternative, visual, note, paid_closing, words, seconds, day, first_batch, prompt, offer, benefit, hook_style, scope, closing_style, …}`. Todos tienen un visor de teleprompter. |
| Guía de estilo de reels | `~/Documents/VEEG SOFT/MARKETING/Reels/GUIA-ESTILO-REELS.md` | Directrices de video. Hay además `Reels/Guiones`, `Copys`, `Publicados` y `Portadas` (flujo de Remotion, skill `reel-veegsoft` en veegsoft-web). |
| Posts de industrias | `veegsoft-web/docs/marketing/posts-industrias.md` | 10 posts de LinkedIn y 9 de GBP con cronograma (25-nov-2026 → 9-feb-2027). El de lanzamiento ya está publicado. |
| Plantilla de carrusel | `veegsoft-web/docs/marketing/linkedin-lanzamiento/slides.html` | 3 slides de 1080×1350 (claro, claro y oscuro), con logo, micro-etiqueta, H1 Inter Tight, render o visor y pie con numeración. A Sebastián le gustaron: «se pueden pulir». |
| Directrices de marca | `veegsoft-web/CLAUDE.md` y `src/lib/asistente/prompt.ts` | Sin precios ni plazos. Solo cifras verificadas (+5 años, +100 proyectos). Sin oficinas: el trabajo es remoto y Cuenca es donde nació la empresa. Tono afirmativo, nunca contra terceros. Industrias: vender el sistema, no la norma. Paleta ink, brand #1E5A8F, aqua, moss, ochre y clay, sin morado. |
| Imágenes de producto | `veegsoft-web/public/industrias/<slug>/*.webp` y `public/proyectos/` | Renders 3D, pantallas, apps y visores de los 9 sistemas demo. |
| Clave de Anthropic | `.env` de veegsoft-web (`ANTHROPIC_API_KEY`) | La usa el chat del sitio. **Aquí se agrega como variable propia de VeegHub**, no se comparte el archivo. |
| Infra de VeegHub | este repo | Vercel con `CRON_SECRET` (hay crons), web-push (`lib/notifications/push.ts`), Resend (`lib/email`), Cloudflare R2 (`lib/storage/r2.ts`), Drive, Meta (`lib/meta`, con app y páginas ya conectadas) y leads con origen y UTM. |

## 3. Decisiones tomadas (no se vuelven a discutir)

1. **Es un módulo de VeegHub, no una app aparte.** Va en la navegación como «Marketing», con subrutas `/admin/marketing/{calendario,ideas,generador,creativos,biblioteca,directrices,metricas}`.
2. **Las tareas de marketing no usan `Task`.** `Task` exige `projectId`, y una publicación no es una tarea de proyecto de cliente. Se crea el modelo `ContentPost` con su propio estado. El dashboard las muestra junto a las tareas en «Hoy».
3. **Las directrices de marca viven en la base de datos y son editables** (`BrandGuideline`). Se siembran desde las reglas actuales de `veegsoft-web/CLAUDE.md` y desde la guía de reels. Todo prompt de IA las inyecta como prefijo fijo y cacheable: nada variable en el system prompt, igual que en el asistente del sitio.
4. **Modelos de Anthropic:** `claude-sonnet-5-5` para estrategia, planes y guiones largos, y `claude-haiku-5-5` para variaciones rápidas (hooks, copys cortos, hashtags). Prompt caching sobre las directrices. Toda salida de IA se guarda como **borrador** con el modelo, los tokens y el costo, para auditar el gasto.
5. **La IA no inventa cifras ni clientes.** El validador de salida revisa precios, plazos, cifras que no estén en la lista verificada, la palabra «oficina» y nombres de empresas reales. Mismas reglas que `asistente:eval`, con su propio conjunto de pruebas (`npm run mkt:eval`).
6. **Las imágenes no se generan con IA dentro de VeegHub.** Anthropic no genera imágenes. Los creativos salen de **plantillas de marca renderizadas en el servidor** (JSX con Satori/`next/og`, sin Chromium en Vercel), con textos de la IA y recursos de la biblioteca. Las imágenes generativas (renders, capturas) se siguen haciendo fuera de VeegHub y se suben a la biblioteca.
7. **Publicar es opt-in por canal.** Sin token de API, el post se marca «manual» y el sistema avisa a la hora con «Copiar texto», «Descargar imágenes» y «Abrir LinkedIn». Con API, publica solo si el post está `APROBADO`.
8. **LinkedIn primero desde el perfil personal** (más alcance que la página, ya comprobado), con la API «Share on LinkedIn» (`w_member_social`), que no requiere revisión. La página de empresa exige la Community Management API, que sí requiere aprobación: va después.
9. **El enlace va en el primer comentario** en LinkedIn. El publicador crea el post y luego el comentario con el enlace UTM.
10. **UTM obligatorio:** cada post genera su enlace con `utm_source={canal}&utm_medium={social|organic}&utm_campaign={campaña}&utm_content={postId}`. Con eso F7 cruza contra GA4 y contra `Lead` (que ya guarda origen y UTM).

## 4. Modelo de datos (F1, con migración Prisma)

```prisma
enum ContentChannel { LINKEDIN_PERSONAL LINKEDIN_COMPANY GBP INSTAGRAM FACEBOOK TIKTOK YOUTUBE BLOG }
enum ContentStatus  { IDEA BORRADOR EN_REVISION APROBADO PROGRAMADO PUBLICADO FALLIDO DESCARTADO }
enum IdeaStage      { IDEA GUION GRABADO EDITADO PUBLICADO ARCHIVADO }
enum AssetKind      { IMAGEN VIDEO RENDER_3D CAPTURA LOGO PLANTILLA OTRO }

model ContentCampaign {       // "Lanzamiento industrias", "Serie IA aplicada"…
  id String @id @default(cuid())
  name String
  slug String @unique          // va a utm_campaign
  objective String?
  startsOn DateTime? @db.Date
  endsOn   DateTime? @db.Date
  posts ContentPost[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ContentPost {
  id String @id @default(cuid())
  campaignId String?
  campaign ContentCampaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  ideaId String?               // si sale del banco de ideas
  idea ContentIdea? @relation(fields: [ideaId], references: [id], onDelete: SetNull)
  channel ContentChannel
  status ContentStatus @default(BORRADOR)
  title String                 // nombre interno
  body String                  // texto final del canal
  firstComment String?         // LinkedIn: enlace en el primer comentario
  linkUrl String?              // URL destino SIN utm; el UTM se arma al publicar
  scheduledAt DateTime?        // instante, America/Guayaquil
  publishedAt DateTime?
  externalId String?           // urn de LinkedIn, id de Meta o GBP
  externalUrl String?
  error String?
  assets ContentPostAsset[]
  aiGenerationId String?
  approvedById String?
  approvedAt DateTime?
  metrics Json?                // impresiones, clics, reacciones (F7)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([status, scheduledAt])
  @@index([channel, scheduledAt])
}

model ContentIdea {           // banco de reels e ideas
  id String @id @default(cuid())
  legacyId Int?                // id del HTML original (101, 201, 401…)
  source String?               // "1-reels-principales.html"…
  title String
  sector String?
  category String?
  format String?               // reel corto, reel largo, carrusel, post
  stage IdeaStage @default(IDEA)
  priority Int?
  audience String?
  beats Json                   // [{tipo:"hook"|"caso"|"giro"|"pantalla"|"cierre", voz, motion}]
  visualPrompt String?         // el "prompt" de pantalla del HTML
  notes String?
  meta Json?                   // campos sueltos del esquema 5 (offer, benefit, hook_style…)
  words Int?
  seconds Int?
  tags String[]
  publishedUrl String?
  posts ContentPost[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([stage])
  @@index([sector])
}

model ContentAsset {          // biblioteca (R2)
  id String @id @default(cuid())
  kind AssetKind
  name String
  r2Key String @unique
  mime String
  width Int?
  height Int?
  tags String[]                // "industria:construccion", "render", "visor"
  alt String?
  posts ContentPostAsset[]
  createdAt DateTime @default(now())
}

model ContentPostAsset {
  postId String
  post ContentPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  assetId String
  asset ContentAsset @relation(fields: [assetId], references: [id], onDelete: Restrict)
  position Int
  @@id([postId, assetId])
}

model BrandGuideline {
  id String @id @default(cuid())
  key String @unique           // "tono", "cifras", "prohibidos", "paleta", "linkedin", "gbp", "reels"
  title String
  content String               // markdown que se inyecta al prompt
  active Boolean @default(true)
  updatedAt DateTime @updatedAt
}

model AiGeneration {          // auditoría y costo
  id String @id @default(cuid())
  kind String                  // "ideas", "guion", "copy", "plan_semanal", "estrategia"
  model String
  input Json
  output Json
  inputTokens Int
  outputTokens Int
  cacheReadTokens Int?
  costUsd Decimal @db.Decimal(10, 5)
  validatorFlags String[]      // reglas que la salida rompió
  createdById String?
  createdAt DateTime @default(now())
}

model ChannelConnection {     // tokens OAuth (F6), cifrados como las credenciales
  id String @id @default(cuid())
  channel ContentChannel @unique
  accountName String
  accessTokenEnc String
  refreshTokenEnc String?
  expiresAt DateTime?
  scopes String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Los tokens se cifran con la misma utilidad que usa `Credential` (`lib/security`).

## 5. Fases

### F1 — Fundaciones
- La migración de §4 y «Marketing» (ícono `Megaphone` u otro libre) en `admin-nav.tsx`, con subnavegación.
- **Directrices:** sembrar `BrandGuideline` desde `veegsoft-web/CLAUDE.md` (tono afirmativo, sin precios ni plazos, cifras verificadas, sin oficinas, paleta sin morado, enfoque de producto en industrias) y desde `GUIA-ESTILO-REELS.md`. Pantalla para editarlas.
- **Biblioteca:** subir a R2 con etiquetas. Script `scripts/import-assets.ts` que suba `veegsoft-web/public/industrias/**` y `docs/marketing/linkedin-lanzamiento/*.jpg`.
- **Hecho cuando:** se ven las directrices, se sube y filtra un recurso, y la migración corre en Vercel (`vercel-build`).

### F3 — Calendario y planificador (va antes que F2)
- Vista de mes y de semana por canal (chips por color), lista «Próximos 14 días» y un widget **«Hoy toca publicar»** en el dashboard de `/admin`.
- Editor de post: canal, texto con contador por canal (LinkedIn 3.000, GBP 1.500), primer comentario, URL destino con vista previa del UTM, recursos ordenables desde la biblioteca, fecha y hora en Ecuador, y estados con el botón **Aprobar**.
- **Recordatorios:** el cron cada 15 minutos (`/api/cron/marketing`, protegido con `CRON_SECRET`) busca posts `APROBADO` cuya hora ya llegó.
  - Si el canal tiene API (F6), publica.
  - Si no, manda push y email con «Copiar texto / Descargar imágenes / Abrir canal» y deja el post en `PROGRAMADO`, a la espera de «Marcar publicado» con la URL.
  - Además, un aviso a las 8:00 del día anterior.
- **Importador:** parsear `posts-industrias.md` en una campaña «Lanzamiento industrias» con 19 posts y sus fechas (cronograma del 1-dic-2026 al 9-feb-2027). El lanzamiento entra como `PUBLICADO` con su URL de LinkedIn.
- **Hecho cuando:** el 1-dic a las 7:30 llega el push del post de manufactura sin que nadie abra Claude Code.

### F2 — Banco de ideas y teleprompter
- Script `scripts/import-banco-ideas.ts` que lee los 5 HTML.
  - Los archivos 1–4 se leen evaluando el literal `rawScripts` con un parser seguro (por ejemplo `acorn` o `json5`); **nunca `eval`**.
  - El archivo 5 se lee del JSON de `#reel-data`.
  - Ambos esquemas se normalizan a `beats[]`, y los campos sueltos van a `meta`.
  - Es idempotente por `(source, legacyId)`.
- **Lista:** filtros por sector, categoría, etapa y prioridad, búsqueda de texto completo y vista de tarjetas como la de los HTML.
- **Ficha:** cada beat con voz y motion, prompt visual, notas, «Crear post a partir de esta idea» y cambio de etapa (IDEA → GUION → GRABADO → EDITADO → PUBLICADO con URL).
- **Teleprompter:** pantalla completa, velocidad ajustable, espejo horizontal, tamaño de letra, cuenta regresiva, pausa con barra espaciadora y anterior/siguiente. Lee los beats de voz en orden. Hay que replicar el comportamiento de `#modal-teleprompter` y `#reel-dialog` de los HTML, revisándolos antes.
- **Hecho cuando:** están los ~199 reels, se graba uno desde el teleprompter en el celular y en el portátil, y los HTML ya no hacen falta.

### F4 — Generador con IA
- `lib/marketing/ai.ts` con el SDK oficial `@anthropic-ai/sdk`. System prompt = directrices activas, cacheado. Antes de tocar parámetros, revisar la documentación vigente del SDK (`claude-api`).
- **Herramientas en la UI:**
  1. **Ideas:** a partir de un sector o tema, propone N ideas de reel con hook, caso, giro, pantalla y cierre, y las guarda en `ContentIdea` como `IDEA`.
  2. **Guion:** convierte una idea en un guion completo con conteo de palabras y segundos (≈2,5 palabras por segundo), en el formato de los beats.
  3. **Copy por canal:** de una idea o una URL del sitio, genera variantes para LinkedIn (gancho en las dos primeras líneas, viñetas con emojis, pregunta de cierre, 3–5 hashtags, enlace al comentario), GBP (sobrio, sin teléfono, ≤1.500) e Instagram.
  4. **Plan semanal:** mira los huecos del calendario, las campañas activas, las páginas del sitio (`https://veegsoft.com/llms.txt`) y los sectores que más leads trajeron (`Lead`), y propone los posts de la semana como borradores.
  5. **Reescribir:** cambiar tono, acortar o más técnico/más comercial.
- **Validador post-generación** (decisión 5) y `npm run mkt:eval` con casos guionados: que no dé precios aunque se los pidan, que no invente cifras ni clientes, que no hable de «oficina» y que respete el límite de caracteres.
- Costo visible por generación y acumulado del mes en el dashboard del módulo.
- Variable: `ANTHROPIC_API_KEY` en Vercel (la misma clave, cargada como variable de este proyecto).
- **Hecho cuando:** un plan semanal genera 3 borradores válidos sin flags del validador, y el eval pasa.

### F5 — Creativos con plantilla
- Plantillas JSX que replican `slides.html` del lanzamiento (y las pulen):
  - **Portada:** H1 + cuadrícula de renders.
  - **Render a sangre:** H1 + render.
  - **Visor oscuro:** H1 + visor con brillo.
  - **Cita o dato:** el gancho en grande.
  - **GBP 4:3 y OG 1200×630.**
- Se renderizan en el servidor con `next/og` (Satori) a PNG o JPG. La IA llena título y subtítulo dentro de los límites de cada plantilla; Sebastián elige los recursos. El resultado se guarda en `ContentAsset` y se adjunta al post.
- Fuentes Inter e Inter Tight empaquetadas (Satori no las descarga) y el logo como SVG inline (`VeegSoftMark` de veegsoft-web).
- **Hecho cuando:** el set de 3 slides de cualquier industria se genera desde la UI en menos de un minuto y se ve igual que el del lanzamiento.

### F6 — Publicación por API (con trámites)
| Canal | API | Trámite | Notas |
|---|---|---|---|
| LinkedIn perfil | Posts API (`/rest/posts`) + Images API, scope `w_member_social` (producto «Share on LinkedIn») | App en LinkedIn Developers verificada con la página de VeegSoft. Sin revisión. | El primer comentario va por la Comments API (`/rest/socialActions/{urn}/comments`). Verificar los scopes vigentes al implementar. |
| LinkedIn página | Community Management API | Requiere aprobación de LinkedIn | Después de que funcione la del perfil. |
| Facebook / Instagram | Graph API con la app de Meta que ya existe en `lib/meta` | Permisos `pages_manage_posts`, `instagram_content_publish` (revisión de la app) | Reutilizar la conexión de páginas. |
| Google Business Profile | Business Profile API (`localPosts`) | Solicitar acceso a la API (formulario de Google; tarda) | Mientras tanto, modo manual. |

- OAuth por canal (`ChannelConnection`) con renovación de tokens y alerta push cuando un token esté por vencer.
- El publicador es idempotente: si hay `externalId`, no vuelve a publicar. Los reintentos son limitados y un fallo deja el post en `FALLIDO` con su error.
- **Hecho cuando:** un post aprobado de prueba sale solo a LinkedIn a su hora, con imágenes y primer comentario.

### F7 — Métricas y estrategia
- **Métricas:** clics por UTM desde GA4 (Data API, filtrando por `utm_campaign` y `utm_content`), leads con esa campaña (`Lead`) y estadísticas del canal cuando la API las da. Si no las da, se cargan a mano.
- **Panel:** qué pilar, canal, sector y formato trae más visitas y leads.
- **Asesor IA mensual:** lee las métricas y el calendario y propone qué repetir, qué cortar y qué probar. Queda como borrador de estrategia, que Sebastián aprueba.

## 6. Riesgos y cuidados
- **Gasto de IA:** tope mensual configurable (variable de entorno) que bloquea las generaciones al superarse, y costo visible siempre.
- **Tokens de redes:** cifrados, nunca en logs y con permisos mínimos.
- **Contenido:** la IA nunca publica sola (regla de oro). El validador bloquea la aprobación si hay flags, salvo un override explícito que queda registrado.
- **Zona horaria:** las fechas programadas son instantes en Ecuador (runbook).
- **Vercel:** Satori sí funciona allí, Chromium no; no se usa Playwright en producción.

## 7. Para arrancar la sesión en VeegHub (prompt sugerido)

> Lee `docs/plans/2026-11-25-modulo-marketing.md` completo y `AGENTS.md`. Empecemos por F1 y luego F3: migración Prisma de §4, navegación «Marketing», directrices sembradas desde `../veegsoft-web/CLAUDE.md` y `~/Documents/VEEG SOFT/MARKETING/Reels/GUIA-ESTILO-REELS.md`, biblioteca en R2 y el calendario con importación de `../veegsoft-web/docs/marketing/posts-industrias.md` y recordatorios por cron. Rama `feat/mkt-f1-fundaciones`. Sin push hasta que lo pida.
