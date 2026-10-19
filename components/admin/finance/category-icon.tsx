import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Building2,
  Landmark,
  Megaphone,
  Receipt,
  ShoppingBag,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

import { IconBadge, type Tone } from "@/components/admin/finance/kpi-card";

// Categories are free text the user edits, so the icon is a best guess from
// the name with a neutral receipt as fallback.
const RULES: Array<[RegExp, LucideIcon, Tone]> = [
  [/publicidad|anuncio|ads|campa|marketing/i, Megaphone, "violet"],
  [/software|herramienta|suscrip|licencia|hosting|dominio|app/i, AppWindow, "blue"],
  [/colaborador|persona|honorario|sueldo|n[oó]mina|equipo/i, Users, "emerald"],
  [/servicio|mantenimiento|soporte/i, Wrench, "amber"],
  [/compra|equipo|material/i, ShoppingBag, "orange"],
  [/impuesto|sri|iess|tasa/i, Landmark, "rose"],
  [/env[ií]o|transporte|movilizaci/i, Truck, "slate"],
  [/oficina|arriendo|alquiler/i, Building2, "slate"],
];

export function categoryVisual(name: string | null | undefined): {
  icon: LucideIcon;
  tone: Tone;
} {
  if (name) {
    for (const [pattern, icon, tone] of RULES) {
      if (pattern.test(name)) return { icon, tone };
    }
  }
  return { icon: Receipt, tone: "slate" };
}

export function CategoryIcon({
  name,
  size = "sm",
}: {
  name: string | null | undefined;
  size?: "sm" | "md";
}) {
  const { icon, tone } = categoryVisual(name);
  return <IconBadge icon={icon} tone={tone} size={size} />;
}
