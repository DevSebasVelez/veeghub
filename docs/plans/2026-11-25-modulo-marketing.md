# Plan: Módulo de Marketing — centro de contenido de VeegSoft

**Creado:** 2026-11-25
**Estado:** 🟢 F1 y F3 en producción con datos cargados (2026-11-25) y cron activo vía Worker de Cloudflare (2026-11-26). F2 y el pulido móvil están hechos en `develop`, sin desplegar.
**Rama sugerida:** `feat/marketing`, con una sub-rama por fase (`feat/mkt-f1-fundaciones`, etc.)
**Origen:** sesión de `veegsoft-web` del 2026-11-25 (lanzamiento de las 9 páginas de industria y primer post de LinkedIn publicado a mano desde Claude Code)

---

## 0. Para retomar en otra sesión

**Lee primero** el §8 (bitácora: qué quedó hecho y qué sigue), el §1 (objetivo), el §3 (decisiones tomadas, que no se vuelven a discutir) y la fase en curso. Cada fase se puede hacer por separado: dice qué hay que hacer fuera del código (LinkedIn, Google, Anthropic), qué se programa y cómo saber que terminó.

**Antes de escribir código:** `docs/ui/convenciones-de-diseno.md` (toda pantalla nueva), `AGENTS.md` (este Next no es el que conoces: lee `node_modules/next/dist/docs/`) y `docs/runbooks/fechas-y-zona-horaria.md`. Una publicación programada es un **instante**: se ancla a `America/Guayaquil`.

### Tablero de fases

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| **F1** | Fundaciones: modelos, navegación, directrices de marca y biblioteca de recursos | — | ✅ en producción, con directrices y biblioteca |
| **F2** | Banco de ideas: importar los ~199 reels, CRUD, estados y teleprompter | F1 | 🟡 hecha en `develop` (2026-11-26); falta desplegar, importar en producción y grabar una prueba en el celular |
| **F3** | Calendario y planificador: publicaciones por canal, cronograma, «hoy toca» y recordatorios push y email | F1 | 🟢 en producción; cron activo (Worker, 2026-11-26); falta confirmar el push del 1-dic |
| **F4** | Generador con IA (Anthropic): ideas, guiones, copys por canal y plan semanal, siempre con las directrices | F1 (+F2/F3 para usar sus datos) | ⬜ |
| **F5** | Creativos: plantillas de imagen (carrusel 4:5, GBP, OG) renderizadas en el servidor | F1, F4 | ⬜ |
| **F6** | Publicación por API: LinkedIn (perfil), Facebook/Instagram (Meta) y Google Business Profile, con aprobación humana | F3 + trámites | ⬜ |
| **F7** | Métricas y estrategia: UTM, GA4, leads por pieza y asesor IA de estrategia | F3, F6 | ⬜ |
| **F8** | Centro de Meta Ads: sincronización sola, estado/objetivo/tipo de cada campaña, gasto mes a mes, alcance, alertas y calidad de lead por anuncio | — (usa el cron de F3) | ⬜ |

Orden recomendado: **F1 → F3 → F2 → F4 → F5 → F6 → F7 → F8.** F8 no depende de F4–F7: si las campañas pesan más que el contenido orgánico, se puede adelantar justo después de F2. F3 va antes que F2 porque el calendario es lo que evita olvidar las publicaciones, que es el dolor de hoy. Los trámites de F6 conviene iniciarlos ya, porque las aprobaciones tardan.

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
| Infra de VeegHub | este repo | Vercel **Hobby** (sólo crons diarios; hasta F3 no había ningún cron) con `CRON_SECRET`, web-push (`lib/notifications/push.ts`), Resend (`lib/email`), Cloudflare R2 (`lib/storage/r2.ts`), Drive, Meta (`lib/meta`, con app y páginas ya conectadas) y leads con origen y UTM. |

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
11. **Las imágenes de un post son opcionales** (decidido 2026-11-25). Un post sin imágenes es un recordatorio válido. Mientras se publique a mano, adjuntarlas sólo ahorra buscarlas: el kit baja las correctas y en orden, también desde el celular. Se vuelven necesarias cuando F5 genere los creativos (se adjuntan solos) y F6 publique por API (las sube él). No se agrega trabajo para hacerlas obligatorias.
12. **El cron no vive en Vercel** (decidido 2026-11-25): la cuenta es Hobby y sólo admite crons diarios; `*/15` hace fallar el deploy. `/api/cron/marketing` lo dispara un **Worker de Cloudflare con Cron Trigger** (`*/15 * * * *`) que llama con `Authorization: Bearer $CRON_SECRET` (decidido por Sebastián el 2026-11-25: gratis y fiable, y ya hay cuenta de Cloudflare por R2).

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
- **Recordatorios:** el cron cada 15 minutos (`/api/cron/marketing`, protegido con `CRON_SECRET`, disparado desde fuera de Vercel: decisión 12) busca posts `APROBADO` cuya hora ya llegó.
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

