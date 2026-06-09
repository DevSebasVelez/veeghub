"use client";

import { useState } from "react";
import { Copy, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";

import { revealCredential } from "@/lib/admin/actions/credentials/actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CredentialViewProps = {
  id: string;
  title: string;
  kind: string;
  url?: string | null;
  username?: string | null;
  accessMethod?: string | null;
  secretPreview?: string | null;
  notes?: string | null;
};

function CopyButton({ value }: { value: string }) {
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => toast.success("Copiado."));
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 shrink-0"
      onClick={handleCopy}
      type="button"
    >
      <Copy className="size-3" />
    </Button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

export function CredentialViewDialog({
  credential,
}: {
  credential: CredentialViewProps;
}) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  async function handleReveal() {
    setRevealing(true);
    try {
      const secret = await revealCredential(credential.id);
      setRevealed(secret);
    } catch {
      toast.error("Error al revelar secreto.");
    } finally {
      setRevealing(false);
    }
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) setRevealed(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <Eye className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{credential.title}</span>
            <StatusBadge value={credential.kind} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {credential.url ? (
            <Field label="URL">
              <div className="flex min-w-0 items-center gap-2">
                <a
                  href={credential.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {credential.url}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  asChild
                >
                  <a href={credential.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              </div>
            </Field>
          ) : null}

          {credential.username ? (
            <Field label="Usuario">
              <div className="flex min-w-0 items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-sm">
                  {credential.username}
                </code>
                <CopyButton value={credential.username} />
              </div>
            </Field>
          ) : null}

          {credential.accessMethod ? (
            <Field label="Método de acceso">
              <p className="wrap-break-word text-sm">{credential.accessMethod}</p>
            </Field>
          ) : null}

          {credential.secretPreview !== null &&
          credential.secretPreview !== undefined ? (
            <Field label="Secreto / Contraseña">
              <div className="flex min-w-0 items-center gap-2">
                {revealed !== null ? (
                  <>
                    <code className="flex-1 break-all font-mono text-sm">
                      {revealed}
                    </code>
                    <CopyButton value={revealed} />
                  </>
                ) : (
                  <>
                    <code className="flex-1 font-mono text-sm text-muted-foreground">
                      {credential.secretPreview || "••••"}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 shrink-0 px-2 text-xs"
                      onClick={handleReveal}
                      disabled={revealing}
                      type="button"
                    >
                      {revealing ? "..." : "Revelar"}
                    </Button>
                  </>
                )}
              </div>
            </Field>
          ) : null}

          {credential.notes ? (
            <Field label="Notas">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {credential.notes}
              </p>
            </Field>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
