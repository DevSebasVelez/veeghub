# De webhook a CRM: modelo de datos y mapeo

Complemento de [`meta-lead-ads-setup.md`](./meta-lead-ads-setup.md). Ese cubre **la configuración
en Meta**; este cubre **lo que construís vos**: qué tablas, qué garantías y cómo mapear campos que
cambian en cada formulario.

Aplica a Meta Lead Ads y, con los mismos principios, a cualquier webhook de terceros
(Stripe, Twilio, WhatsApp Cloud API, Shopify).

---

## 1. Por qué hace falta una tabla de eventos

Meta hace un `POST` y se olvida. No hay bandeja de entrada ni forma de decir "mandámelo de nuevo".
Si tu servidor lo pierde, **el lead se perdió**.

La tabla de eventos guarda el payload crudo **antes** de hacer cualquier cosa lenta. Es la frontera
de durabilidad: una vez escrito, una llamada fallida a la API se puede reintentar sin depender del
emisor.

También es lo único que permite distinguir, cuando algo falla:

| Síntoma | Qué significa | Qué se arregla |
|---|---|---|
| Tabla vacía | El emisor nunca entregó | Configuración en Meta |
| Filas en `FAILED` | Entregó y tu código falló | Permisos, token o código |
| Filas en `PROCESSED` sin lead | Bug de mapeo | Tu mapeo |

Sin ella, las tres se ven igual: "no llegó nada".

---

## 2. Las tres tablas

### 2.1 Evento crudo

| Columna | Para qué |
|---|---|
| `externalId` | **único**. El `leadgen_id` de Meta. Es la clave de idempotencia |
| `payload` | JSON completo, tal como llegó |
| `status` | `PENDING` → `PROCESSED` \| `FAILED` \| `IGNORED` |
| `attempts` | contador, para el backoff de reintentos |
| `error` | texto del último error, **legible**. Es lo que vas a leer a las 11 de la noche |
| `receivedAt` / `processedAt` | latencia y auditoría |

`IGNORED` no es lo mismo que `FAILED`: significa "ya lo teníamos", que es el resultado **correcto**
de un reintento.

### 2.2 Registro de la cuenta conectada

Guarda el token de página **cifrado** (AES-256-GCM o equivalente), el nombre, y `lastEventAt`.

> **Trampa:** los tokens de página derivados de un usuario del sistema no expiran solos, pero
> **quedan inválidos al regenerar el token del usuario del sistema**. Si los cacheás, ante un error
> `190` hay que descartar el cacheado y volver a pedirlo. Sin eso, la integración se rompe en
> silencio y no se recupera sola.

### 2.3 El lead

Tres grupos de columnas:

1. **Persona**: nombre, email, teléfono (normalizado + el original sin tocar), empresa
2. **Atribución**: ids y nombres de campaña, conjunto, anuncio y formulario — sin esto no podés
   responder "¿qué campaña trae clientes?"
3. **Crudo**: `rawPayload` con el JSON completo

---

## 3. Idempotencia: dos niveles

Meta reintenta ante cualquier respuesta que no sea 200 rápido. Sin esto, un reintento crea leads
duplicados.

```
1. Único en evento.externalId   → el mismo evento no se procesa dos veces
2. Único en lead.externalLeadId → aunque el evento se reprocese, el lead no se duplica
```

El segundo es el que importa: el primero se puede saltar si reconstruís eventos desde un backfill.

**Regla de oro del handler:**

```
1. validar firma          → si falla, 401 y NO guardar
2. guardar evento crudo   → rápido, sin llamadas externas
3. responder 200          → antes de los ~5 segundos
4. procesar aparte        → cola, job, worker
```

Invertir 3 y 4 es el error clásico y produce exactamente los duplicados que la idempotencia
después tiene que tapar.

---

## 4. Mapeo de campos: el formulario cambia, el código no

Este es el punto que más sorprende: **los nombres de campo los elige quien arma el formulario**, y
cambian entre campañas. Un mapeo rígido pierde datos en silencio.

