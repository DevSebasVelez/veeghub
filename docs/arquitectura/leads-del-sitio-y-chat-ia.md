# Leads del sitio y del chat IA

> Lado VeegHub de la integración con veegsoft.com (desplegada el 2026-10-26).
> La arquitectura completa —chat, modelo, protocolo, seguridad, cómo crecer—
> está en `veegsoft-web/docs/arquitectura/asistente-ia-y-veeghub.md`. El
> detalle operativo de la ingesta (firma, pruebas con curl, duplicados) está
> en `docs/runbooks/ingesta-leads-del-sitio-web.md`.

## Qué recibe VeegHub

Un único endpoint público, `POST /api/webhooks/website/leads`, firmado con
HMAC (`x-veeg-signature`, secreto `WEBSITE_LEAD_SECRET`). Lo llaman:

| Origen | `channel` | Resultado |
|---|---|---|
| Formularios del sitio y landings US | ausente / `form` | `Lead` nuevo, `source: WEBSITE` |
| Asistente IA del sitio | `chat` + bloque `chat` | upsert por `chatSessionId`, `source: WEB_CHAT` |

```
route.ts ── verifyWebsiteLeadSignature ── websiteLeadSchema (zod)
   │
   ▼
ingestWebsiteLead (lib/leads/website.ts)
   ├─ form → prisma.lead.create + actividad «Lead recibido desde el formulario…»
   └─ chat → findUnique(chatSessionId)
              ├─ existe → update + actividad «El asistente IA actualizó…»   → 200
              └─ no     → create + actividad «Lead captado por el asistente…» → 201
   │
   └─ marcarPosibleDuplicado (nunca fusiona)
   │
   ▼ sólo si se creó
after(notifyNewLead)  →  push a todos los dispositivos  →  si ninguno, correo a LEAD_ALERT_EMAIL
```

## Modelo de datos

En `Lead` (migración `20261026120000_chat_ia_leads`):

| Campo | Tipo | Nota |
|---|---|---|
| `source` | `LeadSource` + `WEB_CHAT` | |
| `temperature` | `LeadTemperature?` (`HOT`/`WARM`/`COLD`) | Indexado con `createdAt`; filtro en la lista. |
| `aiSummary` | `String?` | 2-4 frases escritas por el asistente. |
| `aiInsights` | `Json?` | `necesidad`, `servicio`, `urgencia`, `plazo`, `preferenciaContacto`, `presupuestoMencionado`, `siguientePaso`, `ubicacion`. **Agregar una clave no requiere migración.** |
| `conversation` | `Json?` | `{ role, text }[]` |
| `chatSessionId` | `String? @unique` | Clave del upsert. |
| `rawPayload` | `Json?` | Payload completo (incluye atribución gclid/UTM). |

Las columnas JSON se leen siempre con `lib/leads/ficha.ts` (`readInsights`,
`readConversation`, `readWebOrigin`), que descarta formas inválidas: un lead
editado o viejo nunca rompe la ficha. Tiene tests en `lib/leads/ficha.test.ts`.

## Interfaz

**Ficha** (`app/admin/leads/[id]/page.tsx`), estilo CRM:

| Componente | Rol |
|---|---|
| `lead-profile.tsx` | Columna fija: avatar (color por temperatura), chips, acciones, etapa, contacto, oportunidad, origen web/Meta. |
| `lead-contact-tiles.tsx` | WhatsApp / Llamar / Correo / Marcar contactado. Los que no aplican quedan apagados. |
| `lead-ai-summary.tsx` | Necesidad como título, resumen, siguiente paso y WhatsApp con mensaje que cita la necesidad (`waLink(phone, name, about)`). |
| `lead-message.tsx` | Mismo lugar para leads sin IA (formulario, Meta). |
| `lead-stats-strip.tsx` | 4 datos con icono (chat: respuesta, urgencia, plazo, prefiere; resto: respuesta, etapa, servicio, recibido). |
| `lead-tabs.tsx` | Conversación / Actividad / Notas. |
| `lead-conversation.tsx`, `lead-activity-timeline.tsx` | Chat con avatares; línea de tiempo con color por tipo. |
| `temperature-pill.tsx` | Icono + palabra (el color nunca va solo). |

**Pipeline y lista**: tarjeta y fila muestran temperatura y una línea del resumen;
la lista filtra por `?temp=HOT|WARM|COLD`.

## Cómo crecer

| Quiero… | Dónde |
|---|---|
| Mostrar un dato nuevo que ya manda el chat | `readInsights` + `LeadProfile` o `LeadStatsStrip`. Del lado web, ver «Pedir/guardar un dato nuevo del lead» en el doc de arquitectura. |
| Un canal nuevo (WhatsApp Business, otro sitio) | Reusar el endpoint con otro `channel`, o un endpoint propio que termine en una función como `ingestWebsiteLead`. Añadir su `LeadSource` y su etiqueta en `SOURCE_LABELS`. |
| Cambiar el texto del push | `alertFor` en `app/api/webhooks/website/leads/route.ts`. |
| Puntuar o priorizar leads | `temperature` ya está indexada; ordenar el pipeline por ella en `lib/admin/queries/leads.ts`. |

## Probar en local

1. `docker compose up -d` y `npm run dev -- -p 3001`.
2. En veegsoft-web: `VEEGHUB_LEADS_URL=http://localhost:3001/api/webhooks/website/leads` y `VEEGHUB_LEAD_SECRET` igual a `WEBSITE_LEAD_SECRET`.
3. Conversar en `http://localhost:3000` (con las claves de prueba de Turnstile) o mandar un payload firmado con curl (ver el runbook).
