# Runbook: conectar Meta Lead Ads a una app propia

**Reutilizable.** Sirve para VeegSoft y para cualquier app futura de un cliente.
Última verificación contra la API: **2026-09-16**, Graph `v23.0`.

---

## 1. Modelo mental: son TRES conexiones distintas

El 90% de la confusión viene de creer que esto es un solo paso. No lo es. Son tres cosas
independientes, y **los leads no llegan hasta que las tres están activas**:

| # | Conexión | Alcance | ¿Hay botón en el panel? |
|---|---|---|---|
| A | **App ↔ Webhook** — la app declara "quiero escuchar el objeto `Page`, campo `leadgen`", y da su URL de callback | Una vez **por app** | ✅ Sí — App Dashboard → Webhooks |
| B | **App ↔ Página** — instalar la app *en esa Página concreta* (`subscribed_apps`) | Una vez **por Página** | ❌ **No existe botón.** Solo API |
| C | **App ↔ Acceso a leads** — Lead Access Manager autoriza a la app a *descargar* los datos | Una vez **por Página** | ✅ Sí — Business Settings |

La doc oficial de Meta lo dice textual:

> *"In addition to configuring the App Dashboard, your app must enable Page subscriptions for the Page
> connected to the app user's account. Notifications for specific fields will not be received unless
> **both** the App Dashboard configuration **and** the Page subscription are active."*

**Consecuencia práctica:** la conexión **B no se puede hacer desde ningún panel de Meta.** No hay
botón, ni en el App Dashboard, ni en Business Suite, ni en la configuración de la Página. Es
obligatoriamente una llamada a la API.

**Y de ahí sale el síntoma más común:** la app **no aparece** en la lista de CRMs de Lead Access
Manager (conexión C). No es un bug ni un permiso faltante — es orden: **C solo lista apps que ya
pasaron por A y por B.** Verificado en la puesta en marcha de VeegSoft: con B hecha pero A sin
hacer, la app seguía sin aparecer; apenas se declaró el webhook en el App Dashboard (A), apareció
en la lista y se pudo asignar.

Diagnóstico rápido de cuál falta:

```bash
# ¿A hecha?  Debe traer callback_url, active: true y el campo leadgen
GET /{app-id}/subscriptions?access_token={app-id}|{app-secret}

# ¿B hecha?  Debe listar la app. Requiere TOKEN DE PÁGINA
GET /{page-id}/subscribed_apps?access_token={page-token}
```

### Las dos formas de hacer la conexión B (sin terminal, si se prefiere)

| Forma | Cuándo usarla |
|---|---|
| **Graph API Explorer** (`developers.facebook.com/tools/explorer`) | Es UI, no requiere terminal. Seleccionar la app → en el desplegable de token elegir **Page Access Token** → método **POST** → ruta `{page-id}/subscribed_apps` → parámetro `subscribed_fields` = `leadgen` → Submit |
| **`curl` / la propia app** | Automatizable. Es lo que hace el botón "Conectar Página" de un CRM real |

Ambas hacen exactamente la misma llamada. No hay una tercera vía.

---

## 2. Procedimiento estándar — los 10 pasos

Aplica igual para VeegSoft y para cualquier cliente. La app siempre vive en el portafolio dueño
de la Página (ver sección 3). **Orden correcto, uno por uno.**

### Paso 1 — Requisitos previos

- [ ] Portafolio comercial **verificado** (Business Verification)
- [ ] Ser **admin** de la Página dueña de las campañas
- [ ] URL pública de política de privacidad — HTTPS, sin login
- [ ] URL de instrucciones de eliminación de datos (puede ser un ancla de la anterior)
- [ ] Dominio HTTPS público donde corre la app. **`localhost` no sirve** para el webhook

### Paso 2 — Crear la app

1. `developers.facebook.com` → **Mis apps** → **Crear app**
2. Caso de uso **Otro** → tipo **Empresa (Business)**
3. **Vincularla al portafolio comercial verificado.** Si no se vincula, después no se puede pedir
   acceso avanzado
4. **Configuración → Básica** → copiar **App ID** y **Clave secreta**
5. En la misma pantalla llenar: política de privacidad, instrucciones de eliminación de datos,
   categoría, ícono

→ `META_APP_ID`, `META_APP_SECRET`

### Paso 3 — Usuario del sistema (token que nunca expira)

No usar token de usuario normal: expira en 60 días y rompe la integración sin aviso.