> Caso real: el formulario nombró el campo `whatsapp_number`, no `phone_number`. La coincidencia
> exacta no lo encontró y el lead se habría guardado **sin teléfono** — justo el dato que se usa
> para llamar.

### La estrategia, en cuatro capas

```
1. Coincidencia exacta   → phone_number, email, full_name, company_name
2. Coincidencia parcial  → contiene "phone" | "celular" | "whatsapp" | "wpp" | "telefono"
3. Lo no reconocido      → a un campo de texto libre, con la pregunta y la respuesta
4. TODO, siempre         → rawPayload con el JSON íntegro
```

La capa 4 es la red: aunque agreguen diez preguntas nuevas mañana, nada se pierde y se puede
reprocesar sin volver a pedirle nada a Meta.

### Detalles que muerden

- **Normalizá el teléfono a E.164** y guardá también el original. Los links `wa.me` necesitan
  E.164 **sin** el `+`.
- Las opciones llegan en snake_case (`software_a_medida`). Humanizalas para mostrar.
- Un campo sin respuesta puede venir **sin la clave `values`**, no como lista vacía. Acceso
  defensivo.
- Los campos que ya promoviste a columna propia **excluilos** del texto libre, o el teléfono
  aparece dos veces.
- Detectá duplicados por teléfono o email y **marcalos**, no los fusiones. Esa decisión es de una
  persona.

---

## 5. Qué hacer cuando el procesamiento falla

Que un lead se guarde **nunca** puede depender de que todo lo demás funcione:

| Parte | Si falla |
|---|---|
| Traer el lead de la API | Marcar `FAILED`, guardar el error, reintentar después |
| Traer nombres de campaña | **Ignorar.** Guardar el lead con los ids. Es decoración |
| Notificar (push, email) | **Ignorar.** El lead ya está guardado; no reintentar la ingesta entera |
| Guardar el lead | Eso sí es `FAILED` |

Una notificación fallida que marca el evento como `FAILED` provoca que el reintento vuelva a
procesar un lead que ya existe.

---

## 6. Red de seguridad: el backfill

El webhook puede perderse: un despliegue caído, un 500, un reintento agotado. Una tarea periódica
debería:

1. Listar los leads del proveedor desde la última sincronización y crear los que falten
2. Reprocesar los eventos en `FAILED` con `attempts < N`, con backoff

En Meta: `GET /{form_id}/leads` filtrando por `time_created`. Requiere `pages_manage_ads`.

---

## 7. Checklist para una integración nueva

```
[ ] Tabla de eventos con externalId ÚNICO
[ ] Validación de firma sobre el cuerpo CRUDO, comparación en tiempo constante
[ ] 200 antes de cualquier llamada externa
[ ] Procesamiento fuera del ciclo de respuesta
[ ] Único en el id externo del registro final
[ ] Mapeo en capas: exacto → parcial → texto libre → rawPayload
[ ] Teléfono a E.164, conservando el original
[ ] Token cifrado, con refresco ante error de token inválido
[ ] Fallos decorativos no tumban la ingesta
[ ] Pantalla que muestre los últimos eventos con su error
[ ] Tarea de backfill
```

---

## 8. Implementación de referencia (Veeghub)

| Pieza | Archivo |
|---|---|
| Config y validación de entorno | `lib/meta/config.ts` |
| Firma HMAC | `lib/meta/signature.ts` |
| Cliente de la API + token cifrado | `lib/meta/graph.ts` |
| Mapeo de campos | `lib/meta/lead-mapper.ts` |
| Ingesta idempotente | `lib/meta/ingest.ts` |
| Endpoint | `app/api/webhooks/meta/leads/route.ts` |
| Pantalla de diagnóstico | `app/admin/leads/configuracion/page.tsx` |
| Modelo | `prisma/schema.prisma` → `Lead`, `LeadActivity`, `MetaPage`, `MetaWebhookEvent` |
