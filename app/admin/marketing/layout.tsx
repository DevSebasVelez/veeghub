import { Sparkles } from "lucide-react";

import { MarketingNav } from "@/components/admin/marketing/marketing-nav";
import { IconTile } from "@/components/admin/tone";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <IconTile icon={Sparkles} tone="pink" size="lg" className="max-sm:hidden" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Calendario editorial, ideas de reels, recursos de marca y directrices de VeegSoft.
          </p>
        </div>
      </div>
      <MarketingNav />
      {children}
    </div>
  );
}
