# Plan: señal de calidad a Meta + pauta VeegSoft

> Auditoría del 2026-11-17 (cuenta, código y la investigación de
> `WORK/ESTRATEGIA 2027 - NOTARIA LATINA`). Reemplaza el "F7 — Conversions API" de
> `2026-09-16-crm-leads-meta.md` y es la base del F9 de `2026-10-21-gestor-campanas-ads.md`.

## 0. Para retomar en otra sesión

**Leé §1 (diagnóstico) y seguí §4 (paso a paso) en orden.** Cada paso dice quién lo hace
(🧑 Sebastián en Meta / 👥 ventas / 💻 código en VeegHub) y cómo saber que terminó.

### Tablero

| # | Paso | Quién | Estado |
|---|---|---|---|
| P0 | Prueba de 7 días del conjunto `TORNO-CNC` (17/11 → 24/11) sin tocarlo | 🧑 | ⏳ en curso |
| P1 | Leer resultados de la prueba y decidir (§4.P1) | 🧑 + 💻 | ⬜ |
| P2 | Definir "Calificado" con ventas | 👥 | ⬜ |
| P3 | Crear dataset CRM + token CAPI en Meta | 🧑 | ⬜ |
| P4 | Puntaje automático de leads de Meta | 💻 | ⬜ |
| P5 | Conversions API (cola + envío + cron) | 💻 | ⬜ |
| P6 | Probar con test event code y desplegar | 💻 + 🧑 | ⬜ |
| P7 | Configurar el embudo CRM en Events Manager | 🧑 | ⬜ |
| P8 | Reporte de costo por lead calificado por anuncio | 💻 | ⬜ |
| P9 | Conceptos creativos nuevos | 🧑 | ⬜ |
| P10 | Revisión mensual: ¿≥ 200 leads/mes? → Conversion Leads | 🧑 | ⬜ |
| P11 | (después) Sitio: píxel + `fbc` · WhatsApp: `ctwa_clid` | 💻 | ⬜ |

### Arranque de la sesión (checklist)

1. Leer §1 (diagnóstico, 2 min) y el tablero de arriba: seguir por el primer ⬜.
2. `git checkout develop && git pull` → `git checkout -b feat/meta-capi`.
3. `docker compose up -d` (Postgres local; sin esto `psql`/Prisma fallan) → `npm run dev`.
4. Antes de tocar rutas o `after()`: leer la guía en `node_modules/next/dist/docs/` (`AGENTS.md`).
5. Antes de escribir la llamada a Meta: confirmar la spec vigente en
   `…/02_FUENTES/02_capi_crm_leads/meta_conversion_leads_payload_spec.md` (o Context7).
6. Al terminar cada paso: marcar ✅ en el tablero y anotar en §5.

### Dónde está cada cosa

**Fuentes y decisiones**

| Qué | Dónde |
|---|---|
| Este plan (fuente de verdad) | `docs/plans/2026-11-17-senal-de-calidad-a-meta.md` |
| Cómo está conectada Meta → VeegHub (3 conexiones, token, errores reales) | `docs/runbooks/meta-lead-ads-setup.md` |
| Modelo de datos del webhook e idempotencia | `docs/runbooks/webhook-a-crm-modelo-de-datos.md` |
| Plan anterior del CRM (su F7 queda reemplazado por este) | `docs/plans/2026-09-16-crm-leads-meta.md` |
| Gestor de campañas (su F9 usa esto) | `docs/plans/2026-10-21-gestor-campanas-ads.md` |
| Investigación algorítmica (base de §1 y §3) | `~/Documents/WORK/ESTRATEGIA 2027 - NOTARIA LATINA/` |
| ↳ Requisitos de Conversion Leads (200 leads/mes, 1–40 %) | `…/02_FUENTES/02_capi_crm_leads/meta_conversion_leads_integration.md` |
| ↳ Spec del payload (`lead_id`, `system_generated`, `crm`) | `…/02_FUENTES/02_capi_crm_leads/meta_conversion_leads_payload_spec.md` |
| ↳ WhatsApp / `ctwa_clid` (P11) | `…/02_FUENTES/04_ctwa_whatsapp/meta_capi_business_messaging.md` |
| ↳ Por qué conceptos distintos ("Entity IDs") | `…/02_FUENTES/01_algoritmo_andromeda/web_adsuploader_andromeda.md` |
| ↳ Qué NO aplicar del protocolo del consultor | `…/05_ANALISIS_Y_PLANES/notas_revision_protocolo.md` |

