"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { revealCredential } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function CredentialSecret({
  id,
  preview,
}: {
  id: string;
  preview: string | null;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-muted px-2 py-1 text-xs">
        {secret ?? preview ?? "••••"}
      </code>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => {
          if (secret) {
            setSecret(null);
            return;
          }

          startTransition(async () => {
            setSecret(await revealCredential(id));
          });
        }}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="animate-spin" />
        ) : secret ? (
          <EyeOff />
        ) : (
          <Eye />
        )}
        <span className="sr-only">Ver secreto</span>
      </Button>
    </div>
  );
}
