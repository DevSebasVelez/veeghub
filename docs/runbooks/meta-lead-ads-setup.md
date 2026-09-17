# Runbook: conectar Meta Lead Ads a una app propia

**Reutilizable.** Sirve para VeegSoft y para cualquier app futura de un cliente.
Última verificación contra la API: **2026-09-16**, Graph `v26.0`.

> Usá la **misma versión** en los `curl` y en el código. Meta registra la suscripción del
> webhook con la versión vigente al crearla (acá quedó en `v26.0`); si el código llama a una
> distinta, las diferencias de payload aparecen mucho después y cuestan de rastrear.

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

## 1.1 Dónde encontrar cada cosa

Meta reparte estas opciones entre **tres paneles distintos** con nombres parecidos. Esta tabla
evita la mitad del tiempo perdido.

| Qué buscás | Panel | Ruta exacta |
|---|---|---|
| Crear la app, App ID, App Secret | **App Dashboard**<br>`developers.facebook.com/apps` | la app → Configuración → Básica |
| Configurar el webhook (conexión A) | App Dashboard | la app → Productos → Webhooks → objeto **Página** |
| Publicar la app (Desarrollo → Live) | App Dashboard | selector arriba, junto al nombre de la app |
| Permisos y funciones / App Review | App Dashboard | la app → Revisión de la app |
| Usuario del sistema y su token | **Business Settings**<br>`business.facebook.com/settings` | Usuarios → Usuarios del sistema |
| Asignar Página / cuenta publicitaria a ese usuario | Business Settings | Usuarios del sistema → *tu usuario* → Agregar activos |
| Lead Access Manager (conexión C) | Business Settings | Integraciones → Acceso a clientes potenciales |
| Verificación del negocio | Business Settings | Centro de seguridad |
| Agregar un socio a tu portafolio | Business Settings | Socios |
| **Crear formularios** de clientes potenciales | **Business Suite**<br>`business.facebook.com` | Todas las herramientas → Formularios de clientes potenciales |
| Ver y descargar leads a mano (CSV) | Business Suite | Centro de clientes potenciales |
| Crear leads de prueba | **Herramienta suelta** | `developers.facebook.com/tools/lead-ads-testing` |
| Probar tokens y llamadas a la API | Herramienta suelta | `developers.facebook.com/tools/explorer` |
| Ver qué entregó Meta y con qué respuesta | App Dashboard | la app → Webhooks → Historial de entregas |

> **App Dashboard ≠ Business Settings.** El primero configura la *app*; el segundo, los *activos del
> negocio* (Páginas, cuentas publicitarias, usuarios). La conexión A vive en uno y la C en el otro.

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
- [ ] Al menos un **formulario para clientes potenciales** en esa Página

> **Verificá de qué tipo son las campañas.** Esta integración solo captura campañas con
> **formulario instantáneo** (Lead Ads). Las campañas de **mensajes** (Messenger/WhatsApp) no
> generan leads por esta API y no llegan por acá.
>
> Los formularios se crean y se ven en **Meta Business Suite → Todas las herramientas →
> Formularios de clientes potenciales**, o al armar el anuncio en el Administrador de anuncios.
> Para listar los que ya existen: `GET /{page-id}/leadgen_forms` (paso 10.3).

### Paso 2 — Crear la app

1. `developers.facebook.com` → **Mis apps** → **Crear app**
2. Caso de uso **Otro** → tipo **Empresa (Business)**
3. **Vincularla al portafolio comercial verificado.** Si no se vincula, después no se puede pedir
   acceso avanzado
4. **Configuración → Básica** → copiar **App ID** y **Clave secreta**
5. En la misma pantalla llenar **todo esto**, porque la categoría vacía impide publicar la app
   (paso 9) y el resto lo ve cualquiera que revise:

   | Campo | Qué poner |
   |---|---|
   | **Categoría** | obligatoria para publicar. "Empresas y páginas" |
   | URL de la política de privacidad | la del negocio dueño de la app |
   | Eliminación de datos de usuario | elegir **URL de instrucciones** (no la de callback, que requiere programar) y apuntar a un ancla con los pasos concretos |
   | URL de Condiciones del servicio | la propia. **No dejar `https://www.facebook.com/`**, que es el placeholder |
   | Dominios de la app | el dominio del negocio y el de la app |
   | Correo de contacto | uno corporativo, no personal |
   | Ícono | opcional, pero mejora la revisión |

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

