# Convenciones de diseño — VeegHub

**Fijadas el 2026-11-25** a partir de las referencias que le gustan a Sebastián
(`~/Documents/VEEG SOFT/UI:UX REFERENCES/DASHBOARDS/`: Saledash, Zentra, Plan, Ecomora, Logip,
el panel de portafolio, el inbox y «Sales Activity») y de los patrones que ya usa este repo.
Aplica a toda pantalla nueva del panel. Las pantallas viejas se acercan a esto cuando se tocan,
no en un pase masivo.

---

## 1. La idea

Las ocho referencias comparten lo mismo: **un lienzo neutro, tarjetas amplias y pocas cosas
por tarjeta**. El color casi no aparece; lo que ordena la pantalla es el tamaño (una cifra
grande), el espacio y el contraste negro/blanco. Se ven caras, no recargadas.

Tres reglas que salen de ahí:

1. **Una tarjeta, un tema.** Título, a lo sumo un subtítulo, una acción. Si una tarjeta necesita
   dos encabezados, son dos tarjetas.
2. **El dato manda.** La cifra o el contenido principal es lo más grande de la tarjeta; la
   etiqueta va arriba, pequeña y en gris.
3. **Color con significado, nunca al azar.** Estados (aprobado, vencido), canales, una serie
   destacada en un gráfico y el **tono de cada tema** (§2.1): el ícono de una cifra o de una
   sección lleva siempre el mismo color, para reconocerla sin leer. El texto y las superficies
   siguen neutros.

> Ajuste del 2026-11-26: Sebastián encontró el panel «plano, blanco y negro». Las referencias
> sí usan acentos (Saledash: baldosas suaves; Zentra: series de color; Ecomora: chips de
> variación). Se agregan los tonos de §2.1; lo demás no cambia.

---

## 2. Superficies

| Pieza | Clase | Notas |
|---|---|---|
| Lienzo | `bg-background` | Lo da el layout. |
| Tarjeta | `rounded-2xl border bg-card` | **`rounded-2xl`** (las referencias usan radios grandes). `rounded-xl` sólo dentro de una tarjeta. |
| Padding de tarjeta | `p-5` (lista: cabecera `px-5 py-4`, filas `px-5 py-3.5`) | Generoso: es lo que separa «cara» de «planilla». |
| Sub-superficie | `rounded-xl bg-muted/40` | Bloques dentro de una tarjeta (vista previa, resumen). Sin borde. |
| Separación entre tarjetas | `gap-4` | `gap-3` sólo en franjas de KPI. |

Sin sombras duras. Si una tarjeta tiene que flotar (popover, tooltip), sombra difusa (`shadow-lg`).

### 2.1 Tonos (`components/admin/tone.tsx`)

- `IconTile` (baldosa redonda: fondo `-100` / ícono `-600`; oscuro `-500/15` / `-300`), `KpiCard`,
  `ToneTag`, `Delta` y los mapas `TONE_*`. No escribir clases de color sueltas para esto.
- Un tono por tema, el mismo en todo el panel:

| Tema | Tono |
|---|---|
| Gasto, dinero, calendario | blue |
| Leads, formularios, texto | violet |
| Costo por lead, ideas, notas | amber |
| Clientes ganados, publicado | emerald |
| Grabar, video | rose |
| Alcance, comentarios | sky |
| Conversaciones, directrices | teal |
| Imágenes, biblioteca, Instagram | pink |
| CTR, conjuntos | indigo |

- `KpiCard active` agrega anillo + lavado del tono: para la cifra seleccionada o la que pide acción.
- `Delta`: verde si mejora, rojo si empeora, azul (`neutral`) si subir no es ni bueno ni malo (gasto).
- Lavado (`TONE_WASH`) sólo para una tarjeta héroe por pantalla (la acción principal o el insight).
- Lo activo sigue siendo negro/blanco (§6); el botón principal puede llevar el tono de su tema
  (p. ej. «Abrir teleprompter» en rose) si es la única acción llena.

## 3. Cabecera de tarjeta

Patrón único, igual en dashboard y módulos:

```tsx
<div className="flex items-center justify-between border-b px-5 py-4">
  <div>
    <h2 className="text-sm font-semibold">Título</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">Qué muestra, en una línea.</p>
  </div>
  {/* una acción: «Ver todas», un botón outline o un IconButton redondo */}
</div>
```

La acción secundaria de una tarjeta es un **botón redondo** con ícono (`rounded-full`, `size-8`,
`variant="outline"`) o un enlace de texto gris. Nunca dos botones llenos en una cabecera.

## 4. Cifras (KPI)

