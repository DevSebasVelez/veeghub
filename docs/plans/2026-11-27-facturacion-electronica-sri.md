# Plan: Facturación electrónica SRI

**Creado:** 2026-11-27
**Estado:** 🟢 Fase A en producción. B0 resuelto, B1 y B2 hechos en ramas sin desplegar (2026-11-27). **Siguiente sesión:** decidir despliegue de B1+B2 y empezar B3 (firma).
**Ramas:** una por subfase (`feat/sri-a1-lector-xml`, `feat/sri-b2-xml`, …) → `develop` → `main`

---

## 0. Para retomar en otra sesión

Para entender el contexto, lee primero:
- §8, la bitácora.
- §3, las decisiones tomadas, que no se vuelven a discutir.
- La subfase en curso.

Cada subfase cabe en una rama y se despliega por separado. Para cada una se indica:
- qué hacer fuera del código (SRI, contador);
- qué se programa;
- qué pruebas la dan por terminada.

Antes de escribir código revisa:
- `AGENTS.md`: este Next no es el que conoces; lee `node_modules/next/dist/docs/`.
- `docs/ui/convenciones-de-diseno.md`.
- `docs/runbooks/fechas-y-zona-horaria.md`. `fechaEmision` es un **día de calendario**; `fechaAutorizacion` es un **instante**.
- `docs/runbooks/comprobantes-y-estado-de-cuenta.md`: los documentos PDF reutilizan `lib/pdf`.

### Tablero

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| **A1** | Lector de XML: al subir el XML autorizado se llenan solos los campos de la factura, que se valida | — | ✅ en producción |
| **A1b** | Rediseño de Facturas según convenciones: KPIs, lista §7, ficha patrón «Plan», diálogo con el XML primero | — | ✅ en producción |
| **A2** | «Comparar con el XML/RIDE» en la ficha: lista diferencias y corrige las elegidas | A1 | ✅ en producción |
| **A3** | Desde el RIDE (PDF) o la clave pegada; si el SRI aún lo entrega, se baja y adjunta el XML; verificación de estado | A1 | ✅ en producción |
| **B0** | Trámites: ambiente de pruebas, punto de emisión 001-002, consulta al contador | — | 🟡 pruebas ✅ aprobado; falta B0.2 (001-002) y B0.3 (contador) |
| **B1** | Modelo de datos: puntos de emisión, ítems, estados SRI, intentos | A1 | ✅ rama `feat/sri-b1-modelo`, sin desplegar |
| **B2** | Generador de XML factura 1.1.0 + clave de acceso + cálculo de totales | B1 | ✅ rama `feat/sri-b2-xml` (sobre B1), sin desplegar |
| **B3** | Firma XAdES-BES con el `.p12` (custodia cifrada) | B2 | ⬜ |
| **B4** | Cliente SRI: recepción, autorización, reintentos y máquina de estados | B3 | ⬜ |
| **B5** | RIDE en PDF (Anexo 2 de la ficha) con el estilo de `lib/pdf` | B2 | ⬜ |
| **B6** | Pantalla «Emitir factura» desde hitos, detalle con línea de tiempo, envío XML+RIDE | B4, B5 | ⬜ |
| **B7** | Campaña de pruebas en `celcer` y paso a producción | B6 + B0 | ⬜ |
| **B8** | Nota de crédito (anulaciones después del día 7) | B7 | ⬜ |

**Orden:** A1 → A2 → A3, mientras B0 avanza en paralelo; después B1 → B2 → B3 → B4 → B5 → B6 → B7, y B8 al final.

La fase A sirve por sí sola aunque la B nunca se termine.

### Regla de oro del módulo

> **Nada llega al SRI de producción sin un clic humano de «Emitir».**
>
> Todo el desarrollo y las pruebas apuntan a `celcer.sri.gob.ec` (pruebas, sin validez tributaria). El ambiente es una configuración explícita, nunca un valor por defecto. Una factura en pruebas nunca se mezcla con las reales.