> **Al regenerar este token (para agregar un permiso o rotarlo), los tokens de página derivados
> quedan inválidos.** Si tu app los cachea, tiene que descartarlos y volver a pedirlos ante un
> error Graph `190`; si no, la integración se rompe en silencio y no se recupera sola.
>
> Acordate de actualizar el token **en local y en producción**, y redesplegar para que el
> entorno tome la variable nueva.

### Paso 4 — Obtener el Page ID

```bash
curl -s "https://graph.facebook.com/v26.0/me/accounts?access_token=$META_SYSTEM_USER_TOKEN" \
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

Antes de seguir, estas variables tienen que existir **en producción**, no solo en local, y hay
que **redesplegar** para que el entorno las tome:

```
META_APP_ID
META_APP_SECRET              ← con esto se valida la firma
META_WEBHOOK_VERIFY_TOKEN    ← con esto se responde el handshake
META_SYSTEM_USER_TOKEN
META_PAGE_ID
META_GRAPH_VERSION
```

Comprobá el handshake contra el dominio real antes de tocar el panel:

```bash
curl -s "https://TU-DOMINIO/api/webhooks/meta/leads?hub.mode=subscribe&hub.verify_token=$META_WEBHOOK_VERIFY_TOKEN&hub.challenge=OK123"
# Esperado: OK123
```

### Paso 6 — Conexión A: suscripción a nivel de APP

App Dashboard → **Productos → + → Webhooks**

1. Objeto: **Página (Page)** → **Suscribirse a este objeto**
2. URL de devolución de llamada: `https://TU-DOMINIO/api/webhooks/meta/leads`
3. Token de verificación: el del paso 5
4. **Verificar y guardar** — Meta hace el `GET` del handshake en ese momento
5. En la lista de campos, suscribir **`leadgen`**

### Paso 7 — Conexión B: suscripción a nivel de PÁGINA (solo API)

```bash
PAGE_TOKEN=$(curl -s "https://graph.facebook.com/v26.0/$META_PAGE_ID?fields=access_token&access_token=$META_SYSTEM_USER_TOKEN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "https://graph.facebook.com/v26.0/$META_PAGE_ID/subscribed_apps?subscribed_fields=leadgen&access_token=$PAGE_TOKEN"
```

Esperado: `{"success": true}`

Verificar (**con token de página**, no con el del usuario del sistema):