**Código existente que se toca**

| Archivo | Para qué en este plan |
|---|---|
| `prisma/schema.prisma` → `Lead` (`metaLeadId`, `metaCreatedAt`, `temperature`, `stage`, `lostReason`, `estimatedValue`) | P4, P5: modelo nuevo `MetaConversionEvent` + relación en `Lead` |
| `lib/meta/config.ts` | P5: `datasetId()`, `capiToken()`, `capiTestCode()`; sumarlos a `metaConfigStatus()` |
| `lib/meta/graph.ts` (`MetaGraphError`, patrón `graphPost`) | P5: reutilizar el manejo de errores |
| `lib/meta/lead-mapper.ts` (`mapLeadFields`, `normalizeKey`, `normalizePhone`) | P4: reutilizar normalización; P5: teléfono E.164 para el hash |
| `lib/meta/ingest.ts` → `ingestLeadgen` | P4: `temperature`; P5: encolar `Lead`; corregir `source`/`is_organic` |
| `lib/admin/actions/leads/actions.ts` → `updateLeadStage`, `markLeadContacted`, `convertLeadToClient` (y revisar `updateLead`) | P5: encolar eventos al cambiar etapa |
| `app/admin/leads/configuracion/page.tsx` + `lib/admin/queries/meta-integration.ts` | P5: panel de eventos CAPI |
| `lib/meta/insights.ts` + `lib/admin/queries/campaigns.ts` + `app/admin/reportes/page.tsx` | P8: gasto por anuncio y costo por calificado |
| `lib/leads/ficha.test.ts` | Ejemplo de estilo de tests (`npm test` = `tsx --test "lib/**/*.test.ts"`) |

**Código nuevo**

| Archivo | Paso |
|---|---|
| `lib/meta/lead-score.ts` + `lib/meta/lead-score.test.ts` | P4 |
| `lib/meta/conversions.ts` + `lib/meta/conversions.test.ts` | P5 |
| `prisma/migrations/<fecha>_add_meta_conversion_events/` | P5 (`npx prisma migrate dev --name add_meta_conversion_events`) |
| `app/api/cron/meta-conversions/route.ts` | P5 |
| `vercel.json` (no existe todavía) | P5 |
| `scripts/backfill-meta-conversions.ts` (opcional) | P5 |

**Variables de entorno**

| Variable | Estado | Dónde se saca |
|---|---|---|
| `META_SYSTEM_USER_TOKEN`, `META_PAGE_ID`, `META_APP_ID`, `META_APP_SECRET` | ✅ ya existen | — |
| `CRON_SECRET` | ✅ existe en `.env`, sin uso → verificar que esté en Vercel | — |
| `META_DATASET_ID` | ⬜ | P3 paso 3 |
| `META_CAPI_TOKEN` | ⬜ | P3 paso 5 |
| `META_CAPI_TEST_CODE` | ⬜ solo local/preview | P3 paso 6 |

**IDs en Meta**

| Qué | ID |
|---|---|
| Portafolio "Negocios de Sebastian" | `1000476566815389` |
| Cuenta publicitaria "VeegSoft S.A" | `act_3364960217152672` |
| Página | `109281652108419` |
| App `VeegHub` | `1550483952950898` |
| Usuario del sistema `veeghub-crm` | `122107878357471639` |
| Conjunto en prueba `TORNO-CNC` | `120249684876000648` |
| Formulario de septiembre (50 leads) | `1469731664978580` |
| Dataset `VeegSoft CRM` | ⬜ se crea en P3 |

**Lugares en Meta**

