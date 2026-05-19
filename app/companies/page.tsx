import Link from "next/link";
import { Building2, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { companyList } from "@/lib/mock-data";
import { cn, formatINR, formatPct } from "@/lib/utils";

export default function CompaniesPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 text-primary" />
          <span>Companies directory</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All companies</h1>
          <p className="text-sm text-muted-foreground">
            Universe of Indian listed companies. Search, filter by sector, and add to watchlist.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active universe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pl-5 font-medium">Ticker</th>
                  <th className="font-medium">Sector</th>
                  <th className="font-medium">Industry</th>
                  <th className="font-medium">LTP</th>
                  <th className="font-medium">Change</th>
                  <th className="font-medium">Mkt Cap</th>
                  <th className="py-3 pr-5"></th>
                </tr>
              </thead>
              <tbody>
                {companyList.map((c) => (
                  <tr key={c.ticker} className="border-b last:border-b-0 transition-colors hover:bg-accent/40">
                    <td className="py-3 pl-5">
                      <Link href={`/company/${c.ticker}`} className="flex items-center gap-2 hover:text-primary">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/15 text-[10px] font-bold text-primary">
                          {c.ticker.slice(0, 3)}
                        </span>
                        <span className="font-medium">{c.ticker}</span>
                      </Link>
                    </td>
                    <td>
                      <Badge variant="outline" className="text-[10px]">{c.sector}</Badge>
                    </td>
                    <td className="text-xs text-muted-foreground">{c.industry}</td>
                    <td className="tabular">₹{c.lastPrice.toFixed(2)}</td>
                    <td>
                      <span className={cn("text-xs tabular", c.change >= 0 ? "text-positive" : "text-critical")}>
                        {formatPct(c.change)}
                      </span>
                    </td>
                    <td className="text-xs tabular text-muted-foreground">{formatINR(c.marketCap)}</td>
                    <td className="py-3 pr-5 text-right">
                      <Link
                        href={`/company/${c.ticker}`}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
