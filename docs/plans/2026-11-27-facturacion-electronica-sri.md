# Plan: Facturación electrónica SRI

**Creado:** 2026-11-27
**Estado:** 🟢 Fase A en producción. B1 a B6 hechos y probados en ramas sin desplegar (2026-11-27). **Siguiente:** B7, la campaña en `celcer` y el paso a producción (requiere B0.2/B0.3 con el contador).
**Ramas:** una por subfase (`feat/sri-a1-lector-xml`, `feat/sri-b2-xml`, …) → `develop` → `main`. Las de la Fase B van apiladas, cada una sobre la anterior, hasta que se despliegue el lote.

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
| **B2** | Generador de XML factura 1.1.0 + clave de acceso + cálculo de totales | B1 | ✅ rama `feat/sri-b2-xml` (sobre B1), validado contra el XSD oficial, sin desplegar |
| **B3** | Firma XAdES-BES con el `.p12` (custodia cifrada) | B2 | ✅ rama `feat/sri-b3-firma` (sobre B2), AUTORIZADO en `celcer`, sin desplegar |
| **B4** | Cliente SRI: recepción, autorización, reintentos y máquina de estados | B3 | ✅ rama `feat/sri-b4-envio` (sobre B3), campaña 7/7 en `celcer`, sin desplegar |
| **B5** | RIDE en PDF (Anexo 2 de la ficha) con el estilo de `lib/pdf` | B2 | ✅ rama `feat/sri-b5-ride` (sobre B4), sin desplegar |
| **B6** | Pantalla «Emitir factura» desde hitos, detalle con línea de tiempo, envío XML+RIDE | B4, B5 | ✅ rama `feat/sri-b6-emitir` (sobre B5), 2 facturas AUTORIZADAS en `celcer` desde la pantalla, sin desplegar |
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
4. **El `.p12` y su clave viven cifrados** (AES-256-GCM) y la llave (`SRI_CERT_KEY`) está en una variable *Sensitive* de Vercel. La clave se escribe una sola vez, al subir el `.p12` en la pantalla, para poder renovar la firma sin tocar Vercel. Así lo pidió Sebastián el 2026-11-27; antes la clave iba en `SRI_CERT_PASSWORD`.
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
  - **Sin validar contra el XSD oficial:** no se descargó `factura_V1.1.0.xsd`. Validarlo con `xmllint` antes de B3 ahorra errores 35. → Resuelto abajo.
- **2026-11-27, XSD oficial** (rama `feat/sri-b2-xml`):
  - Se bajó el ZIP «XML y XSD Factura» de sri.gob.ec (feb-2022) y se guardó `factura_V1.1.0.xsd` en `lib/sri/xsd/`.
  - **Hallazgo:** el XSD publicado solo acepta la leyenda «CONTRIBUYENTE RÉGIMEN RIMPE». La factura real de mayo, con la de Negocio Popular, sí fue autorizada, así que el SRI valida con un XSD más nuevo que el que publica. La copia local acepta las dos leyendas.
  - El ZIP no trae `xmldsig-core-schema.xsd`. Se puso un sustituto que valida documentos sin firmar.
  - Seis variantes del constructor validan con `xmllint`.