---

## 1. Objetivo

Hoy Sebastián factura en el facturador web del SRI. Después sube a VeegHub el XML y el RIDE, y digita a mano el número, la fecha, la clave, el subtotal, el IVA y el total.

Objetivo:
1. **A:** que subir el XML (o el RIDE, o pegar la clave) llene todo solo y valide que cuadra.
2. **B:** emitir la factura desde VeegHub, partiendo del hito por cobrar: armarla, firmarla, enviarla al SRI, recibir la autorización, generar el RIDE y enviarla al cliente, sin volver a pasar por el facturador del SRI.

## 2. Qué sabemos

### 2.1 Del contribuyente

| Dato | Valor |
|---|---|
| Emisor | VELEZ PALOMEQUE CHRISTIAN SEBASTIAN · nombre comercial VEEGSOFT · RUC 0104885694001 |
| Régimen | **RIMPE Negocio Popular**. Leyenda en el XML: `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE`. Pronto pasará los USD 20 000 y subirá a **RIMPE Emprendedor** (leyenda `CONTRIBUYENTE RÉGIMEN RIMPE`, y cambia el IVA). |
| IVA actual | 0 % (`codigoPorcentaje` 0) en las facturas emitidas como Negocio Popular |
| Serie actual | 001-001 (facturador del SRI). Secuencial 000000001 emitido el 13/05/2026. |
| Obligado a llevar contabilidad | NO |
| Firma electrónica | Security Data, vigente. Sebastián avisa si la renueva o cambia de proveedor. |

El régimen y el IVA vigentes se leen de `TaxProfile`, que tiene vigencias. **Nunca se fijan en el código.** El día del cambio a Emprendedor solo se crea un `TaxProfile` nuevo.

### 2.2 Formato del XML que entrega el facturador del SRI

Es la `<factura id="comprobante" version="1.1.0">` **firmada y sin envoltura**: no trae `<autorizacion>`, `numeroAutorizacion` ni `fechaAutorizacion`. En el esquema offline, el número de autorización **es** la clave de acceso.

Otras fuentes envuelven ese mismo XML en `<autorizacion>` (directo, o dentro de `RespuestaAutorizacionComprobante/autorizaciones`), con la factura en CDATA o escapada con entidades. El lector acepta todas esas variantes.

Rutas útiles:
- `infoTributaria/{ambiente, razonSocial, nombreComercial, ruc, claveAcceso, codDoc, estab, ptoEmi, secuencial, contribuyenteRimpe}`
- `infoFactura/{fechaEmision dd/mm/aaaa, tipoIdentificacionComprador, identificacionComprador, razonSocialComprador, totalSinImpuestos, totalDescuento, totalConImpuestos/totalImpuesto[]/{codigo, codigoPorcentaje, baseImponible, valor}, importeTotal, pagos}`
- `detalles/detalle[]/{codigoPrincipal, descripcion, cantidad, precioUnitario, descuento, precioTotalSinImpuesto}`
- `infoAdicional/campoAdicional[@nombre]`

### 2.3 Del SRI (Ficha Técnica Esquema Offline v2.34, jul-2026)

**Clave de acceso: 49 dígitos.**

| Parte | Dígitos | Contenido |
|---|---|---|
| Fecha de emisión | 8 | `ddmmaaaa` |
| codDoc | 2 | `01` = factura |
| RUC | 13 | del emisor |
| Ambiente | 1 | 1 = pruebas, 2 = producción |
| Serie | 6 | estab + ptoEmi |
| Secuencial | 9 | |
| Código numérico | 8 | lo elige el emisor |
| Tipo de emisión | 1 | `1` = normal |
| Dígito verificador | 1 | módulo 11, pesos 2–7; 11 → 0, 10 → 1 |

**Web services SOAP.**

