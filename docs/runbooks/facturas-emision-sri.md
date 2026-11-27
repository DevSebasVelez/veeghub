# Emisión de facturas electrónicas (Fase B)

Lo que VeegHub necesita para emitir facturas propias. Plan completo y bitácora: `docs/plans/2026-11-27-facturacion-electronica-sri.md`.

> **Regla de oro:** nada llega al SRI de producción sin un clic humano de «Emitir». Todo lo de esta guía apunta a `celcer` (pruebas).

## Piezas

| Archivo | Qué hace |
|---|---|
| `lib/sri/invoice-calc.ts` | Aritmética de la factura (líneas, IVA por tarifa, totales), sin Node: la usan la pantalla y el constructor |
| `lib/sri/build-invoice.ts` | Arma el XML `factura` 1.1.0 sin firmar: totales en centavos, clave de acceso, leyenda RIMPE |
| `lib/sri/identification.ts` | Cédula (módulo 10) y RUC del comprador |
| `lib/sri/issue-request.ts` | Valida lo que manda la pantalla «Nueva factura» (cliente, proyecto, punto, hitos, identificación) |
| `lib/sri/finalize.ts` | Al autorizar: guarda XML autorizado y RIDE como archivos y liga hitos (solo PRODUCCION) |
| `lib/sri/emitter.ts` | El emisor tal como figura en el RUC (razón social con los apellidos primero, dirección matriz) |
| `lib/sri/regime.ts` | Leyenda `contribuyenteRimpe` de cada régimen |
| `lib/sri/emission.ts` | Toma el secuencial del punto de emisión y lee el régimen y el IVA del `TaxProfile` vigente |
| `lib/sri/certificate.ts` | Cifra y descifra el `.p12` y lee titular, emisor y vigencia |
| `lib/sri/signing.ts` | Firma XAdES-BES (`ec-sri-invoice-signer`) y registra cada firma en `SriSigningEvent` |
| `lib/sri/ws.ts` | Recepción (`validarComprobante`), autorización (`queryAuthorization`) y consulta de estado |
| `lib/sri/state.ts` | Reglas puras de la máquina de estados |
| `lib/sri/self-check.ts` | Revisión interna del XML antes de firmar y de cada envío |
| `lib/sri/issue.ts` | Crear la factura emitida, avanzarla ante el SRI y procesar las pendientes (cron) |
| `lib/pdf/ride.tsx` | RIDE en PDF armado desde el XML; si no está autorizada, sale como vista previa sin valor tributario |
| `app/admin/facturas/[id]/ride` | Ruta del RIDE (`?download=1` para descargar) |
| `app/admin/facturas/nueva` | Pantalla «Nueva factura»; `vista-previa` arma el RIDE sin tomar secuencial |
| `app/admin/facturas/[id]/estado` | Estado SRI para el progreso en vivo de «Emitir» |
| `app/admin/facturas/catalogo` | Catálogo de productos y servicios (`CatalogItem`) |
| `lib/sri/xsd/` | XSD oficial de la factura 1.1.0, con dos ajustes documentados en los archivos |
| `scripts/sri-smoke.ts` | Prueba de punta a punta contra `celcer`, sin crear factura |
| `scripts/sri-campaign.ts` | Campaña de B4 contra `celcer` con la máquina real (`SRI_CAMPAIGN_ONLY=1,3` para correr solo algunos casos) |

## Configurar la firma electrónica

1. Variable del servidor `SRI_CERT_KEY`: la llave de cifrado, 32 bytes en base64 (`openssl rand -base64 32`).
   - En Vercel va como *Sensitive*; en local, en `.env`.
   - **No tiene valor por defecto.** Si cambia, la firma guardada ya no se puede descifrar y hay que volver a subirla.
2. Subir el `.p12` **con su clave** en **Finanzas › Impuestos › Firma electrónica**.
   - Antes de guardar, VeegHub abre el archivo con esa clave y hace una firma de prueba. Si algo falla, avisa y no guarda nada.
   - El archivo y la clave se guardan cifrados con `SRI_CERT_KEY`, cada uno con su propio IV y su propio AAD. La clave no se vuelve a mostrar ni se devuelve al navegador.
   - La clave nunca se escribe en un chat.