```bash
curl -s "https://graph.facebook.com/v26.0/$META_PAGE_ID/subscribed_apps?access_token=$PAGE_TOKEN" \
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

### Paso 9 — Pasar la app a Live

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

### Paso 10 — Probar de punta a punta

**Este es el único paso que prueba que los leads reales van a entrar.** Todo lo anterior se puede
verificar por partes y dar verde sin que el circuito completo funcione.

#### 10.1 — Probar la entrega (aislado, no necesita formularios)

App Dashboard → **Webhooks** → objeto Página → fila `leadgen` → botón **Probar / Test**.

Manda un payload de ejemplo directo al endpoint. Qué significa cada resultado:

| En tu tabla de eventos | Qué prueba |
|---|---|
| Aparece una fila, aunque sea `FAILED` con `Object with ID '444444444444' does not exist` | ✅ Meta entrega, la firma valida, el evento se persiste. El `FAILED` es correcto: ese ID es relleno |
| No aparece nada | ❌ Meta no está entregando. Revisar conexiones A y B, y que el endpoint responda el handshake |
| `Invalid signature` en los logs | ❌ Se está firmando algo distinto al cuerpo crudo |

#### 10.2 — Probar un lead real

`developers.facebook.com/tools/lead-ads-testing` → seleccionar Página y formulario →
**Crear cliente potencial**. Solo se permite un lead de prueba por formulario; para repetir hay que
eliminar el anterior.

> **La app tiene que estar en Live (paso 9).** En modo Desarrollo, Meta crea el lead pero **no
> entrega el webhook**, y el síntoma es confuso: la herramienta dice "Se envió tu cliente potencial
> de prueba" y no llega nada.

Si el lead no aparece pero 10.1 sí funcionó, el problema está entre Meta y la entrega, no en el
código.

#### 10.3 — Recuperar un lead que ya existe en Meta

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

#### ⚠️ No dar por buena la configuración sin 10.2

En la puesta en marcha de VeegSoft, el primer intento de 10.2 se hizo con la app en **modo
Desarrollo**: Meta creó el lead y no entregó nada. Se verificaron la entrega, la lectura y el
guardado por separado —lo que daba una falsa sensación de terminado— y el lead se cargó a mano con
10.3. Al pasar la app a **Live** y repetir 10.2, el lead entró solo. ✅

Moraleja: no declarar la integración terminada hasta ver un lead entrar solo. Por eso en este
runbook pasar a Live es el paso 9 y probar es el 10, y no al revés.

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

## 4.1 Construí una pantalla de diagnóstico

Sin esto, cuando algo falla no se puede distinguir **"Meta nunca entregó"** de **"entregó y
nuestro código falló"**, que necesitan arreglos opuestos. En esta puesta en marcha fue lo que
desatascó el problema.

Debe mostrar, consultando en vivo:

- Token: tipo, si expira, y qué permisos le faltan de la lista esperada
- Acceso a la Página
- **Conexión A y conexión B por separado**, no como un único "está conectado"
- **Los últimos eventos recibidos**, con su estado y el texto del error de los fallidos

En Veeghub es `/admin/leads/configuracion`
(`lib/admin/queries/meta-integration.ts` + `app/admin/leads/configuracion/page.tsx`).

---

## 5. Comandos de diagnóstico

```bash
set -a && source .env && set +a

# ¿El token sirve, qué tipo es, expira, qué scopes tiene?
curl -s "https://graph.facebook.com/v26.0/debug_token?input_token=$META_SYSTEM_USER_TOKEN&access_token=$META_APP_ID|$META_APP_SECRET" \
  | python3 -m json.tool
# Buscar: "type": "SYSTEM_USER", "expires_at": 0, y los 7 scopes