| Ambiente | Host |
|---|---|
| Pruebas | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/` |
| Producción | `https://cel.sri.gob.ec/comprobantes-electronicos-ws/` |

- Recepción: `RecepcionComprobantesOffline?wsdl`, `validarComprobante(xml base64)` → `RECIBIDA` o `DEVUELTA`.
- Autorización: `AutorizacionComprobantesOffline?wsdl`, `autorizacionComprobante(clave)` → `AUTORIZADO`, `NO AUTORIZADO` o en proceso.

**Errores frecuentes:**

| Código | Significado |
|---|---|
| 35 | XSD |
| 39 | firma inválida |
| 43 | clave registrada |
| 45 | secuencial registrado |
| 52 | error de cálculos |
| 65 | fecha extemporánea |
| 70 | en procesamiento |

**Normativa:**
- Desde el 1-ene-2026 la transmisión al SRI es **inmediata**.
- Un comprobante solo se puede anular hasta el día 7 del mes siguiente; después, nota de crédito.
- El facturador offline de escritorio se apaga el 31-dic-2026. El web sigue.
- El emisor **debe** enviar el XML y el RIDE al comprador por email.

**Registro de proveedores de software (NAC-DGERCGC26-00000027, jul-2026):** según las firmas consultadas, no aplica a sistemas propios que no se comercializan, pero está «pendiente de aclaración». → **B0: confirmar con el contador**, porque Sebastián vende desarrollo de software.

### 2.4 Librerías

| Pieza | Elección | Por qué |
|---|---|---|
| Leer XML | `fast-xml-parser` | Puro JS, rápido, sin dependencias nativas |
| Firmar | `ec-sri-invoice-signer` (MIT, activa: v1.8.3 de nov-2026) | Solo firma, probada con certificados de Security Data. Puro JS (node-forge), funciona en Vercel. |
| SOAP | `fetch` con sobre armado a mano | Dos operaciones fijas; el paquete `soap` pesa y alarga el arranque en frío |
| Texto del RIDE (A3) | `unpdf` | Funciona en serverless; solo se usa para buscar la clave de 49 dígitos |
| RIDE (B5) | `@react-pdf/renderer` | Ya instalado (`lib/pdf`) |

**Descartada:** `open-factura`. Sin mantenimiento desde 2024 y con issues abiertos de «FIRMA INVÁLIDA». Sirve solo como referencia.

## 3. Decisiones tomadas

1. **El XML es la fuente de verdad, nunca el PDF.** Del RIDE solo se toma la clave.
2. **La app emite con un punto de emisión propio, `001-002`.** El facturador del SRI se queda con `001-001`, así sus secuenciales nunca chocan. El secuencial se asigna en una transacción, como los folios de comprobantes.
3. **Régimen, leyenda e IVA salen de `TaxProfile` según la fecha de emisión.**
4. **El `.p12` vive cifrado** (AES-256-GCM) y la llave está en una variable *Sensitive* de Vercel.
   - Nunca va al repo, a logs ni al cliente.
   - Cada firma queda registrada.
   - Hay un aviso 30 días antes de que caduque.
5. **Pruebas antes que producción**, con un interruptor de ambiente explícito y visible en la UI. Ver la regla de oro.
6. **Enviar al SRI es idempotente.** Ante errores 43/45/70 se consulta la autorización antes de reintentar. Nunca se reenvía con otra clave sin anular la anterior.

## 4. Fase A — Lector de facturas

### A1. Lector de XML al subir (esta rama)

**Código:**
- `lib/sri/access-key.ts`: descompone la clave y valida el dígito verificador (módulo 11), con tests.
- `lib/sri/invoice-xml.ts`: `parseSriInvoiceXml(text)`.
  - Desenvuelve las variantes de §2.2 y devuelve un objeto tipado: emisor, comprador, serie, secuencial, número `001-001-000000001`, fecha, clave, ambiente, totales en centavos, IVA por tarifa, ítems, leyenda RIMPE y, si vienen, autorización y fecha de autorización.
  - Revisa que la clave cuadre con fecha, RUC, serie, secuencial y ambiente, y que los totales cuadren.
  - Tests con fixtures **anonimizados** de las cuatro variantes.