- **2026-11-27, B1 probado en el navegador:** con `next dev` reiniciado, el selector de régimen guarda y precarga, en claro y en oscuro.
- **2026-11-27, B3 hecho en código** (rama `feat/sri-b3-firma`, 6 commits). Guía de uso: `docs/runbooks/facturas-emision-sri.md`.
  - **Custodia:** `SriCertificate` guarda el `.p12` cifrado con AES-256-GCM bajo `SRI_CERT_KEY`, sin llave por defecto. Solo puede haber uno activo. La clave del archivo vive solo en `SRI_CERT_PASSWORD`.
  - **Registro:** `SriSigningEvent` guarda una fila por cada firma.
  - **Pantalla:** tarjeta «Firma electrónica» en Finanzas › Impuestos. Muestra titular, emisor y caducidad, con aviso 30 días antes. La subida solo envía el archivo.
  - **Recepción:** `sendToReception` en `ws.ts`. No se reintenta (§3.6).
  - **Smoke contra `celcer`:** con un `.p12` autofirmado salió `RECIBIDA` y luego `NO AUTORIZADO [39]` por la cadena de confianza. El XML, el envío y la lectura de la respuesta funcionan; solo falta una firma real.
  - **Tests:** 145 en verde. La firma se verifica con `xml-crypto`, se rompe si cambia la factura y el documento firmado pasa el XSD.
  - **Cambio el mismo día (pedido de Sebastián):** la clave del `.p12` ya no va en `SRI_CERT_PASSWORD`. Se escribe al subir el archivo y se guarda cifrada junto a él (migración `20261127250000_sri_certificate_password`). Así renovar la firma es subir el archivo nuevo con su clave.
    - Verificado con un script contra la BD local: con una clave equivocada no se guarda nada; con la correcta se guarda y firma sin ninguna variable de clave.
    - No se pudo probar la subida desde el navegador: la herramienta no sube archivos `.p12` por política, así que esa prueba la hace Sebastián.
  - **Para cerrar B3:** subir el `.p12` con su clave en Finanzas › Impuestos (Sebastián), correr `npx tsx scripts/sri-smoke.ts` y esperar `AUTORIZADO`. `SRI_CERT_KEY` local ya está en `.env`.
  - **Al desplegar:** crear `SRI_CERT_KEY` como variable *Sensitive* en Vercel y subir el `.p12` en producción.
- **2026-11-27, B3 cerrado con la firma real:**
  - Sebastián subió su `.p12` con su clave en Finanzas › Impuestos (local).
  - La tarjeta muestra: titular CHRISTIAN SEBASTIAN VELEZ PALOMEQUE, emisor «AUTORIDAD DE CERTIFICACION SUBCA-2 SECURITY DATA», vigente hasta el **4 may 2027**. Se revisó en claro y en oscuro.
  - `npx tsx scripts/sri-smoke.ts`: factura `001-002-000000002` (PRUEBAS, USD 1,00, consumidor final, leyenda Negocio Popular) → XSD ✔ → **RECIBIDA** → **AUTORIZADO**. Clave `2711202601010488569400110010020000000022371751917`. Sin error 39 ni 52.
  - Quedó una fila en `SriSigningEvent` (`smoke-test`, PRUEBAS).
  - **Detalle:** el `serialNumber` del certificado de Security Data trae la cédula más un sufijo (`0104885694-…`), y así se muestra.
  - El secuencial 001 de pruebas se consumió en la prueba con el certificado autofirmado (NO AUTORIZADO, error 39).
