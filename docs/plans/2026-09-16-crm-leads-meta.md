# Plan: Módulo CRM de Leads + integración Meta Lead Ads

**Creado:** 2026-09-16
**Estado:** F1–F5 completas · pendientes F6 (cron) y F7 (métricas)
**Rama sugerida:** `feat/leads-crm`

---

## 1. Objetivo

Hoy: entrar a cada campaña de Meta → descargar CSV → llamar. Manual, lento, se pierden leads.

Meta: lead entra por formulario de Meta Ads → llega a Veeghub en segundos → push al celular → se gestiona en un pipeline hasta la venta → al ganar se convierte en `Client` (módulo existente, **no se toca**).

Métrica que importa: **tiempo desde que el lead llena el formulario hasta la primera llamada**. Objetivo < 5 min.

---

## 2. Decisión de arquitectura: ¿Lead / Contacto / Cliente?



### Respuesta corta: **NO crear módulo de Contactos ahora.** Modelo `Lead → Client`.



### Por qué

El modelo clásico Salesforce es `Lead → (Contact + Account) + Opportunity`. Mapeado a este proyecto:


| Concepto CRM | Qué es aquí                                            | Estado                                      |
| ------------ | ------------------------------------------------------ | ------------------------------------------- |
| Lead         | Persona anónima que llenó el formulario, sin calificar | **falta → lo construimos**                  |
| Contact      | Persona dentro de una empresa cliente                  | no existe                                   |
| Account      | Empresa                                                | `Client` ✅                                  |
| Opportunity  | El trato / la venta concreta                           | `Project` (ya tiene `ProjectStatus.LEAD`) ✅ |


La "oportunidad" **no** es `Client`: es `Project`. `Client` ya es la cuenta de la que cuelgan pagos, proyectos, facturas, credenciales, drive. Un cliente puede tener varias oportunidades (varios proyectos) a lo largo del tiempo — por eso `Project` es el lugar natural de la oportunidad, y ya tiene el estado `LEAD` listo.

`Contact` solo aporta valor cuando **una misma cuenta tiene varias personas con las que hablas** (gerente que firma, contador que paga, técnico que aprueba). Hoy `Client` ya tiene `email`, `billingEmail`, `phone`. Para negocios de 1–2 interlocutores eso alcanza y agregar `Contact` mete un join extra en cada pantalla sin dar nada.

### Cuándo agregar Contactos (gatillo concreto)

Agregar `ClientContact` cuando se cumpla **uno** de estos:

- Hay ≥ 3 clientes donde escribes habitualmente a más de una persona.
- Necesitas mandar la factura a un correo y el avance del proyecto a otro (hoy se resuelve con `billingEmail`, pero si aparece un tercer destinatario, se rompe).

La migración a futuro es barata y no destructiva:

```prisma
model ClientContact {
  id       String  @id @default(cuid())
  clientId String
  client   Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name     String
  role     String?   // "Gerente", "Contabilidad"
  email    String?
  phone    String?
  isPrimary Boolean @default(false)
  leadId   String?  @unique   // de qué lead salió
}
```

Y un backfill que crea un `ClientContact` primario por cada `Client` con email/phone. **No se borran los campos de** `Client` (se quedan como "datos de la cuenta").

### Flujo final

```
Formulario Meta ──webhook──> Lead (NEW)
                               │
                    pipeline:  NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION
                               │
                    ┌──────────┴──────────┐
                  WON                    LOST (con motivo)
                    │
        convertLeadToClient()
                    │
     ┌──────────────┼───────────────┐
  Client        Project(LEAD)   Receivable(PLANNED)   ← opcionales los 2 últimos
 (obligatorio)
```

**Regla dura:** el módulo `clientes` no se modifica. Lo único que toca `Client` es una relación inversa `leads Lead[]` y `convertedFromLead`, que Prisma exige para la FK. Cero cambios en sus queries, actions, páginas o dialogs existentes.

---



## 3. Guía completa de Meta (lo que hace Sebastián, fuera del código)

> **Los pasos detallados viven en [`docs/runbooks/meta-lead-ads-setup.md`](../runbooks/meta-lead-ads-setup.md)**,
> un runbook reutilizable para cualquier app futura de un cliente. Acá queda solo el resumen y el
> estado de esta implementación.

