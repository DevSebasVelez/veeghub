import { Info } from "lucide-react";

import { deleteTaxProfile } from "@/lib/admin/actions/tax-profiles/actions";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import { TaxProfileDialog } from "@/components/admin/dialogs/tax-profile-dialog";
import { FinanceTabs } from "@/components/admin/finance/finance-tabs";
import { getCurrentTaxProfile, getTaxProfiles } from "@/lib/admin/queries/tax-profiles";
import { forTaxProfileDialog } from "@/lib/admin/serialize";
import { dayStartUtc, formatDateOnly } from "@/lib/admin/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TaxSettingsPage() {
  const [profiles, current] = await Promise.all([
    getTaxProfiles(),
    getCurrentTaxProfile(),
  ]);
  const today = dayStartUtc(new Date());

  const daysSince = (value: Date | null) =>
    value ? Math.floor((today.getTime() - value.getTime()) / 86400000) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configuración tributaria
          </h1>
          <p className="text-sm text-muted-foreground">
            Datos de referencia del titular del RUC, por período de vigencia.
          </p>
        </div>
        <TaxProfileDialog mode="create" />
      </div>

      <FinanceTabs active="impuestos" />

      <Alert>
        <Info className="size-4" />
        <AlertTitle>Referencia editable</AlertTitle>
        <AlertDescription>
          Copia aquí lo que figura en tu RUC y verifícalo periódicamente en el
          SRI. No se aplica automáticamente: cada factura guarda la tarifa de
          IVA con la que se emitió, aunque cambies esta configuración.
        </AlertDescription>
      </Alert>

      {profiles.length === 0 ? (
        <Card className="rounded-lg">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Aún no hay configuración tributaria. Registra tu régimen, las
            tarifas de IVA aplicables y la fecha en que lo verificaste.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => {
            const isCurrent = profile.id === current?.id;
            const age = daysSince(profile.lastVerifiedAt);

            return (
              <Card key={profile.id} className="rounded-lg">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">{profile.regime}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {formatDateOnly(profile.validFrom)} –{" "}
                      {profile.validTo ? formatDateOnly(profile.validTo) : "vigente"}
                    </p>
                  </div>
                  {isCurrent ? <Badge>Vigente</Badge> : <Badge variant="outline">Histórica</Badge>}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">Tarifas IVA:</span>
                    {profile.vatRates.length ? (
                      profile.vatRates.map((rate) => (
                        <Badge key={rate.toString()} variant="outline">
                          {Number(rate.toString())}%
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">sin registrar</span>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    Última verificación:{" "}
                    {profile.lastVerifiedAt
                      ? `${formatDateOnly(profile.lastVerifiedAt)} (hace ${age} días)`
                      : "sin registrar"}
                  </p>
                  {profile.notes ? (
                    <p className="whitespace-pre-line text-muted-foreground">{profile.notes}</p>
                  ) : null}
                  <div className="flex justify-end gap-1 pt-1">
                    <TaxProfileDialog profile={forTaxProfileDialog(profile)} />
                    <ConfirmActionButton
                      icon="trash"
                      title="Eliminar vigencia"
                      description="Las facturas no se modifican; conservan su tarifa."
                      confirmLabel="Eliminar"
                      destructive
                      successMessage="Vigencia eliminada."
                      action={deleteTaxProfile.bind(null, profile.id)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
