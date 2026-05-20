import { loadBseUpdates } from "@/lib/server/load-updates";
import { loadCpppTenders } from "@/lib/server/load-cppp";
import { TendersClient } from "./tenders-client";

// Render on every request (the upstream fetches are still ISR-cached).
export const dynamic = "force-dynamic";

export default async function TendersPage() {
  const [bseLoad, cpppLoad] = await Promise.all([loadBseUpdates(), loadCpppTenders()]);

  return (
    <TendersClient
      bseUpdates={bseLoad.payload?.updates ?? []}
      bseFetchedAt={bseLoad.fetchedAt}
      bseStale={bseLoad.stale}
      bseStatus={bseLoad.status}
      bseError={bseLoad.error}
      liveTenders={cpppLoad.tenders}
      cpppFetchedAt={cpppLoad.fetchedAt}
      cpppScanned={cpppLoad.scanned}
      cpppStatus={cpppLoad.status}
      cpppStale={cpppLoad.stale}
      cpppError={cpppLoad.error}
    />
  );
}
