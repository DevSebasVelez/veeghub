import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-sky-200 bg-sky-50 text-sky-700",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  ARCHIVED: "border-zinc-200 bg-zinc-50 text-zinc-600",
  LEAD: "border-violet-200 bg-violet-50 text-violet-700",
  TODO: "border-zinc-200 bg-zinc-50 text-zinc-600",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  BLOCKED: "border-red-200 bg-red-50 text-red-700",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LOW: "border-zinc-200 bg-zinc-50 text-zinc-600",
  MEDIUM: "border-blue-200 bg-blue-50 text-blue-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  URGENT: "border-red-200 bg-red-50 text-red-700",
  PLANNED: "border-violet-200 bg-violet-50 text-violet-700",
  INVOICED: "border-blue-200 bg-blue-50 text-blue-700",
  PARTIALLY_PAID: "border-amber-200 bg-amber-50 text-amber-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-zinc-200 bg-zinc-50 text-zinc-600",
  READY_TO_SEND: "border-amber-200 bg-amber-50 text-amber-700",
  SENT: "border-blue-200 bg-blue-50 text-blue-700",
  LOGIN: "border-indigo-200 bg-indigo-50 text-indigo-700",
  OAUTH: "border-sky-200 bg-sky-50 text-sky-700",
  API_KEY: "border-purple-200 bg-purple-50 text-purple-700",
};

const labels: Record<string, string> = {
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
  LEAD: "Lead",
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  BLOCKED: "Bloqueado",
  DONE: "Listo",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
  PLANNED: "Planificado",
  INVOICED: "Facturado",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  READY_TO_SEND: "Por enviar",
  SENT: "Enviado",
  LOGIN: "Login",
  OAUTH: "OAuth",
  API_KEY: "API key",
  DATABASE: "DB",
  HOSTING: "Hosting",
  SOCIAL_MEDIA: "Red social",
  EMAIL: "Email",
  OTHER: "Otro",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border", styles[value] ?? "border-zinc-200 bg-zinc-50")}
    >
      {labels[value] ?? value}
    </Badge>
  );
}