**Clave para entender el orden:** son tres conexiones independientes, y los leads no llegan hasta
que las tres estén activas.

| # | Conexión | ¿Botón en el panel? |
|---|---|---|
| A | App declara el webhook (objeto `Page`, campo `leadgen`) | ✅ App Dashboard → Webhooks |
| B | App instalada **en la Página** (`subscribed_apps`) | ❌ **No existe. Solo API** |
| C | Lead Access Manager autoriza a la app a descargar leads | ✅ Business Settings |

La app **no aparece** en la lista de CRMs de C hasta que B esté hecho. Ese es el error más común.

### Orden correcto

```
1. Requisitos previos (portafolio verificado, política de privacidad, dominio HTTPS)
2. Crear app Business + vincular al portafolio        → APP_ID, APP_SECRET
3. Usuario del sistema + token "Nunca" (7 scopes)     → SYSTEM_USER_TOKEN
4. GET /me/accounts                                   → PAGE_ID
5. DESPLEGAR el endpoint del webhook (F2)             → VERIFY_TOKEN
6. [A] App Dashboard → Webhooks → Page → leadgen
7. [B] POST /{page-id}/subscribed_apps                  (solo API)
8. [C] Lead Access Manager → CRMs → asignar la app
9. Lead Ads Testing Tool → lead de prueba
10. App Review → acceso avanzado → app en Live
```

### Estado actual

| Paso | Estado |
|---|---|
| 1–4 | ✅ hecho |
| 5 | ⏳ bloqueado por F2 |
| 6 | ⏳ requiere el paso 5 |
| 7 | ✅ hecho — `VeegHub` instalada en la Página con `subscribed_fields: [leadgen]` |
| 8 | ⏳ la app ya debería aparecer en la lista |
| 9–10 | ⏳ |

Pendiente aparte: regenerar el token del usuario del sistema agregando `pages_manage_ads`
(necesario para el backfill de F6; el webhook funciona sin él).

### Diseño de los formularios (afecta mucho la calidad del lead)

- Tipo de formulario: **Mayor intención** (agrega paso de revisión) → menos leads basura, más caros
  pero contactables. Vale la pena cuando llamás vos mismo.
- Campos: `full_name`, `phone_number`, `email` + 1–2 preguntas personalizadas
  ("¿Qué necesitás?", "¿Cuándo querés empezar?"). Cada campo extra baja la conversión.
- **Nombrar campañas / conjuntos / anuncios con convención**
  (ej. `EC-Web-Pymes-Sep26 | Interes-Emprendedores | Video-Testimonio`): eso es lo que después se ve
  en el reporte de "qué campaña trae clientes".
- Un `form_id` distinto por servicio → permite auto-asignar el `serviceTag` del lead.

## 4. Variables de entorno nuevas

```bash
# Meta
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_SYSTEM_USER_TOKEN=
META_PAGE_ID=
META_GRAPH_VERSION=v23.0

# Web Push (npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:veegsoft@gmail.com

# Cron + alertas
CRON_SECRET=
LEAD_ALERT_EMAIL=veegsoft@gmail.com

# Normalización de teléfonos
DEFAULT_PHONE_COUNTRY=EC
```

Cargar las mismas en Vercel (Production + Preview).

---



## 5. Fases de implementación

Cada fase es una sesión de trabajo cerrada: compila, corre y se puede commitear sola.

---



### F1 — Esquema de datos

**Archivos:** `prisma/schema.prisma`, `prisma/migrations/2026XXXX_add_leads_crm/`

