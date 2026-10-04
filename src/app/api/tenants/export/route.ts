import { overview, tenantPublicAddress } from "@/server/apps";
import { ok, requireSession } from "@/server/auth";
import { filterTenants, isExpired, parseTenantQuery, todayIn } from "@/server/tenant-query";

export async function GET(request: Request) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const query = parseTenantQuery(new URL(request.url).searchParams);
  const today = todayIn();
  const { apps, tenants } = await overview();
  const origin = (process.env.PUBLIC_URL?.trim() || new URL(request.url).origin).replace(/\/+$/, "");
  const rows = filterTenants(tenants, query, today).map((tenant) => {
    const app = apps.find((item) => item.key === tenant.app);
    return {
      program: app?.name ?? tenant.app,
      name: tenant.name,
      slug: tenant.slug,
      contactName: tenant.contactName,
      phone: tenant.phone,
      email: tenant.email,
      expiresAt: tenant.expiresAt,
      expired: isExpired(tenant, today),
      active: tenant.active,
      createdAt: tenant.createdAt.startsWith("1970") ? null : tenant.createdAt,
      address: app ? tenantPublicAddress(app, origin, tenant.slug, tenant.domains) : "",
    };
  });
  return ok({ rows, today });
}