- Server action `analyzeInvoiceXml(text)`:
  - parsea;
  - verifica que el emisor sea el RUC de `COMPANY`;
  - busca al cliente por `taxId`;
  - avisa si la clave ya está en otra factura;
  - devuelve advertencias (pruebas, emisor distinto, totales que no cuadran) en español.
- Diálogo de factura:
  - al elegir el XML se lee en el navegador y se llama la acción;
  - los campos se llenan solos: número, clave, fecha, subtotal, IVA, tarifa, total y cliente sugerido;
  - aparece una tarjeta «Leído del XML» con lo detectado y las advertencias;
  - todo sigue siendo editable.
- `COMPANY.taxId` (`lib/company.ts`) es el RUC esperado.

**Terminado cuando:**
- los tests del lector pasan con las cuatro variantes;
- el XML real de mayo llena el diálogo correctamente en el navegador, en claro y en oscuro;
- un XML de otro RUC o en ambiente de pruebas muestra la advertencia;
- una clave duplicada se bloquea con un mensaje claro.

### A2. Releer el XML de facturas existentes
- Botón «Releer XML» en el detalle de la factura. Compara lo guardado con lo que dice el XML y propone las correcciones en una lista con checks.
- Ejemplo real: la factura local `001` dice USD 500 y el XML dice USD 1,00.
- **Terminado cuando:** corregir una factura no rompe los hitos asociados (`syncInvoicePaidStatus`).

### A3. Desde el RIDE o la clave
- Subir el RIDE: con `unpdf` se extrae el texto y se busca la clave de 49 dígitos con DV válido.
- Pegar la clave: se valida.
- En ambos casos: `autorizacionComprobante(clave)` en `cel.sri.gob.ec` → XML autorizado → mismo flujo que A1. Se guarda ese XML como archivo de la factura.
- **Terminado cuando:** con solo el RIDE de mayo se obtiene el XML y se llena todo. Si el SRI no responde, sale un mensaje claro y el formulario sigue siendo manual.

## 5. Fase B — Emisión propia

### B0. Trámites (Sebastián)
1. En SRI en línea: **habilitar el ambiente de pruebas** de comprobantes electrónicos (gratis, en línea).
2. Confirmar que el punto de emisión `001-002` se puede usar para facturación electrónica sin registrarlo aparte. Si hay que crearlo en el RUC, hacerlo.
3. **Contador:** confirmar si el registro de proveedores de sistemas de facturación (NAC-DGERCGC26-00000027) aplica a un sistema propio que no se comercializa.
4. Tener a mano el `.p12` de Security Data y su clave. Se cargan cifrados en B3; nunca se pegan en un chat.

### B1. Modelo de datos

| Modelo / campo | Qué guarda |
|---|---|
| `EmissionPoint` | `estab`, `ptoEmi`, `ambiente`, `nextSequential`, `active`, `label` |
| `Invoice.source` | `UPLOADED` (lo de hoy) o `ISSUED` (emitida desde la app) |
| `Invoice.sriStatus` | máquina de estados: `DRAFT` → `SIGNED` → `RECEIVED` / `RETURNED` → `AUTHORIZED` / `NOT_AUTHORIZED` |
| `Invoice` (otros campos) | `environment`, `authorizedAt`, `emissionPointId`, `sequential` |
| `InvoiceItem` | descripción, cantidad, precio, descuento, tarifa IVA, hito de origen opcional |
| `SriSubmission` | cada llamada al SRI: operación, ambiente, estado, mensajes (código, texto, adicional), duración |