| Qué | Dónde |
|---|---|
| Crear dataset, token CAPI, probar eventos, embudo CRM | business.facebook.com → Events Manager |
| Asignar dataset a cuenta y usuario del sistema | Configuración del portafolio → Orígenes de datos → Conjuntos de datos |
| Lead de prueba | developers.facebook.com/tools/lead-ads-testing |
| Resultados de la prueba (P1) | Ads Manager → cuenta VeegSoft S.A → conjunto `TORNO-CNC` |

---

## 1. Diagnóstico honesto

### Lo que la API de conversiones (CAPI) va a hacer y lo que no

**No va a optimizar las campañas de VeegSoft en el corto plazo.** La optimización
"Conversion Leads" (Meta busca gente parecida a tus calificados, no a cualquiera que llena el
formulario) pide, según la doc oficial
(`02_FUENTES/02_capi_crm_leads/meta_conversion_leads_integration.md`):

- ≥ **200 leads/mes** — VeegSoft hace ~25.
- Subir datos ≥ 1 vez/día.
- La etapa a optimizar ocurre ≤ 28 días después del lead y tiene tasa entre **1 % y 40 %**.

Con 5–20 USD/día no se llega a 200/mes. Mandar eventos **no cambia a quién le muestra Meta los
anuncios** mientras el objetivo siga siendo "Clientes potenciales" normal.

**Lo que sí da, desde el día uno:**

1. **Medición real**: costo por lead *calificado* y por cliente, por anuncio. Hoy el anuncio
   "ganador" es ganador por CPL; puede no serlo por calificados. Esta es la decisión que más plata
   mueve con este presupuesto.
2. **Historial en el dataset**: Meta entrena Conversion Leads con historial. Si el volumen sube
   (más presupuesto o una cuenta de cliente con volumen), arrancás con meses de datos y no de cero.
3. **Audiencias**: calificados/clientes como audiencia para excluir o como semilla de similares.
   Ojo: una similar necesita ~100 personas en la semilla; a ~10 calificados/mes son meses.
4. **Producto para clientes**: la misma integración sirve para Notaría Latina (que sí puede tener
   volumen) y para el gestor de campañas (F9). Se construye una vez.

### Lo que sí optimiza la pauta ahora (en orden de impacto)

1. **Creatividad** con conceptos distintos (es la segmentación real con público amplio).
2. **Fricción en el formulario y el copy** (ya hay Mayor intención + 4 preguntas: está bien hecho).
3. **No tocar** los conjuntos: cada edición significativa reinicia el aprendizaje.
4. **Juzgar por calificados**, no por CPL — para eso hace falta P4 y P8.
5. **Velocidad de respuesta de ventas** a los leads A (el puntaje de P4 los pone primero).

### Fase de aprendizaje

Meta sale de aprendizaje con ~50 eventos en 7 días por conjunto. A CPL ≈ 5,4 USD eso son
~39 USD/día en un conjunto. Con 5 USD/día el conjunto queda en "Aprendizaje limitado". **No es
grave**: el ganador de Excel también empezó así y entregó 36 leads a 5,06 USD. "Limitado" significa
que Meta optimiza con menos certeza, no que no entregue.

### Recomendación

**Sí, implementarlo — pero por la razón correcta** (medición + historial + producto
reutilizable), no esperando que el CPL baje solo. Costo: ~1,5 días de código + 1 h en Meta.
Prioridad dentro del plan: P4 (puntaje) y P8 (reporte) primero, porque dan valor inmediato;
P5 (CAPI) en la misma sesión porque comparte la definición de etapas.

---

## 2. Estado verificado (2026-11-17, por Graph API)

| Dato | Valor |
|---|---|
| Cuenta | `VeegSoft S.A` — `act_3364960217152672`, portafolio "Negocios de Sebastian" (`1000476566815389`) |
| Página | `109281652108419` · IG `17841457151651578` |
| Activo | Campaña `CLIENTESPOTENCIALES/FORMULARIO/ECUADOR` → conjunto `TORNO-CNC` (`120249684876000648`, creado 17/11) → anuncio `REEL-TALLER-CNC`. 5 USD/día, `LEAD_GENERATION`, 1 día clic, Advantage+ audience, Ecuador |
| Ganador anterior (pausado) | Campaña `CLIENTES POTENCIALES 1/FORMULARIO/ECUADOR`: 182,26 USD → 36 leads (CPL 5,06) |
| Formulario `TORNO-CNC - Mayor intencion - Nov 2026` | Preguntas: ¿taller?, ¿cómo cotizas?, ¿cuándo?, ¿presupuesto? |
| Píxel / dataset | **Ninguno** en la cuenta ni en el portafolio |
| Token `veeghub-crm` | `ads_read, leads_retrieval, pages_manage_ads, pages_manage_metadata, pages_read_engagement, pages_show_list, business_management` — sin `ads_management` |
| MCP de Meta | No habilitado para esta cuenta → leer por Graph |