```prisma
enum LeadStage {
  NEW
  CONTACTED
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  WON
  LOST
}

enum LeadSource {
  META_ADS
  INSTAGRAM
  WHATSAPP
  REFERRAL
  WEBSITE
  MANUAL
  CSV_IMPORT
  OTHER
}

enum LeadActivityType {
  NOTE
  CALL
  WHATSAPP
  EMAIL
  MEETING
  STAGE_CHANGE
  SYSTEM
}

enum MetaEventStatus {
  PENDING
  PROCESSED
  FAILED
  IGNORED
}

model Lead {
  id           String     @id @default(cuid())
  name         String
  email        String?
  phone        String?          // guardado en E.164: +5939XXXXXXXX
  phoneRaw     String?          // lo que vino de Meta, sin tocar
  company      String?
  message      String?          // respuesta a la pregunta abierta del form
  stage        LeadStage  @default(NEW)
  source       LeadSource @default(META_ADS)
  serviceTag   String?          // "Web", "App", "Ecommerce" — derivado del form
  estimatedValue Decimal? @db.Decimal(12, 2)
  currency     String     @default("USD")
  notes        String?
  lostReason   String?

  // Atribución Meta
  metaLeadId     String?  @unique   // clave de idempotencia
  metaFormId     String?
  metaFormName   String?
  metaPageId     String?
  metaAdId       String?
  metaAdName     String?
  metaAdsetId    String?
  metaAdsetName  String?
  metaCampaignId String?
  metaCampaignName String?
  metaCreatedAt  DateTime?
  rawPayload     Json?            // field_data completo, por si Meta agrega campos

  // SLA / seguimiento
  firstContactedAt DateTime?      // se setea al salir de NEW → mide tiempo de respuesta
  nextFollowUpAt   DateTime?
  stageChangedAt   DateTime @default(now())

  // Conversión
  convertedClientId  String?  @unique
  convertedClient    Client?  @relation("LeadConversion", fields: [convertedClientId], references: [id], onDelete: SetNull)
  convertedProjectId String?  @unique
  convertedProject   Project? @relation("LeadProjectConversion", fields: [convertedProjectId], references: [id], onDelete: SetNull)
  convertedAt        DateTime?

  activities LeadActivity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([stage, createdAt])
  @@index([stage, nextFollowUpAt])
  @@index([source, createdAt])
  @@index([metaCampaignId])
  @@index([phone])
  @@index([email])
  @@index([createdAt])
}

model LeadActivity {
  id         String           @id @default(cuid())
  leadId     String
  lead       Lead             @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type       LeadActivityType
  body       String?
  fromStage  LeadStage?
  toStage    LeadStage?
  occurredAt DateTime         @default(now())
  createdAt  DateTime         @default(now())

  @@index([leadId, occurredAt])
}

model MetaPage {
  id              String   @id @default(cuid())
  pageId          String   @unique
  pageName        String?
  // token de página cifrado, mismo patrón que Credential
  encryptedToken  String?
  tokenIv         String?
  tokenTag        String?
  subscribed      Boolean  @default(false)
  subscribedAt    DateTime?
  lastEventAt     DateTime?
  lastBackfillAt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model MetaWebhookEvent {
  id          String          @id @default(cuid())
  leadgenId   String          @unique
  pageId      String?
  formId      String?
  payload     Json
  status      MetaEventStatus @default(PENDING)
  attempts    Int             @default(0)
  error       String?
  receivedAt  DateTime        @default(now())
  processedAt DateTime?

  @@index([status, receivedAt])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  lastUsedAt DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Relaciones inversas a agregar (único cambio en modelos existentes):

```prisma
model Client  { ... leadOrigin Lead? @relation("LeadConversion") }
model Project { ... leadOrigin Lead? @relation("LeadProjectConversion") }
model User    { ... pushSubscriptions PushSubscription[] }
```

- [ ] Editar `schema.prisma`
- [ ] `npx prisma migrate dev --name add_leads_crm`
- [ ] `npx prisma generate`
- [ ] Verificar que `npm run build` pasa y que las páginas de clientes/proyectos siguen intactas

---



### F2 — Webhook Meta + ingesta (LA FASE URGENTE)

**Archivos nuevos:**

```
lib/meta/config.ts          // versión de Graph, base URL, lectura de env
lib/meta/signature.ts       // verifyMetaSignature (HMAC sha256 + timingSafeEqual)
lib/meta/graph.ts           // fetchLead, fetchAdContext, subscribePage, listPages
lib/meta/lead-mapper.ts     // field_data[] → campos de Lead + normalización de teléfono
lib/meta/ingest.ts          // ingestLeadgen({ leadgenId, pageId, formId, adId })
app/api/webhooks/meta/leads/route.ts
app/admin/leads/configuracion/page.tsx   // estado de la integración + botón suscribir
lib/admin/actions/meta/actions.ts        // connectPage, subscribePage, testIntegration
```

`route.ts` **— contrato:**

```ts
// GET: handshake. Devuelve hub.challenge en texto plano, 200.
//   Comparar hub.verify_token con META_WEBHOOK_VERIFY_TOKEN (timing-safe).
//   Si no coincide → 403.
//
// POST:
//   1. const raw = await request.text()   ← el body CRUDO, antes de JSON.parse
//   2. verificar header 'x-hub-signature-256' = 'sha256=' + HMAC(APP_SECRET, raw)
//      → si falla: 401 y NO procesar
//   3. JSON.parse(raw)
//   4. por cada entry[].changes[] con field === 'leadgen':
//        upsert MetaWebhookEvent por leadgenId (dedupe)  ← barato y rápido
//   5. responder 200 INMEDIATAMENTE
//   6. after(() => procesar cada evento con ingestLeadgen)   ← next/server
```

Puntos críticos:

- **Responder 200 en < 5s.** Meta reintenta si no; sin `after()` un Graph lento provoca leads duplicados y reintentos en cascada.
- **Nunca confiar en el payload.** Solo trae IDs. Los datos del lead se piden a Graph:
  ```
  GET /{leadgen_id}?fields=id,created_time,field_data,ad_id,form_id,campaign_id,platform,is_organic
  ```
- **Idempotencia doble:** `MetaWebhookEvent.leadgenId @unique` + `Lead.metaLeadId @unique`. Si el lead ya existe → marcar evento `IGNORED` y salir.
- **El proxy ya excluye** `/api` (`proxy.ts` matcher `/((?!api|...))`), así que el webhook no pasa por NextAuth. Verificar que sigue así, no tocar el matcher.
- `ads_read` **es opcional:** si el fetch del contexto de anuncio falla, guardar el lead igual con los IDs. Nunca perder un lead por un campo de adorno.
- **Normalización de teléfono:** Meta devuelve formatos variados. Guardar `phoneRaw` tal cual y `phone` en E.164 asumiendo `DEFAULT_PHONE_COUNTRY=EC` cuando no hay prefijo. El link `wa.me` necesita E.164 sin `+`.
- **Detección de duplicados:** si ya hay un `Lead` con el mismo `phone` o `email` en estado no-LOST → crear el lead igual pero marcarlo y registrar un `LeadActivity` tipo `SYSTEM` con "posible duplicado de {id}". Nunca fusionar automático.

- [x] `lib/meta/config.ts`, `signature.ts`, `graph.ts`, `lead-mapper.ts`, `ingest.ts`
- [x] `app/api/webhooks/meta/leads/route.ts` — GET handshake + POST con validación de firma
- [x] Probado local: handshake OK, token inválido → 403, sin firma → 401, firma manipulada → 401,
      firma válida → 200; reenvío del mismo evento → no duplica (evento `IGNORED`);
      token de página obtenido de Graph, cifrado y guardado en `MetaPage`
- [ ] Página de configuración con estado (token OK / página suscrita / último evento)
- [ ] Deploy a producción
- [ ] Paso 6 de la guía Meta (webhook en el App Dashboard) — necesita el deploy

---



### F3 — Notificaciones push

**Dependencia:** `npm i web-push` + `npm i -D @types/web-push`

**Archivos:**

```
lib/notifications/push.ts                    // sendPushToAdmins(payload)
lib/admin/actions/notifications/actions.ts   // savePushSubscription, removePushSubscription, sendTestPush
components/admin/push-subscribe-button.tsx   // pide permiso, suscribe, muestra estado
public/sw.js                                 // AGREGAR listeners push + notificationclick, subir CACHE_VERSION a v3
app/manifest.ts                              // agregar shortcut { name: "Leads", url: "/admin/leads" }
next.config.ts                               // headers: sw.js con Cache-Control no-store
```

Payload de la notificación:

```json
{
  "title": "🔥 Nuevo lead: Juan Pérez",
  "body": "EC-Web-Pymes-Sep26 · +593 99 123 4567",
  "icon": "/web-app-manifest-192x192.png",
  "badge": "/web-app-manifest-192x192.png",
  "tag": "lead-<id>",
  "requireInteraction": true,
  "data": { "url": "/admin/leads?lead=<id>" }
}
```

`notificationclick` → `clients.matchAll()` → si hay ventana de Veeghub abierta, `focus()` + `navigate(url)`; si no, `clients.openWindow(url)`.

Detalles que muerden:

- **iOS:** Web Push funciona desde iOS 16.4 **solo si la PWA está instalada en la pantalla de inicio**. Safari en pestaña no recibe nada. → agregar en `/admin/leads` un aviso una sola vez: "Instala Veeghub en tu inicio para recibir avisos de leads".
- El `sw.js` actual ya existe y cachea; **agregar** los listeners, no reescribirlo. Subir `CACHE_VERSION` para forzar actualización del SW en los dispositivos ya instalados.
- Si `webpush.sendNotification` devuelve `410 Gone` o `404` → borrar esa `PushSubscription` (dispositivo desinstalado).
- **Fallback:** si el lead es `NEW` y no hay suscripciones push activas (o todas fallan) → email vía Resend a `LEAD_ALERT_EMAIL` reusando `lib/email/resend.ts`.
- El envío del push va dentro del `after()` de la ingesta, nunca bloqueando el 200 a Meta.

- [x] Claves VAPID generadas y en `.env`
- [x] `lib/notifications/push.ts` + `lead-alert.ts` (con fallback por email) + actions
- [x] Botón de suscripción en `/admin/leads/configuracion`, con aviso específico para iOS
- [x] Listeners `push` y `notificationclick` en `sw.js`, `CACHE_VERSION` a v3
- [x] Headers `no-store` para `/sw.js` en `next.config.ts`
- [x] Conectado a la ingesta, envuelto para que un fallo de push no marque el evento como FAILED
- [x] Limpieza de dispositivos muertos (404/410) verificada
- [ ] **Cargar `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en producción**
- [ ] Probar en el celular con la PWA instalada

