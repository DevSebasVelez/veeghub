import { after } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";

import {
  extractLeadgenChanges,
  ingestLeadgen,
  recordWebhookEvents,
} from "@/lib/meta/ingest";
import {
  verifyWebhookSignature,
  verifyWebhookToken,
} from "@/lib/meta/signature";

// Meta retries whenever we do not answer 200 quickly, so the handler must never
// wait on the Graph API. It persists the raw event, answers, and ingests in after().
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Handshake: Meta echoes hub.challenge back as plain text to confirm the URL. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || !verifyWebhookToken(token)) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge ?? "", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(request: Request) {
  // The signature is computed over the exact bytes Meta sent. Parsing first and
  // re-serializing would change the digest and reject every delivery.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[meta] firma inválida en webhook de leads");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Malformed body: answering 200 stops Meta from retrying something we can
    // never parse.
    return Response.json({ received: true, ignored: "invalid json" });
  }

  const changes = extractLeadgenChanges(payload);

  if (changes.length === 0) {
    return Response.json({ received: true, leads: 0 });
  }

  const stored = await recordWebhookEvents(
    changes,
    payload as Prisma.InputJsonValue,
  );

  after(async () => {
    for (const change of stored) {
      const result = await ingestLeadgen(change);

      if (result.status === "created") {
        // TODO(F3): enviar push a los administradores con el lead recién creado.
        console.log("[meta] lead creado", result.leadId);
      }
    }
  });

  return Response.json({ received: true, leads: stored.length });
}
