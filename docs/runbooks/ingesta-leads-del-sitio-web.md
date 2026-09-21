# Ingesta de leads del sitio web

**veegsoft.com manda cada envío correcto de su formulario de contacto a VeegHub,
y entra como `Lead` con `source: WEBSITE`.**

Antes un lead del sitio vivía sólo en la bandeja de `info@veegsoft.com`: sin
etapa, sin seguimiento y separado de los que llegan por Meta.

---

## La regla en una línea

> El correo es la vía que no puede fallar. El CRM es un extra que nunca debe
> bloquear ni romper el formulario del sitio.

Si VeegHub está caído, sin configurar o tarda, el visitante no se entera y el
mensaje llega igual por correo. Cambiar un lead perdido en una bandeja por un
lead perdido del todo sería mal negocio.

---

## Las piezas

| dónde | archivo | qué hace |
|---|---|---|
| veegsoft-web | `src/lib/crm.ts` | Firma y envía. No lanza nunca. Timeout de 5 s |
| veegsoft-web | `src/app/api/contact/route.ts` | Llama al CRM en `after()`, ya respondido el visitante |
| veeghub | `lib/leads/website.ts` | Verifica la firma, valida con zod, crea el `Lead` |
| veeghub | `app/api/webhooks/website/leads/route.ts` | `POST /api/webhooks/website/leads` |

---

## Configuración

El mismo secreto en los dos lados, con **nombres distintos**:

```bash
# veegsoft-web/.env
VEEGHUB_LEADS_URL=https://veeghub.veegsoft.com/api/webhooks/website/leads
VEEGHUB_LEAD_SECRET=<secreto compartido>

# veeghub/.env
WEBSITE_LEAD_SECRET=<el mismo secreto>
```

Generar el secreto:

```bash
openssl rand -hex 32
```

**Ninguno lleva `NEXT_PUBLIC_`.** Son de servidor. Un secreto con ese prefijo
acaba en el bundle del navegador y cualquiera podría firmar leads falsos.

Con `VEEGHUB_LEADS_URL` o `VEEGHUB_LEAD_SECRET` sin definir, el sitio se salta
el envío y funciona exactamente como antes. Es un estado válido, no un error.

---

## La firma

HMAC-SHA256 sobre el **cuerpo crudo**, en la cabecera `x-veeg-signature`, con el
prefijo `sha256=`. Mismo trato que el webhook de Meta que está al lado.

```
x-veeg-signature: sha256=<hex>
```

El cuerpo se serializa **una sola vez** y se manda esa misma cadena. Parsear el
JSON y volver a serializarlo cambia el orden de las claves, produce otro digest
y el endpoint rechazaría todas las entregas. Por eso la ruta lee
`request.text()` antes de `JSON.parse`.

---

## El payload

Sólo `name` es obligatorio en la práctica; el resto depende de qué formulario
del sitio lo manda —el corto de las landings pide menos campos que el de
`/contacto`— y un lead sin empresa sigue siendo un lead.

```json
{
  "name": "Nombre Apellido",
  "email": "persona@empresa.com",
  "phone": "0991234567",
  "company": "Empresa S.A.",
  "message": "Qué necesita resolver",
  "serviceTag": "Desarrollo de software a medida",
  "sourcePath": "/desarrollo-de-software-quito"
}
```

`sourcePath` es la ruta del formulario que lo envió. Existe para responder qué
landing convierte, que es la pregunta que no se podía contestar antes.

El teléfono se normaliza a E.164 con `normalizePhone` de
`lib/meta/lead-mapper` — el mismo que usa la ingesta de Meta, no un segundo
normalizador. `phoneRaw` conserva lo que escribió la persona.

---

## Duplicados

Si el teléfono o el correo coinciden con un lead anterior que no esté en `LOST`,
se escribe una `LeadActivity` de tipo `SYSTEM` en la ficha nueva:

```
Posible duplicado del lead <nombre> (<id>).
```

**Nunca se fusiona automáticamente.** Decidir que dos registros son la misma
persona es de un humano. Mismo criterio que la ingesta de Meta.

---

## Probar que funciona

Con la base levantada (`docker compose up -d`) y el servidor corriendo:

```bash
SECRET="<el de WEBSITE_LEAD_SECRET>"
BODY='{"name":"Prueba","email":"prueba@example.com","phone":"0991234567","message":"probando","serviceTag":"Desarrollo","sourcePath":"/desarrollo-de-software-quito"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)"

curl -i -X POST http://localhost:3000/api/webhooks/website/leads \
  -H "Content-Type: application/json" \
  -H "x-veeg-signature: $SIG" \
  -d "$BODY"
```

Esperado: `201` con `{"received":true,"leadId":"..."}` y el lead visible en la
sección de leads.

| respuesta | qué pasó |
|---|---|
| `401 Invalid signature` | El secreto no coincide entre los dos repos, o el cuerpo se modificó en el camino |
| `400 invalid payload` | Falta `name` o algún campo excede el máximo |
| `201` pero no aparece | Mirar los logs: el prefijo es `[web]` |

Del lado del sitio, los fallos se registran con el prefijo `[crm]` y **no**
llegan al visitante: el formulario responde bien igual.

---

## Diferencia con el webhook de Meta

Meta reintenta si no respondes 200 rápido, así que aquel handler persiste el
evento crudo, responde y hace la ingesta en `after()`.

Acá el emisor es nuestro y ya le respondió a su propio visitante antes de
llamarnos, así que **nadie está esperando**. El lead se crea dentro de la
petición: si falla, se ve en el código de estado y el sitio puede registrarlo.