---



### F4 — UI del pipeline

**Archivos:**

```
app/admin/leads/page.tsx                  // tabs: Pipeline | Lista
app/admin/leads/loading.tsx
app/admin/leads/[id]/page.tsx             // detalle + timeline
lib/admin/queries/leads.ts
lib/admin/actions/leads/actions.ts
lib/admin/schemas.ts                      // + leadSchema, leadActivitySchema, leadConvertSchema
components/admin/leads/pipeline-board.tsx
components/admin/leads/lead-column.tsx
components/admin/leads/lead-card.tsx
components/admin/leads/lead-table.tsx
components/admin/leads/lead-stage-select.tsx
components/admin/leads/lead-quick-actions.tsx
components/admin/leads/lead-activity-timeline.tsx
components/admin/leads/lead-filters.tsx
components/admin/dialogs/lead-dialog.tsx  // crear/editar manual
components/admin/dialogs/lead-activity-dialog.tsx
app/admin/admin-nav.tsx                   // + item "Leads" (icono lucide `Magnet`), ARRIBA de Clientes
components/admin/status-badge.tsx         // + colores de LeadStage
```

Decisiones de UI:

- **Sin drag & drop en v1.** No hay librería de DnD en el proyecto y agregar `@dnd-kit` por esto no se paga solo. El cambio de etapa va con un `Select` inline siguiendo exactamente el patrón de `components/admin/inline-status-select.tsx` (server action + `router.refresh()` + `toast.success`). DnD queda como mejora opcional después.
- **Dialogs:** patrón obligatorio del proyecto — estado controlado con `useState`, `ActionForm` con `onSuccess={() => setOpen(false)}`, `router.refresh()`, toasts Sonner solo en éxito, errores inline con `Alert`. **No** usar `window.location.reload()`. No agregar otro `<Toaster>`.
- **Quick actions** en cada tarjeta (esto es el 80% del valor diario):
  - `https://wa.me/{E164 sin +}?text={plantilla}` — plantilla precargada con el nombre y el servicio
  - `tel:{phone}` — un toque para llamar desde el celular
  - `mailto:{email}`
  - Botón **"Marcar contactado"** → setea `firstContactedAt`, pasa a `CONTACTED`, crea `LeadActivity` tipo `CALL`