- Franja de 3-4 tarjetas al inicio de un módulo, `grid gap-3 sm:grid-cols-2 xl:grid-cols-4`.
- Dentro: **baldosa de ícono** con el tono del tema (`KpiCard`, §2.1), etiqueta pequeña en gris, cifra `text-2xl font-semibold tabular-nums`
  y una línea de contexto en `text-xs`.
- Una tarjeta KPI es un enlace a la lista que explica la cifra.
- Variación: verde con flecha arriba, rojo con flecha abajo, siempre con el signo.
- Sólo cifras que existen en la base. Nada de «+12 %» decorativo.

## 5. Estados y etiquetas

- **Pill suave con punto**: `rounded-full border px-2 py-0.5 text-xs` + fondo `-50` /
  texto `-700` (oscuro: `-950` / `-300`). El punto (`size-1.5 rounded-full`) cuando el estado
  aparece en una fila larga.
- Colores de estado fijos en todo el panel:

| Significado | Color |
|---|---|
| neutro / borrador | zinc |
| en revisión / atención | amber |
| aprobado / programado | blue |
| requiere acción ya | orange |
| hecho / publicado / cobrado | emerald |
| error / vencido | red |

- Etiquetas libres (tags): `rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground`.

## 6. Navegación y acciones

- **Lo activo es negro** (en oscuro, blanco): `bg-primary text-primary-foreground` en pills de
  período o el botón principal. Una sola acción llena por pantalla; el resto `outline` o `ghost`.
- Secciones de un módulo: `AreaNav` (subrayado, por URL). Nunca Tabs de shadcn ni grupos de
  pills como navegación (ver memoria «Section nav»).
- Filtros: `next/form` o selects que escriben la URL; la URL es el estado.
- Destructivo: `ghost` en rojo + `ConfirmationDialog`.

### Menú lateral

- **Una sola fuente:** `components/admin/nav-config.ts`. El sidebar, la barra móvil y el título de la
  cabecera («Sección › Página») leen de ahí; una sección nueva es una entrada en el grupo que le toca.
- Grupos: **Inicio · Comercial · Operación · Finanzas · Recursos**. No se agrega un grupo para un
  solo ítem salvo Inicio.
- Activo: fondo + barra de 3 px a la izquierda + `aria-current="page"`; gana el `href` más largo
  que coincide (`/admin/finanzas/resumen` sigue marcando «Cobros»).
- Contadores (`badge`) sólo para lo que pide acción hoy (leads sin contactar, posts de hoy). Se
  calculan en `lib/admin/queries/nav.ts`.
- Móvil: barra inferior con los 4 accesos diarios + «Menú», que abre el sidebar completo. Objetivos
  táctiles de 44 px como mínimo.

## 7. Listas y tablas

- Fila = **baldosa o punto** a la izquierda, título `text-sm font-medium`, meta `text-xs
  text-muted-foreground` separada por «·», y a la derecha el estado o la cifra.
- Divisores finos (`divide-y`), sin rayado de cebra.
- Encabezados de tabla en `text-xs text-muted-foreground`, sin mayúsculas sostenidas.
- Agrupar por día con una banda `bg-muted/40 px-5 py-1.5 text-xs font-medium`.

## 8. Fichas de detalle (patrón «Plan»)

Dos columnas desde `lg`: **contenido a la izquierda** (formulario o cuerpo) y **panel lateral
fijo** a la derecha (`lg:sticky lg:top-20`, `w-80`) con estado, acciones y datos clave como
pares etiqueta/valor. En móvil el panel va arriba.

## 9. Tipografía

- Título de página `text-2xl font-semibold tracking-tight`; subtítulo `text-sm text-muted-foreground`.
- Título de tarjeta `text-sm font-semibold`. Cifra `text-2xl` (KPI) o `text-3xl` (cifra héroe).
- Pesos 400 / 500 / 600. Sin `font-bold`.
- Números siempre `tabular-nums`.

## 10. Fechas

Ver `docs/runbooks/fechas-y-zona-horaria.md`. Las etiquetas de fecha se calculan en el servidor
(Ecuador) y llegan como texto al cliente.

## 11. Antes de dar por terminada una pantalla

- [ ] Se ve bien en **claro y oscuro** (el panel se usa en oscuro).
- [ ] Se ve bien en móvil (390 px): nada se sale, el panel lateral sube.
- [ ] Una sola acción llena.
- [ ] Ningún color sin significado; íconos de cifras y secciones con su tono (§2.1).
- [ ] Vacíos con texto útil («qué hacer para que aparezca algo»), no sólo «Sin datos».
- [ ] Probada en el navegador con sesión real.
