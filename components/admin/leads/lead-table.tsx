import Link from "next/link";

import { DeleteLeadButton } from "@/components/admin/leads/delete-lead-button";
import { LeadCard } from "@/components/admin/leads/lead-card";

import { formatCurrency, formatDate } from "@/lib/admin/format";
import { LeadQuickActions } from "@/components/admin/leads/lead-quick-actions";
import { LeadStageSelect } from "@/components/admin/leads/lead-stage-select";
import { SOURCE_LABELS } from "@/components/admin/leads/constants";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadCardData } from "@/components/admin/leads/types";

export function LeadTable({ leads }: { leads: LeadCardData[] }) {
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {leads.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay leads con estos filtros.
          </p>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>

      <Card className="hidden rounded-lg md:block">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Lead</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Recibido</TableHead>
                <TableHead className="pr-5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay leads con estos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="group">
                    <TableCell className="pl-5">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {lead.name}
                      </Link>
                      {lead.company ? (
                        <div className="text-xs text-muted-foreground">
                          {lead.company}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="tabular-nums">{lead.phone ?? "—"}</div>
                      {lead.email ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {lead.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                      {lead.metaCampaignName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {lead.estimatedValue
                        ? formatCurrency(lead.estimatedValue)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <LeadStageSelect id={lead.id} stage={lead.stage} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <LeadQuickActions
                          id={lead.id}
                          name={lead.name}
                          phone={lead.phone}
                          email={lead.email}
                          contacted={Boolean(lead.firstContactedAt)}
                        />
                        <DeleteLeadButton id={lead.id} name={lead.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      </Card>
    </>
  );
}