### Calidad de los 50 leads del formulario de septiembre

| Pregunta | Distribución |
|---|---|
| Presupuesto | < $500: 25 · $500–2.000: 17 · $2.000–5.000: 3 · > $5.000: 5 |
| Cuándo | Lo antes posible: 14 · 1–3 meses: 23 · Solo averiguando: 13 |
| Tamaño | Solo yo: 5 · 2–10: 31 · 11–50: 13 · > 50: 1 |
| Email | 42 gratuitos · 8 corporativos |

Regla A/B/C (nuestra): **A** = presupuesto ≥ $500 y no "solo averiguando" y no "solo yo" → 21
(42 %); **C** = < $500 y "solo averiguando" → 9 (18 %); **B** = resto → 20.
Por anuncio: Excel/control 17 A de 37 (46 %); `REEL2-TEST` 4 A de 13 (31 %).
**Costo por lead A ≈ 12,4 USD** (calculado).

### Código

| Pieza | Estado |
|---|---|
| Webhook `leadgen` → 200 inmediato + `after()` + outbox `MetaWebhookEvent` | ✅ |
| `Lead.metaLeadId` (lead_id) y `metaCreatedAt` guardados | ✅ |
| `Lead.temperature` (HOT/WARM/COLD) | ✅ existe, solo la llena el chat IA |
| CAPI de vuelta a Meta | ❌ |
| Cron | ❌ No hay ninguno (`CRON_SECRET` está en `.env` pero sin uso) |
| `source: is_organic ? "INSTAGRAM" : "META_ADS"` en `lib/meta/ingest.ts` | ⚠️ Incorrecto: `is_organic` = no vino de anuncio. Plataforma real en `platform` (`fb`/`ig`) |
| veegsoft.com: píxel | ❌ placeholder, `fbq` nunca se carga |
| veegsoft.com: `fbclid` → `fbc` | ❌ solo `gclid` + UTM en `src/utils/attribution.ts` |

---

## 3. Qué se toma de la investigación de Notaría Latina

| Idea | ¿Aplica? | Cómo |
|---|---|---|
| Consolidar (Andromeda/GEM) | ✅ | Un conjunto amplio; verticales como anuncios, no conjuntos |
| CAPI CRM / costo por calificado | ✅ | Caso exacto de la doc oficial (formulario + `lead_id`). P5 |
| Creatividad = segmentación, conceptos distintos | ✅ | P9 |
| Fricción | ✅ ya aplicada | Mayor intención + preguntas; sumar precio "desde" y lógica condicional |
| CTWA + `ctwa_clid` | ⏸️ | Solo si se reactiva WhatsApp. P11 |
| Correo corporativo obligatorio | ❌ | 84 % usa gmail/hotmail; en pymes de Ecuador mata volumen sin filtrar |
| CAPI Gateway | ❌ | Sobra para decenas de eventos/día |
| Anti-detect / proxies | ❌ | Viola políticas; riesgo de perder el portafolio |

Corrección al documento maestro: `action_source` va en la **raíz** del evento; `event_source` y
`lead_event_source` van en `custom_data`.

---

## 4. Paso a paso

### P0 · Prueba TORNO-CNC (17/11 → 24/11) 🧑

- **No tocar nada** del conjunto: ni presupuesto, ni público, ni anuncio, ni formulario.
  Renombrar sí se puede.
- Expectativa realista: 5 USD × 7 = 35 USD → **~5–7 leads**. Es poco para concluir; sirve para
  detectar un desastre o una sorpresa, no para declarar ganador.