- **Tarjeta del lead muestra:** nombre, teléfono, campaña, tiempo transcurrido desde que llegó (rojo si `NEW` y > 30 min), servicio, próximo seguimiento.
- **Vista Lista:** tabla con filtros (etapa, origen, campaña, rango de fechas) + `Pagination` (componente existente) + búsqueda por nombre/teléfono/email.
- **Importador CSV** (`app/admin/leads/importar/page.tsx`): sube el CSV de Meta, mapea columnas, dedup por `metaLeadId`/teléfono. Necesario como puente durante el App Review y útil después para histórico.
- **Dashboard** (`lib/admin/queries/dashboard.ts` + `app/admin/page.tsx`): tarjeta "Leads sin contactar" con conteo `NEW` y el más antiguo destacado. Es una **adición** a la query existente, sin tocar el resto.

- [x] Queries + actions + schemas
- [x] Board + tabla + detalle + timeline
- [x] Quick actions (WhatsApp / llamada / email / marcar contactado)
- [x] Item en nav + colores de badge + shortcut en el manifest
- [x] Tarjeta en dashboard
- [x] Conversión lead → cliente (se adelantó F5)
- [ ] Importador CSV

---



### F5 — Conversión Lead → Cliente

**Archivos:** `components/admin/dialogs/convert-lead-dialog.tsx`, `lib/admin/actions/leads/actions.ts`

