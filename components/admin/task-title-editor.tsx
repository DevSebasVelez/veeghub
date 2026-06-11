"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { renameTask } from "@/lib/admin/actions/tasks/actions";
import { cn } from "@/lib/utils";

export function TaskTitleEditor({
  id,
  title,
  done,
  className,
}: {
  id: string;
  title: string;
  done: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const router = useRouter();
  const saving = useRef(false);

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setEditing(false);

    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      saving.current = false;
      return;
    }

    try {
      await renameTask(id, trimmed);
      router.refresh();
    } catch {
      toast.error("Error al actualizar la tarea");
      setValue(title);
    }
    saving.current = false;
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        className={cn(
          "-mx-1 w-[calc(100%+0.5rem)] rounded border-0 bg-background px-1 text-sm font-medium leading-5 ring-1 ring-ring outline-none",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(title);
        setEditing(true);
      }}
      title="Clic para editar"
      className={cn(
        "w-full cursor-text rounded px-0 text-left text-sm font-medium leading-5 transition-colors hover:text-foreground",
        done && "text-muted-foreground line-through",
        className,
      )}
    >
      {value}
    </button>
  );
}
