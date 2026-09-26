import { agentCall, platformApps } from "@/server/apps";
import { ok, requireSession } from "@/server/auth";

type Usage = { slug: string; dbBytes: number | null; uploadBytes: number };

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const results = await Promise.all(
    platformApps().map(async (app) => {
      try {
        const rows = await agentCall<Usage[]>(app, "/usage", { timeoutMs: 2 * 60 * 1000 });
        return rows.map((row) => ({ ...row, app: app.key }));
      } catch {
        return [];
      }
    }),
  );
  return ok({ rows: results.flat(), calculatedAt: new Date().toISOString() });
}
