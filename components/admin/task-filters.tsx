"use client";

import { usePathname, useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Project = { id: string; name: string };

export function TaskFilters({
  projects,
  currentProject,
  showDone,
}: {
  projects: Project[];
  currentProject: string;
  showDone: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={currentProject}
        onValueChange={(v) => update("proyecto", v === "all" ? null : v)}
      >
        <SelectTrigger size="sm" className="w-auto min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={showDone ? "secondary" : "outline"}
        size="sm"
        onClick={() => update("completadas", showDone ? null : "1")}
        className="gap-1.5"
      >
        <CheckCheck className="size-3.5" />
        Completadas
        {showDone && (
          <span className="ml-0.5 rounded-full bg-primary/15 px-1 text-xs text-primary">
            on
          </span>
        )}
      </Button>
    </div>
  );
}
