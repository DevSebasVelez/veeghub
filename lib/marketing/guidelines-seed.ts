/**
 * Starting brand guidelines of the marketing module (decision 3).
 *
 * Distilled on 2026-11-25 from `veegsoft-web/CLAUDE.md` (tone, figures,
 * offices, palette, industries), `veegsoft-web/docs/marketing/posts-industrias.md`
 * (LinkedIn and GBP practice) and `MARKETING/Reels/GUIA-ESTILO-REELS.md`.
 * Those files live outside this repo and outside Vercel, so the text is copied
 * here and seeded into `BrandGuideline`. From then on the database is the
 * source: the seed only creates missing keys and never overwrites an edit.
 *
 * `position` is the order inside the AI system prompt (F4). Keep it stable:
 * reordering changes the cached prefix.
 */
export type GuidelineSeed = {
  key: string;
  title: string;
  position: number;
  content: string;
};

export const GUIDELINE_SEEDS: GuidelineSeed[] = [
  {
    key: "identidad",
    title: "Quién es VeegSoft",
    position: 10,
    content: `- VeegSoft es una empresa de ingeniería de software a medida: sistemas enterprise, apps, web, IA aplicada, automatización, integraciones y nube (arquitectos de soluciones certificados en AWS, programa de partners de AWS).
- **Trabajo remoto.** Cuenca (Azuay) es donde nació la empresa. Nunca «sede», «oficina» ni «equipo en X».
- Mercados: **Ecuador, Estados Unidos y Latinoamérica**.
- Vocabulario enterprise: «empresas», «proyectos», «operación», «sistema». No «clientes» ni «negocios» como relleno.
- El vocabulario técnico es contenido, no decoración: alta disponibilidad, observabilidad, arquitectura, Multi-AZ, IAM, colas, cuando vienen al caso y sin cifras inventadas.
- Calificación en Google: 5,0.`,
  },
  {
    key: "tono",
    title: "Tono",
    position: 20,
    content: `- **Afirmativo, nunca contra un tercero.** Un texto dice qué **es** el trabajo; no abre nombrando algo malo que insinúa que vende otro («No vendemos checklists vacíos», «no vendemos miedo»).
- No se descalifica a nadie («desconfía de quien te lo ofrezca») ni se afirma la propia honestidad («lo honesto es que…», «te decimos con franqueza»). El dato útil se dice y ya.
- Sí valen los límites de alcance («no vendemos hardware de bodega») y la promesa de avisar cuando la empresa no nos necesita: informan y quitan riesgo.
- Tuteo, español neutro latinoamericano, ortografía cuidada.
- Elegancia es contención: una idea por pieza.`,
  },
  {
    key: "cifras",
    title: "Cifras verificadas",
    position: 30,
    content: `- Las **únicas** cifras propias verificadas: **más de 5 años** y **más de 100 proyectos**. Calificación de Google 5,0.
- Ninguna otra cifra sobre VeegSoft (clientes, ahorro, porcentajes, tiempos de entrega) sin que Sebastián la confirme.
- Cifras de ejemplo dentro de una pieza: en **dólares**, plausibles para una empresa ecuatoriana y con formato de punto para miles y coma para decimales (\`$4.860\`, \`31,4 %\`).
- Datos de ejemplo con nombres ficticios creíbles del país (*Comercial Andrade*, *Ferretería El Sol*). **Nunca nombres de empresas reales como clientes.**`,
  },
  {
    key: "prohibidos",
    title: "Lo que nunca va",
    position: 40,
    content: `- **Sin precios ni plazos.** Cada sistema se cotiza; no se promete «en 2 semanas» ni «desde $X».
- **Nunca «sin mensualidades»**: la empresa paga hosting y soporte.
- **Sin «oficina», «sede» ni dirección o teléfono de una ciudad.**
- Sin clientes, testimonios ni casos inventados.
- Sin «enlatado» (no se usa en Ecuador): «genérico», «de paquete» o «estándar».
- Sin ataques ni comparaciones con competidores.
- Sin morado, índigo, violeta ni fucsia en ninguna pieza.`,
  },
  {
    key: "industrias",
    title: "Industrias: vender el sistema",
    position: 50,
    content: `Decisión de Sebastián (2026-11-25): «la idea es venderles sistemas de alta ingeniería, enterprise, mostrarles el potencial; lo legal es propio de cada proyecto».

- Las piezas de industria abren con el **sistema** (recorrido 3D, módulos, visor, app), no con la norma.
- Una regla verificada aparece, si acaso, como **funcionalidad** (el reajuste por fórmula polinómica, los plazos del siniestro, el precio mínimo por caja), nunca como sección legal.
- Cada industria tiene un sistema de ejemplo con datos demo: Planta·OS (manufactura), Obra·OS (construcción), Cosecha·OS (agroexportación), Bodega·OS (distribución), Clínica·OS (salud), Ruta·OS (transporte), Estadía·OS (hotelería), Aula·OS (educación), Oficina·OS (seguros).
- Manufactura: **sin integración con PLC por ahora**; la captura es tablet, báscula, lector e impresora. Las máquinas son «segunda etapa».
- El gancho sale de cómo opera de verdad el negocio: qué número llega tarde, qué se anota a mano, qué reporte arma alguien los viernes.`,
  },
  {
    key: "paleta",
    title: "Marca visual",
    position: 60,
    content: `- Marca **negro + blanco** con azul acero de acento: \`brand\` **#1E5A8F** (el del logo).
- Rampas: \`ink\` (neutro, papel a tinta), \`brand\` (azul acero), \`aqua\` (nube, datos, integraciones), \`moss\` (éxito, entrega, automatización), \`ochre\` (atención, en curso), \`clay\` (humano, consultoría/IA, soporte).
- Acentos de industria: clay → salud y seguros · aqua → distribución y hotelería · moss → transporte y agroexportación · ochre → manufactura · brand → educación · ink → construcción.
- **Sin morado** ni sus vecinos, sin excepción.
- Tipografía: **Inter Tight** en titulares, **Inter** en texto. Pesos 400/500/600.
- Imágenes de producto con datos demo y nombres ficticios: renders 3D, pantallas, apps y visores de \`public/industrias/<slug>/\`.`,
  },
  {
    key: "linkedin",
    title: "LinkedIn",
    position: 70,
    content: `- Se publica desde el **perfil personal de Sebastián** (llega más lejos que la página). Después se comparte desde la página de VeegSoft y Esteban lo comparte con una línea suya.
- **Un post por semana**, martes o miércoles entre 7:30 y 9:00 (Ecuador).
- **El enlace va en el primer comentario**, nunca en el post. El comentario es una línea con 👇 y el enlace con UTM.
- Estructura que funcionó: gancho en las dos primeras líneas (una cita del dolor real, entre comillas, con un emoji), un párrafo que lo explica, «Así se ve…» y 5-7 viñetas con emoji, una línea de alcance, una pregunta de cierre con 👇 y 3-5 hashtags (#Ecuador y #SoftwareAMedida suelen ir).
- Imágenes: carrusel 4:5 (1080×1350) o 3-4 imágenes; primero el render 3D, luego 2 pantallas y el visor.
- Máximo 3.000 caracteres. Responder cada comentario en la primera hora.`,
  },
  {
    key: "gbp",
    title: "Google Business Profile",
    position: 80,
    content: `- Tipo **Novedad** (u **Oferta** sólo si hay una promoción real). Botón **«Más información»** con el enlace con UTM.
- Una por semana, el mismo día que LinkedIn. Imagen: el render 3D de la industria.
- Texto sobrio: «Software para … en Ecuador.», un párrafo con los módulos y una línea de cierre que invita a la web.
- **Sin teléfono en el texto** (GBP rechaza esos posts) y con pocos o ningún emoji.
- Máximo 1.500 caracteres.`,
  },
  {
    key: "reels-contenido",
    title: "Reels: guion y contenido",
    position: 90,
    content: `- Cada reel nuevo empieza preguntando el estilo: **A. tomas dinámicas**, **B. cara fija arriba**, **C. horizontal de época** (también D: producto vertical sin cara, y E: lanzamiento con locución).
- El gráfico **no ilustra, demuestra**: si se habla de una hoja de cálculo, abajo hay una hoja que se llena. Interfaz simulada, no metáforas (nada de bombillas, engranajes ni cohetes).
- **Logotipos reales**, no iconos genéricos (si aparece un ERP, aparece SAP).
- **Sólo funciones reales del sistema**: nada de sensores, telemetría ni OEE en vivo si el producto no lo hace.
- Estructura: gancho → caso → giro (la frase bisagra) → pantalla → cierre.
- Densidad: ~86 palabras y 14-18 frases en 33 s (≈2,5-3,25 palabras por segundo). Unir frases con comas libera más tiempo que borrar palabras.
- Público Ecuador, cifras en dólares y plausibles (una hora de sillón odontológico ~$60, un pedido de ferretería ~$2.000).
- VeegSoft es de **Cuenca (Azuay)**, código telefónico 07.
- Cierre estándar idéntico en todas las piezas: isotipo VS sobre negro y «veegsoft.com» en fino. Sin ciudad, sin país.`,
  },
  {
    key: "reels-visual",
    title: "Reels: línea visual",
    position: 100,
    content: `- Lienzo 1080×1920 a 60 fps. Caja segura: 56 px arriba y **246 px abajo** (reserva de Instagram): nada legible por debajo de y=1674.
- Paleta de video: brand #0A5BE0, brandDeep #0038A8, brandLit #3B8CFF, paper #F7F9FC, ink #0B1220. Cuatro fondos: papel, ink #080C14, azul #0A5BE0 y azul profundo #062B72. El azul pleno se reserva para la frase bisagra.
- Una sola familia: **Inter**. Titulares en caja baja, peso 800-900, con **una** palabra en azul.
- Sobre el video de Sebastián no va nada (ni gráficos, ni corrección de color).
- Nada se queda quieto; nada entra nítido (desenfoque de entrada); un plano, una idea.
- Todo redondeado (píldoras y squircles), sombras difusas, sin tipografía monoespaciada en etiquetas.`,
  },
];
