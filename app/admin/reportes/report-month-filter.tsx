"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportMonthFilter({
  value,
  options,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onValueChange={(next) => router.push(`/admin/reportes?month=${next}`)}
    >
      <SelectTrigger className="h-10 w-full sm:w-56">
        <SelectValue />
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