### F8 — Centro de Meta Ads (agregada 2026-11-26)

**Por qué.** Hoy `/admin/campanas` sólo se actualiza cuando alguien la abre (o con el botón «Actualizar»), muestra gasto/impresiones/clics por campaña y no dice si una campaña está activa, qué objetivo tiene, si es de formulario o de mensajes, ni cuánto se gastó cada mes. Sebastián quiere un centro de marketing donde se vea **qué funciona, cuánto cuesta y qué mover para vender más**.

**Qué existe (verificado el 2026-11-26).**
- `lib/meta/insights.ts`: `GET act_…/insights` con `level=campaign`, `time_increment=1`, `time_range` y los campos `campaign_id, campaign_name, spend, impressions, clicks, reach`. `limit=500` sin paginar (`paging.next` se ignora). TTL de 15 min y tope del 80 % de uso de la API.
- La sincronización corre sólo al abrir la página (`after()`) o con «Actualizar» (`force`). Sólo sincroniza el rango visible.
- `MetaCampaignInsight`: una fila por campaña y día, única por `(campaignId, date)`. `MetaAdAccount`: una cuenta (`act_3364960217152672`).
- **No se lee ni se guarda:** `status`/`effective_status`, `objective`, `optimization_goal`, `destination_type`, presupuesto, estrategia de puja, conjuntos de anuncios, anuncios, creativos, `actions`, `frequency`, `cpm`.
- El alcance (`reach`) se guarda por día, pero **no se puede sumar entre días** (la misma persona cuenta varias veces) y la UI no lo usa.
- Filtro de la página: sólo `?dias=7|30|90|365`. No hay mes ni rango libre.
- Los leads se cuentan desde la tabla `Lead` (`metaCampaignId`/`metaAdsetId`/`metaAdId` ya se guardan en cada lead), no desde Meta.
- No hay CAPI ni cron de Meta. El token no tiene `ads_management` (sólo lectura).

**Relación con otros planes (no duplicar).**
- `2026-10-21-gestor-campanas-ads.md` F3 (pausar/activar, editar presupuesto, sincronizar `effective_status` y rechazos) se **absorbe aquí en modo lectura**. Escribir en Meta (pausar, presupuesto) sigue en ese plan, porque necesita `ads_management`.
- `2026-11-17-senal-de-calidad-a-meta.md`: P8 (costo por lead calificado por anuncio, `level=ad`) se construye aquí (F8.4). CAPI (P3–P7) sigue en ese plan; F8 sólo lo **muestra** cuando exista.

> Antes de programar: revisar con la documentación vigente de la Marketing API (versión `v26.0`, `META_GRAPH_VERSION`) los nombres exactos de campos y enums. Los de abajo son los esperados, no verificados.

#### F8.1 — Sincronización sola (lo primero)
- Ruta `GET /api/cron/meta` con `CRON_SECRET`, disparada por el **mismo Worker** `veeghub-cron` (otro `fetch` en su `scheduled()`, o un segundo Cron Trigger cada hora). No se agrega nada a Vercel (decisión 12).
- Cada pasada: estructura (campañas, conjuntos y anuncios con estado) + insights de **hoy y ayer** (Meta corrige el día anterior). Una vez al día, re-sincroniza los últimos 28 días (atribución tardía).
- Paginación real (`paging.next`) y respeto del tope de uso que ya existe.
- La página deja de sincronizar al abrirse: lee lo guardado y muestra «Actualizado hace X min». El botón «Actualizar» se queda como forzado.
- Backfill de leads de formularios (`GET /{form_id}/leads`), pendiente desde el plan de CRM F6, en la misma ruta: si el webhook pierde un lead, el cron lo recupera.
- **Hecho cuando:** sin abrir el panel durante un día, los datos de ayer están completos a las 8:00.

