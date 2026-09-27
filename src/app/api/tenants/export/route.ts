import * as XLSX from "xlsx";
import { tr } from "@messages/tr";
import { overview, tenantPublicAddress } from "@/server/apps";
import { requireSession } from "@/server/auth";
import { filterTenants, isExpired, parseTenantQuery, todayIn } from "@/server/tenant-query";

function displayDate(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const query = parseTenantQuery(new URL(request.url).searchParams);
  const today = todayIn();
  const { apps, tenants } = await overview();
  const origin = (process.env.PUBLIC_URL?.trim() || new URL(request.url).origin).replace(/\/+$/, "");
  const t = tr.tenants;
  const rows = filterTenants(tenants, query, today).map((tenant) => {
    const app = apps.find((item) => item.key === tenant.app);
    return {
      [t.program]: app?.name ?? tenant.app,
      [t.name]: tenant.name,
      [t.slug]: tenant.slug,
      [t.contactName]: tenant.contactName,
      [t.phone]: tenant.phone,
      [t.email]: tenant.email,
      [t.expiresAt]: displayDate(tenant.expiresAt),
      [t.status]: isExpired(tenant, today) ? t.expired : tenant.active ? t.active : t.passive,
      [t.createdAt]: tenant.createdAt.startsWith("1970") ? "" : displayDate(tenant.createdAt),
      [t.address]: app ? tenantPublicAddress(app, origin, tenant.slug, tenant.domains) : "",
    };
  });
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [12, 32, 16, 22, 18, 28, 14, 12, 14, 48].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, t.title.slice(0, 31));
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kurumlar-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
