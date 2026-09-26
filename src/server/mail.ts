import "server-only";
import nodemailer from "nodemailer";

export function adminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() || "suaterenler@gmail.com";
}

export function publicUrl(): string {
  return (process.env.PUBLIC_URL?.trim() || "https://app.erenleryazilim.com").replace(/\/+$/, "");
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 3))}@${domain}`;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const host = process.env.SMTP_HOST?.trim() || "127.0.0.1";
  if (host === "log") {
    console.log(`[mail] ${message.to} · ${message.subject}\n${message.text}`);
    return;
  }
  const user = process.env.SMTP_USER?.trim();
  const port = Number(process.env.SMTP_PORT ?? 25);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
    tls: { rejectUnauthorized: host !== "127.0.0.1" && host !== "localhost" },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM?.trim() || "Erenler Yönetim <noreply@erenleryazilim.com>", ...message });
}
