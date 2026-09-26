import { tr } from "@messages/tr";
import { AgentError, agentCall, findApp, type TenantRecord } from "@/server/apps";
import { fail, ok, rateLimited, readBody, requireSession } from "@/server/auth";
import { maskEmail, publicUrl, sendMail } from "@/server/mail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export async function POST(request: Request, context: { params: Promise<{ app: string; slug: string }> }) {
  const denied = await requireSession(request);
  if (denied) return denied;
  if (rateLimited(request, 20, 15 * 60 * 1000, "credentials")) return fail("rateLimited", 429);
  const params = await context.params;
  const app = findApp(params.app);
  if (!app) return fail("unknownProgram", 400);
  const body = await readBody(request);
  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_PATTERN.test(to)) return fail("tenantInvalidEmail", 400);
  if (!password || password.length > 200) return fail("invalidRecord", 400);
  let tenant: TenantRecord | undefined;
  try {
    tenant = (await agentCall<TenantRecord[]>(app, "/tenants")).find((record) => record.slug === params.slug);
  } catch (error) {
    if (error instanceof AgentError) return fail(error.code, error.status);
    throw error;
  }
  if (!tenant) return fail("notFound", 404);
  const address = `${(app.publicUrl ?? `${publicUrl()}${app.publicPath}`).replace(/\/+$/, "")}/${tenant.slug}`;
  const m = tr.tenants.credentialsMail;
  const fill = (text: string) => text.replace("{program}", app.name).replace("{name}", tenant.name);
  const rows: [string, string][] = [
    [tr.tenants.address, address],
    [tr.tenants.adminUser, "admin"],
    [tr.tenants.adminPassword, password],
  ];
  try {
    await sendMail({
      to,
      subject: fill(m.subject),
      text: `${fill(m.intro)}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${m.changePassword}`,
      html: `<p>${escapeHtml(fill(m.intro))}</p><table cellpadding="6" style="border-collapse:collapse">${rows
        .map(([label, value]) => `<tr><td style="color:#666">${escapeHtml(label)}</td><td><b>${label === tr.tenants.address ? `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>` : escapeHtml(value)}</b></td></tr>`)
        .join("")}</table><p style="color:#666">${escapeHtml(m.changePassword)}</p>`,
    });
  } catch (error) {
    console.error(error);
    return fail("mailFailed", 502);
  }
  return ok({ sentTo: maskEmail(to) });
}