#### F8.2 — Estado y tipo de cada campaña
- Modelos nuevos: `MetaCampaign` (id, nombre, `status`, `effectiveStatus`, `objective`, `buyingType`, `dailyBudget`/`lifetimeBudget`, `startTime`/`stopTime`, `updatedTime`), `MetaAdSet` (id, campaña, `optimizationGoal`, `destinationType`, `billingEvent`, presupuesto, público resumido, `effectiveStatus`) y `MetaAd` (id, conjunto, nombre, `effectiveStatus`, miniatura del creativo, `issues`/`ad_review_feedback`).
- **Tipo legible** derivado de `objective` + `optimization_goal` + `destination_type`, por ejemplo «Formulario instantáneo», «Mensajes de WhatsApp», «Mensajes de Messenger/IG», «Tráfico al sitio», «Reconocimiento». Pill neutra con ícono.
- **Estado** con los colores de las convenciones: activa (emerald), en aprendizaje (amber), pausada (zinc), con problemas o rechazada (red), programada (blue).
- Ficha de campaña (patrón «Plan»): KPIs arriba, conjuntos y anuncios debajo con su gasto y sus leads, y a la derecha los datos (objetivo, tipo, presupuesto, fechas, estado).
- Push cuando un anuncio pasa a `DISAPPROVED`/`WITH_ISSUES` o una campaña activa deja de gastar 24 h.

#### F8.3 — Reportes: gasto mes a mes y filtros
- Filtros por URL: **mes** (selector como `report-month-filter`), rango libre, estado, tipo y campaña. La URL es el estado.
- **Gasto mes a mes:** barras de los últimos 12 meses (gasto) con línea de leads y costo por lead. Tabla debajo: mes, gasto, leads, CPL, clientes ganados, costo por cliente, variación contra el mes anterior.
- **Alcance real:** pedir el `reach` del período agregado (sin `time_increment`) y guardarlo aparte, por período y campaña, para no sumar alcances diarios. Mostrar alcance, frecuencia y CPM.
- Insights con `actions` y `cost_per_action_type` para contar en Meta los leads, las conversaciones iniciadas y los clics al enlace, al lado de los leads que llegaron al CRM. La diferencia entre ambos sirve como alerta de leads perdidos.
- Exportar CSV del período.
- `/admin/reportes` (cobros/flujo) gana una tarjeta «Marketing del mes»: gasto, leads, CPL y clientes ganados.

#### F8.4 — Calidad y ventas por anuncio
- Insights a nivel `ad` (diario) para cruzar cada anuncio con los leads del CRM por `metaAdId`.
- Por anuncio y conjunto: leads, % contactado, % calificado, % ganado, **costo por lead calificado** y **costo por cliente**. Es el P8 del plan de señal de calidad.
- Ranking «qué anuncio trae clientes, no sólo leads», y alerta cuando un anuncio barato trae leads que nunca califican.
- Desglose por plataforma y ubicación (`publisher_platform`, `platform_position`), edad/sexo y región, para decidir dónde poner el presupuesto.

#### F8.5 — Recomendaciones para vender más
- Reglas simples y visibles, sin IA al principio. Ejemplos:
  - Frecuencia > 3 en 7 días: el público se cansó, rotar el creativo.
  - CPL un 40 % sobre la media de 30 días.
  - Conjunto en aprendizaje limitado.
  - Campaña sin gasto con presupuesto activo.
  - Anuncio con CTR bajo frente a sus hermanos.
- Cada recomendación es una tarjeta con el dato que la dispara y un enlace al Administrador de anuncios. Nada se cambia solo: sin `ads_management`, sólo se avisa.
- Más adelante (con F4): el asesor IA de F7 lee estas métricas junto con las del orgánico y propone el plan del mes.
- Ideas para evaluar en su momento, cada una con su permiso o trámite:
  - Públicos personalizados desde los clientes ganados (lookalike). Requiere `ads_management`.
  - Biblioteca de anuncios de la competencia (`ads_archive`).
  - Estadísticas de la página e Instagram orgánico (`pages_read_engagement`, `instagram_manage_insights`), para tener orgánico y pagado en el mismo panel.

