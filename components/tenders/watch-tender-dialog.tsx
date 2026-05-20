"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { newManualTenderId } from "@/lib/manual-tenders";
import { watchlist } from "@/lib/mock-data";
import type { Tender, Bidder, TenderStatus } from "@/lib/types";

interface BidderRow {
  name: string;
  ticker: string; // "" = not on watchlist
}

interface FormState {
  title: string;
  buyer: string;
  resultDate: string; // YYYY-MM-DD
  valueCr: string;
  sourceUrl: string;
  notes: string;
  status: TenderStatus;
  winner: string; // bidder name, "" = none
  bidders: BidderRow[];
}

const STATUS_OPTIONS: { value: TenderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "evaluation", label: "Under evaluation" },
  { value: "result_in", label: "Result in" },
  { value: "awarded", label: "Awarded" },
];

/** ISO -> YYYY-MM-DD for a <input type=date>. */
function isoToDateInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> ISO, assuming 11:00 IST (typical bid-opening time). */
function dateInputToIso(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T11:00:00+05:30`);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function blankForm(): FormState {
  return {
    title: "",
    buyer: "",
    resultDate: "",
    valueCr: "",
    sourceUrl: "",
    notes: "",
    status: "pending",
    winner: "",
    bidders: [{ name: "", ticker: "" }],
  };
}

function formFromTender(t: Tender): FormState {
  return {
    title: t.title,
    buyer: t.buyer,
    resultDate: isoToDateInput(t.resultDate),
    valueCr: t.estimatedValue ? String(t.estimatedValue / 1e7) : "",
    sourceUrl: t.sourceUrl ?? "",
    notes: t.notes ?? "",
    status: t.status,
    winner: t.winner ?? "",
    bidders: t.bidders.length
      ? t.bidders.map((b) => ({ name: b.name, ticker: b.ticker ?? "" }))
      : [{ name: "", ticker: "" }],
  };
}

export function WatchTenderDialog({
  open,
  onOpenChange,
  editTender,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTender?: Tender | null;
  onSave: (tender: Tender) => void;
}) {
  const [form, setForm] = useState<FormState>(blankForm());
  const [error, setError] = useState<string | null>(null);

  // (Re)initialise the form whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setForm(editTender ? formFromTender(editTender) : blankForm());
      setError(null);
    }
  }, [open, editTender]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setBidder = (i: number, patch: Partial<BidderRow>) =>
    setForm((f) => ({
      ...f,
      bidders: f.bidders.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }));

  const addBidder = () => setForm((f) => ({ ...f, bidders: [...f.bidders, { name: "", ticker: "" }] }));
  const removeBidder = (i: number) =>
    setForm((f) => ({ ...f, bidders: f.bidders.filter((_, idx) => idx !== i) }));

  const namedBidders = form.bidders.filter((b) => b.name.trim());
  const resultRecorded = form.status === "awarded" || form.status === "result_in";

  const handleSave = () => {
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.buyer.trim()) return setError("Buyer / ministry is required.");
    if (!form.resultDate) return setError("Result date is required.");

    const winnerName = resultRecorded ? form.winner.trim() : "";
    const bidders: Bidder[] = namedBidders.map((b) => ({
      name: b.name.trim(),
      ticker: b.ticker || undefined,
      status: winnerName
        ? b.name.trim() === winnerName
          ? "won"
          : "lost"
        : "applied",
    }));

    const valueCr = parseFloat(form.valueCr);
    const tender: Tender = {
      id: editTender?.id ?? newManualTenderId(),
      refNo: editTender?.refNo ?? `WATCH-${(editTender?.id ?? newManualTenderId()).slice(-6).toUpperCase()}`,
      title: form.title.trim(),
      buyer: form.buyer.trim(),
      description: form.notes.trim() || "Manually tracked tender.",
      estimatedValue: Number.isFinite(valueCr) && valueCr > 0 ? Math.round(valueCr * 1e7) : undefined,
      bidders,
      resultDate: dateInputToIso(form.resultDate),
      status: form.status,
      winner: winnerName || undefined,
      followUps: editTender?.followUps ?? [],
      publishedAt: editTender?.publishedAt ?? new Date().toISOString(),
      sourcePortal: "Manual",
      sourceUrl: form.sourceUrl.trim() || undefined,
      dataSource: "manual",
      notes: form.notes.trim() || undefined,
    };
    onSave(tender);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{editTender ? "Edit tracked tender" : "Watch a tender"}</DialogTitle>
          <DialogDescription>
            Add a tender you want to follow. The dashboard counts down to the result date and
            shows the outcome once you record it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Tender title" required>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Visa & passport services — Embassy of India, Rabat"
            />
          </Field>

          <Field label="Buyer / ministry" required>
            <Input
              value={form.buyer}
              onChange={(e) => set("buyer", e.target.value)}
              placeholder="e.g. Ministry of External Affairs"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Result date (D-day)" required>
              <Input type="date" value={form.resultDate} onChange={(e) => set("resultDate", e.target.value)} />
            </Field>
            <Field label="Est. value (₹ Cr)">
              <Input
                type="number"
                min="0"
                value={form.valueCr}
                onChange={(e) => set("valueCr", e.target.value)}
                placeholder="optional"
              />
            </Field>
          </div>

          {/* Bidders */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Bidders</label>
              <button
                type="button"
                onClick={addBidder}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add bidder
              </button>
            </div>
            <div className="space-y-2">
              {form.bidders.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={b.name}
                    onChange={(e) => setBidder(i, { name: e.target.value })}
                    placeholder="Company name"
                    className="flex-1"
                  />
                  <NativeSelect
                    value={b.ticker}
                    onChange={(v) => setBidder(i, { ticker: v })}
                    className="w-32"
                  >
                    <option value="">No ticker</option>
                    {watchlist.map((w) => (
                      <option key={w.ticker} value={w.ticker}>
                        {w.ticker}
                      </option>
                    ))}
                  </NativeSelect>
                  {form.bidders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBidder(i)}
                      className="text-muted-foreground hover:text-critical"
                      aria-label="Remove bidder"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <NativeSelect value={form.status} onChange={(v) => set("status", v as TenderStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {resultRecorded && (
              <Field label="Winner">
                <NativeSelect value={form.winner} onChange={(v) => set("winner", v)}>
                  <option value="">Not decided</option>
                  {namedBidders.map((b, i) => (
                    <option key={i} value={b.name.trim()}>
                      {b.name.trim()}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>

          <Field label="Source URL">
            <Input
              value={form.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
              placeholder="optional — link to the tender on CPPP / IREPS / news"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="optional — why you're watching this"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>

          {error && (
            <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editTender ? "Save changes" : "Watch tender"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-critical">*</span>}
      </label>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </select>
  );
}