1. `business.facebook.com/settings` → **Usuarios → Usuarios del sistema** → **Agregar**
   → nombre descriptivo (ej. `veeghub-crm`), rol **Administrador**
2. **Agregar activos**:
   - **Páginas** → la Página → **Control total**
   - **Apps** → la app del paso 2 → **Administrar app**
   - **Cuentas publicitarias** → la cuenta → **Administrar campañas**
3. **Generar nuevo token** → app del paso 2 → vencimiento **Nunca** → permisos:

   | Permiso | Para qué |
   |---|---|
   | `pages_show_list` | listar las Páginas |
   | `pages_read_engagement` | leer datos de la Página |
   | `pages_manage_metadata` | **suscribir la app a la Página** (paso 7) |
   | `leads_retrieval` | **leer los datos del lead** (flujo principal) |
   | `pages_manage_ads` | listar formularios y leads históricos (backfill) |
   | `ads_read` | nombres de campaña / conjunto / anuncio |
   | `business_management` | gestionar activos del portafolio |

4. **Copiar el token ya** — no se vuelve a mostrar

→ `META_SYSTEM_USER_TOKEN`

### Paso 4 — Obtener el Page ID

```bash
curl -s "https://graph.facebook.com/v23.0/me/accounts?access_token=$META_SYSTEM_USER_TOKEN" \
  | python3 -m json.tool
```

Del resultado: `id` → `META_PAGE_ID`. El campo `tasks` debe incluir `MANAGE` y `ADVERTISE`.
El `access_token` que aparece ahí es el **token de página** (tampoco expira, porque deriva de un
usuario del sistema). No hace falta guardarlo en `.env`: se puede pedir cuando se necesite.

### Paso 5 — Desplegar el endpoint del webhook ⚠️

**Este paso va ANTES de tocar Webhooks en el panel.** Meta verifica la URL en vivo en el paso 6;
si no responde, no deja guardar.

El endpoint tiene que:
- responder `GET` con el `hub.challenge` en texto plano (200) cuando `hub.verify_token` coincide
- responder `POST` con 200 en menos de ~5 segundos
- validar la cabecera `X-Hub-Signature-256`

Generar el token de verificación (es un valor inventado por vos, no de Meta):

```bash
openssl rand -hex 32
```

→ `META_WEBHOOK_VERIFY_TOKEN` (en `.env` y en el hosting)

### Paso 6 — Conexión A: suscripción a nivel de APP

App Dashboard → **Productos → + → Webhooks**

1. Objeto: **Página (Page)** → **Suscribirse a este objeto**
2. URL de devolución de llamada: `https://TU-DOMINIO/api/webhooks/meta/leads`
3. Token de verificación: el del paso 5
4. **Verificar y guardar** — Meta hace el `GET` del handshake en ese momento
5. En la lista de campos, suscribir **`leadgen`**

### Paso 7 — Conexión B: suscripción a nivel de PÁGINA (solo API)

```bash
PAGE_TOKEN=$(curl -s "https://graph.facebook.com/v23.0/$META_PAGE_ID?fields=access_token&access_token=$META_SYSTEM_USER_TOKEN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "https://graph.facebook.com/v23.0/$META_PAGE_ID/subscribed_apps?subscribed_fields=leadgen&access_token=$PAGE_TOKEN"
```

Esperado: `{"success": true}`

Verificar (**con token de página**, no con el del usuario del sistema):

```bash
curl -s "https://graph.facebook.com/v23.0/$META_PAGE_ID/subscribed_apps?access_token=$PAGE_TOKEN" \
  | python3 -m json.tool
```

Esperado:
```json
{ "data": [ { "name": "TuApp", "id": "...", "subscribed_fields": ["leadgen"] } ] }
```

Si devuelve `{"data": []}` → la app **no** está instalada. Nada más va a funcionar.

> Los pasos 6 y 7 son independientes entre sí: funcionan en cualquier orden. Lo que importa es que
> **los dos** estén hechos antes de esperar eventos.

### Paso 8 — Conexión C: Lead Access Manager

Recién ahora la app aparece en la lista.

1. `business.facebook.com/settings` → **Integraciones → Acceso a clientes potenciales**
2. Seleccionar la Página → pestaña **CRMs** → **Asignar CRM** → elegir la app
3. Pestaña **Personas**: **dejarla vacía es correcto.** Los admins de la Página ya tienen acceso a
   leads automáticamente. Esa pestaña solo sirve para dar acceso a gente que **no** es admin
   (un vendedor, una agencia externa)

