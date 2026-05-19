import { loadBseUpdates } from "@/lib/server/load-updates";
import { TendersClient } from "./tenders-client";

// Render on every request (we still cache the upstream fetch via revalidate).
export const dynamic = "force-dynamic";

export default async function TendersPage() {
  const bseLoad = await loadBseUpdates();
  return (
    <TendersClient
      bseUpdates={bseLoad.payload?.updates ?? []}
      bseFetchedAt={bseLoad.fetchedAt}
      bseStale={bseLoad.stale}
      bseStatus={bseLoad.status}
      bseError={bseLoad.error}
    />
  );
}
