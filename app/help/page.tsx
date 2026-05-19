import Link from "next/link";
import { HelpCircle, BookOpen, Sparkles, Radio, CalendarRange, BellRing, Telescope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HelpCircle className="h-3 w-3 text-primary" />
          <span>Help & Documentation</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How Catalyst works</h1>
          <p className="text-sm text-muted-foreground">
            The predictive philosophy in 5 minutes.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Telescope className="h-4 w-4 text-primary" /> The premise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Most retail investors react to news. Catalyst flips this. Government tender timelines and SEBI
            disclosures are <span className="font-medium text-foreground">already public</span> — they&apos;re just buried in PDFs and
            inaccessible at scale. Catalyst is an attention engine that surfaces the few catalysts that actually move stocks.
          </p>
          <p>
            <span className="font-medium text-foreground">Anchor example:</span> BLS International lost its UAE visa contract on 5 May 2026.
            The financial bid opening date was listed in MEA tender documents 53 days in advance. The stock crashed ~30% over the
            catalyst window. Catalyst&apos;s job is to flag this kind of D-Day before it happens.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Feature
          icon={CalendarRange}
          title="Crystal Ball — Tender calendar"
          body="Polls CPPP, GeM, and state tender portals every 15 minutes. Pulls relevant tender PDFs through a semantic sector filter (no keyword blindness). Extracts bid submission, technical evaluation and financial bid opening dates. Plots them on a calendar."
        />
        <Feature
          icon={Radio}
          title="Smoke Detector — Live disclosures"
          body="Polls BSE & NSE corporate announcement feeds every 60s. Auto-tags each Reg 30 filing by severity (critical negative, critical positive, structural drama) using high-impact trigger words and an LLM classifier."
        />
        <Feature
          icon={Sparkles}
          title="Loopback intelligence"
          body="If a disclosure mentions a newly submitted bid, the system backward-tracks the project on tender portals and automatically adds its financial bid opening date to your calendar. Ecosystem moves get caught: when a competitor wins, the watchlist company moves too."
        />
        <Feature
          icon={BellRing}
          title="Notification engine"
          body="Telegram, Slack, email, and custom webhooks. 48-hour D-Day pings by default. Configure lead times and severity gates per channel."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> Quick start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Step n={1} title="Add companies to your watchlist">
            Pick tickers you care about. Catalyst auto-detects their sector and applies semantic tender filtering.
          </Step>
          <Step n={2} title="Add buyers and competitors">
            Track ministries (e.g. MEA, MoD) and rival bidders (e.g. VFS Global, Alhind Group). Ecosystem signals
            are often louder than direct ones.
          </Step>
          <Step n={3} title="Configure alerts">
            Connect a Telegram bot or webhook. Default: 48h advance ping on financial bid openings.
          </Step>
          <Step n={4} title="Trade the catalyst">
            On D-Day, position 30 minutes before the financial bid opening. Within 2-6 hours the L1 result begins
            leaking. <span className="text-muted-foreground">Educational only — not investment advice.</span>
          </Step>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently asked</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Faq q="Why isn&apos;t this just every tender on CPPP?">
            CPPP gets ~15,000 daily tenders. Catalyst&apos;s semantic filter (BGE embeddings + cosine ≥ 0.62 +
            LLM verification) keeps only those that map to your watchlist&apos;s sectors. Typical day: 50-100 relevant tenders.
          </Faq>
          <Faq q="How accurate is the PDF date extraction?">
            Two-stage: PyMuPDF for text-native PDFs, Tesseract OCR for scanned ones, then Gemini structured output
            for the actual date extraction. We see ~94% precision and 89% recall on a manually-labelled benchmark of 200 tender PDFs.
          </Faq>
          <Faq q="Can I get a programmatic feed?">
            Yes — paid tiers get a JSON API and webhook deliveries. See the Alerts → Channels page for the payload schema.
          </Faq>
          <Faq q="Does this count as research advice?">
            No. Catalyst is a data + alerting product. As distribution scales we may register as a SEBI Research Analyst.
          </Faq>
        </CardContent>
      </Card>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Sparkles; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {n}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card/40 p-3">
      <div className="text-sm font-medium">{q}</div>
      <div className="mt-1 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}
