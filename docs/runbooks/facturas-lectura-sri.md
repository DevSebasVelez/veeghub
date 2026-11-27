# Lectura de facturas del SRI (XML, RIDE y clave)

Al registrar una factura emitida en el facturador del SRI, VeegHub completa los datos a partir del documento. Plan completo: `docs/plans/2026-11-27-facturacion-electronica-sri.md`.

## Tres formas de entrada, un mismo resultado

| Entrada | Qué se obtiene | Confianza |
|---|---|---|
| **XML autorizado** (recomendado) | Número, fecha, clave, subtotal, IVA y tarifa, total, comprador, ítems, leyenda RIMPE | Total: es la fuente de verdad |
| **RIDE (PDF)** | La clave (49 dígitos con DV) y, de ahí, número, fecha y ambiente. Además comprador, subtotal, IVA y total leídos del texto | Clave segura; montos «confírmalos» |
| **Clave pegada** | Número, fecha y ambiente | Montos y cliente a mano |

En los tres casos (`lib/admin/actions/invoices/documents.ts`):
1. Con el RIDE o la clave se pide antes el XML autorizado al SRI (`AutorizacionComprobantesOffline`). Si el SRI lo entrega, se guarda y se adjunta a la factura: **queda como si se hubiera subido el XML**.
2. Se busca el cliente por RUC o cédula. El RUC de una persona natural es su cédula + `001`, así que se prueban las dos formas.
3. Se bloquea si la clave ya está en otra factura (en el diálogo y al guardar).
4. Después de llenar el formulario, y sin bloquearlo, se consulta el estado en el SRI (`ConsultaComprobante`), que se muestra como etiqueta: Autorizada · No autorizada · Sin verificar · SRI sin respuesta.

## Lo que el SRI sí y no entrega (verificado el 2026-11-27)

- El XML que baja del facturador del SRI es la `<factura>` firmada **sin** `<autorizacion>`. En el esquema offline, el número de autorización es la clave.
- `autorizacionComprobante` con la clave de una factura emitida en el facturador web en mayo-2026 devolvió **0 comprobantes**. No se puede contar con descargar el XML de facturas viejas o emitidas en el facturador web. Para esas, el XML se baja de SRI en línea (Comprobantes electrónicos › Consultas).
- `ConsultaComprobante` responde «fecha de emisión fuera del rango permitido» para facturas antiguas: solo verifica facturas recientes.
- El SRI a veces deja una petición colgada mientras la siguiente responde en 100 ms. Por eso `lib/sri/ws.ts` usa un timeout de 5 s y 1 reintento.

## Comparar una factura con su documento

En la ficha de la factura, **«Comparar con el XML»** (o «con el RIDE» si no hay XML) relee el archivo guardado, lista cada dato que difiere (guardado → documento) y corrige solo los que se marquen. Al aplicar se vuelve a leer el documento en el servidor y se re-sincroniza el estado de pago (`syncInvoicePaidStatus`). Si a una factura con documentos le falta la clave, la ficha lo avisa.

## Código

| Archivo | Qué hace |
|---|---|
| `lib/sri/access-key.ts` | Descompone y valida la clave (módulo 11) y la encuentra dentro de un texto |
| `lib/sri/invoice-xml.ts` | Lector del XML en todas sus envolturas (factura sola, `<autorizacion>` con CDATA o escapada, respuesta SOAP) |
| `lib/sri/ride.ts` | Lector del texto del RIDE; acepta el valor antes o después de la etiqueta |
| `lib/sri/ws.ts` | Llamadas SOAP de solo lectura: autorización y consulta de estado |
| `lib/admin/actions/invoices/documents.ts` | Acciones del diálogo: XML, RIDE, clave y verificación |
| `lib/admin/actions/invoices/reconcile.ts` | Comparar y corregir una factura guardada |

`unpdf` va en `serverExternalPackages` (`next.config.ts`): se carga con el `require` de Node, igual que en los tests.

## Pruebas

- `npm test`: fixtures anonimizados de la factura real en `lib/sri/fixtures/` (XML; texto del RIDE según `unpdf` y según `pdftotext -layout`). Las respuestas del SRI se simulan, así que los tests nunca llaman al SRI.
- Los fixtures **no** llevan datos de clientes reales. Si se agrega uno nuevo, se anonimiza el comprador y se quita la firma.
