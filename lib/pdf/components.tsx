import { Image, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

import { COMPANY } from "@/lib/company";
import { APP_TIME_ZONE, formatCurrency } from "@/lib/admin/format";
import { fromCents } from "@/lib/admin/finance/money";
import { C, LEADING, LOGO_PATH, LOGO_RATIO, PAGE_X, s } from "@/lib/pdf/theme";

import type { ReceiptParty } from "@/lib/admin/receipts/data";

export const money = (cents: number) => formatCurrency(fromCents(cents));

/** Calendar day (@db.Date, UTC midnight): "27 de noviembre de 2026". */
export function longDay(value: Date) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" }).format(value);
}

/** Calendar day, short: "27 nov 2026". */
export function shortDay(value: Date) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" })
    .format(value)
    .replace(/\./g, "");
}

/** A real instant in the business zone: "27 nov 2026, 14:32". */
export function instant(value: Date) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).format(value);
}

export function DocHeader({
  title,
  code,
  meta,
}: {
  title: string;
  code: string;
  meta: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      <Image src={LOGO_PATH} style={{ width: 19 * LOGO_RATIO, height: 19, marginTop: 2 }} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>{title}</Text>
        <Text style={[s.mono, { fontSize: 9, color: C.body, marginTop: 4 }]}>{code}</Text>
        <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 2 }}>{meta}</Text>
      </View>
    </View>
  );
}

export function Hairline({ my = 22 }: { my?: number }) {
  return <View style={[s.hairline, { marginVertical: my }]} />;
}

export type PillTone = "emerald" | "blue" | "red" | "amber" | "zinc";

const PILL: Record<PillTone, { fg: string; bg: string }> = {
  emerald: { fg: C.emerald, bg: C.emeraldWash },
  blue: { fg: C.blue, bg: C.blueWash },
  red: { fg: C.red, bg: C.redWash },
  amber: { fg: C.amber, bg: C.amberWash },
  zinc: { fg: C.body, bg: "#F4F4F5" },
};

export function Pill({ tone, children }: { tone: PillTone; children: string }) {
  const { fg, bg } = PILL[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <View style={{ width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: fg, marginRight: 5 }} />
      <Text style={{ fontSize: 7.5, fontWeight: 600, color: fg, letterSpacing: 0.3, lineHeight: 1 }}>
        {children}
      </Text>
    </View>
  );
}

function PartyLines({ lines }: { lines: Array<string | null | undefined> }) {
  return (
    <>
      {lines.filter(Boolean).map((line) => (
        <Text key={line} style={{ fontSize: 8.5, color: C.muted, marginTop: 1.5, lineHeight: LEADING }}>
          {line}
        </Text>
      ))}
    </>
  );
}

export function Parties({ clientLabel, client }: { clientLabel: string; client: ReceiptParty }) {
  const clientName = client.legalName ?? client.name;

  return (
    <View style={s.row}>
      <View style={{ flex: 1, paddingRight: 24 }}>
        <Text style={s.label}>Emisor</Text>
        <Text style={{ fontSize: 10.5, fontWeight: 600, marginTop: 7 }}>{COMPANY.brand}</Text>
        <PartyLines
          lines={[
            COMPANY.legalName,
            COMPANY.taxId ? `RUC ${COMPANY.taxId}` : null,
            COMPANY.address,
            COMPANY.phone,
            `${COMPANY.email} · ${COMPANY.website}`,
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{clientLabel}</Text>
        <Text style={{ fontSize: 10.5, fontWeight: 600, marginTop: 7 }}>{clientName}</Text>
        <PartyLines
          lines={[
            client.legalName && client.legalName !== client.name ? client.name : null,
            client.taxId ? `RUC / CI ${client.taxId}` : null,
            client.address,
            client.email,
          ]}
        />
      </View>
    </View>
  );
}

/** Label on the left, value on the right, hairline below. */
export function Field({
  label,
  children,
  mono,
  last,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
        borderBottomWidth: last ? 0 : 0.6,
        borderBottomColor: C.line,
      }}
    >
      <Text style={{ color: C.muted, width: 150 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        {typeof children === "string" ? (
          <Text style={[{ fontSize: 9.5, textAlign: "right", fontWeight: 500, lineHeight: LEADING }, mono ? s.mono : {}]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function DocFooter({ note }: { note: string }) {
  return (
    <>
      <View fixed style={[s.hairline, { position: "absolute", left: PAGE_X, right: PAGE_X, bottom: 58 }]} />
      <Text
        fixed
        style={{ position: "absolute", left: PAGE_X, bottom: 32, width: 320, fontSize: 7.5, color: C.faint, lineHeight: 1.5 }}
      >
        {note}
      </Text>
      <Text
        fixed
        style={{ position: "absolute", right: PAGE_X, bottom: 43, width: 160, fontSize: 7.5, color: C.muted, textAlign: "right" }}
      >
        {COMPANY.website} · {COMPANY.email}
      </Text>
      <View fixed style={{ position: "absolute", right: PAGE_X, bottom: 32, width: 160 }}>
        <Text
          style={{ fontSize: 7.5, color: C.faint, textAlign: "right" }}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </>
  );
}