- **2026-11-27, B4 hecho** (rama `feat/sri-b4-envio`, sobre B3, 9 commits):
  - **Modelo:** `Invoice.sriXml` guarda los bytes exactos que se envían, `sriAuthorizedXml` la respuesta del SRI, y además `sriAttempts`, `sriNextAttemptAt`, `sriLeaseUntil` y `sriLastError`.
  - **Reglas puras** (`lib/sri/state.ts`, con tests):
    - 43 y 70 en recepción significan que el SRI ya tiene el documento: se pasa a consultar la autorización.
    - Si un envío no tuvo respuesta, se consulta la autorización antes de reenviar, y solo se reenvía si el SRI no tiene registro.
    - Los reintentos esperan cada vez más: 30 s, 1, 2, 5, 10 y 30 min, y luego cada hora.
  - **Máquina** (`lib/sri/issue.ts`):
    - `createIssuedInvoice` crea el borrador con el secuencial, los ítems y el XML en una sola transacción.
    - `advanceInvoice` firma, envía y consulta la autorización. Usa un lease para que dos procesos no avancen la misma factura y registra cada llamada en `SriSubmission`.
    - Producción se rechaza salvo `SRI_ALLOW_PRODUCTION=true`, que no se define hasta B7.
  - **Revisión interna antes de firmar y antes de cada envío** (`lib/sri/self-check.ts`): relee el XML y exige que cuadren los totales, la aritmética de cada línea, la clave y el ambiente.
  - **Hallazgo: `celcer` no valida la aritmética.** El 2026-11-27 autorizó:
    - un total de USD 2,00 sobre una base de USD 1,00;
    - una línea de 1 × 5,00 declarada como 1,00;
    - una fecha de emisión de hace 40 días;
    - una cédula con dígito verificador inválido.

    En pruebas no se puede provocar el error 52. La revisión interna es la única barrera, y está probada en la campaña.
  - **Cron:** va dentro de `/api/cron/marketing` (el Worker de Cloudflare, cada 15 min), antes de la sincronización de Meta para no quedarse sin tiempo. Retoma las facturas firmadas o recibidas cuyo siguiente intento ya venció. Nunca empieza una emisión.
  - **Ficha de factura:** tarjeta «SRI» con el estado, el ambiente, el último problema, el próximo intento, el historial de llamadas y el botón contextual («Reintentar envío» o «Consultar autorización»). Se probó en el navegador: una factura con envío perdido pasó por ERROR → SIN REGISTRO → RECIBIDA → **AUTORIZADO** con un clic. Revisada en claro y en oscuro.
  - **Facturas emitidas no editables:** «Editar» y «Comparar» las rechazan en el servidor y se ocultan en la ficha.
  - **Campaña** (`npx tsx scripts/sri-campaign.ts`, 7/7):
    1. autorizada;
    2. clave repetida (43) que se resuelve sin crear un documento nuevo;
    3. devuelta por estructura (35);
    4. cálculos frenados por la revisión interna;
    5. envío sin respuesta y luego recuperado;
    6. dos procesos a la vez;
    7. bloqueo de producción.

    Las facturas de prueba quedan en la BD local con el cliente «Cliente de pruebas SRI».
  - 159 tests en verde.
  - **Pendiente para B6:**
    - al autorizar, adjuntar el XML autorizado como archivo de la factura y ligar los hitos de los ítems;
    - cambiar los textos de la ficha que mencionan «Editar» en facturas emitidas;
    - validar la cédula o el RUC del comprador, porque producción puede exigirlo aunque `celcer` no lo haga.
- **2026-11-27, B5 hecho** (rama `feat/sri-b5-ride`, sobre B4, 4 commits):
  - **RIDE** en `lib/pdf/ride.tsx`, armado **desde el XML de la factura**, igual que el facturador del SRI. Tiene:
    - caja del emisor (logo, razón social, nombre comercial, dirección matriz, obligado a contabilidad, leyenda RIMPE);
    - caja del documento (RUC, número, autorización, fecha y hora, ambiente, emisión, clave en Code 128 y en texto);
    - comprador, detalle, información adicional y forma de pago;
    - subtotales por tarifa: 15 %, 0 %, no objeto, exento, sin impuestos, descuento, IVA, propina y total.
  - **Vista previa:** si la factura no está autorizada, el RIDE lleva arriba «VISTA PREVIA · SIN AUTORIZACIÓN DEL SRI · SIN VALOR TRIBUTARIO». B6 la usará antes de «Emitir».
  - **Código de barras:** `bwip-js` (JS puro, MIT), importado como `bwip-js/node`.
  - El lector del XML ahora también lee la dirección del establecimiento, si lleva contabilidad y las formas de pago.
  - **Ruta:** `/admin/facturas/[id]/ride` (`?download=1` para descargar). En la tarjeta SRI de la ficha están «Ver RIDE» o «Vista previa», y «Descargar».
  - **Probado así:**
    - se revisaron como imagen el RIDE de la factura real de mayo, uno de pruebas autorizado y uno de varios ítems al 15 % y 0 % con descuento;
    - la ruta funciona en dev y en el **build de producción** (`next build` + `next start`);
    - la tarjeta se revisó en claro y en oscuro.
  - 162 tests en verde.