- Mientras tanto, ventas marca cada lead que entre en el pipeline (contactado / calificado /
  perdido + motivo). Eso alimenta P1.

### P1 · Leer la prueba y decidir (24/11) 🧑 + 💻

Datos a sacar (Graph o Ads Manager, conjunto `120249684876000648`, 17/11–24/11): gasto, leads,
CPL, CTR, frecuencia, y respuestas del formulario (cuántos "Sí, soy dueño o gerente",
presupuesto ≥ $500, "Este mes / 1–3 meses").

Línea base para comparar = ganador de Excel: **CPL 5,06 · 46 % leads A · ~12 USD por lead A**.

| Resultado | Decisión |
|---|---|
| Costo por lead A ≤ ~15 USD | Mantener. Subir a 7–10 USD/día (≤ 20 % por semana si se quiere ir fino, o un salto único y no tocar 7 días) |
| CPL ok pero casi todos "Trabajo en un taller" / "No tengo taller" / < $500 | El copy atrae al perfil equivocado: nuevo concepto apuntando a dueños; no ajustar el mismo anuncio |
| < 3 leads en 7 días | Volver al concepto Excel como base y sumar CNC como **segundo anuncio en el mismo conjunto** |

Recomendación de estructura después de la prueba: **1 campaña, 1 conjunto amplio, 2–4 anuncios de
conceptos distintos** (Excel/control + CNC + los nuevos de P9), cada anuncio con su formulario si
el vertical lo pide. Presupuesto objetivo 15–20 USD/día cuando haya caja.

### P2 · Definir "Calificado" con ventas 👥

Una definición que ventas pueda marcar sin dudar. Propuesta:

> **Calificado** = se habló con la persona **y** tiene una necesidad que VeegSoft resuelve **y**
> presupuesto ≥ 500 USD (o lo confirma en la llamada) **y** es quien decide o está con quien decide.

- Esa etapa es `QUALIFIED` en VeegHub. Meta pide que la etapa a optimizar tenga tasa **1–40 %**;
  con la regla A de §2 hoy sería ~40 % → apretar un poco la definición está bien.
- Cada lead perdido lleva `lostReason` (ya existe el campo) — usar siempre una de estas:
  *sin presupuesto · solo averiguaba · no contesta · no es decisor · no es lo que hacemos · competencia*.
- **Terminado cuando**: ventas lo usa con todos los leads de la semana de prueba.

### P3 · Dataset CRM y token en Meta 🧑 (~30 min)

> Los nombres de menús de Meta cambian seguido. Si algo no coincide, buscar en
> Business Help Center "Set Up Your CRM for Conversion Leads".

1. **business.facebook.com** → portafolio *Negocios de Sebastian* → **Events Manager**.
2. **Conectar orígenes de datos** → elegir **CRM** (si no aparece, **Web**: un dataset es un
   dataset; lo que importa es mandarle eventos con `action_source: system_generated`).
   Nombre: `VeegSoft CRM`. Si pide sitio web, poner `veegsoft.com` y **no** instalar el código
   todavía (eso es P11).
3. Anotar el **ID del dataset** (número largo) → será `META_DATASET_ID`.
4. **Configuración del portafolio → Orígenes de datos → Conjuntos de datos** → seleccionar
   `VeegSoft CRM`:
   - **Cuentas publicitarias asignadas** → agregar `VeegSoft S.A`.
   - **Personas / Usuarios del sistema** → agregar `veeghub-crm` con control total.
5. Events Manager → dataset → **Configuración** → sección *Conversions API* →
   **Generar token de acceso** → copiarlo → será `META_CAPI_TOKEN`.
   (No regenerar el token del usuario del sistema: invalida el token de página cacheado.)
6. Events Manager → dataset → pestaña **Probar eventos** → copiar el **código de prueba**
   (`TEST12345`) → será `META_CAPI_TEST_CODE` (solo en local / preview).
7. Cargar en **Vercel** (Production y Preview) y en `.env` local:
   ```
   META_DATASET_ID=
   META_CAPI_TOKEN=
   META_CAPI_TEST_CODE=      # solo local/preview; vacío en producción
   ```
