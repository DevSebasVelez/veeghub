# Emisión de facturas electrónicas (Fase B)

Lo que VeegHub necesita para emitir facturas propias. Plan completo y bitácora: `docs/plans/2026-11-27-facturacion-electronica-sri.md`.

> **Regla de oro:** nada llega al SRI de producción sin un clic humano de «Emitir». Todo lo de esta guía apunta a `celcer` (pruebas).

## Piezas

| Archivo | Qué hace |
|---|---|
| `lib/sri/build-invoice.ts` | Arma el XML `factura` 1.1.0 sin firmar: totales en centavos, clave de acceso, leyenda RIMPE |
| `lib/sri/emitter.ts` | El emisor tal como figura en el RUC (razón social con los apellidos primero, dirección matriz) |
| `lib/sri/regime.ts` | Leyenda `contribuyenteRimpe` de cada régimen |
| `lib/sri/emission.ts` | Toma el secuencial del punto de emisión y lee el régimen y el IVA del `TaxProfile` vigente |
| `lib/sri/certificate.ts` | Cifra y descifra el `.p12` y lee titular, emisor y vigencia |
| `lib/sri/signing.ts` | Firma XAdES-BES (`ec-sri-invoice-signer`) y registra cada firma en `SriSigningEvent` |
| `lib/sri/ws.ts` | Recepción (`validarComprobante`), autorización y consulta de estado |
| `lib/sri/xsd/` | XSD oficial de la factura 1.1.0, con dos ajustes documentados en los archivos |
| `scripts/sri-smoke.ts` | Prueba de punta a punta contra `celcer` |

## Configurar la firma electrónica

1. Variables del servidor. En Vercel van como *Sensitive*; en local, en `.env`:
   - `SRI_CERT_KEY`: llave de cifrado del `.p12`, 32 bytes en base64 (`openssl rand -base64 32`). **No tiene valor por defecto.** Si cambia, la firma guardada ya no se puede descifrar y hay que volver a subirla.
   - `SRI_CERT_PASSWORD`: la clave del `.p12`. Ninguna pantalla la pide y nunca se escribe en un chat.
2. Subir el `.p12` en **Finanzas › Impuestos › Firma electrónica**. Antes de guardar, VeegHub abre el archivo con `SRI_CERT_PASSWORD` y hace una firma de prueba. Si algo falla, avisa y no guarda nada.
3. Queda una sola firma activa: subir otra reemplaza la anterior. La tarjeta avisa 30 días antes de que caduque.
4. Elegir el régimen para la factura electrónica en la vigencia actual de Impuestos. Sin régimen, VeegHub no emite.

## Probar contra `celcer`

```bash
npx tsx scripts/sri-smoke.ts                       # con la firma guardada en VeegHub
SRI_P12_PATH=~/ruta/firma.p12 npx tsx scripts/sri-smoke.ts   # con un archivo
```

El script:
1. Emite una factura de USD 1,00 a consumidor final desde el punto 001-002 de PRUEBAS. Consume un secuencial de pruebas.
2. La firma y la valida contra el XSD.
3. La envía a recepción y consulta la autorización.

El ambiente está fijo en el código. Imprime la respuesta del SRI y la ruta del XML firmado. Nunca imprime la clave.

**Resultado esperado con la firma real:** `RECIBIDA`, y después `AUTORIZADO`.

Con un certificado autofirmado sale `RECIBIDA` y luego `NO AUTORIZADO [39] FIRMA INVALIDA` («no existe un certificado root registrado»). Eso confirma que el XML y el circuito están bien y que solo falla la firma. Verificado el 2026-11-27.

## Lo que hay que saber

- **XSD publicado vs. real:** el ZIP del SRI (feb-2022) solo acepta la leyenda «CONTRIBUYENTE RÉGIMEN RIMPE». El SRI autoriza la de Negocio Popular, así que la copia local acepta las dos. El ZIP tampoco trae `xmldsig-core-schema.xsd`. En su lugar hay un sustituto que sirve para validar XML sin firmar.
- **La recepción no se reintenta.** Si vence el tiempo, el resultado es incierto. Antes de reenviar se consulta la autorización: un reenvío con la misma clave devuelve el error 43.
- **Los tests no llaman al SRI** y usan un `.p12` autofirmado que se genera en el momento. La validación con el XSD se salta si la máquina no tiene `xmllint`.
- **`next dev` y migraciones:** si se agregan modelos de Prisma con el servidor corriendo, hay que reiniciarlo. Si no, el cliente Prisma viejo falla con «Cannot read properties of undefined».
