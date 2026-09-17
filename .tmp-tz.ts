import "dotenv/config";
import { formatDate } from "@/lib/admin/format";
import { meetingSchema } from "@/lib/admin/schemas";

console.log("TZ del proceso:", process.env.TZ || "(sin definir → usa la del sistema)");
console.log("Intl por defecto:", Intl.DateTimeFormat().resolvedOptions().timeZone);

// BUG 1 — lead creado 19:30 en Guayaquil = 00:30 UTC del día siguiente
const lead = new Date("2026-09-16T19:30:00-05:00");
console.log("\nBUG 1 · lectura");
console.log("  instante real     : 16 sep 19:30 Guayaquil");
console.log("  formatDate() da   :", formatDate(lead));

// BUG 2 — reunión cargada como 15:00 en un input datetime-local
const fd = new FormData();
fd.set("title", "Reunión");
fd.set("startsAt", "2026-09-20T15:00");
fd.set("endsAt", "2026-09-20T16:00");
fd.set("status", "SCHEDULED");
const parsed = meetingSchema.parse(Object.fromEntries(fd));
console.log("\nBUG 2 · escritura");
console.log("  el usuario escribe: 2026-09-20 15:00");
console.log("  se guarda como    :", parsed.startsAt.toISOString());
console.log("  eso en Guayaquil  :", new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" }).format(parsed.startsAt));