8. Verificar desde la terminal (debe devolver el nombre del dataset):
   ```bash
   curl -s "https://graph.facebook.com/v26.0/$META_DATASET_ID?fields=name&access_token=$META_CAPI_TOKEN"
   ```

**Terminado cuando**: el `curl` devuelve `VeegSoft CRM` y las variables están en Vercel.

### P4 · Puntaje automático de leads de Meta 💻 (~2 h)

Objetivo: cada lead del formulario entra con `temperature` HOT/WARM/COLD calculada de sus respuestas.

1. Nuevo `lib/meta/lead-score.ts`:
   - `scoreLead(fields: MetaFieldEntry[]): "HOT" | "WARM" | "COLD" | null`.
   - Buscar por **substring normalizado** (los nombres de pregunta cambian por formulario):
     `presupuesto`, `cuando|implementar|empezar`, `personas|taller`.
   - Regla (la de §2, A=HOT, B=WARM, C=COLD), con el formulario CNC:
     *No tengo taller* → COLD; *Trabajo en un taller* → máx. WARM;
     *Solo estoy averiguando* + *Menos de $500* → COLD.
   - Valores llegan en snake_case (`menos_de_$500`, `solo_estoy_averiguando`): normalizar antes.
   - Si el formulario no tiene preguntas reconocibles → `null` (no inventar).
2. `lib/meta/lead-score.test.ts` con los casos reales de §2 (el proyecto usa `tsx --test`).
3. `lib/meta/ingest.ts` → `prisma.lead.create`: `temperature: scoreLead(metaLead.field_data)`.
4. De paso, corregir origen: `source: "META_ADS"` siempre para leads de anuncio; guardar
   `metaLead.platform` en `rawPayload` (ya está) y mostrarlo como chip fb/ig si se quiere.
   Si `is_organic` es true, usar `source: "META_ADS"` igual y anotarlo en la actividad.
5. La lista ya filtra `?temp=` y el pipeline ya muestra la píldora: verificar que se vea en leads Meta.
6. Script opcional para recalcular los leads existentes con `metaLeadId` desde `rawPayload`.

**Terminado cuando**: tests verdes y un lead de prueba (Lead Ads Testing Tool) entra con temperatura.

### P5 · Conversions API 💻 (~1 día)

**Esquema** (`prisma/schema.prisma` + migración `add_meta_conversion_events`):

```prisma
enum MetaConversionStatus {
  PENDING
  SENT
  FAILED
  SKIPPED // fuera de la ventana de 7 días o sin lead_id
}

model MetaConversionEvent {
  id         String               @id @default(cuid())
  leadId     String
  lead       Lead                 @relation(fields: [leadId], references: [id], onDelete: Cascade)
  eventName  String               // Lead | Contactado | Calificado | Propuesta | Cliente
  eventTime  DateTime
  value      Decimal?             @db.Decimal(12, 2)
  currency   String?
  status     MetaConversionStatus @default(PENDING)
  attempts   Int                  @default(0)
  error      String?
  fbtraceId  String?
  sentAt     DateTime?
  createdAt  DateTime             @default(now())

  @@unique([leadId, eventName])   // idempotencia: un evento por lead y etapa
  @@index([status, createdAt])
}
```

**Mapeo de etapas** (orden fijo; si se salta una, se encolan las intermedias con el mismo `eventTime`):

| Etapa VeegHub | `event_name` |
|---|---|
| (ingesta) | `Lead` |
| `CONTACTED` | `Contactado` |
| `QUALIFIED` | `Calificado` |
| `PROPOSAL` | `Propuesta` |
| `NEGOTIATION` | (no se manda; no aporta) |
| `WON` | `Cliente` (+ `value` = `estimatedValue`, `currency`) |
| `LOST` | **nada** — el lead que no avanza es la señal |

Retroceder de etapa no borra ni reenvía nada.

**`lib/meta/conversions.ts`**:

- `enqueueStageEvents(leadId, toStage, at = new Date())`: solo si el lead tiene `metaLeadId`;
  `createMany({ skipDuplicates: true })` con la etapa y las anteriores faltantes.
