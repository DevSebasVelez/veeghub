"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHANNELS, CONTENT_CHANNELS } from "@/lib/marketing/constants";

export function ChannelFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("canal");
    else params.set("canal", value);
    router.push(`${pathname}?${params}`);
  }

  return (
    <Select value={current} onValueChange={select}>
      <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Filtrar por canal">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los canales</SelectItem>
        {CONTENT_CHANNELS.map((channel) => (
          <SelectItem key={channel} value={channel}>
            {CHANNELS[channel].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
