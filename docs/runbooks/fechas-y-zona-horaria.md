# Fechas y zona horaria

**El host corre en UTC. El negocio corre en Ecuador (UTC−05:00, sin horario de verano).**
Toda fecha cruza esa frontera dos veces: al guardar y al mostrar. Este documento fija cómo.

---

## La regla en una línea

> Si tiene hora, se ancla a `America/Guayaquil`.
> Si es solo un día del calendario, se trata en UTC y se muestra en UTC.

---

## Dos tipos de fecha, dos tratamientos

| Tipo | Ejemplos | Columna | Cómo se guarda | Cómo se muestra |
|---|---|---|---|---|
| **Instante** | `createdAt`, `startsAt`, `sentAt`, `occurredAt`, `firstContactedAt` | `DateTime` | UTC real, con el offset explícito al parsear | `formatDate()` — fija `America/Guayaquil` |
| **Día de calendario** | `dueDate`, `issueDate`, `paidAt`, `startDate`, `nextFollowUpAt` | `@db.Date` (o `DateTime` alimentado por un `input[type=date]`) | medianoche UTC | `formatDateOnly()` — fija `UTC` |

Mezclarlos es el error: mostrar un día de calendario con `formatDate()` lo corre al día anterior
a las 19:00, y mostrar un instante con `formatDateOnly()` pierde la hora.

---

## Los dos bugs que originaron esto

Ambos reproducidos el 2026-09-16 con el host en UTC.

### 1. Lectura — el día se corría

```
instante real   : 16 sep 19:30 Guayaquil
formatDate() da : 17 sept 2026, 12:30 a. m.   ← día equivocado
```

**Causa:** `Intl.DateTimeFormat` sin `timeZone` usa la zona del proceso, que en el host es UTC.
**Arreglo:** `formatDate()` fija `timeZone: APP_TIME_ZONE`.

### 2. Escritura — se guardaban 5 horas corridas (peor: silencioso)

```
el usuario escribe : 2026-09-20 15:00
se guardaba como   : 2026-09-20T15:00:00.000Z
eso en Guayaquil   : 10:00 a. m.              ← dato corrupto
```

**Causa:** un `input[type=datetime-local]` envía `"2026-09-20T15:00"` **sin offset**, y
`new Date()` lo interpreta en la zona del proceso.
**Arreglo:** `parseLocalDateTime()` en `lib/admin/schemas.ts` fija el offset `-05:00` antes de
parsear. El resultado es idéntico corra el host en UTC, Guayaquil o Tokio — verificado en los tres.

---

## No usar `TZ`

**Vercel reserva la variable `TZ`.** Y renombrarla no sirve: Node solo lee ese nombre exacto, así
que un `APP_TZ` quedaría decorativo y daría falsa confianza.

La zona vive en el código, con Ecuador por defecto, y **no depende de la zona del proceso**:

```ts
// lib/admin/format.ts
export const APP_TIME_ZONE =
  process.env.NEXT_PUBLIC_APP_TIME_ZONE || "America/Guayaquil";
```

**Para este proyecto no hay nada que configurar**: la variable no está definida en ningún entorno
y no hace falta. La rama del `process.env` existe solo para que un despliegue distinto de este
código, en otro país, no requiera tocar la lógica — no para VeegSoft.

## El offset se calcula, no se escribe a mano

`zoneOffsetMinutes()` lo obtiene de la base IANA a través de `Intl`, para el instante concreto.
Eso significa que **el horario de verano se resuelve solo**, y que un despliegue para un cliente en
otro país solo cambia esa variable.

Verificado:

| Zona | Enero | Julio |
|---|---|---|
| `America/Guayaquil` | −05:00 | −05:00 (Ecuador no tiene horario de verano) |
| `Europe/Madrid` | +01:00 | +02:00 (cambia solo) |

El offset se consulta **dos veces**: depende del instante que se está calculando, y en el día del
cambio de hora la primera estimación puede caer del lado equivocado.

---

## Reglas para código nuevo

1. **Nunca** `new Intl.DateTimeFormat(...)` suelto. Usar `formatDate` o `formatDateOnly`.
2. **Nunca** `new Date(textoDeFormulario)` directo. Para valores con hora, `parseLocalDateTime()`.
3. **No derivar fechas dentro de componentes cliente.** Calcular en el servidor y pasar el
   resultado como prop: el reloj del navegador y el del servidor difieren y React reporta
   desajuste de hidratación. Por eso `LeadCardData` trae `ageLabel`, `stale` y `followUpDue`
   ya calculados.
4. Diferencias de tiempo (antigüedad, SLA) son **independientes de la zona**: restar instantes
   siempre es seguro.

---

## Cómo verificarlo

Cualquier cambio de fechas debe dar el mismo resultado en las tres zonas:

```bash
for tz in UTC America/Guayaquil Asia/Tokyo; do
  echo "== $tz =="; TZ=$tz npx tsx --tsconfig tsconfig.json ./script-de-prueba.ts
done
```

Casos límite que hay que cubrir siempre: **19:00–23:59** (donde el día cambia en UTC) y
**00:00** (medianoche local).