- `buildEvent(row, lead)`:
  ```json
  {
    "event_name": "Calificado",
    "event_time": 1763400000,
    "action_source": "system_generated",
    "event_id": "<leadId>:Calificado",
    "user_data": {
      "lead_id": "1234567890123456",
      "em": ["<sha256(email trim lowercase)>"],
      "ph": ["<sha256(teléfono solo dígitos con código país, sin +)>"]
    },
    "custom_data": {
      "event_source": "crm",
      "lead_event_source": "VeegHub",
      "value": 1500, "currency": "USD"
    }
  }
  ```
  - `lead_id` como **string** (`metaLeadId` tal cual). Un id de 16–17 dígitos supera
    2^53 y como `Number` de JS pierde precisión → Meta lo rechaza por inválido.
  - `event_time` = `max(eventTime, metaCreatedAt + 1 s)`: Meta descarta eventos anteriores al lead.
  - Si `now - eventTime > 7 días` → `SKIPPED` con motivo, sin llamar a Meta.
- `flushConversionEvents(limit = 100)`: toma PENDING + FAILED con `attempts < 5`, un solo
  `POST https://graph.facebook.com/{v}/{META_DATASET_ID}/events` con `data: [...]`,
  `access_token=META_CAPI_TOKEN` y `test_event_code` si existe `META_CAPI_TEST_CODE`.
  Respuesta OK → `SENT` + `fbtraceId`; error → `FAILED` + `attempts++` + mensaje.
  Usar el mismo estilo de errores que `MetaGraphError` en `lib/meta/graph.ts`.
- `lib/meta/config.ts`: `datasetId()`, `capiToken()`, `capiTestCode()` y sumarlos a
  `metaConfigStatus()` como opcionales (la integración de leads no debe romperse si faltan).

**Dónde encolar** (encolar dentro de la misma transacción del cambio de etapa; enviar en `after()`):

- `lib/meta/ingest.ts` → tras crear el lead: `Lead` (`eventTime = metaCreatedAt`).
- `lib/admin/actions/leads/actions.ts`: `updateLeadStage`, `markLeadContacted`,
  `convertLeadToClient` (→ `Cliente` con valor). Revisar con
  `grep -rn "stage:" lib/admin/actions` que no haya otro camino que cambie etapa (p. ej. `updateLead`).
- Encolar nunca debe hacer fallar la acción del usuario: `try/catch` + `console.error`.

**Cron diario** (Meta pide subida ≥ 1/día y reintenta lo que falló):

- `app/api/cron/meta-conversions/route.ts` (GET), valida
  `Authorization: Bearer ${CRON_SECRET}`, llama `flushConversionEvents()`.
- `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/meta-conversions", "schedule": "0 13 * * *" }] }
  ```
  (13:00 UTC = 08:00 Ecuador; una vez al día funciona también en plan Hobby).
- Antes de escribir la ruta, leer la guía de route handlers y `after()` en
  `node_modules/next/dist/docs/` (regla de `AGENTS.md`).

**Diagnóstico** en `/admin/leads/configuracion`: estado de las variables, últimos 20 eventos
(etapa, estado, error), conteo SENT/FAILED/SKIPPED de los últimos 30 días, botón "Enviar ahora".

**Backfill inicial**: script que, para los leads con `metaLeadId` creados en los últimos 7 días,
encola sus etapas actuales (lo más viejo ya no lo acepta Meta).

**Tests** (`lib/meta/conversions.test.ts`): relleno de etapas intermedias, hash de email/teléfono,
`event_time` ≥ creación del lead, `SKIPPED` fuera de ventana, `LOST` no encola.

### P6 · Probar y desplegar 💻 + 🧑

1. Local con `META_CAPI_TEST_CODE` cargado: crear lead de prueba con Lead Ads Testing Tool
   (o usar uno real reciente), moverlo a Contactado y Calificado.
2. Events Manager → dataset → **Probar eventos**: deben aparecer `Lead`, `Contactado`,
   `Calificado` con origen *Servidor*. Si Meta marca error de `lead_id`, revisar que sea el
   `leadgen_id` exacto.
3. Despliegue según el flujo del repo: rama `feat/meta-capi` → commits convencionales por partes →
   `develop` → `main --no-ff` (push a main = deploy). Migración aplicada en producción.