**Riesgos.**
- Límite de uso de la API: la estructura cambia poco (cada hora basta) y los insights se piden sólo para hoy y ayer.
- Zona horaria: Meta reporta el gasto en la zona de la cuenta publicitaria (runbook §7.4). Hay que verificar que coincida con Ecuador o convertir.
- `date_preset` excluye hoy: usar `time_range`.
- Los `action_type` de leads no son estables: mapear varios (`lead`, `onsite_conversion.lead_grouped`, `leadgen_grouped`) y probarlo con datos reales.

**Hecho cuando:**
- Sin abrir el panel, el gasto de ayer y el estado de todas las campañas están al día.
- Se filtra por mes y se ve el gasto mes a mes con su CPL.
- Cada campaña muestra su tipo y su estado.
- Hay al menos una recomendación con datos reales.

## 6. Riesgos y cuidados
- **Gasto de IA:** tope mensual configurable (variable de entorno) que bloquea las generaciones al superarse, y costo visible siempre.
- **Tokens de redes:** cifrados, nunca en logs y con permisos mínimos.
- **Contenido:** la IA nunca publica sola (regla de oro). El validador bloquea la aprobación si hay flags, salvo un override explícito que queda registrado.
- **Zona horaria:** las fechas programadas son instantes en Ecuador (runbook).
- **Vercel:** Satori sí funciona allí, Chromium no; no se usa Playwright en producción.

## 7. Para arrancar la próxima sesión (prompt sugerido)

> Lee `docs/plans/2026-11-25-modulo-marketing.md` (empieza por el §8) y `docs/ui/convenciones-de-diseno.md`. F2 está hecha en `develop` (§8, 2026-11-26): falta desplegarla e importar las ideas en producción. Lo siguiente es F4 (generador con IA) o adelantar F8 (centro de Meta Ads), según lo que decida Sebastián. Sin push hasta que lo pida.

## 8. Bitácora

### 2026-11-25 — F1 y F3 (desplegadas: `main` 4834bef, Vercel OK)

**Hecho y probado en el navegador** (oscuro, claro y 390 px):
- Migración `20261125214831_marketing_module` (aditiva). Además de §4: `ContentPost.reminderSentAt` / `dueNotifiedAt` (para no avisar dos veces), `ContentAsset.size`, `BrandGuideline.position` (orden fijo en el prompt) y `@@unique([source, legacyId])` en `ContentIdea` (lo necesita el importador de F2).
- «Marketing» en la barra lateral → `/admin/marketing/{calendario,biblioteca,directrices}` con `AreaNav`. Ideas, generador, creativos y métricas se agregan con su fase.
- Calendario: mes, semana (filas por canal) y lista de 14 días + «sin fecha»; franja de KPIs; editor con contador por canal, UTM en vivo, primer comentario, imágenes ordenables y fecha/hora en Ecuador; botón **Aprobar**; cambiar el contenido de un post aprobado lo devuelve a borrador; kit «publicar a mano»; tarjeta «Hoy toca publicar» en `/admin`.
- Cron `GET /api/cron/marketing` (`lib/marketing/reminders.ts`): post `APROBADO` cuya hora llegó → push + email y queda `PROGRAMADO`; desde las 8:00 de Ecuador, resumen de los posts de mañana (incluye los no aprobados, para aprobarlos a tiempo). Simulado en las horas clave: cada aviso sale una sola vez.
- Biblioteca en R2 (`marketing/…`), subida directa con URL firmada, etiquetas y filtros. Directrices: 10 sembradas (`lib/marketing/guidelines-seed.ts`), editables.
- Importador de `posts-industrias.md`: campaña `industrias`, 19 posts (el lanzamiento como `PUBLICADO`, el resto `BORRADOR` a las 7:30), con sus imágenes.
- Scripts: `npm run mkt:assets` (sube `veegsoft-web/public/industrias/**` y el carrusel de lanzamiento) y `npm run mkt:import` (directrices + cronograma). Ambos idempotentes; usan el `DATABASE_URL` y el bucket del `.env`.
- Local: base con todo cargado; las 72 imágenes están en `veeghub-staging`.