Migración aditiva: las facturas actuales quedan como `UPLOADED`.

### B2. XML 1.1.0, clave y totales
- `lib/sri/build-invoice.ts`: datos tipados → XML sin firmar, en el mismo orden de nodos que el XSD.
- Clave de acceso con código numérico aleatorio.
- Totales en centavos y redondeo a 2 decimales en totales, como pide la ficha.
- Leyenda RIMPE y tarifa de IVA desde `TaxProfile`.
- **Test de oro:** reconstruir el XML real de mayo a partir de sus datos debe dar el mismo `<factura>` sin la firma.

### B3. Firma
- `lib/sri/signing.ts` envuelve `ec-sri-invoice-signer`.
- El `.p12` se sube en una pantalla de configuración y se guarda cifrado (R2 o BD). La llave va en `SRI_CERT_KEY`; la clave del `.p12`, en `SRI_CERT_PASSWORD`; ambas *Sensitive* en Vercel.
- Se muestran titular, emisor y caducidad del certificado.
- **Terminado cuando:** una factura firmada se envía a `celcer` y vuelve `RECIBIDA`, sin error 39.

### B4. Cliente SRI
- `lib/sri/ws.ts`: `sendToReception(xml, env)` y `requestAuthorization(clave, env)` con `fetch` y SOAP, timeout, y lectura de `mensajes`.
- Flujo: firmar → recepción → esperar 2–3 s → autorización; si sigue en proceso, reintentar con backoff.
- Lo que siga pendiente lo retoma un cron. En Vercel Hobby el cron es diario, así que se usa el Worker de Cloudflare de marketing cada 10 minutos.
- Botón «Reintentar» y «Consultar estado».
- **Terminado cuando:**
  - en pruebas se cubren AUTORIZADO, DEVUELTA (XSD), NO AUTORIZADO (cálculos), clave repetida (43) y SRI caído (timeout);
  - cada caso termina en un estado claro, sin secuenciales perdidos ni duplicados.

### B5. RIDE
- `lib/pdf/ride.tsx` con los campos del Anexo 2:
  - emisor, RUC, «FACTURA», número, número de autorización, fecha y hora de autorización, ambiente, emisión;
  - clave en texto y en código de barras Code128;
  - comprador;
  - detalle;
  - subtotales por tarifa, descuento, IVA y total;
  - forma de pago, información adicional y leyenda RIMPE.
- Mismo lenguaje visual que los comprobantes.

### B6. UI
- «Emitir factura» desde uno o varios hitos de un cliente: arma los ítems desde los hitos, deja editar descripciones y muestra la vista previa del RIDE.
- Confirmación explícita con ambiente, número y total.
- Detalle de la factura con línea de tiempo de `SriSubmission`, descarga de XML y RIDE, y «Enviar al cliente», que reutiliza `sendInvoiceEmail` con XML y RIDE adjuntos.

### B7. Pruebas y paso a producción
- Campaña en `celcer`: al menos 10 facturas autorizadas que cubran 1 ítem, varios ítems, descuento, cliente con cédula, RUC y consumidor final, y los casos de error de B4.
- Paso a producción:
  - crear `EmissionPoint` 001-002 en ambiente producción;
  - emitir la primera factura real de bajo monto;
  - comprobarla en el portal del SRI (Comprobantes electrónicos recibidos/emitidos).

### B8. Nota de crédito
- XML `notaCredito`, mismo flujo, ligada a la factura original. Para anular después del día 7.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Filtración del `.p12`, que es la firma legal de Sebastián | Cifrado en reposo, llave aparte, nunca en logs ni en el cliente, registro de cada firma. Si se filtra, revocar en Security Data. |
| El SRI está caído y la transmisión es inmediata | Estado `SIGNED`/`RECEIVED` persistente, reintentos, cron, aviso en la UI |
| Error de cálculo (52) | Totales en centavos, test de oro, validación antes de enviar |
| Cambios de la ficha (varias versiones al año) | Revisar la ficha al empezar cada subfase B. Versión de esquema configurable. |
| Registro de proveedores | B0.3 antes de producción |
| Cambio de régimen | `TaxProfile` con vigencias; test con las dos leyendas |