4. Producción **sin** `META_CAPI_TEST_CODE`. Verificar el día siguiente en Events Manager →
   *Información general* que los eventos llegan y no hay alertas.

**Terminado cuando**: 3 días seguidos de eventos reales sin errores en el panel.

### P7 · Embudo en Events Manager 🧑 (cuando haya ~1–2 días de eventos)

1. Events Manager → `VeegSoft CRM` → debería aparecer **Configurar embudo / CRM setup**
   (Meta lo habilita al validar los datos, ~1–2 días según la doc).
2. Ordenar etapas: Lead → Contactado → Calificado → Propuesta → Cliente.
3. Marcar **Calificado** como etapa objetivo.
4. **No cambiar todavía** el objetivo de las campañas a Conversion Leads (ver P10).

### P8 · Reporte costo por calificado 💻 (~½ día)

En `/admin/reportes` (o `/admin/campanas`, que ya cruza gasto con clientes ganados):
por **anuncio** y por **campaña**, últimos 7/30/90 días:
gasto · leads · % HOT · % Calificado · **costo por lead calificado** · clientes · costo por cliente.
El gasto por anuncio requiere ampliar `lib/meta/insights.ts` a `level=ad`
(hoy sincroniza por campaña en `MetaCampaignInsight`). Esta tabla es la que decide qué anuncio
escalar y cuál apagar.

### P9 · Conceptos creativos 🧑

3–5 conceptos que cambien a la vez **persona, escenario, formato y ángulo** (Andromeda agrupa las
variaciones menores como si fueran el mismo anuncio):

1. Dueño de taller grabado en su taller contando el problema de las proformas (CNC).
2. "¿Dónde se fue la utilidad?" a cámara, gerente pyme (concepto con 46 % de leads A).
3. Demo de pantalla: proforma en 2 minutos, sin voz o con subtítulos.
4. Caso real con cifras (antes/después), aunque sea un cliente del sistema actual.
5. Carrusel "5 señales de que tu Excel ya no da más".

Copy con fricción: precio ancla "proyectos desde USD ___" (definir) y "para empresas en
operación". Formularios: mantener Mayor intención y la pregunta de presupuesto; con lógica
condicional, quien marca *< $500 + solo averiguando* termina en una pantalla con recursos
gratuitos en vez de "un asesor te contactará".
Meter los nuevos anuncios **en el conjunto existente**, de a 1–2 por semana, sin tocar lo demás.

### P10 · Revisión mensual 🧑

| Condición | Acción |
|---|---|
| < 200 leads/mes (lo esperable) | Seguir con "Clientes potenciales", decidir anuncios con P8 |
| ≥ 200 leads/mes y Calificado entre 1–40 % | Duplicar la campaña con objetivo **Conversion Leads** (meta de rendimiento "leads de conversión") apuntando a `Calificado`, convivir 2–4 semanas, comparar costo por calificado |
| ≥ 100 calificados/clientes acumulados | Audiencia personalizada desde el dataset → similar 1 % Ecuador como prueba |

### P11 · Después (no bloquea)

- **Sitio**: cargar píxel con Consent Mode en `veegsoft-web`, capturar `fbclid` y construir `fbc`
  (`fb.1.<timestamp>.<fbclid>`) en `src/utils/attribution.ts`, mandarlo a VeegHub; los leads
  web/chat envían eventos con `fbc` + email/teléfono hasheados (sin `lead_id`).
- **WhatsApp**: solo si se reactiva CTWA. Webhook de WhatsApp Cloud API → guardar `ctwa_clid` del
  objeto `referral` → eventos con `action_source: business_messaging`,
  `messaging_channel: whatsapp` (`02_FUENTES/04_ctwa_whatsapp/meta_capi_business_messaging.md`).
  Este trabajo es reutilizable para Notaría Latina, donde pesa más.

---

## 5. Registro

| Fecha | Qué | Notas |
|---|---|---|
| 2026-11-17 | Auditoría y plan | Datos de §2 leídos por Graph con el token del sistema. Decisión: probar `TORNO-CNC` 7 días a 5 USD sin tocar |