### Paso 9 — Probar de punta a punta

**Este es el único paso que prueba que los leads reales van a entrar.** Todo lo anterior se puede
verificar por partes y dar verde sin que el circuito completo funcione.

#### 9.1 — Probar la entrega (aislado, no necesita formularios)

App Dashboard → **Webhooks** → objeto Página → fila `leadgen` → botón **Probar / Test**.

Manda un payload de ejemplo directo al endpoint. Qué significa cada resultado:

| En tu tabla de eventos | Qué prueba |
|---|---|
| Aparece una fila, aunque sea `FAILED` con `Object with ID '444444444444' does not exist` | ✅ Meta entrega, la firma valida, el evento se persiste. El `FAILED` es correcto: ese ID es relleno |
| No aparece nada | ❌ Meta no está entregando. Revisar conexiones A y B, y que el endpoint responda el handshake |
| `Invalid signature` en los logs | ❌ Se está firmando algo distinto al cuerpo crudo |

#### 9.2 — Probar un lead real

`developers.facebook.com/tools/lead-ads-testing` → seleccionar Página y formulario →
**Crear cliente potencial**. Solo se permite un lead de prueba por formulario; para repetir hay que
eliminar el anterior.

> **La app tiene que estar en Live (paso 10).** En modo Desarrollo, Meta crea el lead pero **no
> entrega el webhook**, y el síntoma es confuso: la herramienta dice "Se envió tu cliente potencial
> de prueba" y no llega nada.

Si el lead no aparece pero 9.1 sí funcionó, el problema está entre Meta y la entrega, no en el
código.

#### 9.3 — Recuperar un lead que ya existe en Meta

Si un lead quedó en Meta sin entregarse (por ejemplo, creado antes de terminar la configuración),
se puede reinyectar mandando un webhook firmado con su `leadgen_id` real:

```bash
BODY="{\"object\":\"page\",\"entry\":[{\"id\":\"$PAGE_ID\",\"time\":$(date +%s),\"changes\":[{\"field\":\"leadgen\",\"value\":{\"leadgen_id\":\"$LEAD_ID\",\"page_id\":\"$PAGE_ID\",\"form_id\":\"$FORM_ID\"}}]}]}"
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET" | sed 's/^.*= //')"
curl -s -X POST "$CALLBACK_URL" -H "content-type: application/json" \
  -H "x-hub-signature-256: $SIG" -d "$BODY"
```

Para conseguir los `leadgen_id` existentes (requiere `pages_manage_ads`):

```bash
GET /{page-id}/leadgen_forms?fields=id,name,leads_count
GET /{form_id}/leads
```

#### ⚠️ No dar por buena la configuración sin 9.2

En la puesta en marcha de VeegSoft, **9.1 pasó y 9.2 nunca se llegó a validar**: el lead de prueba
se creó con la app en modo Desarrollo, no se entregó, y después se cargó a mano con 9.3. Se
verificaron la entrega, la lectura y el guardado por separado, pero no el circuito automático.

Moraleja: pasar a Live **antes** del 9.2, y no declarar la integración terminada hasta ver un lead
entrar solo.

### Paso 10 — Pasar la app a Live

**En modo Desarrollo, Meta solo entrega webhooks para usuarios con rol en la app.**
Los leads de prueba que crea el propio administrador llegan; los de un desconocido que ve el
anuncio y llena el formulario, **no**. Con la app en Desarrollo no se recibe ni un lead real.

App Dashboard → selector junto al nombre de la app → **En vivo**.

Requisitos para que deje: categoría, política de privacidad y URL de eliminación de datos
completas (paso 2).

#### ¿Hace falta App Review? Normalmente **no**

Verificado el 2026-09-16 en la puesta en marcha de VeegSoft: se leyó un lead real con
`GET /{form_id}/leads` y `leads_retrieval`, con la app en **acceso estándar** y en modo
Desarrollo. Funcionó.

La razón: los permisos sobre **activos del propio portafolio** se conceden por asignación en
Business Manager al usuario del sistema, no por App Review. El App Review es para pedir permisos
**a usuarios finales** vía Facebook Login — un camino que este procedimiento no usa.

Síntoma que confunde: `leads_retrieval` **no aparece** en App Review → Permisos y funciones.
Es correcto y esperado; solo aparecería agregando el producto Facebook Login for Business.

