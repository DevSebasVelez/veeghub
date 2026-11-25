import { MarketingNav } from "@/components/admin/marketing/marketing-nav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Calendario editorial, recursos de marca y directrices de VeegSoft.
        </p>
      </div>
      <MarketingNav />
      {children}
    </div>
  );
}