**Lecciones:** un `<textarea>` envía `\r\n`; todo texto de formulario pasa por `formText()` en las acciones. El CORS de `veeghub-staging` sólo acepta `http://localhost:3000`: en otro puerto, la subida falla con «Error de red».

**Pendiente antes de dar F1/F3 por cerradas:**
1. ~~Crear el Worker del cron~~ — hecho el 2026-11-26. Worker `veeghub-cron` en Cloudflare, creado desde el panel web (sin wrangler): `scheduled()` llama a `https://veeghub.veegsoft.com/api/cron/marketing` con `Authorization: Bearer ${env.CRON_SECRET}` y hace `console.log` de la respuesta; también tiene `fetch()` para probarlo a mano abriendo su URL `workers.dev`. Cron Trigger `*/15 * * * *`; `CRON_SECRET` es un *Secret* del Worker, el mismo valor que en Vercel. Probado: `200 {"due":0,"tomorrow":0,"pushed":0,"emailed":0}`. Si algún día da 401: el secreto no coincide o Vercel no se redesplegó tras cambiarlo. Descartados: cron-job.org (el secreto en un tercero) y GitHub Actions (se atrasa 15-30 min).
2. ~~Desplegar~~ — hecho el 2026-11-25 (`main` 4834bef). En el mismo deploy salió el sidebar nuevo por secciones (`components/admin/nav-config.ts`).
3. ~~Cargar producción~~ — hecho el 2026-11-25 desde la UI: 10 directrices, 19 posts, 36 imágenes. **Cómo se hizo** (las variables de producción son *Sensitive* en Vercel: `vercel env pull` las baja vacías y los scripts locales no sirven contra producción). «Cargar base» en Directrices e «Importar» en Calendario con `posts-industrias.md`: la importación trae sola las 36 imágenes de industria desde veegsoft.com (`lib/marketing/assets.ts`). Las 3 del carrusel de lanzamiento no son públicas; ese post ya está publicado, se suben a mano sólo si hacen falta. Probado contra una base vacía: 10 directrices, 19 posts, 36 imágenes y 45 adjuntos en ~7 s.
4. Aprobar los posts del cronograma — **Manufactura (LinkedIn y GBP) del 1-dic aprobados** el 2026-11-25. Los siguientes se aprueban semana a semana (el resumen de las 8:00 del día anterior lo recuerda).
5. Variable opcional `MARKETING_ALERT_EMAIL` (si no está, usa `LEAD_ALERT_EMAIL`).
6. Basura menor: un objeto huérfano en `veeghub-staging/marketing/subidas/` de una prueba de subida fallida.

**Hecho cuando (F3):** el 1-dic a las 7:30 llega el push del post de manufactura sin abrir Claude Code. Worker activo desde el 2026-11-26: el 30-nov a las 8:00 debe llegar el resumen de mañana y el 1-dic a las 7:30 el push. Si llegan, F3 queda cerrada.

**Sigue: F2** — banco de ideas y teleprompter (§5). Antes de programar, revisar los 5 HTML de `~/Documents/VEEG SOFT/MARKETING/Banco de Ideas/` y su `#modal-teleprompter` / `#reel-dialog`; el parser de los archivos 1-4 sin `eval` (acorn o json5).

### 2026-11-26 — Pulido de UI/UX móvil (rama `feat/mkt-ui-polish`)

Probado en el navegador a 390 px y en escritorio, en claro y oscuro:
- **Ficha del post:** tiene dos secciones por URL, «Listo para publicar» (por defecto) y «Editar» (`?vista=editar`).
  - «Listo para publicar» muestra el texto, el primer comentario (con su UTM) y las imágenes, cada uno con «Copiar», que confirma con un check.
  - Las imágenes se abren en un visor a pantalla completa: flechas, deslizar con el dedo, descargar.
  - Tiene «Descargar todas» y «Abrir canal». En el celular aparece también **«Compartir con imágenes»** (Web Share API): copia el texto y manda las imágenes a la app de LinkedIn o de Google.
  - Un post publicado se ve sólo como referencia.
  - En el celular el orden es estado → contenido → datos.
