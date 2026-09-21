import {
  ingestWebsiteLead,
  verifyWebsiteLeadSignature,
  websiteLeadSchema,
} from "@/lib/leads/website";

// Escribe en la base en cada petición: nada que cachear.
export const dynamic = "force-dynamic";

/**
 * Entrada de leads desde veegsoft.com.
 *
 * El sitio público llama acá después de que su formulario de contacto responde
 * bien. A diferencia del webhook de Meta, el emisor es nuestro, así que el
 * lead se crea en la propia petición en vez de en `after()`: la web ya le
 * respondió al visitante antes de llamarnos y nadie está esperando. Así, si la
 * creación falla, el sitio lo ve en el código de estado y puede registrarlo.
 */
export async function POST(request: Request) {
  // Bytes exactos: la firma se calcula sobre el cuerpo crudo, y volver a
  // serializar el JSON parseado cambiaría el digest.
  const rawBody = await request.text();

  if (!verifyWebsiteLeadSignature(rawBody, request.headers.get("x-veeg-signature"))) {
    console.warn("[web] firma inválida en la ingesta de leads");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = websiteLeadSchema.safeParse(payload);

  if (!parsed.success) {
    console.warn("[web] payload de lead inválido", parsed.error.issues);
    return Response.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const lead = await ingestWebsiteLead(parsed.data);
  console.log("[web] lead creado", lead.id);

  return Response.json({ received: true, leadId: lead.id }, { status: 201 });
}