- **2026-11-27, diseño acordado para B6** (con Sebastián): un facturador normal y sencillo, con las convenciones de diseño.
  - **Entradas:** «Nueva factura» en Facturas, y «Facturar» en el hito o el proyecto, que precarga cliente, concepto y valor.
  - **Una sola pantalla:**
    - cliente y comprador editables;
    - ítems con agregar y quitar, y código, concepto, cantidad, precio, descuento e IVA editables;
    - forma de pago e información adicional;
    - totales en vivo, calculados con el mismo código que firma.
  - **Catálogo de productos y servicios** reutilizable.
  - **Al emitir:** vista previa del RIDE → «Emitir» con confirmación (ambiente, número y total) → progreso en vivo → «Enviar al cliente» con el XML y el RIDE.
- **2026-11-27, cierre de sesión. Para retomar B6:**
  - **Ramas** (cada una sobre la anterior, ninguna fusionada ni desplegada): `feat/sri-b1-modelo` → `feat/sri-b2-xml` → `feat/sri-b3-firma` → `feat/sri-b4-envio` → `feat/sri-b5-ride`. Todas rebasadas sobre `develop` (9414172). B6 sale de `feat/sri-b5-ride`.
  - **Entorno local:**
    - `.env` tiene `SRI_CERT_KEY`.
    - La firma real de Security Data (vigente hasta el 4 may 2027) está subida en la BD local.
    - El TaxProfile local es «RIMPE Negocio Popular» desde el 2026-01-01, con IVA 0 %.
    - El punto 001-002 de PRUEBAS va por el secuencial ~20.
    - Las facturas de prueba están con el cliente «Cliente de pruebas SRI».
  - **Migraciones nuevas** (aditivas, todavía sin aplicar en producción): `20261127230000_sri_emission_model`, `20261127240000_sri_certificate`, `20261127250000_sri_certificate_password` y `20261128000000_sri_issuing_state`.
  - **Al agregar modelos de Prisma**, hay que reiniciar `next dev`.
  - **Pendientes de B4 que se resuelven en B6:**
    - al autorizar, adjuntar el XML autorizado y el RIDE como archivos de la factura (hoy la ficha dice «XML autorizado · pendiente de subir»);
    - ligar los hitos de los ítems (`InvoiceItem.receivableId` → `Receivable.invoiceId` + `syncInvoicePaidStatus`);
    - quitar o adaptar los textos «usa Editar» en las facturas emitidas;
    - validar la cédula (módulo 10) y el RUC del comprador.
  - **Antes de B7 (producción):**
    - confirmar con el contador B0.2 (si 001-002 necesita registro) y B0.3 (NAC-DGERCGC26-00000027);
    - crear `SRI_CERT_KEY` en Vercel y subir el `.p12` en producción;
    - crear el `EmissionPoint` de PRODUCCION;
    - definir `SRI_ALLOW_PRODUCTION=true` solo entonces.
  - **También pendiente** (fuera del SRI): pasar el margen de Egresos a «margen cobrado». El análisis está hecho (calc.ts:287); falta implementarlo.
