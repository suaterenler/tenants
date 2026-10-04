import { tenantCodeFromName } from "./slug";

export const REQUEST_STATUSES = ["new", "contacted", "trial", "converted", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_FIELDS = 40;
export const MAX_VALUE_LENGTH = 2000;
export const MAX_NOTE_LENGTH = 4000;

export const PRODUCT_KEYS = ["egitim-yonetim-sistemi", "kuafor-programi", "e-ticaret", "web-sitesi"] as const;

export type TrialRequest = {
  id: string;
  receivedAt: string;
  source: string;
  formSlug: string;
  formName: string;
  submissionId: string;
  submittedAt: string;
  locale: string | null;
  name: string;
  email: string;
  phone: string;
  product: string;
  company: string;
  fields: Record<string, string>;
  labels: Record<string, string>;
  ip: string | null;
  userAgent: string | null;
  status: RequestStatus;
  note: string;
  updatedAt: string;
  updatedBy: string;
  tenantApp?: string;
  tenantSlug?: string;
  tenantCreatedAt?: string;
};

export type InboundRequest = Omit<TrialRequest, "id" | "receivedAt" | "status" | "note" | "updatedAt" | "updatedBy">;

const KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

function stringMap(value: unknown, maxValue: number): Record<string, string> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_FIELDS) return null;
  const result: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (!KEY_PATTERN.test(key) || typeof entry !== "string" || entry.length > maxValue) return null;
    result[key] = entry.trim();
  }
  return result;
}

const COMPANY_KEYS = ["firma", "firma_adi", "isletme", "isletme_adi", "company"];

export function companyFrom(fields: Record<string, string>): string {
  for (const key of COMPANY_KEYS) {
    const value = fields[key]?.trim();
    if (value) return value.slice(0, 200);
  }
  return "";
}

export function withDefaults(record: TrialRequest): TrialRequest {
  return { ...record, company: typeof record.company === "string" ? record.company : "" };
}

export function parseInbound(body: unknown): InboundRequest | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const source = text(input.source, 40);
  const formSlug = text(input.formSlug, 100);
  const formName = text(input.formName, 200);
  if (!source || !formSlug || !formName) return null;
  const rawId = input.submissionId;
  const submissionId = typeof rawId === "number" && Number.isFinite(rawId) ? String(rawId) : text(rawId, 100);
  if (!submissionId) return null;
  const submittedAtRaw = text(input.submittedAt, 64);
  if (!submittedAtRaw || Number.isNaN(Date.parse(submittedAtRaw))) return null;
  const fields = stringMap(input.fields, MAX_VALUE_LENGTH);
  const labels = stringMap(input.labels, 200);
  const locale = optionalText(input.locale, 20);
  const ip = optionalText(input.ip, 64);
  const userAgent = optionalText(input.userAgent, 500);
  if (!fields || !labels || locale === undefined || ip === undefined || userAgent === undefined) return null;
  return {
    source,
    formSlug,
    formName,
    submissionId,
    submittedAt: new Date(submittedAtRaw).toISOString(),
    locale,
    name: (fields.ad_soyad ?? "").slice(0, 200),
    email: (fields.eposta ?? "").slice(0, 200),
    phone: (fields.telefon ?? "").slice(0, 60),
    product: (fields.urun ?? "").slice(0, 100),
    company: companyFrom(fields),
    fields,
    labels,
    ip,
    userAgent,
  };
}

export function sameSubmission(a: Pick<TrialRequest, "source" | "formSlug" | "submissionId">, b: Pick<TrialRequest, "source" | "formSlug" | "submissionId">): boolean {
  return a.source === b.source && a.formSlug === b.formSlug && a.submissionId === b.submissionId;
}

export function resolveRequestsSecret(env: Record<string, string | undefined>): string | null {
  return (env.TENANTS_SECRET ?? env.PLATFORM_SECRET)?.trim() || null;
}

