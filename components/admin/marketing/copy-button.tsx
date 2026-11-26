"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast.error("El navegador no dejó copiar. Mantén presionado el texto para copiarlo a mano.");
    return false;
  }
}

/**
 * Copy with visible confirmation: the icon turns into a check for two seconds
 * and a screen reader hears «Copiado». Large enough to hit with a thumb.
 */
export function CopyButton({
  text,
  label = "Copiar",
  copiedLabel = "Copiado",
  variant = "outline",
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={cn("h-9 px-3 sm:h-8", className)}
      disabled={!text}
      onClick={async () => setCopied(await copyText(text))}
    >
      {copied ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-4" />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