`convertLeadToClient(leadId, formData)` en una `prisma.$transaction`:

1. Crear `Client` con nombre/email/teléfono del lead (editables en el dialog antes de confirmar)
2. Opcional: crear `Project` con `status: LEAD`, slug generado con `lib/admin/slug.ts`, `budget = estimatedValue`
3. Opcional: crear `Receivable` (`PLANNED`) con el anticipo
4. `lead.stage = WON`, `convertedClientId`, `convertedProjectId`, `convertedAt`
5. `LeadActivity` tipo `SYSTEM`: "Convertido en cliente {nombre}"
6. `revalidatePath('/admin/leads')`, `/admin/clientes`, `/admin`

En el detalle del cliente: un chip discreto "Origen: Meta Ads · {campaña}" con link al lead. Lectura pura, no cambia nada del módulo de clientes.

- [x] Server action transaccional (claim atómico con `updateMany`, no check-then-act)
- [x] Dialog con datos prellenados y checkboxes de proyecto/hito
- [x] Aviso de conversión en el detalle del lead, con links a cliente y proyecto
- [ ] Chip de origen en el detalle de **cliente**
- [ ] Manejo de "este teléfono/email ya existe como cliente" → ofrecer vincular en vez de duplicar

---



### F6 — Resiliencia: cron, backfill y reintentos

**Archivos:** `vercel.json`, `app/api/cron/meta-backfill/route.ts`, `app/api/cron/lead-followups/route.ts`, `lib/meta/backfill.ts`

```json
{
  "crons": [
    { "path": "/api/cron/meta-backfill",  "schedule": "*/15 * * * *" },
    { "path": "/api/cron/lead-followups", "schedule": "0 13 * * *" }
  ]
}
```

(13:00 UTC ≈ 08:00 Ecuador)

- `meta-backfill`: por cada formulario activo, `GET /{form_id}/leads` filtrando por `time_created > lastBackfillAt`; crea los que falten. Red de seguridad para webhooks perdidos (deploy caído, error 500, evento no reintentado).
- Reprocesar `MetaWebhookEvent` en `FAILED` con `attempts < 5`, backoff exponencial.
- `lead-followups`: leads con `nextFollowUpAt <= hoy` → push agrupado ("3 leads te esperan hoy"). Y leads `NEW` con más de 2h sin contactar → push de urgencia.
- Ambas rutas protegidas con `Authorization: Bearer ${CRON_SECRET}` (Vercel lo manda si está definido).

- [ ] `vercel.json`
- [ ] Backfill + reintentos
- [ ] Recordatorios de seguimiento
- [ ] Guard de `CRON_SECRET`

---



### F7 — Métricas y feedback a Meta (optimización real del gasto)

**Archivos:** `lib/admin/queries/leads-reports.ts`, `app/admin/reportes/page.tsx` (sección nueva), `lib/meta/conversions.ts`

