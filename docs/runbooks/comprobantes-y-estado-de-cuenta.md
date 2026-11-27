# Comprobantes de pago y estado de cuenta

Dos PDF que salen del panel sin pasar por el SRI. **No son comprobantes de venta**: los dos lo dicen en el pie.

| Documento | Dónde | Ruta |
|---|---|---|
| Comprobante de pago (uno por `Payment`) | Icono de recibo en cada fila de pagos: Cobros → Pagos, ficha del cliente, ficha del proyecto | `GET /admin/finanzas/pagos/[id]/comprobante` |
| Estado de cuenta (por cliente) | Botón **Estado de cuenta** en la ficha del cliente | `GET /admin/clientes/[id]/estado-de-cuenta?desde&hasta&todo=1&proyecto` |
| Estado de cuenta del proyecto | Botón **Estado de cuenta** en la ficha del proyecto (solo si el proyecto tiene cliente) | `GET /admin/proyectos/[id]/estado-de-cuenta?desde&hasta&todo=1` |

Las dos rutas aceptan `?download=1` para forzar la descarga. Sin ese parámetro el PDF se abre en el navegador. El envío por email (Resend) está en `lib/admin/actions/receipts/actions.ts` y deja una fila en `EmailDelivery` con `kind` = `RECEIPT` o `STATEMENT`.

## Folio del comprobante

- Formato `RC-AAAA-NNNN`. El contador vive en `DocumentSequence` (`key = "RC-2026"`), con una fila por año.
- El folio se asigna **la primera vez** que se emite el comprobante, sea al verlo, descargarlo o enviarlo. Ver el PDF también cuenta como emitirlo. Las emisiones siguientes reutilizan el mismo número (`Payment.receiptFolio`).
- `ensureReceiptFolio` incrementa el contador y escribe el folio en una sola transacción. Si dos peticiones emiten a la vez, la que pierde revierte su incremento y usa el folio de la otra.
- Si se borra un pago, su número no se reutiliza. Queda un hueco y eso es intencional.

## Saldo del hito en el comprobante

Es el saldo **a la fecha de ese pago**, no el saldo de hoy. Se calcula sumando los pagos anteriores del mismo hito, ordenados por `paidAt` y luego por `createdAt`. Así, el comprobante de un primer abono dice lo mismo aunque se vuelva a emitir meses después. Las retenciones se toman del hito tal como están ahora.

## Estado de cuenta

- **Pagos recibidos**: los pagos del cliente cuyo `paidAt` cae dentro del periodo. Por defecto el periodo va del 1 de enero a hoy. Con `todo=1` empieza en el primer pago.
- **Pendiente de pago**: todos los hitos que no están en `PAID` ni en `CANCELLED` y tienen saldo, **sin importar el periodo**. El corte es hoy, en hora de Guayaquil.
- Los días vencidos se calculan entre `dueDate` (`@db.Date`, medianoche UTC) y el día de hoy, también en medianoche UTC. Más detalle en `fechas-y-zona-horaria.md`.
- No lleva datos bancarios (decisión del 2026-11-27).

## Estado de cuenta del proyecto

Es el mismo documento acotado a un proyecto (`getAccountStatementData` con `projectId`), con una vista del proyecto entero en `projectSummary` (`lib/admin/receipts/project-summary.ts`, con tests):

- **Cifras:** valor del proyecto (suma de sus hitos, sin los `CANCELLED`), pagado (`paidAmount`), retenido (`withheldAmount`) y saldo pendiente, con lo vencido aparte.
- **Hitos del proyecto:** todos los hitos no cancelados, pagados o no, con vencimiento, factura, valor, cubierto (pagado + retenido) y saldo. Reemplaza la tabla «Pendiente de pago».
- **Estado de cada hito:** se calcula al corte con sus cifras, no se toma de `Receivable.status`. Saldo 0 → Pagado; saldo con vencimiento pasado → Vencido; algo cubierto → Abonado; si no → Pendiente.
- **Pagos recibidos:** los del periodo, igual que en el del cliente. Sin `desde`/`hasta` la ruta del proyecto toma **todo el proyecto** (desde el primer pago), y el diálogo abre en «Todo».
- El código es `EC-AAAAMMDD-XXXX` con los últimos 4 caracteres del id del **proyecto**, y el archivo se llama `Estado-de-cuenta-<cliente>-<proyecto>-<día>.pdf`.
- En la ficha del cliente, elegir un proyecto en el selector produce este mismo formato.
- El email usa las cifras del proyecto. Deja `EmailDelivery` con `kind = STATEMENT` y el `clientId` del cliente.

## Datos del emisor

Están en `lib/company.ts`. Un campo en `null` simplemente no se imprime.

## Detalles de react-pdf

- Las fuentes Geist (TTF) y el logo recortado están en `lib/pdf/fonts` y `lib/pdf/assets`. Se incluyen en el bundle de `/admin/**` mediante `outputFileTracingIncludes` en `next.config.ts`.
- **No pongas `lineHeight` en la página** ni en un texto con `render`: react-pdf borra el texto dinámico (el número de página) cuando hereda un `lineHeight`. Los textos de varias líneas usan `LEADING` por su cuenta, con `fontSize` explícito.
- Para previsualizar sin levantar el servidor, renderiza a archivo con `tsx` y conviértelo con `pdftoppm -png`.