- `GET /api/admin/marketing/assets/[id]?archivo=1` sirve los bytes desde el mismo origen (máximo 4 MB). Así «Compartir» no depende del CORS de R2.
- **Editor:** las imágenes se abren en el visor; los botones de ordenar crecen en el celular; «Guardar» queda fijo abajo en el celular.
- **Calendario en el celular:**
  - Mes: puntos de color por canal; tocar un día abre su agenda debajo.
  - Semana: lista por día en vez de la tabla con scroll lateral.
  - Las filas muestran la miniatura de la primera imagen y el estado debajo.
  - Los botones de navegación son de 40 px.
- **Biblioteca:** tocar una imagen abre el visor (antes abría la URL cruda en otra pestaña); los botones de cada tarjeta son de 40 px en el celular.

**Falta probar en un teléfono real:** «Compartir con imágenes» (el navegador del escritorio no lo ofrece).

### 2026-11-26 — F2: banco de ideas y teleprompter (rama `feat/mkt-f2-banco-ideas`)

Probado en el navegador, en escritorio y en móvil, en claro y oscuro:
- **Parser** (`lib/marketing/ideas-import.ts`):
  - Archivos 1-4: lee el literal `rawScripts` desde el árbol sintáctico de `acorn`. Sólo acepta arreglos, objetos, textos y números; cualquier otra cosa (funciones, llamadas, plantillas con expresiones) se rechaza. **Nunca `eval`.**
  - Archivo 5: lee el JSON de `#reel-data`. El sector sale de la audiencia (lo que va después del «·»). El gancho alternativo, la secuencia visual, la oferta, el beneficio y los demás campos van a `meta`.
  - Tests: 6, incluido uno que lee los 5 archivos reales: 199 reels, ids únicos y 5 beats cada uno.
- **Importar:**
  - `npm run mkt:ideas` en local.
  - En producción, «Importar» en Marketing › Ideas, con los 5 HTML a la vez (574 KB, por debajo del límite de 1 MB de las server actions).
  - Es idempotente por `(source, legacyId)`: reimportar actualiza el guion y **conserva la etapa, las notas y la URL**.
  - Probado desde la UI: 199 ideas en ~1 s.
- **Lista** `/admin/marketing/ideas`:
  - KPIs por etapa (activas, listas para grabar, por editar, publicadas).
  - Búsqueda sin tildes en el título, el sector y el texto de los beats.
  - Filtros de categoría, etapa, sector y prioridad, en la URL.
  - Tarjetas con el gancho y un botón directo al teleprompter.
- **Ficha** `/admin/marketing/ideas/[id]` (patrón «Plan»):
  - Beats con lo que se dice y lo que se ve en pantalla. «Copiar texto» y «Guion completo».
  - Gancho alternativo, secuencia de motion y prompt visual, cada uno con «Copiar».
  - Etapa: un selector más «Marcar siguiente». Al pasar a PUBLICADO pide la URL.
  - «Crear post a partir de esta idea»: crea un borrador de LinkedIn vinculado a la idea y abre el editor.
  - Notas, posts vinculados, y anterior/siguiente.
- **Teleprompter** `/admin/marketing/ideas/[id]/grabar`, a pantalla completa:
  - Cuenta regresiva de 3 o 5 s, o sin cuenta.
  - Velocidad en px/s, tamaño de letra y espejo, guardados en `localStorage` como en el HTML.
  - Línea de lectura. Gancho principal o alternativo.
  - Pausa al tocar el texto o con la barra espaciadora; se detiene si arrastras o cambias de pestaña.
  - Mantiene la pantalla encendida mientras lee (Wake Lock).
  - «Marcar grabado», y anterior/siguiente.
  - Atajos: ↑↓ velocidad, +/− letra, M espejo, R inicio, ←→ otra idea, Esc salir.

**Para cerrar F2:**
1. Desplegar (`develop` → `main`).
2. En producción, Marketing › Ideas › «Importar» con los 5 HTML.
3. Grabar un reel desde el teleprompter en el celular y en el portátil. Cuando ya no hagan falta los HTML, F2 queda cerrada.

