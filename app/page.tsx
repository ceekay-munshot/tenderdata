import { loadBseUpdates } from "@/lib/server/load-updates";
import { loadBidAssistTenders } from "@/lib/server/load-bidassist";
import { loadBidAssistAwards } from "@/lib/server/load-bidassist-awards";
import { TendersClient } from "./tenders-client";

// Render on every request (the upstream fetches are still ISR-cached).
export const dynamic = "force-dynamic";

export default async function TendersPage() {
  const [bseLoad, baLoad, awardLoad] = await Promise.all([
    loadBseUpdates(),
    loadBidAssistTenders(),
    loadBidAssistAwards(),
  ]);

  return (
    <TendersClient
      bseUpdates={bseLoad.payload?.updates ?? []}
      bseFetchedAt={bseLoad.fetchedAt}
      bseStale={bseLoad.stale}
      bseStatus={bseLoad.status}
      bseError={bseLoad.error}
      liveTenders={baLoad.tenders}
      sourceFetchedAt={baLoad.fetchedAt}
      sourceScanned={baLoad.scanned}
      sourceStatus={baLoad.status}
      sourceStale={baLoad.stale}
      sourceError={baLoad.error}
      awardTenders={awardLoad.tenders}
      awardFetchedAt={awardLoad.fetchedAt}
      awardScanned={awardLoad.scanned}
      awardStatus={awardLoad.status}
      awardStale={awardLoad.stale}
      awardError={awardLoad.error}
    />
  );
}