## 7. Pruebas

- **Unitarias** (`npm test`): clave de acceso, lector de las cuatro variantes, constructor de XML (test de oro), totales, redondeo y leyenda por régimen.
- **Integración contra `celcer`:** script `scripts/sri-smoke.ts`. Se corre a mano y nunca en CI.
- **Navegador:** cada pantalla en claro, oscuro y 390 px.

## 8. Bitácora

- **2026-11-27:**
  - Investigación y plan.
  - Decisiones §3 tomadas con Sebastián: Negocio Popular → Emprendedor pronto, punto 001-002, firma Security Data.
  - Empieza A1.
- **2026-11-27, A1 + A1b hechos:**
  - Código: `lib/sri/access-key.ts`, `lib/sri/invoice-xml.ts`, la acción `analyzeInvoiceXml` y la validación de la clave al guardar.
  - El diálogo pone el XML primero y muestra la tarjeta «Leído del XML».
  - Rediseño de Facturas: KPIs (facturado en el año, por enviar, por cobrar, pagadas), filas §7 con chips XML/RIDE y la ficha con panel lateral.
  - 15 tests del lector. Probado en el navegador con el XML real, en claro y en oscuro.
  - **Hallazgo:** el XML que baja del facturador del SRI es la `<factura>` firmada sin `<autorizacion>`.
  - **Pendiente:** la vista móvil a 390 px no se pudo revisar (la ventana no cambió de tamaño).
  - La lista ya no tiene el envío rápido por fila: se envía desde la ficha.
- **2026-11-27, A2 + A3 hechos:**
  - **A2:** `reconcile.ts` + `ReconcileInvoiceDialog`. Probado con la factura local: detectó 6 diferencias y aplicó 3 elegidas.
  - **A3:** `lib/sri/ride.ts` (unpdf), `lib/sri/ws.ts` y las acciones `analyzeInvoiceRide`, `analyzeAccessKey` y `verifyWithSri`. Probado con el RIDE real y con una clave pegada. Se detectó el duplicado y se deshabilitó «Registrar».
  - **Hallazgos del SRI**, consultados en vivo:
    - El WS de autorización no devuelve las facturas del facturador web (0 comprobantes).
    - `ConsultaComprobante` rechaza las facturas antiguas («fuera del rango»).
    - Hay cortes intermitentes; se pusieron un timeout de 5 s y 1 reintento.
    - Detalle en `docs/runbooks/facturas-lectura-sri.md`.
  - 113 tests en verde.
  - **Pendientes:** probar el RIDE contra el build de producción con sesión, y la vista móvil.
- **2026-11-27, Fase A desplegada** (`main` 0e54a6d, Vercel en verde).
  - Antes del deploy se probó el RIDE contra el build de producción en local.
  - **Para probar un build de producción en local:** `AUTH_TRUST_HOST=true npx next start -p 3000`. Sin esa variable Auth.js rechaza el host (`UntrustedHost`) y la sesión parece cerrada.
- **2026-11-27, cierre de sesión, estado de B0:**
  - En SRI en línea, la página de solicitud del ambiente de pruebas (`https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet-pruebas/pages/solicitud/menu.jsf`) dice que **ya hay una solicitud en curso** y no deja crear otra.
  - **Para revisarlo:** Sebastián inicia sesión él mismo en SRI en línea (Claude no ingresa claves). Luego Claude lee la pantalla y busca el estado de la solicitud y la «Validación de emisor».
  - **Ojo:** la autorización de oficio debería cubrir pruebas; puede que ya esté habilitado y la «solicitud en curso» sea un trámite viejo.
  - Si no se resuelve, llamar al 1700 774 774.
  - **B1 y B2 no dependen de esto:** se pueden hacer mientras tanto.