# Token de página (para todo lo que sea a nivel de Página)
PAGE_TOKEN=$(curl -s "https://graph.facebook.com/v26.0/$META_PAGE_ID?fields=access_token&access_token=$META_SYSTEM_USER_TOKEN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# ¿La app está instalada en la Página? (conexión B)
curl -s "https://graph.facebook.com/v26.0/$META_PAGE_ID/subscribed_apps?access_token=$PAGE_TOKEN" \
  | python3 -m json.tool

# ¿Qué formularios tiene la Página?
curl -s "https://graph.facebook.com/v26.0/$META_PAGE_ID/leadgen_forms?fields=id,name,status,leads_count&access_token=$PAGE_TOKEN" \
  | python3 -m json.tool

# Leer un lead concreto
curl -s "https://graph.facebook.com/v26.0/{LEADGEN_ID}?fields=id,created_time,field_data,ad_id,form_id,campaign_id,platform,is_organic&access_token=$PAGE_TOKEN" \
  | python3 -m json.tool

# ¿Qué suscripciones declaró la app? (conexión A)
curl -s "https://graph.facebook.com/v26.0/$META_APP_ID/subscriptions?access_token=$META_APP_ID|$META_APP_SECRET" \
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
[ ]  9. Pasar la app a LIVE   (en Desarrollo NO llegan leads reales)
[ ] 10.1 Botón Test de Webhooks → debe aparecer un evento
[ ] 10.2 Lead Ads Testing Tool → el lead debe entrar SOLO  ← la prueba que cuenta
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

> El **lado de tu aplicación** —qué tablas, qué garantías de idempotencia y cómo mapear campos
> que cambian en cada formulario— está en
> [`webhook-a-crm-modelo-de-datos.md`](./webhook-a-crm-modelo-de-datos.md).

---

## 7.2 Qué más se puede traer con estos permisos

Con los siete permisos del paso 3, sin pedirle nada nuevo a Meta:

### Por webhook (llegan solos)

| Campo | Qué trae | Permiso | ¿App Review? |
|---|---|---|---|
| `leadgen` | Formularios de clientes potenciales | `leads_retrieval` | **No** (comprobado) |
| `feed` | Publicaciones y comentarios en la Página | `pages_read_engagement` | probablemente no |
| `mention` | Menciones de la Página | `pages_read_engagement` | probablemente no |
| `messages` | Mensajes de Messenger | `pages_messaging` | **sí, casi seguro** |
| `ratings` | Reseñas | `pages_read_engagement` | probablemente no |

Instagram va por su propio objeto de webhook (`comments`, `mentions`, `story_insights`) con
`instagram_manage_comments`.

> Solo `leads_retrieval` está verificado. Que funcione con acceso estándar **no garantiza** que
> `pages_messaging` haga lo mismo: la mensajería es la superficie más restringida de Meta.

### Por consulta

| Qué | Endpoint | Permiso |
|---|---|---|
| Gasto, impresiones, clics, CTR | `GET /{ad_account}/insights` | `ads_read` |
| Campañas, conjuntos, anuncios | `GET /{ad_account}/campaigns` | `ads_read` |
| Formularios y leads históricos | `GET /{page-id}/leadgen_forms`, `GET /{form_id}/leads` | `pages_manage_ads` |
| Métricas de la Página | `GET /{page-id}/insights` | `pages_read_engagement` |

---

## 7.3 Límites de uso de la API

Cada respuesta trae la cabecera **`X-Business-Use-Case-Usage`**:

```json
{"<id>": [{
  "type": "ads_insights",
  "call_count": 1,                        // % consumido, ventana móvil de 1 hora
  "total_cputime": 1,
  "total_time": 1,
  "estimated_time_to_regain_access": 0,   // minutos hasta recuperar acceso
  "ads_api_access_tier": "development_access"
}]}
```

- Son **porcentajes sobre una ventana móvil de una hora**, no un contador que se reinicia a horario
  fijo.
- Hay **cuotas separadas** por tipo: `ads_insights`, `ads_management`, `pages`.
- **`development_access` es el tier por defecto** y tiene límites bajos. `standard_access` se
  consigue cumpliendo requisitos de la Marketing API.

**Cómo convivir con eso:** guardar los datos en la propia base y agregarlos desde ahí, en vez de
llamar a Meta en cada carga de página. Una llamada con `time_increment=1` devuelve una fila por día
y cubre cualquier rango posterior sin volver a pedir nada. Leer la cabecera en cada llamada y
negarse a llamar por encima del ~80%.

---

## 7.4 Dos trampas de los insights

### `date_preset` excluye el día de hoy

`last_30d`, `last_7d` y compañía **no incluyen hoy**. Una campaña que gastó esta mañana devuelve
`{"data": []}` y parece que la integración está rota. Usar siempre `time_range` explícito:

```
time_range={"since":"2026-08-18","until":"2026-09-16"}
```

### Los `action_type` de leads no son estables

En esta cuenta el lead llegó como `offsite_complete_registration_add_meta_leads`; en otras es
`lead` o `onsite_conversion.lead_grouped`. El nombre depende de cómo se armó la campaña.

**No cuentes leads desde los insights.** Tomá de Meta el gasto y las métricas de entrega, y contá
los leads desde tus propios registros: es estable y refleja lo que realmente recibiste.

### La zona horaria del gasto

Meta reporta el gasto por el **día calendario de la cuenta publicitaria**, no en UTC. Si agrupás
tus leads por día UTC, después de las 19:00 de Ecuador las dos series caen en días distintos y los
números no cuadran. Ver [`fechas-y-zona-horaria.md`](./fechas-y-zona-horaria.md).

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
| Paso 9 (Live) | ✅ app publicada, sin App Review |
| Paso 10.1 (entrega) | ✅ probado con el botón Test |
| Paso 10.2 (lead real de punta a punta) | ✅ validado con la app en Live: el lead entró solo |
| Lead real | leído por API y reinyectado a mano con 10.3 |
