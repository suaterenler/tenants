import { tr } from "@messages/tr";
import { fail, ok, rateLimited, signResetToken } from "@/server/auth";
import { adminEmail, maskEmail, publicUrl, sendMail } from "@/server/mail";

export async function POST(request: Request) {
  if (rateLimited(request, 3, 15 * 60 * 1000, "forgot")) return fail("rateLimited", 429);
  const to = adminEmail();
  const link = `${publicUrl()}/admin?reset=${encodeURIComponent(await signResetToken())}`;
  const m = tr.tenants.resetMail;
  try {
    await sendMail({
      to,
      subject: m.subject,
      text: `${m.intro}\n\n${link}\n\n${m.expires}\n${m.ignore}`,
      html: `<p>${m.intro}</p><p><a href="${link}">${m.button}</a></p><p style="color:#666">${m.expires}<br>${m.ignore}</p>`,
    });
  } catch (error) {
    console.error(error);
    return fail("mailFailed", 502);
  }
  return ok({ sentTo: maskEmail(to) });
}