- **2026-11-27, B0 revisado** (Claude leyó SRI en línea con la sesión ya abierta por Sebastián; no se ingresó ninguna clave):
  - Solicitud de emisión en **ambiente de pruebas**: al pulsar «Siguiente» el SRI responde «YA TIENE UNA SOLICITUD DE AUTORIZACIÓN APROBADA EN AMBIENTE DE PRUEBAS». **Pruebas ya está habilitado**; la «solicitud en curso» era eso.
  - **Validación de emisor** (`comprobantes-electronicos-internet/publico/validezEmisor.jsf`) con el RUC 0104885694001: aparece como emisor autorizado, fecha de autorización **13/05/2026 10:25**, Azuay, Cuenca.
  - Siguen abiertos B0.2 (¿001-002 sin registro aparte?) y B0.3 (contador).
- **2026-11-27, B1 hecho** (rama `feat/sri-b1-modelo`, 3 commits):
  - Migración aditiva `20261127230000_sri_emission_model`: `EmissionPoint` (uno por ambiente, contador propio), `Invoice.source/sriStatus/environment/emissionPointId/sequential/authorizedAt`, `InvoiceItem`, `SriSubmission`, `TaxProfile.sriRegime`.
  - CHECK en BD: una factura `ISSUED` siempre tiene ambiente, punto, secuencial y estado; `(punto, secuencial)` es único. Se siembra solo `001-002` en **PRUEBAS**; el de producción se crea a propósito en B7.
  - `lib/sri/emission.ts`: `takeSequential` (bloquea el punto dentro de la transacción de la factura; rechaza punto de otro ambiente) y `getSriTaxContext(día)` (rechaza emitir si no hay perfil vigente o no tiene régimen SRI).
  - `TaxProfile.regime` era texto libre, así que se agregó `sriRegime` (enum) con selector en el diálogo de Impuestos. La leyenda sale de `lib/sri/regime.ts`.
  - Probado contra la BD local: 20 emisiones concurrentes dan 1..20 sin huecos ni duplicados, un rollback devuelve el número, el CHECK y el único funcionan.
  - **Pendiente:** probar el selector de régimen en el navegador (claro/oscuro). El `next dev` que estaba corriendo tenía el cliente Prisma viejo («error de la base de datos» al guardar); hay que reiniciarlo.
  - **Al desplegar:** en producción, editar la vigencia actual en Finanzas › Impuestos y elegir «RIMPE · Negocio Popular»; sin eso VeegHub no emite.
- **2026-11-27, B2 hecho** (rama `feat/sri-b2-xml`, sobre B1, 2 commits):
  - `lib/sri/build-invoice.ts` (`buildInvoiceXml`), `lib/sri/emitter.ts` (emisor tal como en el RUC: razón social apellidos primero) y `buildAccessKey` en `access-key.ts`.
  - Cantidad × precio exacto con BigInt (6 decimales), un solo redondeo por línea; IVA por tarifa sobre la base sumada. Formatos como el facturador: `cantidad`/`precioUnitario`/`descuento` cortos («1»), totales con 2 decimales, `tarifa` «0.0».
  - **Test de oro en verde:** con los datos de la factura de mayo da el mismo `<factura>` (sin firma) y la misma clave. 12 tests del constructor; 127 en total.
  - **Riesgo a verificar en `celcer` (B3/B7):** el IVA de cada línea se redondea por separado y el total por tarifa sobre la suma, así que pueden diferir en 1 centavo con varias líneas gravadas. Si el SRI devuelve error 52, cambiar a total = suma de líneas.
  - **Sin validar contra el XSD oficial:** no se descargó `factura_V1.1.0.xsd`. Validarlo con `xmllint` antes de B3 ahorra errores 35.

