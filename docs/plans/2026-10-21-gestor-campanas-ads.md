# Plan: Gestor de campañas Meta Ads + Google Ads con IA (estilo SaleADS)

**Creado:** 2026-10-21
**Estado:** 📝 Solo planificado — no hay código todavía
**Rama sugerida:** `feat/ads-manager` (una sub-rama por fase: `feat/ads-f1-fundaciones`, etc.)
**Referencia de producto:** [saleads.ai](https://saleads.ai/es), analizado por ingeniería inversa el 2026-10-21 (ver §11)

---

## 0. Para retomar en otra sesión

**Leé primero:** §1 (objetivo), §3 (decisiones ya tomadas, no se vuelven a discutir) y la fase
en curso. Cada fase es autocontenida: dice qué tenés que hacer vos afuera (Meta, Google,
Vercel), qué se programa, y cómo saber que terminó.

### Tablero de fases

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| **F0** | Trámites externos iniciados (Vercel Pro, Meta, Google) | — | ⬜ |
| **F1** | Fundaciones: modelos, cola de tareas, cron, cuentas por cliente | F0 (Vercel Pro) | ⬜ |
| **F2** | Meta: lanzar una campaña **en pausa** desde un borrador manual (sin IA) | F1 | ⬜ |
| **F3** | Meta: gestionar (pausar/activar, presupuesto, sincronizar, métricas por cliente) | F2 | ⬜ |
| **F4** | IA: estrategia, copies y creativos generados, con aprobación humana | F2 | ⬜ |
| **F5** | Meta: cuentas de **clientes** por acceso de socio + acceso avanzado | F3 + trámite Meta | ⬜ |
| **F6** | Google: conexión MCC, cuentas por cliente, métricas | F1 + trámite Google | ⬜ |
| **F7** | Google: lanzar campaña de Búsqueda (en pausa) con copies IA | F6 + F4 | ⬜ |
| **F8** | Google: Performance Max / Demand Gen + YouTube (opcional) | F7 | ⬜ |
| **F9** | Optimización: reglas, alertas, asesor IA, señal de conversiones | F3 (+F7) | ⬜ |

Orden recomendado: **F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F9 → F8**.
F0 se arranca **ya** aunque el código espere: las aprobaciones de Meta y Google tardan días.

### Regla de oro de todo el módulo

> **Todo se crea en `PAUSED`.** Ninguna acción automática gasta dinero sin un clic humano de
> "Activar". Esto aplica a la IA, a los reintentos y a las reglas de F9.

---

## 1. Objetivo

**Hoy:** las campañas se arman a mano en Ads Manager y Google Ads, cliente por cliente. VeegHub
solo lee insights de una cuenta (`/admin/campanas`) y recibe leads.

**Meta:** desde VeegHub, elegir un cliente → objetivo → la IA propone estrategia, copies y
creativos → se revisa y edita → un clic crea la campaña completa en Meta o Google (en pausa) →
se activa → VeegHub muestra gasto, leads y costo por lead **por cliente**, cruzado con el CRM.

**Métricas que importan:**
- Tiempo de "idea" a "campaña creada en pausa": objetivo **< 10 min** (hoy ~1 h).
- Costo por lead y costo por cliente ganado, por cliente, sin abrir Ads Manager.

**Fuera de alcance (por ahora):** autoservicio para que clientes se registren solos, cobro por
suscripción, TikTok. Ver §3.1 sobre cuándo reconsiderar.

---

## 2. Lo que ya existe y se reutiliza

| Pieza | Dónde | Cómo se usa aquí |
|---|---|---|
| Cliente de Graph API (`graphGet`, `graphPost`, `MetaGraphError`) | `lib/meta/graph.ts` | Base del constructor de campañas Meta. `graphPost` hoy manda params por query: para cuerpos grandes (targeting, creativos) hay que agregar una variante con body `application/x-www-form-urlencoded` o JSON |
| Configuración Meta + token de usuario del sistema | `lib/meta/config.ts` | Mismo token, con permisos ampliados (F0) |
| Lectura de cuota `X-Business-Use-Case-Usage` y techo del 80 % | `lib/meta/insights.ts` | Se extrae a un helper común y se aplica también a escrituras |
| Sync de insights diario e idempotente | `lib/meta/insights.ts`, `MetaCampaignInsight` | Se generaliza a varias cuentas (hoy `resolveAdAccount` toma `findFirst`) |
| Cifrado AES de secretos | `lib/security/credentials.ts` | Refresh token de Google, tokens de página |
| Almacenamiento de archivos | `lib/storage/r2.ts` (Cloudflare R2) | Creativos generados y subidos |
| Cola con estado/intentos | patrón de `MetaWebhookEvent` | Mismo patrón para `AdLaunchJob` |
| Leads con `campaign_id`/`adset`/`ad` | `Lead`, `lib/meta/lead-mapper.ts` | Costo por lead real por campaña creada desde VeegHub |
| Guardia de admin | `lib/auth/require-admin.ts` | Todas las rutas nuevas |
| `CRON_SECRET` | `.env` | Ya declarado; aún no hay `vercel.json` ni ruta de cron |
| Runbook Meta | `docs/runbooks/meta-lead-ads-setup.md` | Errores conocidos, scopes actuales, límites de uso |

---

## 3. Decisiones de arquitectura (registro — no re-discutir sin motivo nuevo)

### D1 · Monolito Next.js, no backend separado

Todo vive en `veeghub`. Razones: ya están auth, Prisma, cifrado, R2, cliente Graph y despliegue;
es una herramienta interna de agencia, no un SaaS multi-tenant. Las llamadas a LLM son espera de
I/O y en Vercel Fluid compute **no se cobra CPU mientras se espera** (verificado en docs de
Vercel el 2026-10-21).

**Cuándo separar:** solo si se vende como SaaS, o si aparece procesamiento pesado propio
(video, Python). Aun así, se separaría **solo el worker**, no la app.

### D2 · Vercel Pro

Hobby es para uso no comercial y limita funciones a 300 s y cron a 1 vez al día.
Pro: 800 s por función (30 min en beta), cron por minuto. Para trabajos sin límite existe
Vercel Workflows (no hace falta al inicio).

### D3 · Tareas largas = tabla de trabajos + cron + `after()`

Lanzar una campaña son 5–10 llamadas encadenadas. No se hace dentro del request del botón:

1. El botón crea un `AdLaunchJob` (`PENDING`) y responde al instante.
2. Se dispara el procesamiento enseguida con `after()` de Next (revisar la API en
   `node_modules/next/dist/docs/` — es Next 16, ver `AGENTS.md`).
3. Un cron cada minuto (`/api/cron/ads-jobs`, protegido con `CRON_SECRET`) recoge lo que
   quedó pendiente o falló con reintento.
4. **Cada paso guarda el ID externo antes de seguir.** Si se corta, se reanuda desde el último
   paso con ID, sin duplicar.

### D4 · Cómo se accede a las cuentas de clientes

| Plataforma | Mecanismo | Por qué |
|---|---|---|
| Meta | **Acceso de socio**: el cliente comparte su cuenta publicitaria, página, IG y píxel con el portafolio de VeegSoft; se asignan al usuario del sistema de VeegSoft | Es el estándar de agencias. Un solo token. Sin OAuth por cliente |
| Google | **Cuenta de administrador (MCC)** de VeegSoft vinculada a la cuenta del cliente; un refresh token OAuth del usuario dueño del MCC | Un solo token cubre todas las cuentas vinculadas |

**⚠️ Relación con el estándar de leads** (`runbooks/meta-lead-ads-setup.md` §3): ese estándar
**descarta** el acceso de socio para *leads* porque implica manejar datos personales de terceros
con la app de VeegSoft. **Sigue vigente para leads.** Gestionar *pauta* es distinto: no se leen
datos personales, solo se crean y leen objetos de anuncios y métricas agregadas. Por eso aquí sí
se usa acceso de socio. **La integración de leads de cada cliente se mantiene en su propia app.**
La campaña Lead Ads que se cree desde VeegHub usa formularios de la página del cliente; los leads
le llegan al cliente por su propia integración.

### D5 · Meta exige acceso avanzado para cuentas ajenas (verificado en docs de Meta 2026-10-21)

- Con **acceso estándar** a `ads_management` solo se gestionan cuentas propias (o donde un admin
  de la app es anunciante), con límites de uso muy bajos ("solo para desarrollo").
- Para **cuentas de otros negocios** hace falta **acceso avanzado** a `ads_management` (y
  `ads_read`) **y** a la función *Ads Management Standard Access*, vía App Review.
- Requisito para pedirlo y mantenerlo: **≥ 1.500 llamadas a la Marketing API en los últimos
  15 días con < 15 % de errores.**

**Consecuencia en el orden de fases:** F2–F4 se construyen y usan sobre **la cuenta
publicitaria propia de VeegSoft**, que funciona con acceso estándar. Ese uso real genera el
volumen de llamadas. Cuando se cumpla, se pide el acceso avanzado (F5). No inflar llamadas
artificialmente: el volumen sale de sincronizaciones reales (insights, estructura, estado).

**Plan B mientras no llega el avanzado** (si un cliente no puede esperar): el cliente agrega tu
usuario personal (admin de la app) como anunciante de su cuenta publicitaria y se usa un token de
usuario de larga duración (60 días). Funciona con acceso estándar, pero con límites bajos y
renovación manual. Solo como puente.

### D6 · Google: REST + `fetch`, sin librería

No hay librería oficial de Google Ads para Node. Se usa la interfaz REST
(`https://googleads.googleapis.com/v{N}/...`) con `fetch`, igual que `lib/meta/graph.ts`. La
versión vigente al 2026-10-21 es **v25**: guardarla en `GOOGLE_ADS_API_VERSION` porque Google
retira versiones cada ~12 meses.

Ventaja clave de Google: `googleAds:mutate` acepta **varias operaciones atómicas con IDs
temporales** (negativos), así que presupuesto + campaña + grupo + anuncios + keywords se crean
**en un solo request, todo o nada**. No hace falta la reanudación paso a paso como en Meta.

### D7 · IA con aprobación humana obligatoria

La IA propone, la persona aprueba. Nada generado se publica sin pasar por la pantalla de
revisión. Texto: Claude (Anthropic API). Imágenes: proveedor a decidir en F4 (Claude no genera
imágenes). Se registra cada generación con su costo (`AiGeneration`).

### 3.1 Cuándo reconsiderar este diseño

- Más de ~10 clientes que quieran **conectarse solos** → OAuth por cliente (Facebook Login for
  Business y OAuth de Google por usuario), como hace SaleADS.
- Vender el módulo como producto → separar worker, multi-tenant real, cobro.

---

## 4. Modelo de datos (borrador — se ajusta en F1)

> Convención del proyecto: dinero en `Decimal(12,2)` + moneda; fechas de calendario como
> `@db.Date` (ver `runbooks/fechas-y-zona-horaria.md`). Meta usa **unidades menores** (centavos) y
> Google **micros** (×1.000.000): convertir **solo en el borde** (`lib/ads/meta`, `lib/ads/google`).

```prisma
enum AdPlatform {
  META
  GOOGLE
}

enum AdDraftStatus {
  DRAFT          // editándose
  READY          // aprobado, listo para lanzar
  LAUNCHING      // hay un AdLaunchJob en curso
  LAUNCHED       // existe en la plataforma (en pausa o activa)
  FAILED
  ARCHIVED
}

enum AdJobStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED         // agotó reintentos o error permanente
}

// Generaliza la cuenta publicitaria: Meta (act_123) o Google (customer id sin guiones).
// MetaAdAccount se migra a esta tabla en F1 (o se le agregan clientId/platform, decidir allí).
model AdAccount {
  id             String     @id @default(cuid())
  platform       AdPlatform
  externalId     String     // "act_123..." | "1234567890"
  name           String?
  currency       String     @default("USD")
  timezone       String?
  clientId       String?    // null = cuenta propia de VeegSoft
  client         Client?    @relation(fields: [clientId], references: [id], onDelete: SetNull)
  // Activos por defecto de Meta para esta cuenta (página, IG, píxel)
  metaPageId     String?
  metaIgUserId   String?
  metaPixelId    String?
  accessStatus   String?    // último resultado del chequeo: "ok", "sin_pago", "sin_permiso"...
  lastCheckedAt  DateTime?
  lastSyncedAt   DateTime?
  usageCallCount Int?
  usageResetMin  Int?
  accessTier     String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  drafts AdCampaignDraft[]

  @@unique([platform, externalId])
  @@index([clientId])
}

// Perfil de marca por cliente: alimenta a la IA (F4).
model BrandProfile {
  id           String   @id @default(cuid())
  clientId     String   @unique
  client       Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  description  String?  // qué vende, a quién
  offer        String?  // oferta principal
  audience     String?  // público ideal
  tone         String?  // tono de voz
  forbidden    String?  // qué no decir (claims prohibidos, competencia)
  website      String?
  whatsapp     String?
  colors       String[]
  logoFileKey  String?  // R2
  locale       String   @default("es")
  updatedAt    DateTime @updatedAt
}

// El "plan de campaña" independiente de la plataforma. spec es JSON validado con zod
// (lib/ads/core/spec.ts), versionado con specVersion para migrar borradores viejos.
model AdCampaignDraft {
  id               String        @id @default(cuid())
  platform         AdPlatform
  adAccountId      String
  adAccount        AdAccount     @relation(fields: [adAccountId], references: [id])
  clientId         String?
  name             String
  objective        String        // "leads" | "messages" | "traffic" | "sales" | "awareness"
  status           AdDraftStatus @default(DRAFT)
  spec             Json
  specVersion      Int           @default(1)
  externalCampaignId String?     // ID real tras lanzar
  createdById      String?
  approvedAt       DateTime?
  launchedAt       DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  jobs     AdLaunchJob[]
  objects  AdObject[]
  assets   AdCreativeAsset[]

  @@index([clientId, status])
  @@index([externalCampaignId])
}

// Cada objeto creado en la plataforma, para reanudar y para gestionar después.
model AdObject {
  id          String     @id @default(cuid())
  draftId     String
  draft       AdCampaignDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  platform    AdPlatform
  kind        String     // "campaign" | "adset" | "creative" | "ad" | "image" | "budget" | "ad_group" | "keyword" | "asset"
  localKey    String     // clave estable dentro del spec, p. ej. "adset:0", "ad:0:1"
  externalId  String
  status      String?    // espejo del estado en la plataforma
  syncedAt    DateTime?
  createdAt   DateTime   @default(now())

  @@unique([draftId, localKey])
  @@index([platform, externalId])
}

model AdLaunchJob {
  id          String      @id @default(cuid())
  draftId     String
  draft       AdCampaignDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  kind        String      // "launch" | "sync" | "update_status" | "update_budget"
  status      AdJobStatus @default(PENDING)
  step        String?     // último paso completado
  attempts    Int         @default(0)
  nextRunAt   DateTime    @default(now())
  lockedUntil DateTime?   // evita que el cron y after() procesen el mismo trabajo
  error       String?
  errorDetail Json?       // code, subcode, fbtrace_id / request-id de Google
  createdAt   DateTime    @default(now())
  finishedAt  DateTime?

  @@index([status, nextRunAt])
}

model AdCreativeAsset {
  id         String   @id @default(cuid())
  draftId    String?
  draft      AdCampaignDraft? @relation(fields: [draftId], references: [id], onDelete: SetNull)
  clientId   String?
  kind       String   // "image" | "video"
  fileKey    String   // R2
  width      Int?
  height     Int?
  source     String   // "upload" | "ai"
  prompt     String?
  metaImageHash String?  // tras subir a Meta
  googleAssetName String? // resource name tras subir a Google
  createdAt  DateTime @default(now())
}

// Auditoría de costo y contenido de cada llamada a IA.
model AiGeneration {
  id           String   @id @default(cuid())
  draftId      String?
  clientId     String?
  purpose      String   // "strategy" | "copies" | "image" | "advisor"
  provider     String   // "anthropic" | "<proveedor de imágenes>"
  model        String
  inputTokens  Int?
  outputTokens Int?
  costUsd      Decimal? @db.Decimal(10, 4)
  output       Json?
  createdAt    DateTime @default(now())

  @@index([clientId, createdAt])
}
```

`MetaCampaignInsight` se generaliza en F3/F6 a `AdCampaignInsight` con `platform` (o se agrega
`platform` + `accountId` ya existe). Decidir en F3 según cuánto código dependa del nombre actual.

---

## 5. Estructura de código

```
lib/ads/
  core/
    spec.ts            # zod: CampaignSpec independiente de plataforma + validadores
    money.ts           # toMinorUnits / toMicros / desde
    jobs.ts            # tomar trabajo con lock, reintentos con backoff, marcar estado
    errors.ts          # clasificar errores: permanente vs reintentable
  meta/
    client.ts          # post con body, lectura de cuota compartida con insights.ts
    readiness.ts       # pago, página, IG, píxel, permisos del token
    launch.ts          # pasos: imagen → campaña → conjuntos → creativos → anuncios
    manage.ts          # estado, presupuesto, sync de estructura
    targeting.ts       # búsqueda de intereses/ubicaciones (targetingsearch)
  google/
    config.ts          # env + versión de API
    auth.ts            # refresh token → access token (cache en memoria ~50 min)
    client.ts          # search (GAQL) y mutate con headers developer-token / login-customer-id
    launch.ts          # mutate atómico con IDs temporales
    manage.ts
    insights.ts        # GAQL diario por campaña
  ai/
    strategy.ts        # objetivo + BrandProfile → estrategia (estructura, público, presupuesto sugerido)
    copies.ts          # copies con límites por plataforma
    images.ts          # proveedor de imágenes (F4)
    prompts/           # prompts versionados
app/admin/campanas/          # ya existe: pasa a ser la pestaña "Rendimiento"
app/admin/campanas/nueva/    # asistente
app/admin/campanas/borradores/[id]/   # revisión, edición, lanzar
app/admin/campanas/cuentas/  # cuentas por cliente + estado de acceso
app/api/cron/ads-jobs/route.ts
app/api/cron/ads-sync/route.ts
vercel.json                  # crons
```

Mutaciones desde la UI: **Server Actions** o rutas en `app/api/admin/ads/*`, según el patrón
que ya usen `leads` y `finanzas` (revisar antes de F2).

---

## 6. Variables de entorno nuevas

| Variable | Fase | Qué es |
|---|---|---|
| `META_GRAPH_VERSION` | ya existe | Mantener alineada; docs actuales usan `v25.0`, el código usa `v26.0` por defecto |
| `META_BUSINESS_ID` | F5 | ID del portafolio de VeegSoft (para listar activos compartidos por clientes) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | F6 | API Center del MCC |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | F6 | ID del MCC, sin guiones |
| `GOOGLE_ADS_CLIENT_ID` | F6 | Cliente OAuth (Google Cloud) |
| `GOOGLE_ADS_CLIENT_SECRET` | F6 | Cliente OAuth |
| `GOOGLE_ADS_REFRESH_TOKEN` | F6 | O guardado cifrado en BD (preferible si se rota desde la UI) |
| `GOOGLE_ADS_API_VERSION` | F6 | `25` al 2026-10-21 |
| `ANTHROPIC_API_KEY` | F4 | Texto |
| `IMAGE_PROVIDER_API_KEY` (nombre según proveedor) | F4 | Imágenes |
| `CRON_SECRET` | ya existe | Proteger `/api/cron/*` |

Agregar cada grupo a un `adsConfigStatus()` como `metaConfigStatus()` para el panel de salud.

---

## F0 · Trámites externos (arrancar YA, en paralelo al código)

Nada de esto es código. Son las cosas que **solo vos podés hacer** y que tienen esperas.

### F0.1 Vercel

- [ ] Subir el equipo a **Pro**.
- [ ] Verificar que el proyecto tenga **Fluid compute** activo (Settings → Functions).

### F0.2 Meta — preparar la app existente para Marketing API

> Es la **misma app** de VeegSoft que ya recibe leads. Ver `runbooks/meta-lead-ads-setup.md` para
> dónde está cada pantalla.

- [ ] **Verificación del negocio** del portafolio de VeegSoft completa
      (business.facebook.com → Configuración → Centro de seguridad). Sin esto no se puede pedir
      acceso avanzado en F5. Si no está, iniciarla ya: puede tardar días.
- [ ] App Dashboard → **Agregar producto → Marketing API**.
- [ ] App Dashboard → Revisión de la app → Permisos y funciones: confirmar que aparecen
      `ads_management`, `ads_read` y la función **Ads Management Standard Access** en nivel
      estándar (viene por defecto).
- [ ] Portafolio de VeegSoft → Usuarios del sistema → el usuario del sistema actual →
      **Asignar activos** → la **cuenta publicitaria de VeegSoft** con control total
      ("Administrar campañas"), la **página** (crear anuncios) y el **píxel/dataset**.
- [ ] **Regenerar el token del usuario del sistema** agregando `ads_management` (y mantener los
      que ya tiene: `ads_read`, `business_management`, `leads_retrieval`,
      `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`, `pages_manage_ads`).
      Para usar la cuenta de Instagram en anuncios: `instagram_basic` (verificar si la UI lo
      pide al asignar la cuenta de IG).
      **⚠️ Al regenerar, los tokens de página en caché quedan inválidos.** El código ya lo
      maneja con `forceRefresh` (ver `getPageAccessToken`), pero conviene vaciar
      `MetaPage.encryptedToken` y confirmar que los leads siguen entrando.
- [ ] Actualizar `META_SYSTEM_USER_TOKEN` en Vercel (producción y preview) y en `.env` local.
- [ ] La cuenta publicitaria de VeegSoft tiene **método de pago** activo.

**Cómo verificar:**
```bash
# scopes del token: debe incluir ads_management
curl "https://graph.facebook.com/v25.0/debug_token?input_token=$TOKEN&access_token=$APP_ID|$APP_SECRET"
# cuentas publicitarias visibles para el usuario del sistema
curl "https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name,account_status,currency,funding_source_details&access_token=$TOKEN"
```

### F0.3 Google — MCC, Cloud y developer token

> Google exige que el developer token salga de una **cuenta de administrador (MCC)**, no de una
> cuenta normal.

- [ ] **Crear el MCC de VeegSoft:** ads.google.com/home/tools/manager-accounts → "Crear una
      cuenta de administrador". Usar un correo de VeegSoft que vaya a quedar (no personal).
- [ ] **Vincular la cuenta de Google Ads propia de VeegSoft** al MCC (si existe): MCC →
      Cuentas → + → Vincular cuenta existente → ID de cliente → aceptar desde la cuenta.
- [ ] **Pedir el developer token:** en el MCC → Admin → **Centro de API** → completar el
      formulario. Al principio queda en **acceso de prueba** (solo cuentas de prueba).
- [ ] Cuando Google lo ofrezca, pedir **acceso Explorer**: 2.880 operaciones/día en cuentas
      reales. Alcanza para empezar. Restringe: creación de cuentas, gestión de usuarios,
      planificador de palabras clave, facturación (no los necesitamos al inicio).
- [ ] Pedir **acceso Basic** (15.000 ops/día) cuando haya uso real: formulario en el Centro de
      API, con descripción del uso (herramienta interna de agencia para crear y reportar
      campañas de sus clientes). Hace falta para el planificador de keywords (F7 opcional).
- [ ] **Crear una cuenta de prueba**: crear un **MCC de prueba** (desde
      ads.google.com con la opción de cuenta de prueba) y dentro una cuenta cliente de prueba.
      Las cuentas de prueba no sirven anuncios ni gastan.
- [ ] **Google Cloud:** console.cloud.google.com → proyecto nuevo `veeghub-ads` →
      APIs y servicios → **habilitar "Google Ads API"**.
- [ ] **Pantalla de consentimiento OAuth:** tipo **Externo** (o Interno si el correo es de
      Google Workspace — mejor, evita verificación). Scope:
      `https://www.googleapis.com/auth/adwords`.
      **⚠️ Si queda en estado "Testing", el refresh token vence a los 7 días.** Publicarla
      ("In production"). Con tipo Externo y sin verificar, Google muestra una advertencia al
      autorizar; es aceptable porque solo la autoriza VeegSoft.
- [ ] **Credenciales → Crear ID de cliente OAuth** tipo "Aplicación web", URI de redirección:
      `https://<dominio-veeghub>/api/admin/ads/google/oauth/callback` y
      `http://localhost:3000/api/admin/ads/google/oauth/callback`.
- [ ] Guardar `client_id` y `client_secret` (no los commitees; van a Vercel en F6).

### F0.4 IA

- [ ] Clave de **Anthropic API** con límite de gasto mensual configurado.
- [ ] Elegir proveedor de imágenes (se evalúa en F4; no bloquea F1–F3).

**Terminado cuando:** Vercel Pro activo, token Meta con `ads_management`, MCC con developer
token en Explorer o Basic, cliente OAuth creado.

---

## F1 · Fundaciones

**Objetivo:** el esqueleto sobre el que corre todo, sin tocar todavía la API de anuncios para
escribir.

### Tareas

1. **Migración Prisma** con los modelos de §4. Decidir: migrar `MetaAdAccount` a `AdAccount`
   (con backfill de la fila existente) o extenderla. Recomendado: **migrar** y dejar
   `lib/meta/insights.ts` leyendo de `AdAccount` donde `platform = META`.
2. **`lib/ads/core/spec.ts`**: esquema zod de `CampaignSpec` v1:
   ```ts
   {
     objective: "leads" | "messages" | "traffic" | "sales" | "awareness",
     destination?: "lead_form" | "whatsapp" | "messenger" | "instagram_direct" | "website",
     budget: { type: "daily" | "lifetime", amount: string /* decimal */, currency },
     schedule?: { start?: string, end?: string },
     audience: { countries, regions?, cities?, ageMin, ageMax, genders?, interests?, advantageAudience: boolean },
     adSets: [{ key, name, audience?, placements: "automatic" | [...] }],
     ads: [{ key, adSetKey, format: "image" | "video" | "carousel", assetIds, primaryText, headline, description?, cta, url? }],
     google?: { /* F7 */ }
   }
   ```
3. **`lib/ads/core/jobs.ts`**: `claimNextJob()` con `UPDATE ... WHERE lockedUntil < now()`
   (o `SELECT ... FOR UPDATE SKIP LOCKED` vía `$queryRaw`), backoff exponencial
   (1, 2, 5, 15, 60 min), máximo 5 intentos, clasificación de errores.
4. **Cron:** `vercel.json` con `/api/cron/ads-jobs` cada minuto y `/api/cron/ads-sync` cada
   hora. La ruta valida `Authorization: Bearer ${CRON_SECRET}`.
   Aprovechar para cerrar el **F6 pendiente del plan de leads** (backfill), que también
   necesita cron.
5. **Pantalla `/admin/campanas/cuentas`:** lista de `AdAccount`, asignar cada una a un
   `Client`, botón "Verificar acceso" (lee `account_status`, `funding_source_details`,
   permisos). Botón "Importar cuentas de Meta" (`GET /me/adaccounts` con el token del usuario
   del sistema).
6. **`adsConfigStatus()`** en el panel de salud de integraciones.

### Terminado cuando

- [ ] La migración corre en local y en Vercel (`vercel-build` hace `migrate deploy`).
- [ ] La cuenta de VeegSoft aparece en `/admin/campanas/cuentas` ligada a un cliente
      "VeegSoft" (o `clientId = null` = propia).
- [ ] Un trabajo de prueba (`kind: "noop"`) pasa de `PENDING` a `SUCCEEDED` por cron.
- [ ] Tests (`lib/**/*.test.ts`) para `spec.ts`, `money.ts` y la clasificación de errores.

---

## F2 · Meta: lanzar una campaña en pausa (sin IA)

**Objetivo:** probar la cadena completa contra Meta con contenido escrito a mano. Si esto
funciona, la IA de F4 solo rellena el mismo `spec`.

**Prerequisito externo:** F0.2 completo.

### Objetivos soportados en v1 (empezar por los dos primeros)

| Objetivo VeegHub | `objective` en Meta | `optimization_goal` | `destination_type` | Requiere |
|---|---|---|---|---|
| Leads con formulario | `OUTCOME_LEADS` | `LEAD_GENERATION` | `ON_AD` | Formulario de la página (`lead_gen_form_id` en el creativo) |
| Mensajes WhatsApp | `OUTCOME_ENGAGEMENT` (o `OUTCOME_LEADS` según versión) | `CONVERSATIONS` | `WHATSAPP` | Página con WhatsApp Business vinculado |
| Tráfico a web | `OUTCOME_TRAFFIC` | `LINK_CLICKS` / `LANDING_PAGE_VIEWS` | `WEBSITE` | URL |
| Ventas/conversiones | `OUTCOME_SALES` | `OFFSITE_CONVERSIONS` | `WEBSITE` | Píxel + evento |

> **Verificar al implementar** en la versión de Graph vigente: combinaciones válidas de
> objetivo/optimización/destino, si `is_adset_budget_sharing_enabled` es obligatorio cuando el
> presupuesto va en el conjunto, y los cambios de Advantage+ (Meta viene unificando campañas
> en estructura Advantage+). Los nombres de objetivos `OUTCOME_*` son los vigentes según docs
> del 2026-10-21.

### Pasos del lanzamiento (`lib/ads/meta/launch.ts`)

Cada paso guarda un `AdObject` con su `localKey` **antes** del siguiente.

1. **Chequeo previo** (`readiness.ts`): cuenta activa (`account_status = 1`), con método de pago,
   página asignada, token con `ads_management`, IG vinculado si hay ubicaciones IG, píxel si el
   objetivo es ventas. Si falla, el trabajo termina en `FAILED` con mensaje entendible, sin
   crear nada.
2. **Subir imágenes:** `POST /act_{id}/adimages` (bytes desde R2) → guardar `hash`.
   Videos: `POST /act_{id}/advideos` y esperar `status.video_status = ready` (reintento
   programado, no espera activa).
3. **Campaña:** `POST /act_{id}/campaigns` con `name`, `objective`, `status=PAUSED`,
   `special_ad_categories` (`[]` o `["NONE"]`; si el cliente es vivienda/empleo/crédito/política,
   la categoría correcta — **preguntar en el asistente**), `buying_type=AUCTION`.
4. **Conjuntos:** `POST /act_{id}/adsets` con `campaign_id`, `daily_budget` en **centavos**,
   `billing_event=IMPRESSIONS`, `optimization_goal`, `destination_type`, `promoted_object`
   (`page_id`, o `pixel_id` + `custom_event_type`), `targeting`
   (`geo_locations`, `age_min/max`, `targeting_automation.advantage_audience`), `status=PAUSED`.
   Sin `bid_amount` salvo estrategia de puja explícita.
5. **Creativos:** `POST /act_{id}/adcreatives` con `object_story_spec`
   (`page_id`, `instagram_user_id`, `link_data` con `image_hash`, `message`, `name`,
   `call_to_action`). Para lead forms: `call_to_action.value.lead_gen_form_id`.
6. **Anuncios:** `POST /act_{id}/ads` con `adset_id`, `creative: {creative_id}`, `status=PAUSED`.
7. Draft → `LAUNCHED`, guardar `externalCampaignId`. Enlace directo a Ads Manager para revisar.

### Idempotencia (el punto delicado)

Meta no tiene claves de idempotencia. Riesgo: Meta crea el objeto y el proceso muere antes de
guardar el ID → al reintentar se duplica.

Mitigación:
- Nombrar cada objeto con un sufijo estable: `"{nombre} · vh:{draftId}:{localKey}"`.
- Antes de crear, si el paso no tiene `AdObject`, **buscar** por nombre
  (`GET /act_{id}/campaigns?filtering=[{field:"name",operator:"CONTAIN",value:"vh:{draftId}:campaign"}]`)
  y adoptar el existente.
- Si un paso falla en Meta **después** de escribir, marcar el error como
  `launch_failed_after_meta_write` (SaleADS distingue exactamente esto) y mostrar en la UI
  qué quedó creado.

### Errores a clasificar (`core/errors.ts`)

| Código Meta | Qué es | Tratamiento |
|---|---|---|
| `190` | token inválido | Permanente → alerta, no reintentar |
| `200`, `10`, `294` | permisos | Permanente → mensaje con el permiso faltante |
| `17` (subcode `2446079`), `613` (`1487742`), `80004` | límite de uso | Reintentable con espera (`estimated_time_to_regain_access`) |
| `100` | parámetro inválido | Permanente → mostrar `error_user_msg` |
| `1487*` / `2446*` varios | validaciones de anuncio | Permanente → mostrar `error_user_title` + `error_user_msg` |
| HTTP 5xx / `2` / `1` | transitorio | Reintentable |

Guardar siempre `fbtrace_id` en `errorDetail`.

**Límites de uso:** con acceso estándar, cada cuenta publicitaria tiene un puntaje máximo de
**60** (lectura = 1, escritura = 3; se recupera en 300 s y bloquea 300 s si se pasa). Un
lanzamiento (~1 campaña + 1–2 conjuntos + 2–4 creativos + 2–4 anuncios + imágenes) son
~10–15 escrituras ≈ 30–45 puntos: **entra, pero de a una campaña por cuenta cada pocos
minutos.** El procesador de trabajos debe serializar por cuenta.

### UI

- `/admin/campanas/nueva`: cliente → cuenta → objetivo → presupuesto → público → anuncios
  (subir imagen a R2, textos, CTA) → guardar borrador.
- `/admin/campanas/borradores/[id]`: vista previa por ubicación (`GET /act_{id}/generatepreviews`
  o `/{creative_id}/previews` tras crear el creativo), botón **Lanzar (en pausa)**, progreso del
  trabajo, errores.

### Terminado cuando

- [ ] Una campaña de leads **y** una de WhatsApp creadas desde VeegHub en la cuenta de
      VeegSoft aparecen en Ads Manager **en pausa**, con la estructura correcta.
- [ ] Matar el proceso a mitad del lanzamiento y reintentar **no duplica** objetos.
- [ ] Un token sin `ads_management` produce un error claro, no un 500.
- [ ] Runbook nuevo `docs/runbooks/meta-marketing-api-campanas.md` con lo verificado
      (combinaciones válidas, errores reales encontrados).

---

## F3 · Meta: gestionar y medir

**Objetivo:** que no haga falta abrir Ads Manager para el día a día.

### Tareas

1. **Activar / pausar** campaña, conjunto o anuncio: `POST /{id}` con `status`. Confirmación
   explícita en la UI al **activar** ("Esto empieza a gastar ~$X/día").
2. **Editar presupuesto** del conjunto (`daily_budget`). Mostrar el aviso de Meta: cambios grandes
   reinician el aprendizaje.
3. **Sincronizar estructura:** cron horario que lee `effective_status`, `configured_status`,
   `issues_info` y `ad_review_feedback` (anuncios rechazados) de lo creado desde VeegHub.
   Notificación push (ya existe web-push) si un anuncio es **rechazado**.
4. **Insights por cliente:** generalizar `syncCampaignInsights` a todas las `AdAccount` META,
   respetando el techo del 80 %. Agregar `actions` de leads (ojo: §7.4 del runbook, los
   `action_type` de leads no son estables) — **mejor contar leads desde la tabla `Lead`** por
   `campaignId`, que es la fuente real.
5. **Panel por cliente** (`/admin/clientes/[id]` pestaña "Pauta" y `/admin/campanas`):
   gasto, leads (CRM), costo por lead, clientes ganados, costo por cliente ganado, por campaña.
6. **Importar campañas existentes** (no creadas desde VeegHub) en modo solo lectura, para ver
   todo el gasto del cliente en un lugar.

### Terminado cuando

- [ ] Pausar/activar desde VeegHub se refleja en Ads Manager en segundos.
- [ ] Un anuncio rechazado genera aviso push con el motivo.
- [ ] El panel muestra costo por lead real (gasto Meta ÷ leads del CRM) por campaña.
- [ ] El volumen de llamadas acumulado se ve en el panel de salud (sirve para F5).

---

## F4 · IA: estrategia, copies y creativos

**Objetivo:** reproducir el flujo de SaleADS — objetivo → estrategia → copies → creativos →
aprobación — pero con el contexto del cliente que VeegHub ya tiene.

**Prerequisito externo:** F0.4.

### Ventaja sobre SaleADS

VeegHub conoce al cliente: `BrandProfile`, proyectos, **qué leads se convirtieron en clientes y
de qué campañas venían**. La IA puede recibir "estos anuncios trajeron leads que cerraron, estos
no" — SaleADS no tiene ese dato.

### Tareas

1. **`BrandProfile`**: pantalla en el detalle del cliente. Botón "Rellenar desde la web" que lee
   `website` y propone campos (con aprobación).
2. **Estrategia** (`ai/strategy.ts`): entrada = objetivo + presupuesto + BrandProfile +
   historial de rendimiento del cliente. Salida = `CampaignSpec` parcial (estructura,
   público sugerido, presupuesto por conjunto, ángulos de mensaje) **validado con zod**.
   Usar salida estructurada (tool use / JSON schema) para no parsear texto libre.
3. **Copies** (`ai/copies.ts`): N variantes por ángulo. Límites:
   - Meta: texto principal (recomendado ≤ 125 car. visibles), título ≤ 40, descripción ≤ 30.
   - Google RSA (F7): 3–15 títulos ≤ **30**, 2–4 descripciones ≤ **90**, rutas ≤ 15, sin
     duplicados (`AssetError.DUPLICATE_ASSET`).
   Validar longitud **en código** y regenerar solo lo que no cumpla.
4. **Creativos** (`ai/images.ts`): evaluar proveedores de imagen (calidad de texto dentro de la
   imagen, costo por imagen, licencia de uso comercial, API estable). Tamaños: 1080×1080 (1:1),
   1080×1350 (4:5) feed, 1080×1920 (9:16) stories/reels. Generar → guardar en R2 →
   `AdCreativeAsset` con `source: "ai"` y `prompt`.
   Sobreponer logo del cliente (si se hace en servidor con `sharp`, ojo con CPU en Vercel; es
   liviano, pero medir).
5. **Revisión:** cada pieza generada se puede editar, regenerar o descartar. "Aprobar" pasa el
   borrador a `READY`. **Sin aprobación no hay botón Lanzar.**
6. **Costo:** registrar cada llamada en `AiGeneration`. Mostrar costo de IA por borrador.
7. **Modelos:** Claude para texto (estrategia con el modelo más capaz, copies con uno más
   rápido). Consultar la skill `claude-api` al implementar para IDs, precios y caché de prompts
   vigentes; cachear el BrandProfile como prefijo del prompt.

### Reglas de contenido (en el prompt y validadas)

- Nada de promesas de resultados garantizados, salud, finanzas o "antes y después" que violen
  políticas publicitarias de Meta/Google.
- Respetar `BrandProfile.forbidden`.
- Idioma = `BrandProfile.locale`.

### Terminado cuando

- [ ] De "objetivo + presupuesto" a borrador completo con 3 ángulos y 2 imágenes en < 2 min.
- [ ] Ningún copy generado excede límites (test con casos borde).
- [ ] Costo por borrador visible y < un umbral definido (p. ej. USD 0,50).

---

## F5 · Meta: cuentas de clientes

**Objetivo:** operar cuentas de clientes, no solo la de VeegSoft.

**Prerequisitos:** F3 en uso real; verificación de negocio de VeegSoft; ≥ 1.500 llamadas a la
Marketing API en 15 días con < 15 % de errores (ver panel de salud de F3).

### F5.1 Pedir acceso avanzado (vos, en Meta)

- [ ] App Dashboard → Revisión de la app → Permisos y funciones → **Solicitar acceso avanzado**
      para: `ads_management`, `ads_read`, **Ads Management Standard Access**
      (y `business_management` si se van a listar activos de otros portafolios).
- [ ] Para cada uno: descripción del uso ("herramienta interna de la agencia VeegSoft para crear,
      pausar y reportar campañas en cuentas publicitarias que los clientes comparten como socio")
      y **screencast**: login en VeegHub → elegir cliente → crear borrador → lanzar en pausa →
      ver en Ads Manager → pausar/activar desde VeegHub → ver métricas.
- [ ] Política de privacidad de VeegSoft publicada (ya existe para la app).
- [ ] Esperar respuesta (típicamente días). Si rechazan, el motivo viene en el panel; corregir y
      reenviar.
- [ ] **Mantenerlo:** Meta revoca el avanzado si caen las llamadas por debajo de 1.500/15 días o
      sube el error al 15 %. El cron de sync de F3 lo sostiene.

### F5.2 Alta de un cliente (procedimiento repetible → runbook)

**Lo que hace el cliente** (o vos con su acceso de admin), en *su* portafolio:
1. business.facebook.com → Configuración → **Socios** → **Agregar** → "Dar acceso a tus activos
   a un socio" → ID del portafolio de VeegSoft (`META_BUSINESS_ID`).
2. Compartir:
   - **Cuenta publicitaria** → "Administrar campañas" (+ "Ver rendimiento").
   - **Página** → crear anuncios / contenido.
   - **Cuenta de Instagram** → anuncios.
   - **Píxel / dataset** → usar (si hay objetivo de ventas).
3. El **método de pago queda en la cuenta del cliente.** VeegSoft nunca paga la pauta.

**Lo que hacés vos** en el portafolio de VeegSoft:
4. Configuración → Usuarios del sistema → el usuario del sistema → **Asignar activos** → cada
   activo compartido con permisos completos de anuncios.
5. En VeegHub `/admin/campanas/cuentas` → **Importar cuentas** → asignarla al `Client` →
   **Verificar acceso** (debe dar ✅ pago, ✅ página, ✅ IG, ✅ permisos).

> No hace falta regenerar el token al asignar activos nuevos al usuario del sistema.

### Código

- Importación usa `GET /{business_id}/client_ad_accounts` y `/client_pages` además de
  `/me/adaccounts`.
- Serializar trabajos **por cuenta** (los límites son por cuenta publicitaria).
- Runbook: `docs/runbooks/meta-alta-cliente-pauta.md` con capturas reales del primer alta.

### Terminado cuando

- [ ] App con acceso avanzado aprobado.
- [ ] Primer cliente real con campaña creada desde VeegHub y gasto cargado a **su** tarjeta.

---

## F6 · Google: conexión y métricas

**Prerequisito externo:** F0.3 (MCC, developer token ≥ Explorer, cliente OAuth).

### F6.1 Obtener el refresh token (una vez, desde VeegHub)

- Ruta `GET /api/admin/ads/google/oauth/start` → redirige a
  `https://accounts.google.com/o/oauth2/v2/auth` con `scope=https://www.googleapis.com/auth/adwords`,
  `access_type=offline`, `prompt=consent`, `state` firmado (CSRF).
- `GET .../oauth/callback` → intercambia `code` en `https://oauth2.googleapis.com/token` →
  guarda el **refresh token cifrado** en BD (tabla `Credential` existente con `kind: OAUTH`, o
  tabla propia). Autorizar con el **usuario dueño del MCC**.
- Botón en `/admin/campanas/cuentas`: "Conectar Google Ads" / "Reconectar".

### F6.2 Cliente REST (`lib/ads/google/client.ts`)

Headers en cada llamada:
```
Authorization: Bearer <access_token>      # renovado desde el refresh token, cache ~50 min
developer-token: <GOOGLE_ADS_DEVELOPER_TOKEN>
login-customer-id: <GOOGLE_ADS_LOGIN_CUSTOMER_ID>   # el MCC, sin guiones — obligatorio vía MCC
```
- Lectura: `POST /v{N}/customers/{id}/googleAds:searchStream` con GAQL.
- Escritura: `POST /v{N}/customers/{id}/googleAds:mutate` (atómico, IDs temporales).
- Error típico: falta `login-customer-id` → `AuthorizationError.USER_PERMISSION_DENIED`.
- Guardar `request-id` del header de respuesta en `errorDetail`.
- Cupo: Explorer = 2.880 ops/día en producción (ventana móvil de 24 h). Contar operaciones
  por día y frenar antes del límite (error `RESOURCE_EXHAUSTED`).

### F6.3 Cuentas y métricas

- Listar cuentas bajo el MCC: GAQL `SELECT customer_client.id, customer_client.descriptive_name,
  customer_client.currency_code, customer_client.time_zone, customer_client.manager
  FROM customer_client WHERE customer_client.level = 1` → `AdAccount` con `platform: GOOGLE`.
- Insights diarios: `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros,
  metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date
  BETWEEN ...` → tabla de insights generalizada (decidida en F3).
- Ojo: `cost_micros` → dividir por 1.000.000. Fechas en la zona horaria **de la cuenta**.

### F6.4 Alta de un cliente en Google (procedimiento repetible → runbook)

1. Pedir al cliente su **ID de cliente de Google Ads** (arriba a la derecha, `123-456-7890`).
2. En el MCC → Cuentas → **+** → **Vincular cuenta existente** → pegar el ID → enviar.
3. El cliente (admin de su cuenta) → Admin → **Acceso y seguridad** → **Administradores** →
   aceptar la solicitud.
4. VeegHub → **Importar cuentas de Google** → asignar al `Client`.
5. El método de pago queda en la cuenta del cliente.

### Terminado cuando

- [ ] Refresh token guardado cifrado y renovación automática funcionando.
- [ ] Cuentas del MCC listadas y asignadas a clientes.
- [ ] Gasto diario de Google visible junto al de Meta en el panel por cliente.
- [ ] Runbook `docs/runbooks/google-ads-api-setup.md` con lo verificado.

---

## F7 · Google: campaña de Búsqueda

**Objetivo:** el tipo de campaña de Google más útil para servicios locales.

### Un solo `googleAds:mutate` atómico

Con IDs temporales (`customers/{id}/campaignBudgets/-1`, `campaigns/-2`, `adGroups/-3`):
1. `campaignBudgetOperation.create`: `amountMicros`, `deliveryMethod: STANDARD`,
   `explicitlyShared: false`.
2. `campaignOperation.create`: `advertisingChannelType: SEARCH`, `status: PAUSED`,
   `campaignBudget: .../-1`, estrategia de puja (`maximizeConversions` si hay conversiones
   configuradas; si no, `maximizeClicks`/`targetSpend`), `networkSettings`
   (`targetGoogleSearch: true`, `targetSearchNetwork` según elección, `targetContentNetwork:
   false` por defecto). **Verificar campos obligatorios nuevos de la versión vigente** (p. ej.
   la declaración de publicidad política en la UE, que Google empezó a exigir al crear campañas).
3. `campaignCriterionOperation.create`: ubicaciones (`geoTargetConstant`) e idioma
   (`languageConstant`).
4. `adGroupOperation.create`: `type: SEARCH_STANDARD`, `campaign: .../-2`.
5. `adGroupCriterionOperation.create`: palabras clave (`keyword.text`, `matchType`
   PHRASE/EXACT) y negativas a nivel campaña.
6. `adGroupAdOperation.create`: `responsiveSearchAd` (títulos/descripciones de F4), `finalUrls`.
7. Opcional: recursos de llamada / sitelinks (assets).

Si algo falla, **no se crea nada** (atómico). Usar `validateOnly: true` primero para mostrar
errores en la pantalla de revisión sin crear.

### IA específica de Google

- Keywords: la IA propone desde BrandProfile + servicios. Con acceso **Basic** se puede validar
  volumen con `KeywordPlanIdeaService` (restringido en Explorer).
- Copies: respetar 30/90 caracteres; al menos 3 títulos sin fijar.

### Terminado cuando

- [ ] Campaña de Búsqueda creada **en pausa** en una cuenta de prueba, y luego en la de VeegSoft.
- [ ] `validateOnly` muestra errores de política antes de lanzar.
- [ ] Activar/pausar desde VeegHub (`campaignOperation.update` + `updateMask: status`).

---

## F8 · Google: Performance Max / Demand Gen + YouTube (opcional)

Solo si F7 está en uso y hay demanda real.

- **Performance Max:** `assetGroups` con imágenes (1,91:1, 1:1, 4:5), logos, títulos, títulos
  largos, descripciones, video opcional. Revisar requisitos mínimos de assets en la versión
  vigente antes de empezar; cambian seguido.
- **Demand Gen:** requiere video → subir a **YouTube** (YouTube Data API, scope
  `youtube.upload`, cuota diaria baja) y referenciar el video como asset. SaleADS tiene una
  integración YouTube separada justamente por esto.
- Señal de conversión: sin conversiones configuradas, PMax rinde mal → depende de F9.

---

## F9 · Optimización y señal de conversiones

**Objetivo:** lo que SaleADS vende como "la IA optimiza continuamente", pero **con reglas
visibles y aprobación humana**.

1. **Reglas** por cliente (tabla `AdRule`): "si CPL > X durante 3 días → proponer pausar",
   "si gasto del mes > Y → alerta", "anuncio con CTR < Z tras N impresiones → proponer
   reemplazo". Las reglas **proponen**; aplicar requiere clic (salvo regla de seguridad:
   pausar si se pasa del presupuesto mensual tope, opt-in explícito).
2. **Asesor IA semanal:** resumen por cliente con métricas + leads del CRM → recomendaciones
   concretas (nuevo ángulo, cambiar público, mover presupuesto). Se guardan como tareas
   (`Task` ya existe) para que no se pierdan.
3. **Conversions API (Meta)** y **conversiones offline / mejoradas (Google)**: cuando un lead
   pasa a `WON` en el CRM, devolver el evento a la plataforma para que optimice por clientes
   reales, no por formularios. Es el **F7 pendiente del plan de leads** — hacerlo una vez y
   servirá a ambos planes. Ojo: para leads de clientes, respetar D4 (la señal la envía la app
   del cliente, o se acuerda explícitamente).
4. **Digest diario** por push/email (Resend ya está): gasto de ayer, leads, anomalías.

---

## 7. Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Gasto no autorizado por bug o IA | Todo en `PAUSED`; activar es manual con confirmación; reglas solo proponen |
| Objetos duplicados en Meta al reintentar | Sufijo `vh:{draftId}:{key}` + búsqueda antes de crear (F2) |
| Pérdida del acceso avanzado de Meta | Panel de salud con llamadas/errores 15 días; cron de sync sostiene volumen real |
| Token Meta regenerado rompe leads | Procedimiento en F0.2 + `forceRefresh` ya existente; verificar leads tras cada regeneración |
| Refresh token Google vence a los 7 días | Pantalla de consentimiento en "In production" (F0.3) |
| Versión de API retirada | Versiones en env (`META_GRAPH_VERSION`, `GOOGLE_ADS_API_VERSION`); revisar cada trimestre |
| Rechazo de anuncios por política | Reglas de contenido en IA (F4); `validateOnly` en Google; aviso push por rechazo (F3) |
| Costos de IA | `AiGeneration` + límite de gasto en Anthropic + umbral por borrador |
| Cliente se va y revoca el socio | Los datos históricos quedan en VeegHub; la cuenta pasa a `accessStatus: "revocado"` sin errores en cascada |

---

## 8. Estimación de esfuerzo (sesiones de trabajo)

| Fase | Sesiones aprox. |
|---|---|
| F1 | 2 |
| F2 | 3–4 |
| F3 | 2–3 |
| F4 | 3–4 |
| F5 | 1 (+ espera de Meta) |
| F6 | 2 |
| F7 | 2–3 |
| F8 | 3+ |
| F9 | 3+ |

---

## 9. Checklist de arranque de cada sesión

1. Leer §0 y la fase en curso.
2. `git checkout develop && git pull`, crear sub-rama de la fase.
3. Revisar `node_modules/next/dist/docs/` para cualquier API de Next que se toque (`AGENTS.md`).
4. Consultar documentación vigente (Context7) de Meta Marketing API / Google Ads API para los
   endpoints de la fase: **los nombres de objetivos, campos obligatorios y versiones cambian.**
5. Al terminar: actualizar el tablero de §0 y el registro de §10.

---

## 10. Registro de avance

| Fecha | Fase | Qué se hizo | Notas / hallazgos |
|---|---|---|---|
| 2026-10-21 | — | Plan creado | Análisis de SaleADS (§11), docs de Vercel, Meta y Google consultadas |

---

## 11. Anexo: cómo está hecho SaleADS (referencia)

Análisis por ingeniería inversa del frontend público (REA, captura de red + bundles JS),
2026-10-21. **Solo se observó el cliente**; lo del servidor es inferencia por rutas y campos.

- **Stack:** Next.js (Turbopack) + Auth.js; API propia en `gateway-prod.saleads.ai` con
  `Authorization: Bearer` y `X-Business-Id`; PostHog, Sentry, Meta Pixel, Cloudflare.
- **El navegador nunca llama a Meta/Google:** todo vía su gateway, que guarda los tokens OAuth.
- **Meta:** OAuth por usuario (`/api/integration/meta/oauth/url`), selección de BM → cuenta →
  página → IG → WhatsApp, puede **crear cuenta publicitaria y píxel**, chequeo previo
  `readiness/check-v3` (pago, permisos, IG profesional, WhatsApp), subida de imagen/video.
  Distinguen `launch_failed_before_meta_write` vs `launch_failed_after_meta_write` y
  `meta_rate_limited`.
- **Google:** OAuth por usuario, `customer-accounts`, tipos `SEARCH`, `PERFORMANCE_MAX`,
  `DEMAND_GEN`; integración YouTube aparte para videos.
- **Campañas:** borrador → copies/creativos IA → lanzamiento; estructura campaña/adset/anuncio
  con `optimization_goal`, `billing_event`, `daily_budget`, `targeting`; todo creado en
  `PAUSED`; métricas por negocio.
- **Agente "Ale":** chat (`/api/ale/send`) con contexto de negocio y adjuntos.
- **Monetización:** suscripción + créditos por generación (Pro USD 69/mes, Business USD 129/mes).

**Diferencias deliberadas de VeegHub:** acceso de socio/MCC en vez de OAuth por usuario (D4),
contexto CRM real para la IA (F4), reglas visibles en vez de "optimización automática" opaca (F9).
