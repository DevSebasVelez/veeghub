"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FormSelect({
  name,
  defaultValue,
  placeholder,
  options,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? undefined}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue placeholder={placeholder ?? "Selecciona"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