3. Queda una sola firma activa: para renovarla basta subir la nueva con su clave, y la anterior deja de usarse. La tarjeta avisa 30 días antes de que caduque.
4. Elegir el régimen para la factura electrónica en la vigencia actual de Impuestos. Sin régimen, VeegHub no emite.

## Probar contra `celcer`

```bash
npx tsx scripts/sri-smoke.ts     # con la firma subida en VeegHub
```

Para probar un archivo antes de subirlo, pon `SRI_P12_PATH` y `SRI_P12_PASSWORD` en `.env`. No los pases en la línea de comandos, porque quedan en el historial de la terminal.

El script:
1. Emite una factura de USD 1,00 a consumidor final desde el punto 001-002 de PRUEBAS. Consume un secuencial de pruebas.
2. La firma y la valida contra el XSD.
3. La envía a recepción y consulta la autorización.

El ambiente está fijo en el código. Imprime la respuesta del SRI y la ruta del XML firmado. Nunca imprime la clave.

**Resultado esperado con la firma real:** `RECIBIDA`, y después `AUTORIZADO`.

Con un certificado autofirmado sale `RECIBIDA` y luego `NO AUTORIZADO [39] FIRMA INVALIDA` («no existe un certificado root registrado»). Eso confirma que el XML y el circuito están bien y que solo falla la firma. Verificado el 2026-11-27.

## Ciclo de una factura emitida

```
DRAFT ─firma→ SIGNED ─recepción→ RECEIVED ─autorización→ AUTHORIZED
                 │                    │                  └→ NOT_AUTHORIZED
                 └→ RETURNED          └ (en proceso: se vuelve a consultar)
```

- **Antes de firmar y antes de cada envío** corre la revisión interna (`self-check`): totales, aritmética de cada línea, clave y ambiente. Si algo no cuadra, no sale nada y la ficha dice «Revisión interna: …».
- **Recepción sin respuesta:** la factura queda en SIGNED. En el siguiente intento se consulta la autorización primero y solo se reenvía si el SRI no tiene registro. Siempre se reenvían los mismos bytes (`Invoice.sriXml`) con la misma clave.
- **43 o 70 en recepción:** el SRI ya tiene el documento, así que se pasa a consultar la autorización.
- **Quién la empuja:**
  - el botón de la tarjeta «SRI» en la ficha;
  - el cron de marketing (`/api/cron/marketing`, cada 15 min), que procesa hasta 5 facturas en 20 s.

  Un lease de 90 s impide que dos procesos avancen la misma factura.
- **Producción** está bloqueada en el código salvo `SRI_ALLOW_PRODUCTION=true`. No se define hasta el paso a producción (B7).
- **Al autorizar:** se guardan el `<autorizacion>` (XML autorizado) y el RIDE como archivos de la factura y, solo en PRODUCCION, se ligan los hitos de sus ítems. Si falla, el cron lo reintenta.
- **Pruebas no se mezcla:** las facturas de PRUEBAS se listan con etiqueta pero no suman en cifras, reportes ni exportaciones (`REAL_INVOICES`) y no ligan ni reservan hitos.
- **Facturas emitidas:** no se editan ni se «comparan». Sus datos son los del XML firmado; una corrección es una nota de crédito (B8).

## Lo que hay que saber

- **`celcer` no valida la aritmética** (verificado el 2026-11-27): autorizó un total que no cuadraba, una línea mal multiplicada, una fecha de hace 40 días y una cédula inválida. Una autorización en pruebas no prueba que los cálculos estén bien; los protege la revisión interna y los tests.

- **XSD publicado vs. real:** el ZIP del SRI (feb-2022) solo acepta la leyenda «CONTRIBUYENTE RÉGIMEN RIMPE». El SRI autoriza la de Negocio Popular, así que la copia local acepta las dos. El ZIP tampoco trae `xmldsig-core-schema.xsd`. En su lugar hay un sustituto que sirve para validar XML sin firmar.
- **La recepción no se reintenta.** Si vence el tiempo, el resultado es incierto. Antes de reenviar se consulta la autorización: un reenvío con la misma clave devuelve el error 43.
- **Los tests no llaman al SRI** y usan un `.p12` autofirmado que se genera en el momento. La validación con el XSD se salta si la máquina no tiene `xmllint`.
- **`next dev` y migraciones:** si se agregan modelos de Prisma con el servidor corriendo, hay que reiniciarlo. Si no, el cliente Prisma viejo falla con «Cannot read properties of undefined».