Reportes:

- Leads por campaña / conjunto / anuncio (con `recharts`, ya instalado)
- Tasa de conversión por etapa (embudo) y por campaña
- **Tiempo medio de primera respuesta** (`firstContactedAt - createdAt`)
- Motivos de pérdida más frecuentes
- Costo por lead y **costo por cliente ganado** (requiere traer el gasto vía `ads_read`: `GET /{ad_account}/insights?fields=spend,campaign_name&level=campaign`)

**Conversions API / conjunto de eventos offline** — el paso que hace que las campañas mejoren solas:
cuando un lead pasa a `QUALIFIED` y a `WON`, mandar el evento de vuelta a Meta con el `lead_id`:

```
POST /{dataset_id}/events
{ "data": [{ "event_name": "Lead calificado", "event_time": ..., "action_source": "system_generated",
             "user_data": { "lead_id": "<metaLeadId>" } }] }
```

Meta deja de optimizar por "cantidad de formularios llenados" y empieza a buscar gente parecida a la que **realmente compra**. Es la diferencia entre 50 leads basura y 15 buenos por el mismo presupuesto.

- [ ] Queries de reportes
- [ ] Gráficos en la página de reportes
- [ ] Integración de insights de gasto
- [ ] Conversions API con eventos de calificado/ganado

---



## 6. Riesgos y notas


| Riesgo                                          | Mitigación                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| App Review demora y hay campañas corriendo      | Puente con Centro de clientes potenciales + importador CSV (F4). Enviar el review apenas F2 esté desplegado.         |
| Webhook cae / deploy con error → leads perdidos | `MetaWebhookEvent` guarda el crudo + backfill cada 15 min (F6). Nunca se depende solo del webhook.                   |
| Push no llega en iPhone                         | Solo funciona con la PWA instalada (iOS 16.4+). Aviso en la UI + fallback por email.                                 |
| Token expirado                                  | Usuario del sistema con expiración "Nunca". El health check de `/admin/leads/configuracion` lo valida y avisa.       |
| Teléfonos sin prefijo de país                   | `phoneRaw` + normalización a E.164 con `DEFAULT_PHONE_COUNTRY=EC`.                                                   |
| Leads duplicados entre campañas                 | Detección por teléfono/email, marcado como posible duplicado. Nunca fusión automática.                               |
| PII de leads                                    | Meta exige URL de eliminación de datos. Definir retención: leads `LOST` con > 12 meses se anonimizan (tarea futura). |
| Fechas corridas por la zona horaria del host | Formateo anclado a Guayaquil y parseo con offset fijo. Verificado en UTC, Guayaquil y Tokio |
| Tocar sin querer el módulo de clientes          | Regla: solo relaciones inversas en `Client`/`Project`. Revisar el diff de `schema.prisma` en cada PR.                |


**Convenciones del proyecto a respetar** (ya establecidas, no reinventar):

- Server actions con `"use server"` + `requireAdmin()` + `parseForm(schema, formData)` + `revalidatePath()`
- Validación con Zod en `lib/admin/schemas.ts`, helpers `optionalText` / `optionalId` / `money`
- Queries en `lib/admin/queries/`, actions en `lib/admin/actions/<modulo>/actions.ts`
- Serialización de `Decimal` con `lib/admin/serialize.ts` antes de pasar a componentes cliente
- Cifrado de tokens con `lib/security/credentials.ts` (AES-256-GCM, mismo patrón que `Credential`)
- **Fechas:** ver [`docs/runbooks/fechas-y-zona-horaria.md`](../runbooks/fechas-y-zona-horaria.md).
  Instantes con `formatDate()` (fija Guayaquil), días de calendario con `formatDateOnly()` (UTC),
  y nunca `new Date()` sobre texto de formulario: usar `parseLocalDateTime()`
- UI en español, `shadcn` + Tailwind v4, `lucide-react`
- **Antes de escribir código leer** `node_modules/next/dist/docs/` — este Next 16 tiene cambios sobre lo conocido (`proxy.ts` en vez de `middleware.ts`, `params` como `Promise`, Cache Components)

---



## 7. Orden recomendado

