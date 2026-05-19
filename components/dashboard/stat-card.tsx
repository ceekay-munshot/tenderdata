import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; tone: "positive" | "critical" | "neutral" };
  icon?: LucideIcon;
  accent?: "primary" | "critical" | "positive" | "warning";
  sub?: string;
}

export function StatCard({ label, value, delta, icon: Icon, accent = "primary", sub }: StatCardProps) {
  const accentMap = {
    primary: "from-primary/15 to-transparent text-primary",
    critical: "from-critical/15 to-transparent text-critical",
    positive: "from-positive/15 to-transparent text-positive",
    warning: "from-warning/15 to-transparent text-warning",
  } as const;

  return (
    <Card className="relative overflow-hidden p-5">
      <div className={cn("pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-50", accentMap[accent])} />
      <div className="relative flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight tabular">{value}</span>
          {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        </div>
        {Icon && (
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br", accentMap[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {delta && (
        <div className="relative mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              delta.tone === "positive" && "bg-positive/15 text-positive",
              delta.tone === "critical" && "bg-critical/15 text-critical",
              delta.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            {delta.value}
          </span>
          <span className="text-[10px] text-muted-foreground">vs last 7d</span>
        </div>
      )}
    </Card>
  );
}