**Cuándo sí hace falta App Review:** si la app necesita acceder a Páginas que **no** pertenecen al
portafolio que la posee. Con el estándar de la sección 3 (una app por portafolio de cliente) ese
caso no se da.

## 3. Clientes: una app propia dentro del portafolio del cliente

**Estándar de VeegSoft:** nunca se crea una app de cliente dentro del portafolio de VeegSoft.
Si un cliente necesita esta integración, **la app se crea en el portafolio comercial del cliente**,
con su propio usuario del sistema y su propio token.

Técnicamente es **el mismo procedimiento de la sección 2**, ejecutado dentro de la cuenta del
cliente: los mismos 10 pasos, sin ninguna variación. Lo único que cambia es quién es el dueño de
cada cosa:

| Recurso | Dueño |
|---|---|
| App de Meta | El cliente |
| Portafolio comercial y verificación | El cliente |
| Página y cuenta publicitaria | El cliente |
| Usuario del sistema y token | El cliente (creado por vos con acceso admin) |
| Política de privacidad y URL de eliminación de datos | **El cliente** — es su app, va su política, no la de VeegSoft |
| Endpoint del webhook | El despliegue del cliente |

### Lo que hay que pedirle al cliente antes de empezar

- [ ] **Rol de administrador en su portafolio comercial** (`business.facebook.com` → Usuarios → Personas).
      No alcanza con "acceso de socio a la Página": para crear un usuario del sistema hace falta
      admin del portafolio
- [ ] **Verificación de negocio completada** en su portafolio. Sin esto no se puede pedir acceso
      avanzado en App Review. Si no la tienen, hay que iniciarla primero y puede tardar días
- [ ] **Política de privacidad publicada** en su dominio, con la sección de eliminación de datos
- [ ] Rol de **administrador de la Página** dueña de las campañas

### Consecuencias de este modelo (asumidas a propósito)

1. **Una App Review por cliente.** Cada app es independiente, así que cada una necesita su propio
   envío de `leads_retrieval` con su screencast, y espera de 1–7 días hábiles. No hay forma de
   reutilizar la aprobación de una app en otra. Es el costo real de este estándar.
2. **Un despliegue por cliente.** Cada app apunta al webhook de su propia instancia. Un solo
   `META_APP_SECRET` por despliegue: la validación de firma queda simple y no hace falta una tabla
   de apps.
3. **Cero riesgo de arrastre.** Si un cliente se va, se lleva su app y sus datos. Nada que
   desconectar del lado de VeegSoft, ni tokens tuyos que revocar.
4. **Sin responsabilidad sobre datos ajenos.** Los leads del cliente nunca pasan por una app tuya,
   así que su tratamiento se rige por la política de ellos.

### Las alternativas que NO usamos, y por qué

Se dejan anotadas para no re-evaluarlas cada vez:

| Alternativa | Qué es | Por qué se descarta |
|---|---|---|
| **Acceso de socio** | El cliente agrega a VeegSoft como socio de su portafolio y asigna sus activos a un usuario del sistema **tuyo** | La app y los tokens quedan del lado de VeegSoft. Manejás datos personales de terceros bajo tu política de privacidad, y si te sacan como socio se corta todo sin aviso |
| **Facebook Login for Business** | Una app tuya multi-cliente; el cliente aprieta "Conectar Facebook" y autoriza su Página | Una sola App Review sirve para todos, pero exige construir el flujo OAuth, cifrar y renovar tokens por cliente, y una tabla de apps con secretos por tenant. Solo se paga si el alta tiene que ser autoservicio y hay volumen |

**Cuándo reconsiderar:** si alguna vez se vende esto como producto SaaS con alta autoservicio y más
de ~10 clientes, Facebook Login for Business pasa a ser la opción correcta. Hasta entonces, no.

## 4. Qué se hace por panel y qué solo por API

| Acción | Panel | API |
|---|---|---|
| Crear app, App ID / Secret | ✅ App Dashboard | — |
| Usuario del sistema y su token | ✅ Business Settings | — |
| Webhook: URL de callback + campo `leadgen` | ✅ App Dashboard → Webhooks | — |
| **Instalar la app en la Página** | ❌ **no existe** | ✅ `POST /{page-id}/subscribed_apps` (o Graph API Explorer) |
| Lead Access Manager → asignar CRM | ✅ Business Settings | — |
| Leer un lead | — | ✅ `GET /{leadgen_id}` |
| Listar formularios / leads históricos | ✅ Centro de clientes potenciales (manual, CSV) | ✅ `GET /{page-id}/leadgen_forms`, `GET /{form_id}/leads` |
| Crear leads de prueba | ✅ Lead Ads Testing Tool | — |