export function bearerToken(header: string | null): string {
  return header !== null && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}

export type RequestPatch = { status?: RequestStatus; note?: string; tenantApp?: string; tenantSlug?: string; tenantCreatedAt?: string };

const TENANT_CODE_PATTERN = /^[a-z0-9-]{1,40}$/;

export const PRODUCT_PROGRAMS: Record<string, string> = { "egitim-yonetim-sistemi": "education", "kuafor-programi": "salon", "e-ticaret": "ecommerce", "web-sitesi": "cms" };
export const TRIAL_DAYS = 7;

export function programForProduct(product: string): string {
  return PRODUCT_PROGRAMS[product] ?? "";
}

export function programNameForProduct(product: string, programs: { key: string; name: string }[]): string {
  const key = programForProduct(product);
  return programs.find((program) => program.key === key)?.name ?? product;
}

export function trialExpiry(from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + TRIAL_DAYS);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parsePatch(body: unknown): RequestPatch | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const patch: RequestPatch = {};
  if ("status" in input) {
    if (!isRequestStatus(input.status)) return null;
    patch.status = input.status;
  }
  if ("note" in input) {
    if (typeof input.note !== "string" || input.note.length > MAX_NOTE_LENGTH) return null;
    patch.note = input.note.trim();
  }
  const hasTenant = "tenantApp" in input || "tenantSlug" in input || "tenantCreatedAt" in input;
  if (hasTenant) {
    const created = input.tenantCreatedAt;
    if (typeof input.tenantApp !== "string" || !TENANT_CODE_PATTERN.test(input.tenantApp)) return null;
    if (typeof input.tenantSlug !== "string" || !TENANT_CODE_PATTERN.test(input.tenantSlug)) return null;
    if (typeof created !== "string" || Number.isNaN(Date.parse(created))) return null;
    patch.tenantApp = input.tenantApp;
    patch.tenantSlug = input.tenantSlug;
    patch.tenantCreatedAt = new Date(created).toISOString();
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

const TURKISH_FOLD: Record<string, string> = { ş: "s", ı: "i", ğ: "g", ü: "u", ö: "o", ç: "c" };

export function localDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function inDateRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = localDay(value);
  if (!day) return false;
  return (!from || day >= from) && (!to || day <= to);
}

export function foldText(value: string): string {
  return value
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[şığüöç]/g, (char) => TURKISH_FOLD[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function columnMatches(value: string, query: string): boolean {
  const needle = foldText(query.trim());
  if (!needle) return true;
  if (foldText(value).includes(needle)) return true;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && value.replace(/\D/g, "").includes(digits);
}

export type SimilarReason = "company" | "email" | "phone";
export type SimilarRequest = { request: TrialRequest; reasons: SimilarReason[] };

function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 7 ? "" : digits.slice(-10);
}

export function findSimilarRequests(target: TrialRequest, all: TrialRequest[]): SimilarRequest[] {
  const company = tenantCodeFromName(target.company);
  const email = target.email.trim().toLowerCase();
  const phone = phoneKey(target.phone);
  const result: SimilarRequest[] = [];
  for (const request of all) {
    if (request.id === target.id) continue;
    const reasons: SimilarReason[] = [];
    if (company && tenantCodeFromName(request.company) === company) reasons.push("company");
    if (email && request.email.trim().toLowerCase() === email) reasons.push("email");
    if (phone && phoneKey(request.phone) === phone) reasons.push("phone");
    if (reasons.length > 0) result.push({ request, reasons });
  }
  return result;
}

export function tenantLinkAllowed(existing: Pick<TrialRequest, "tenantApp" | "tenantSlug">, patch: RequestPatch): boolean {
  if (!existing.tenantSlug) return true;
  if (patch.tenantApp === undefined && patch.tenantSlug === undefined) return true;
  return patch.tenantApp === existing.tenantApp && patch.tenantSlug === existing.tenantSlug;
}