- **2026-11-27, B6 hecho** (rama `feat/sri-b6-emitir`, sobre B5, 7 commits):
  - **Cálculo compartido:** `computeInvoiceTotals` pasó a `lib/sri/invoice-calc.ts`, sin imports de Node. La pantalla muestra los totales en vivo con el mismo código que firma; `buildInvoiceXml` lo usa y el test de oro sigue en verde.
  - **Identificación:** `lib/sri/identification.ts` valida cédula (módulo 10) y RUC (persona natural = cédula + establecimiento; sociedades módulo 11). Un RUC de sociedad que no cuadra con módulo 11 solo **avisa**, porque el SRI ha entregado RUC así. Se valida en la pantalla y en el servidor (`resolveIssueRequest`), no en el constructor: el XML de oro usa una cédula anonimizada.
  - **Catálogo:** modelo `CatalogItem` (migración `20261128010000_catalog_items`) y página Facturas › Productos y servicios (crear, editar, archivar). La factura copia los valores.
  - **Pantalla** `/admin/facturas/nueva`:
    - cliente y comprador editables (con «Guardar estos datos en el cliente»), ítems con código, concepto, cantidad, precio, descuento e IVA de las tarifas vigentes, «Del catálogo» e «Hito pendiente», forma de pago e información adicional (el email va como campo «Email»);
    - panel con ambiente, número siguiente, fecha y totales;
    - «Revisar y emitir» → RIDE de vista previa (ruta `nueva/vista-previa`, arma el XML con el siguiente secuencial **sin tomarlo**) + ambiente, número y total → «Emitir en pruebas» → progreso en vivo (firmando, enviando, esperando autorización, guardando XML y RIDE) → «Enviar al cliente» con `SendInvoiceForm`.
    - El progreso se consulta en `/admin/facturas/[id]/estado` (route handler): el cliente ejecuta las server actions de una en una, así que no se puede sondear con otra acción mientras corre `sendIssued`.
  - **Entradas:** «Nueva factura» en Facturas (el registro por XML quedó como «Registrar del SRI»); «Facturar» en un hito abre un menú (Emitir factura / Registrar del SRI); «Facturar» en la cabecera del proyecto (precarga cliente, nombre y saldo del presupuesto); «Emitir factura» en la ficha del cliente.
  - **Al autorizar** (`lib/sri/finalize.ts`, llamado por `advanceInvoice` y reintentado por el cron): guarda el `<autorizacion>` del SRI como XML de la factura y el RIDE autorizado, y liga los hitos de los ítems con `syncInvoiceReceivables` + `syncInvoicePaidStatus`. Si falla (p. ej. R2), queda «Autorizada, pero no se pudieron guardar…» y el cron lo reintenta.
  - **Decisión (regla de oro):** una factura de **PRUEBAS no liga hitos** ni los reserva, y **no suma** en los KPIs de Facturas, reportes, resumen financiero, su exportación ni el dashboard (`REAL_INVOICES`). Se listan con la etiqueta «Pruebas». Antes de este cambio las facturas de la campaña B4 inflaban «Facturado en 2026». El ligado se probó en pruebas antes de restringirlo (hito → INVOICED) y después se deshizo.
  - **Ficha:** los textos «usa Editar» se adaptaron para las emitidas; la lista ya no muestra «Editar» en ellas.
  - **Probado en `celcer` desde el navegador:**
    - `001-002-000000020`: cédula 1710034065, 2 ítems (hito de USD 1,50 y producto del catálogo 0,5 × 45 con descuento de 2,25), total USD 21,75 → **AUTORIZADO**; XML `<autorizacion>` y RIDE guardados en R2.
    - `001-002-000000021`: consumidor final, desde «Facturar» de un hito, USD 2,00 → **AUTORIZADO**.
    - Cédula inválida bloquea «Revisar y emitir»; menú «Facturar» y «Registrar del SRI» con el hito precargado; claro y oscuro; ancho de 500 px (la ventana no baja más) sin desbordes.
    - Cron: finalizó 3 facturas autorizadas de la campaña B4 que no tenían XML ni RIDE.
  - **No probado:** «Enviar factura» por correo (no se envió ningún email sin permiso); el ligado de hitos en PRODUCCION (solo existe el punto de pruebas); `next build`.
  - 171 tests en verde.
  - **Pendientes:** la vista a 390 px real; la línea de tiempo de `SriSubmission` es la de B4 (tarjeta SRI), sin cambios.

