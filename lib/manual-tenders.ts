"use client";

/**
 * Manual tender-watch — user-added tenders, persisted in the browser.
 *
 * The portal scrapers are unreliable (captcha/OTP walls), so the
 * predictive calendar's reliable backbone is manual entry: the user adds
 * a tender they care about and the dashboard tracks its result date and
 * the winner once recorded.
 *
 * Storage is localStorage — zero infra, zero cost, works per-browser.
 * A synced backend can replace `load`/`persist` later without changing
 * callers.
 */

import { useCallback, useEffect, useState } from "react";
import type { Tender } from "@/lib/types";

const STORAGE_KEY = "tendertrack:manual-tenders:v1";

export function loadManualTenders(): Tender[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tender[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: Tender[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

/** Generate a stable id for a new manual tender. */
export function newManualTenderId(): string {
  return `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ManualTendersApi {
  tenders: Tender[];
  /** True once localStorage has been read (avoids an SSR/hydration flash). */
  loaded: boolean;
  /** Insert or replace a tender by id. */
  upsert: (tender: Tender) => void;
  /** Delete a tender by id. */
  remove: (id: string) => void;
}

export function useManualTenders(): ManualTendersApi {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTenders(loadManualTenders());
    setLoaded(true);
  }, []);

  const save = useCallback((next: Tender[]) => {
    setTenders(next);
    persist(next);
  }, []);

  const upsert = useCallback(
    (tender: Tender) => {
      setTenders((prev) => {
        const exists = prev.some((t) => t.id === tender.id);
        const next = exists
          ? prev.map((t) => (t.id === tender.id ? tender : t))
          : [tender, ...prev];
        persist(next);
        return next;
      });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setTenders((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      return next;
    });
  }, []);

  // `save` is exposed implicitly through upsert/remove; keep it referenced
  // so eslint doesn't flag it and future bulk-set use is easy.
  void save;

  return { tenders, loaded, upsert, remove };
}