```
HOY        → Guía Meta pasos 1 y 2     (no dependen de código)
           → Paso 5 (instalar app en la Página) y recién ahí el Paso 3
Sesión 1   → F1 esquema
Sesión 2   → F2 webhook + deploy + Meta pasos 4, 5, 7 + ENVIAR APP REVIEW
Sesión 3   → F3 push
Sesión 4   → F4 UI pipeline + importador CSV
Sesión 5   → F5 conversión
Sesión 6   → F6 cron
Sesión 7   → F7 métricas + Conversions API
```

---



## 8. Registro de sesiones


| Fecha      | Fase | Qué se hizo | Pendiente                  |
| ---------- | ---- | ----------- | -------------------------- |
| 2026-09-16 | F0 | Plan creado | — |
| 2026-09-16 | F1 | Esquema Prisma: `Lead`, `LeadActivity`, `MetaPage`, `MetaWebhookEvent`, `PushSubscription` + 3 relaciones inversas. `prisma validate` OK, cliente generado | Aplicar migración (falta levantar Docker) |
| 2026-09-16 | F0 | Meta pasos 1 y 2 OK: app creada, usuario del sistema con token `expires_at: 0` y 6 scopes. `META_PAGE_ID=109281652108419` | — |
| 2026-09-16 | F0 | Paso 5 OK: app `VeegHub` (1550483952950898) instalada en la Página, `subscribed_fields: [leadgen]` | Paso 3 (Lead Access Manager ya debería listarla) |
| 2026-09-16 | F0 | Detectado: falta scope `pages_manage_ads` para el backfill de F6 | Regenerar token del usuario del sistema con los 7 scopes |
| 2026-09-16 | F1 | Migración `20260917004435_add_leads_crm` aplicada en la base local | — |
| 2026-09-16 | F2 | `lib/meta/*` + webhook completos y probados local (firma, handshake, idempotencia, token de página cifrado) | Página de configuración, deploy, paso 6 en Meta |
| 2026-09-16 | docs | Runbook reutilizable `docs/runbooks/meta-lead-ads-setup.md`; estándar definido: app de cliente siempre en el portafolio del cliente | — |
| 2026-09-16 | F2 | Desplegado en `veeghub.veegsoft.com`. Pasos 6, 7 y 8 de Meta cerrados: conexión A activa (`callback_url`, `leadgen`), app instalada en la Página, CRM asignado | Paso 9 (lead de prueba) y paso 10 (App Review) |
| 2026-09-16 | F4+F5 | Pipeline, tabla, detalle con timeline, quick actions y conversión a cliente. Build limpio, queries y transacción verificadas con datos sembrados | Importador CSV; chip de origen en detalle de cliente |
| 2026-09-16 | F4 | Bug encontrado y corregido: el guard de doble conversión estaba fuera de la transacción y dejaba un cliente huérfano | — |
| 2026-09-16 | F2 | Página de diagnóstico `/admin/leads/configuracion`: verifica token, acceso a la Página, conexiones A y B, y lista los últimos eventos recibidos | — |
| 2026-09-16 | F2 | **Confirmado que NO hace falta App Review**: se leyó un lead real con acceso estándar, app en modo Desarrollo, sobre activos propios del portafolio | — |
| 2026-09-16 | F2 | Fix: el token de página cifrado en `MetaPage` nunca se refrescaba; al regenerar el token del sistema la integración quedaba rota en silencio. Ahora reintenta con refresh ante Graph 190 | — |
| 2026-09-16 | F2 | Fix: el formulario real usa `whatsapp_number`, no `phone_number`. El matcheo exacto perdía el teléfono. Ahora hay coincidencia por subcadena y los valores se humanizan | — |
| 2026-09-16 | F2 | App pasada a **Live**. Lead real de prueba inyectado y almacenado | — |
| 2026-09-16 | F3 | Web push completo: envío, fallback por email, limpieza de dispositivos muertos, listeners en el SW, botón con caso iOS | Cargar claves VAPID en producción y probar en el celular |
| 2026-09-16 | fix | Zona horaria: el host en UTC corría el día al leer y guardaba las reuniones 5 horas desplazadas. Anclado a Guayaquil en lectura y escritura. Runbook en `docs/runbooks/fechas-y-zona-horaria.md` | — |