---

## 5. Comandos de diagnóstico

```bash
set -a && source .env && set +a

# ¿El token sirve, qué tipo es, expira, qué scopes tiene?
curl -s "https://graph.facebook.com/v23.0/debug_token?input_token=$META_SYSTEM_USER_TOKEN&access_token=$META_APP_ID|$META_APP_SECRET" \
  | python3 -m json.tool
# Buscar: "type": "SYSTEM_USER", "expires_at": 0, y los 7 scopes

# Token de página (para todo lo que sea a nivel de Página)
PAGE_TOKEN=$(curl -s "https://graph.facebook.com/v23.0/$META_PAGE_ID?fields=access_token&access_token=$META_SYSTEM_USER_TOKEN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# ¿La app está instalada en la Página? (conexión B)
curl -s "https://graph.facebook.com/v23.0/$META_PAGE_ID/subscribed_apps?access_token=$PAGE_TOKEN" \
  | python3 -m json.tool

# ¿Qué formularios tiene la Página?
curl -s "https://graph.facebook.com/v23.0/$META_PAGE_ID/leadgen_forms?fields=id,name,status,leads_count&access_token=$PAGE_TOKEN" \
  | python3 -m json.tool

# Leer un lead concreto
curl -s "https://graph.facebook.com/v23.0/{LEADGEN_ID}?fields=id,created_time,field_data,ad_id,form_id,campaign_id,platform,is_organic&access_token=$PAGE_TOKEN" \
  | python3 -m json.tool

# ¿Qué suscripciones declaró la app? (conexión A)
curl -s "https://graph.facebook.com/v23.0/$META_APP_ID/subscriptions?access_token=$META_APP_ID|$META_APP_SECRET" \
  | python3 -m json.tool
```

---

## 6. Errores reales y su causa

Todos observados en la puesta en marcha de VeegSoft el 2026-09-16.

| Error | Causa real | Solución |
|---|---|---|
| La app **no aparece** en Lead Access Manager → CRMs | Falta la conexión A, la B, o las dos | Verificar `GET /{app-id}/subscriptions` (A) y `GET /{page-id}/subscribed_apps` con token de página (B). **Las dos** tienen que estar antes de que C la liste |
| Pestaña **Personas** vacía en Lead Access | No es un error | Los admins de la Página ya tienen acceso. Solo asignar gente que no sea admin |
| `{"data": []}` en `subscribed_apps` | Ídem: falta el paso 7 | Ejecutar el `POST` |
| `190 (2069032) User Access Token Is Not Supported — A Page access token is required for this call for the new Pages experience` | Se usó el token del usuario del sistema donde va **token de página** | Derivar el token de página primero |
| `(#100) The parameter user_id is required` en `has_lead_access` | Falta el `user_id` en el campo compuesto | `fields=has_lead_access.user_id({id}).app_id({app_id})` |
| `has_lead_access` → `"This API is not available."` | Se consultó con un **usuario del sistema**; esa verificación es para usuarios normales | No es bloqueante. Ignorar y validar con una prueba real de lead |
| `(#200) Requires pages_manage_ads permission to manage the object` | Falta el scope `pages_manage_ads` | Regenerar el token del usuario del sistema con ese permiso. Afecta al backfill, no al webhook |
| `(#200) Requires leads_retrieval permission` al leer un lead | Falta el paso 8 (Lead Access Manager) o el scope | Asignar la app como CRM y revisar scopes |
| El webhook no recibe nada, pero el handshake pasó | App en modo **Desarrollo**: solo dispara para admins/testers | Probar con la Lead Ads Testing Tool. Para leads reales, App Review + Live |
| Meta reintenta y llegan leads duplicados | El endpoint tardó más de ~5s en responder 200 | Responder 200 primero y procesar en segundo plano. Deduplicar por `leadgen_id` único |
| Los leads de prueba llegan pero los reales no | App en modo **Desarrollo** | Pasar a Live (paso 10). Desarrollo solo entrega para usuarios con rol en la app |
| `leads_retrieval` no aparece en App Review → Permisos y funciones | Esa lista es para permisos pedidos vía Facebook Login | Es correcto. Con usuario del sistema sobre activos propios no se necesita |
| La herramienta de prueba dice "App is not installed" y lista permisos faltantes que el token sí tiene | Esa herramienta evalúa el token del **usuario logueado**, no el del usuario del sistema | Ignorar si `subscribed_apps` y `debug_token` están correctos |
| Todo deja de funcionar tras regenerar el token del usuario del sistema | El token de página cacheado quedó inválido | Descartar el token cacheado y volver a pedirlo ante un error Graph `190` |
| El lead llega sin teléfono | El formulario nombró el campo `whatsapp_number` u otra variante | No asumir `phone_number`. Buscar por subcadena (`phone`, `celular`, `whatsapp`, `wpp`) |

