"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowDown, ArrowUp, Loader2, X } from "lucide-react";

import { createPost, updatePost } from "@/lib/admin/actions/marketing/actions";
import type { AssetDTO, PostDetailDTO } from "@/lib/admin/queries/marketing";
import {
  CHANNELS,
  CONTENT_CHANNELS,
  type ContentChannelValue,
} from "@/lib/marketing/constants";
import { buildUtmUrl, renderFirstComment } from "@/lib/marketing/utm";
import { AssetPicker } from "@/components/admin/marketing/asset-picker";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Campaign = { id: string; name: string; slug: string };

export function PostEditor({
  post,
  campaigns,
  library,
  defaultDate,
}: {
  post?: PostDetailDTO;
  campaigns: Campaign[];
  library: AssetDTO[];
  /** "yyyy-MM-dd" in Ecuador for a new post. */
  defaultDate?: string;
}) {
  const router = useRouter();
  const readOnly = post?.status === "PUBLICADO";

  const [channel, setChannel] = useState<ContentChannelValue>(post?.channel ?? "LINKEDIN_PERSONAL");
  const [campaignId, setCampaignId] = useState(post?.campaignId ?? "none");
  const [body, setBody] = useState(post?.body ?? "");
  const [firstComment, setFirstComment] = useState(post?.firstComment ?? "");
  const [linkUrl, setLinkUrl] = useState(post?.linkUrl ?? "");
  const [assets, setAssets] = useState<AssetDTO[]>(post?.assets ?? []);
  const [unscheduled, setUnscheduled] = useState(post ? !post.scheduledLocal : !defaultDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = CHANNELS[channel];
  const campaignSlug = campaigns.find((c) => c.id === campaignId)?.slug ?? null;
  const over = info.maxChars ? body.length > info.maxChars : false;

  const utmUrl = useMemo(
    () => buildUtmUrl({ linkUrl, channel, campaignSlug, postId: post?.id ?? "ID_DEL_POST" }),
    [linkUrl, channel, campaignSlug, post?.id],
  );

  const [defaultDay, defaultTime] = post?.scheduledLocal
    ? post.scheduledLocal.split("T")
    : [defaultDate ?? "", "07:30"];

  function move(index: number, delta: number) {
    setAssets((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || readOnly) return;

    const formData = new FormData(event.currentTarget);
    const fecha = String(formData.get("fecha") ?? "");
    const hora = String(formData.get("hora") ?? "");
    formData.delete("fecha");
    formData.delete("hora");

    if (!unscheduled) {
      if (!fecha || !hora) {
        setError("Elige fecha y hora, o marca «Sin fecha».");
        return;
      }
      // Wall-clock in Ecuador; the server anchors it with parseLocalDateTime.
      formData.set("scheduledLocal", `${fecha}T${hora}`);
    }
    formData.set("channel", channel);
    formData.set("campaignId", campaignId);
    formData.set("assetIds", assets.map((asset) => asset.id).join(","));

    setSaving(true);
    setError(null);
    try {
      if (post) {
        const result = await updatePost(post.id, formData);
        if (!result.ok) return setError(result.error);

        if (result.data.revoked) {
          toast.warning("Cambió el contenido aprobado: el post volvió a borrador.");
        } else {
          toast.success("Post guardado.");
        }
        router.refresh();
      } else {
        const result = await createPost(formData);
        if (!result.ok) return setError(result.error);

        toast.success("Post creado.");
        router.push(`/admin/marketing/calendario/${result.data.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset disabled={readOnly || saving} className="space-y-5">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Canal</FieldLabel>
              <Select value={channel} onValueChange={(value) => setChannel(value as ContentChannelValue)}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_CHANNELS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CHANNELS[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Campaña</FieldLabel>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin campaña</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>Nombre interno</FieldLabel>
            <Input name="title" defaultValue={post?.title ?? ""} placeholder="Manufactura · LinkedIn" required />
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>Texto</FieldLabel>
              <span
                className={cn(
                  "text-xs tabular-nums text-muted-foreground",
                  over && "font-medium text-destructive",
                )}
              >
                {body.length.toLocaleString("es-EC")}
                {info.maxChars ? ` / ${info.maxChars.toLocaleString("es-EC")}` : ""}
              </span>
            </div>
            <Textarea
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={14}
              className="font-sans leading-6"
              required
            />
          </Field>

          {info.linkInComment ? (
            <Field>
              <FieldLabel>Primer comentario</FieldLabel>
              <Textarea
                name="firstComment"
                value={firstComment}
                onChange={(event) => setFirstComment(event.target.value)}
                rows={2}
                placeholder="El recorrido completo 👇"
              />
              <FieldDescription>
                En LinkedIn el enlace va aquí, no en el post. Se agrega solo al final, con su UTM.
              </FieldDescription>
            </Field>
          ) : null}

          <Field>
            <FieldLabel>URL destino</FieldLabel>
            <Input
              name="linkUrl"
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://veegsoft.com/industrias/manufactura"
            />
            <FieldDescription className="break-all">
              {utmUrl ? (
                <>
                  Con UTM: <span className="text-foreground">{utmUrl}</span>
                </>
              ) : (
                "Sin UTM: se arma al publicar con el canal, la campaña y el id del post."
              )}
            </FieldDescription>
          </Field>

          {info.linkInComment && (firstComment || utmUrl) ? (
            <div className="rounded-xl bg-muted/40 p-3 text-sm">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Así queda el comentario</div>
              <p className="whitespace-pre-wrap break-all">{renderFirstComment(firstComment, utmUrl)}</p>
            </div>
          ) : null}

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>Imágenes</FieldLabel>
              <AssetPicker
                library={library}
                selected={assets.map((asset) => asset.id)}
                onChange={(ids) =>
                  setAssets((current) => {
                    const known = new Map(
                      [...current, ...library].map((asset) => [asset.id, asset]),
                    );
                    return ids.flatMap((id) => (known.get(id) ? [known.get(id)!] : []));
                  })
                }
              />
            </div>
            {assets.length ? (
              <ol className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                {assets.map((asset, index) => (
                  <li key={asset.id} className="overflow-hidden rounded-xl border bg-card">
                    <div className="relative aspect-[3/2] bg-muted">
                      {asset.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL, not optimizable
                        <img src={asset.url} alt={asset.alt ?? asset.name} className="size-full object-cover" />
                      ) : null}
                      <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 text-xs font-medium tabular-nums">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 p-1.5">
                      <span className="truncate text-xs" title={asset.name}>
                        {asset.name}
                      </span>
                      <div className="flex shrink-0">
                        <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir">
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-xs" disabled={index === assets.length - 1} onClick={() => move(index, 1)} aria-label="Bajar">
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setAssets((current) => current.filter((a) => a.id !== asset.id))} aria-label="Quitar">
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Sin imágenes.</p>
            )}
          </Field>

          <Field>
            <FieldLabel>Fecha y hora (Ecuador)</FieldLabel>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={unscheduled} onCheckedChange={(value) => setUnscheduled(value === true)} />
              Sin fecha todavía
            </label>
            {!unscheduled ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <DatePickerField name="fecha" defaultValue={defaultDay || null} />
                <Input type="time" name="hora" defaultValue={defaultTime} required />
              </div>
            ) : null}
            <FieldDescription>
              El día anterior a las 8:00 llega un recordatorio. A la hora, si está aprobado, llega el
              aviso con el texto listo para copiar.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </fieldset>

      {readOnly ? null : (
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving || over}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {post ? "Guardar cambios" : "Crear borrador"}
          </Button>
        </div>
      )}
    </form>
  );
}
