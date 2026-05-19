"use client";

import { Building2, Calendar, ExternalLink, AlertTriangle, CheckCircle2, Info, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { BidderChip } from "./bidder-chip";
import { cn, daysFromNow, formatDate, formatINR, formatRelativeTime } from "@/lib/utils";
import { tendersById } from "@/lib/mock-data";

export function TenderDetail({ tenderId, onClose }: { tenderId: string | null; onClose: () => void }) {
  const tender = tenderId ? tendersById[tenderId] : null;

  return (
    <Dialog open={!!tender} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        {tender && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={tender.status} />
                <span className="font-mono text-[10px] text-muted-foreground">{tender.refNo}</span>
                <Badge variant="outline" className="text-[10px]">{tender.sourcePortal}</Badge>
              </div>
              <DialogTitle className="pt-2">{tender.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Key facts grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KeyFact label="Buyer" icon={Building2} value={tender.buyer} />
                <KeyFact
                  label="Result date"
                  icon={Calendar}
                  value={formatDate(tender.resultDate, { day: "numeric", month: "short", year: "numeric" })}
                  sub={tender.status === "awarded" || tender.status === "result_in" ? `${Math.abs(daysFromNow(tender.resultDate))}d ago` : `Result in ${daysFromNow(tender.resultDate)}d`}
                />
                {tender.estimatedValue && (
                  <KeyFact label="Estimated value" icon={FileText} value={formatINR(tender.estimatedValue)} />
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">{tender.description}</p>
              </div>

              {/* Winner banner */}
              {tender.winner && (
                <div className="rounded-md border border-positive/40 bg-positive/10 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-positive">Winner</div>
                  <div className="mt-0.5 text-base font-semibold">{tender.winner}</div>
                </div>
              )}

              {/* Bidders */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bidders ({tender.bidders.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {tender.bidders.map((b, i) => (
                    <BidderChip key={`${b.name}-${i}`} bidder={b} />
                  ))}
                </div>
              </div>

              {/* Follow-ups timeline */}
              {tender.followUps.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Follow-ups & related events
                  </h4>
                  <ul className="space-y-2">
                    {tender.followUps
                      .slice()
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((fu) => {
                        const Icon = fu.tone === "negative" ? AlertTriangle : fu.tone === "positive" ? CheckCircle2 : Info;
                        return (
                          <li
                            key={fu.id}
                            className={cn(
                              "flex items-start gap-3 rounded-md border px-3 py-2.5",
                              fu.tone === "negative" && "border-critical/30 bg-critical/8",
                              fu.tone === "positive" && "border-positive/30 bg-positive/8",
                              fu.tone === "neutral" && "border-border bg-muted/30",
                            )}
                          >
                            <Icon
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0",
                                fu.tone === "negative" && "text-critical",
                                fu.tone === "positive" && "text-positive",
                                fu.tone === "neutral" && "text-muted-foreground",
                              )}
                            />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {fu.ticker && (
                                  <Badge variant="outline" className="font-mono text-[10px]">{fu.ticker}</Badge>
                                )}
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {fu.kind.replace("_", " ")}
                                </span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDate(fu.date, { day: "numeric", month: "short", year: "numeric" })} · {formatRelativeTime(fu.date)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm">{fu.text}</p>
                              {fu.source && <p className="mt-0.5 text-[10px] text-muted-foreground">Source: {fu.source}</p>}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}

              {/* Source link */}
              {tender.sourceUrl && (
                <a
                  href={tender.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open on {tender.sourcePortal} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyFact({
  label,
  icon: Icon,
  value,
  sub,
}: {
  label: string;
  icon: typeof Building2;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border bg-card/40 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