---

## 7. Checklist copiable

```
[ ]  1. Portafolio verificado + admin de la Página + política de privacidad + URL de borrado
[ ]  2. App Business creada y vinculada al portafolio    → APP_ID, APP_SECRET
[ ]  3. Usuario del sistema + activos + token "Nunca"    → SYSTEM_USER_TOKEN (7 scopes)
[ ]  4. GET /me/accounts                                 → PAGE_ID
[ ]  5. Endpoint del webhook DESPLEGADO en HTTPS         → VERIFY_TOKEN
[ ]  6. [A] App Dashboard → Webhooks → Page → leadgen    (panel)
[ ]  7. [B] POST /{page-id}/subscribed_apps              (SOLO API)
[ ]  8. [C] Lead Access Manager → CRMs → asignar la app  (panel)
[ ] 9.1 Botón Test de Webhooks → debe aparecer un evento
[ ] 9.2 Lead Ads Testing Tool → el lead debe entrar SOLO (requiere Live primero)
[ ] 10. Pasar la app a LIVE  (hacerlo ANTES del 9.2)
```

> App Review normalmente **no** hace falta: ver el paso 10.

---

## 7.1 Independencia de la tecnología

Nada de esto depende de Next.js. Meta solo necesita una URL HTTPS pública que cumpla un
contrato de cuatro puntos, implementable en Laravel, Express, Django, Rails, Go o lo que sea:

1. **`GET`** con `hub.mode`, `hub.verify_token` y `hub.challenge` → devolver el `challenge` en
   texto plano con 200 si el token coincide; 403 si no.
2. **`POST`** → validar la cabecera `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256 del
   **cuerpo crudo** con el App Secret. Comparar en tiempo constante.
3. **Responder 200 en menos de ~5 segundos**, antes de llamar a Graph. Meta reintenta si tardás,
   y esos reintentos son la fuente de los leads duplicados. Guardar el evento crudo y procesar
   después (cola, job, worker, `after()`, lo que ofrezca tu stack).
4. **Idempotencia**: índice único sobre el `leadgen_id`. Es lo único que garantiza que un
   reintento no cree un lead repetido.

Después, `GET /{leadgen_id}?fields=id,created_time,field_data,ad_id,form_id` con el token de
página. Es HTTP plano: `Http::get()` en Laravel, `requests` en Django, `fetch` en Node.

En Laravel el equivalente directo sería una ruta fuera del middleware CSRF, la validación de
firma en un middleware propio, y el procesamiento en un Job encolado.

Lo que **no** cambia según la tecnología: los 10 pasos de configuración en Meta, el orden de las
tres conexiones, y el hecho de que la conexión B solo se puede hacer por API.

---

## 8. Registro de esta implementación (VeegSoft)

| Dato | Valor |
|---|---|
| App | `VeegHub` — `1550483952950898` |
| Página | `VeegSoft` — `109281652108419` |
| Usuario del sistema | id `122107878357471639`, `expires_at: 0` |
| Scopes actuales | `ads_read`, `business_management`, `leads_retrieval`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`, `public_profile` |
| Falta | `pages_manage_ads` (regenerar token) |
| Pasos 1–8 | ✅ hechos |
| Callback | `https://veeghub.veegsoft.com/api/webhooks/meta/leads` — handshake y firma verificados en producción |
| Webhook registrado por Meta en | `v26.0` (se alineó `META_GRAPH_VERSION` a la misma) |
| Paso 9.1 (entrega) | ✅ probado con el botón Test |
| Paso 9.2 (lead real de punta a punta) | ⚠️ **nunca validado** — se intentó en modo Desarrollo y no se repitió tras pasar a Live |
| Lead real | leído por API y reinyectado a mano con 9.3 |
| Paso 10 | ✅ app en Live, sin App Review |
