"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Archive, ArrowDown, ArrowUp, Building2, ChevronLeft, ChevronRight, ChevronsUpDown, Copy, Database, DatabaseArrowDown, Download, ExternalLink, FolderDown, FolderOpen, Globe, HardDrive, Info, KeyRound, Loader2, LogIn, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MadeBy } from "@/components/made-by";
import { AdminHeader } from "@/components/panel/admin-header";
import { ConfirmProvider, useConfirm } from "@/components/panel/confirm-dialog";
import { DatePicker } from "@/components/panel/date-picker";
import { Field } from "@/components/panel/field";
import { PasswordInput } from "@/components/panel/password-input";
import { HeaderDateRange, HeaderSelect, HeaderText } from "@/components/panel/header-filters";
import { OptionSelect } from "@/components/panel/option-select";
import { PhoneInput } from "@/components/panel/phone-input";
import { RelativeTimeChip } from "@/components/panel/relative-time-chip";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CreateTenantDialog, CredentialsDialog, domainUrl, EMPTY_FORM, panelUrl, tenantAddress, type AppInfo, type Secret, type Tenant, type TenantForm } from "@/components/panel/tenant-create";
import { adminFetch, AdminRequestError, authHeaders, BASE_PATH, readToken, storeToken, type ApiBody } from "@/lib/admin-client";
import { excelDate, writeExcel, type ExcelCell } from "@/lib/excel";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";

const PAGE_SIZES = [25, 50, 100];
const EMPTY_OVERVIEW: Overview = { apps: [], rows: [], total: 0, page: 1, pageCount: 1, pageSize: 25, today: "" };

type TenantSort = "name" | "app" | "expiresAt" | "status";
type SortDir = "asc" | "desc";
type UsageRow = { app: string; slug: string; dbBytes: number | null; uploadBytes: number };
type UsageResult = { rows: UsageRow[]; calculatedAt: string };
type BuildInfo = { commit: string | null; builtAt: string | null };
type ProgramVersion = { key: string; name: string; running: BuildInfo | null; expected: { commit: string; builtAt: string | null; receivedAt?: string } | null; failed: { commit: string; failedAt: string; runUrl: string | null } | null };
type VersionState = "current" | "pending" | "unknown" | "noInfo" | "offline" | "failed";

function versionState(version: ProgramVersion): VersionState {
  if (version.failed) return "failed";
  if (!version.running) return "offline";
  const running = version.running.commit;
  if (!running) return "noInfo";
  const expected = version.expected?.commit;
  if (!expected) return "unknown";
  const [short, long] = running.length <= expected.length ? [running, expected] : [expected, running];
  if (long.startsWith(short)) return "current";
  const builtAt = Date.parse(version.running.builtAt ?? "");
  const expectedAt = Date.parse(version.expected?.builtAt ?? version.expected?.receivedAt ?? "");
  return Number.isFinite(builtAt) && Number.isFinite(expectedAt) && builtAt >= expectedAt ? "current" : "pending";
}

const VERSION_TONE: Record<VersionState, { chip: string; dot: string }> = {
  current: { chip: "border-emerald-500/40 bg-emerald-500/10", dot: "bg-emerald-500" },
  pending: { chip: "border-amber-500/50 bg-amber-500/10", dot: "bg-amber-500 animate-pulse" },
  unknown: { chip: "border-border bg-muted/40", dot: "bg-sky-500" },
  noInfo: { chip: "border-border bg-muted/40", dot: "bg-muted-foreground/40" },
  offline: { chip: "border-destructive/40 bg-destructive/5", dot: "bg-destructive" },
  failed: { chip: "border-destructive/60 bg-destructive/10", dot: "bg-destructive animate-pulse" },
};

function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Overview = { apps: AppInfo[]; rows: Tenant[]; total: number; page: number; pageCount: number; pageSize: number; today: string };
async function adminDownload(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/api${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiBody<unknown> | null;
    throw new AdminRequestError(payload && !payload.ok ? payload.error : `HTTP ${response.status}`, response.status);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function adminUpload(path: string, file: File): Promise<void> {
  const response = await fetch(`${BASE_PATH}/api${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/zip" },
    body: file,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as ApiBody<unknown> | null;
  if (!payload) throw new AdminRequestError(`HTTP ${response.status}`, response.status);
  if (!payload.ok) throw new AdminRequestError(payload.error, response.status);
}

function isExpired(tenant: Tenant, today: string): boolean {
  return tenant.expiresAt !== null && tenant.expiresAt <= today;
}

type TenantExportRow = { program: string; name: string; slug: string; contactName: string; phone: string; email: string; expiresAt: string | null; expired: boolean; active: boolean; createdAt: string | null; address: string };

function noopSubscribe(): () => void {
  return () => undefined;
}

export default function AdminPage() {
  return (
    <ConfirmProvider>
      <AdminScreen />
    </ConfirmProvider>
  );
}

function readResetToken(): string | null {
  return new URLSearchParams(window.location.search).get("reset");
}

function AdminScreen() {
  const stored = useSyncExternalStore(noopSubscribe, () => Boolean(readToken()), () => null);
  const initialReset = useSyncExternalStore(noopSubscribe, readResetToken, () => null);
  const [override, setSignedIn] = useState<boolean | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const signedIn = override ?? stored;

  function signOut() {
    storeToken(null);
    setSignedIn(false);
  }

  function finishReset() {
    window.history.replaceState(null, "", window.location.pathname);
    storeToken(null);
    setSignedIn(false);
    setResetDone(true);
  }

  if (signedIn === null) return null;
  if (initialReset && !resetDone) return <PasswordReset token={initialReset} onDone={finishReset} />;
  return signedIn ? <TenantManager onSignOut={signOut} /> : <AdminLogin onSignedIn={() => setSignedIn(true)} />;
}

function Toolbar() {
  return (
    <div className="flex items-center gap-1">
      <LocaleSwitcher />
      <ThemeToggle />
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  const t = useI18n().messages;
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <Toolbar />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="flex-col items-center gap-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </span>
          <CardTitle className="text-2xl font-semibold">{t.tenants.title}</CardTitle>
          <CardDescription>{t.tenants.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <div className="absolute bottom-4">
        <MadeBy />
      </div>
    </div>
  );
}

function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useI18n().messages;
  const confirm = useConfirm();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    setSubmitting(true);
    try {
      const result = await adminFetch<{ token: string }>("/login", { method: "POST", body: { password } });
      toast.dismiss();
      storeToken(result.token);
      onSignedIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.unexpected);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot() {
    const ok = await confirm({ message: t.tenants.forgotConfirm, confirmText: t.tenants.forgotSend });
    if (!ok) return;
    setSending(true);
    try {
      const result = await adminFetch<{ sentTo: string }>("/password/forgot", { method: "POST", body: {} });
      toast.success(t.tenants.forgotSent.replace("{email}", result.sentTo));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.unexpected);
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <Field label={t.tenants.password} htmlFor="admin-password" required>
          <PasswordInput id="admin-password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
        </Field>
        <Button type="submit" disabled={submitting || !password}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t.tenants.login}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => void handleForgot()} disabled={sending}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t.tenants.forgotPassword}
        </Button>
      </form>
    </AuthShell>
  );
}

function DisabledReason({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-not-allowed" tabIndex={0} aria-label={reason} />}>{children}</TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function UsageCell({ row }: { row: UsageRow | null }) {
  const { messages: t, locale } = useI18n();
  if (!row) return <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>;
  const db = row.dbBytes ?? 0;
  return (
    <TableCell className="text-right text-sm tabular-nums" title={`${t.tenants.database}: ${row.dbBytes === null ? "—" : formatBytes(db, locale)} · ${t.tenants.files}: ${formatBytes(row.uploadBytes, locale)}`}>
      <div className="font-medium">{formatBytes(db + row.uploadBytes, locale)}</div>
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1" title={t.tenants.database}>
          <Database className="size-3" />
          {row.dbBytes === null ? "—" : formatBytes(db, locale)}
        </span>
        <span className="inline-flex items-center gap-1" title={t.tenants.files}>
          <FolderOpen className="size-3" />
          {formatBytes(row.uploadBytes, locale)}
        </span>
      </div>
    </TableCell>
  );
}

function PasswordReset({ token, onDone }: { token: string; onDone: () => void }) {
  const t = useI18n().messages;
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mismatch = repeat !== "" && password !== repeat;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || password !== repeat) return;
    setSubmitting(true);
    try {
      await adminFetch<{ changed: boolean }>("/password/reset", { method: "POST", body: { token, password } });
      toast.success(t.tenants.resetDone);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.unexpected);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <p className="text-center text-sm font-medium">{t.tenants.resetTitle}</p>
        <Field label={t.tenants.newPassword} htmlFor="new-password" required hint={t.tenants.passwordHint}>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoFocus />
        </Field>
        <Field label={t.tenants.newPasswordRepeat} htmlFor="new-password-repeat" required hint={mismatch ? t.tenants.passwordMismatch : undefined}>
          <PasswordInput id="new-password-repeat" value={repeat} onChange={setRepeat} invalid={mismatch} />
        </Field>
        <Button type="submit" disabled={submitting || !password || password !== repeat}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t.tenants.resetSubmit}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={onDone}>
          {t.tenants.backToLogin}
        </Button>
      </form>
    </AuthShell>
  );
}

function TenantManager({ onSignOut }: { onSignOut: () => void }) {
  const { messages: t, locale } = useI18n();
  const confirm = useConfirm();
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW);
  const [versions, setVersions] = useState<ProgramVersion[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contact, setContact] = useState("");
  const [debouncedContact, setDebouncedContact] = useState("");
  const [expires, setExpires] = useState({ from: "", to: "" });
  const [debouncedExpires, setDebouncedExpires] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [appFilter, setAppFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<TenantSort>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TenantForm>(EMPTY_FORM);
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("general");
  const [usage, setUsage] = useState<UsageResult | null>(null);
  const [deleting, setDeleting] = useState<Tenant | null>(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [calculating, setCalculating] = useState(false);
  const today = overview.today;

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof AdminRequestError && error.status === 401) {
        onSignOut();
        return;
      }
      toast.error(error instanceof Error ? error.message : t.errors.unexpected);
    },
    [onSignOut, t],
  );

  const queryString = useCallback(
    (paged: boolean) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (debouncedContact) params.set("contact", debouncedContact);
      if (debouncedExpires.from) params.set("expiresFrom", debouncedExpires.from);
      if (debouncedExpires.to) params.set("expiresTo", debouncedExpires.to);
      if (appFilter) params.set("app", appFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sort", sort);
      params.set("dir", sortDir);
      if (paged) {
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
      }
      const value = params.toString();
      return value ? `?${value}` : "";
    },
    [debouncedSearch, debouncedContact, debouncedExpires, appFilter, statusFilter, sort, sortDir, page, pageSize],
  );

  const load = useCallback(
    () =>
      adminFetch<Overview>(`/tenants${queryString(true)}`)
        .then((data) => {
          setOverview(data);
          if (data.page !== page) setPage(data.page);
        })
        .catch(handleError)
        .finally(() => setLoading(false)),
    [handleError, queryString, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadVersions = useCallback(
    () =>
      adminFetch<ProgramVersion[]>("/versions")
        .then(setVersions)
        .catch(() => undefined)
        .finally(() => setVersionsLoaded(true)),
    [],
  );

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setDebouncedContact(contact.trim());
      setDebouncedExpires(expires);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, contact, expires]);

  async function confirmBackup(tenant: Tenant, kind: "database" | "files") {
    const message = (kind === "database" ? t.tenants.backupDatabaseConfirm : t.tenants.backupFilesConfirm).replace("{name}", tenant.name);
    const ok = await confirm({ message, confirmText: t.tenants.download });
    if (ok) await downloadBackup(tenant, kind);
  }

  async function downloadBackup(tenant: Tenant, kind: "database" | "files") {
    setDownloading(`${tenant.app}:${tenant.slug}:${kind}`);
    try {
      await adminDownload(`/tenants/${tenant.app}/${tenant.slug}/backup/${kind}`, `${tenant.app}_${tenant.slug}-${kind}.zip`);
      toast.success(t.tenants.backupReady);
    } catch (error) {
      handleError(error);
    } finally {
      setDownloading(null);
    }
  }

  async function restoreDatabase(tenant: Tenant, file: File) {
    const message = t.tenants.restoreConfirm.replace("{name}", tenant.name).replace("{file}", file.name);
    const ok = await confirm({ message, confirmText: t.tenants.restore, danger: true });
    if (!ok) return;
    setRestoring(true);
    try {
      await adminUpload(`/tenants/${tenant.app}/${tenant.slug}/restore/database`, file);
      toast.success(t.tenants.restored);
    } catch (error) {
      handleError(error);
    } finally {
      setRestoring(false);
    }
  }

  function askDelete(tenant: Tenant) {
    setDialogOpen(false);
    setDeleteCode("");
    setDeleting(tenant);
  }

  async function confirmDelete() {
    if (!deleting || deleteCode !== deleting.slug) return;
    setDeleteBusy(true);
    try {
      await adminFetch<{ deleted: boolean }>(`/tenants/${deleting.app}/${deleting.slug}`, { method: "DELETE" });
      toast.success(t.tenants.deleted.replace("{name}", deleting.name));
      setDeleting(null);
      setUsage(null);
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function calculateUsage() {
    setCalculating(true);
    try {
      setUsage(await adminFetch<UsageResult>("/tenants/usage"));
    } catch (error) {
      handleError(error);
    } finally {
      setCalculating(false);
    }
  }

  const usageOf = (tenant: Tenant) => usage?.rows.find((row) => row.app === tenant.app && row.slug === tenant.slug) ?? null;
  const usageTotal = usage ? usage.rows.reduce((sum, row) => sum + (row.dbBytes ?? 0) + row.uploadBytes, 0) : 0;
  const columnCount = usage ? 7 : 6;

  async function exportExcel() {
    setExporting(true);
    try {
      const data = await adminFetch<{ rows: TenantExportRow[]; today: string }>(`/tenants/export${queryString(false)}`);
      const text = (value: string | null): ExcelCell => (value ? (excelDate(value) ?? value) : "");
      await writeExcel({
        fileName: `hesaplar-${data.today}.xlsx`,
        sheetName: t.tenants.title,
        header: [t.tenants.program, t.tenants.name, t.tenants.slug, t.tenants.contactName, t.tenants.phone, t.tenants.email, t.tenants.expiresAt, t.tenants.status, t.tenants.createdAt, t.tenants.address],
        rows: data.rows.map((row) => [row.program, row.name, row.slug, row.contactName, row.phone, row.email, text(row.expiresAt), row.expired ? t.tenants.expired : row.active ? t.tenants.active : t.tenants.passive, text(row.createdAt), row.address]),
      });
    } catch (error) {
      handleError(error);
    } finally {
      setExporting(false);
    }
  }

  const appName = useCallback((key: string) => overview.apps.find((app) => app.key === key)?.name ?? key, [overview.apps]);

  function toggleSort(key: TenantSort) {
    if (sort === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortHead(key: TenantSort, label: string, className?: string) {
    const active = sort === key;
    return (
      <TableHead className={className} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground" onClick={() => toggleSort(key)}>
          {label}
          {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
        </button>
      </TableHead>
    );
  }

  const rows = overview.rows;

  const formApp = overview.apps.find((app) => app.key === form.app);

  function openCreate() {
    setCreateOpen(true);
  }

  function openEdit(tenant: Tenant) {
    setEditing(tenant);
    setTab("general");
    setForm({
      app: tenant.app,
      slug: tenant.slug,
      name: tenant.name,
      active: tenant.active,
      contactName: tenant.contactName,
      phone: tenant.phone,
      email: tenant.email,
      expiresAt: tenant.expiresAt ?? "",
      disabledModules: tenant.disabledModules,
      domains: (tenant.domains ?? []).join("\n"),
    });
    setDialogOpen(true);
  }

  const formDomains = form.domains.split(/[\s,]+/).filter(Boolean);
  const standardAddress = form.slug ? tenantAddress(overview.apps, form.app, form.slug) : "";
  const addressLinks = [...new Set([standardAddress, ...formDomains.map((domain) => domainUrl(overview.apps, form.app, domain))].filter(Boolean))];

  function patch(changes: Partial<TenantForm>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function toggleModule(key: string, enabled: boolean) {
    setForm((current) => ({
      ...current,
      disabledModules: enabled ? current.disabledModules.filter((item) => item !== key) : [...current.disabledModules, key],
    }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      contactName: form.contactName,
      phone: form.phone,
      email: form.email,
      expiresAt: form.expiresAt || null,
      disabledModules: form.disabledModules,
      domains: form.domains.split(/[\s,]+/).filter(Boolean),
    };
    try {
      if (editing) {
        await adminFetch<Tenant>(`/tenants/${editing.app}/${editing.slug}`, { method: "PATCH", body: { ...payload, active: form.active } });
        toast.success(t.tenants.saved);
        setDialogOpen(false);
      }
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tenant: Tenant, next: boolean) {
    const message = (next ? t.tenants.activateConfirm : t.tenants.deactivateConfirm).replace("{name}", tenant.name);
    const ok = await confirm({ message, confirmText: next ? t.tenants.activate : t.tenants.deactivate, danger: !next });
    if (!ok) return;
    try {
      await adminFetch<Tenant>(`/tenants/${tenant.app}/${tenant.slug}`, { method: "PATCH", body: { active: next } });
      await load();
    } catch (error) {
      handleError(error);
    }
  }

  async function resetAdmin(tenant: Tenant) {
    const ok = await confirm({ message: t.tenants.resetAdminConfirm.replace("{name}", tenant.name), confirmText: t.tenants.resetAdmin, danger: true });
    if (!ok) return;
    try {
      const result = await adminFetch<{ password: string }>(`/tenants/${tenant.app}/${tenant.slug}/reset-admin`, { method: "POST", body: {} });
      setDialogOpen(false);
      setSecret({ title: t.tenants.passwordReset, tenant, password: result.password });
    } catch (error) {
      handleError(error);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.tenants.copied);
    } catch {
      return;
    }
  }

  const appOptions = [...overview.apps.map((app) => ({ value: app.key, label: app.online ? app.name : `${app.name} (${t.tenants.notConnected})` }))];
  const statusOptions = [
    { value: "active", label: t.tenants.active },
    { value: "passive", label: t.tenants.passive },
    { value: "expired", label: t.tenants.expired },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader active="tenants" onSignOut={onSignOut} />
      <main className="mx-auto flex max-w-[100rem] flex-col gap-4 p-4">
        {!versionsLoaded ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
            {Array.from({ length: Math.max(overview.apps.length + 1, 5) }, (_, index) => (
              <div key={index} className="flex min-h-[115px] flex-col gap-1.5 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="size-2.5 rounded-full" />
                </div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : versions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {versions.map((version) => {
              const state = versionState(version);
              const tone = VERSION_TONE[state];
              const label = t.tenants.versionState[state];
              const hint =
                state === "failed"
                  ? t.tenants.versionFailed.replace("{commit}", version.failed?.commit.slice(0, 7) ?? "")
                  : state === "pending"
                  ? t.tenants.versionPending.replace("{commit}", version.expected?.commit.slice(0, 7) ?? "")
                  : state === "current"
                    ? t.tenants.versionCurrent
                    : state === "unknown"
                      ? t.tenants.versionUnknown
                      : state === "noInfo"
                        ? t.tenants.versionNoInfo
                        : t.tenants.notConnected;
              const cardClass = cn("flex flex-col gap-1.5 rounded-lg border p-3", tone.chip);
              const card = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{version.name}</span>
                    <span className={cn("size-2.5 shrink-0 rounded-full", tone.dot)} />
                  </div>
                  <div className="font-mono text-base leading-none">{version.running?.commit?.slice(0, 7) ?? "—"}</div>
                  <div className="flex min-h-4 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {shortDate(version.running?.builtAt)}
                    <RelativeTimeChip value={version.running?.builtAt} />
                  </div>
                  <div className="truncate text-xs font-medium">
                    {label}
                    {state === "pending" ? <span className="font-mono"> → {version.expected?.commit.slice(0, 7)}</span> : null}
                    {state === "failed" ? <span className="font-mono"> · {version.failed?.commit.slice(0, 7)}</span> : null}
                  </div>
                </>
              );
              return version.failed?.runUrl ? (
                <a key={version.key} href={version.failed.runUrl} target="_blank" rel="noopener noreferrer" title={hint} className={cardClass}>
                  {card}
                </a>
              ) : (
                <div key={version.key} title={hint} className={cardClass}>
                  {card}
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-xl font-semibold">{t.tenants.title}</h2>
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true);
              const minimum = new Promise((resolve) => window.setTimeout(resolve, 600));
              void Promise.all([load(), loadVersions(), minimum]).finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            aria-label={t.tenants.refresh}
            title={t.tenants.refresh}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            {t.tenants.refresh}
          </Button>
          <Button variant="outline" onClick={() => void calculateUsage()} disabled={calculating || overview.total === 0}>
            {calculating ? <Loader2 className="size-4 animate-spin" /> : <HardDrive className="size-4" />}
            {t.tenants.calculateUsage}
          </Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || overview.total === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t.tenants.export}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t.tenants.newTenant}
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <TableHeader>
                <TableRow>
                  {sortHead("app", t.tenants.program, "min-w-36")}
                  {sortHead("name", t.tenants.name, "min-w-40")}
                  <TableHead className="min-w-36">{t.tenants.contact}</TableHead>
                  {sortHead("expiresAt", t.tenants.expiresAt)}
                  {usage ? <TableHead className="text-right">{t.tenants.size}</TableHead> : null}
                  {sortHead("status", t.tenants.status, "w-28 min-w-28 max-w-32 whitespace-nowrap")}
                  <TableHead className="w-48" />
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderSelect value={appFilter} onChange={(value) => { setAppFilter(value); setPage(1); }} options={appOptions} allLabel={t.common.all} label={t.tenants.program} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={search} onChange={setSearch} label={t.tenants.name} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={contact} onChange={setContact} label={t.tenants.contact} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderDateRange from={expires.from} to={expires.to} onChange={(from, to) => setExpires({ from, to })} future />
                  </TableHead>
                  {usage ? <TableHead className="h-auto bg-muted/40 py-1.5 font-normal" /> : null}
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderSelect value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={statusOptions} allLabel={t.common.all} label={t.tenants.status} className="min-w-0" />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal" />
                </TableRow>
              </TableHeader>
              <TableBody>
                 {loading || refreshing ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="py-8 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="py-8 text-center text-muted-foreground">
                      {t.tenants.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((tenant) => {
                    const expired = isExpired(tenant, today);
                    const daysLeft = tenant.expiresAt ? Math.round((Date.parse(tenant.expiresAt) - Date.parse(today)) / 86_400_000) : null;
                    const createdDay = tenant.createdAt ? tenant.createdAt.slice(0, 10) : "";
                    const daysUsed = createdDay >= "2000-01-01" ? Math.max(0, Math.round((Date.parse(today) - Date.parse(createdDay)) / 86_400_000)) : null;
                    return (
                      <TableRow key={`${tenant.app}:${tenant.slug}`}>
                        <TableCell>
                          <Badge variant="outline">{appName(tenant.app)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="font-mono text-xs text-amber-600 dark:text-amber-400">{tenant.slug}</div>
                          {tenant.domains?.length ? (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5 text-xs text-muted-foreground">
                              <Globe className="size-3" />
                              {tenant.domains.map((domain) => (
                                <a
                                  key={domain}
                                  href={domainUrl(overview.apps, tenant.app, domain)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded bg-muted px-1.5 py-0.5 text-primary underline-offset-2 hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {domain}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{tenant.contactName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{[tenant.phone, tenant.email].filter(Boolean).join(" · ")}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {tenant.expiresAt ? (
                            <span className="flex flex-col items-start gap-1">
                              <span className={expired ? "font-medium text-destructive" : undefined} title={expired ? t.tenants.expiredHint : undefined}>
                                {formatDate(tenant.expiresAt, locale)}
                              </span>
                              <span className="flex flex-wrap items-center gap-1">
                                {daysUsed !== null ? (
                                  <Badge variant="outline" className="border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                                    {daysUsed === 0 ? t.tenants.openedToday : t.tenants.daysUsed.replace("{days}", String(daysUsed))}
                                  </Badge>
                                ) : null}
                                {expired ? (
                                  <Badge variant="destructive">{t.tenants.expired}</Badge>
                                ) : daysLeft !== null ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      daysLeft <= 7
                                        ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                                        : daysLeft <= 30
                                          ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                          : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    }
                                  >
                                    {daysLeft === 0 ? t.tenants.expiresToday : t.tenants.daysLeft.replace("{days}", String(daysLeft))}
                                  </Badge>
                                ) : null}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t.tenants.noExpiry}</span>
                          )}
                        </TableCell>
                        {usage ? <UsageCell row={usageOf(tenant)} /> : null}
                        <TableCell>
                          <Switch checked={tenant.active} onCheckedChange={(next) => void toggleActive(tenant, next)} aria-label={t.tenants.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {tenantAddress(overview.apps, tenant.app, tenant.slug, tenant.domains) ? (
                              <Button variant="ghost" size="icon-sm" aria-label={t.tenants.panelLogin} title={t.tenants.panelLogin} render={<a href={panelUrl(tenantAddress(overview.apps, tenant.app, tenant.slug, tenant.domains))} target="_blank" rel="noreferrer" />}>
                                <LogIn className="size-4 text-violet-600 dark:text-violet-400" />
                              </Button>
                            ) : null}
                            {tenantAddress(overview.apps, tenant.app, tenant.slug, tenant.domains) ? (
                              <Button variant="ghost" size="icon-sm" aria-label={t.tenants.open} title={t.tenants.open} render={<a href={tenantAddress(overview.apps, tenant.app, tenant.slug, tenant.domains)} target="_blank" rel="noreferrer" />}>
                                <ExternalLink className="size-4 text-emerald-600 dark:text-emerald-400" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon-sm" aria-label={t.tenants.noAddress} title={t.tenants.noAddress} disabled>
                                <ExternalLink className="size-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" aria-label={t.tenants.downloadDatabase} title={t.tenants.downloadDatabase} disabled={downloading !== null} onClick={() => void confirmBackup(tenant, "database")}>
                              {downloading === `${tenant.app}:${tenant.slug}:database` ? <Loader2 className="size-4 animate-spin" /> : <DatabaseArrowDown className="size-4" />}
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label={t.tenants.downloadFiles} title={t.tenants.downloadFiles} disabled={downloading !== null} onClick={() => void confirmBackup(tenant, "files")}>
                              {downloading === `${tenant.app}:${tenant.slug}:files` ? <Loader2 className="size-4 animate-spin" /> : <FolderDown className="size-4" />}
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label={t.tenants.edit} title={t.tenants.edit} onClick={() => openEdit(tenant)}>
                              <Pencil className="size-4" />
                            </Button>
                            <DisabledReason reason={tenant.active ? t.tenants.deleteNeedsPassive : null}>
                              <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={t.tenants.delete} title={tenant.active ? undefined : t.tenants.delete} disabled={tenant.active} onClick={() => askDelete(tenant)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </DisabledReason>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="inline-flex flex-wrap items-center gap-1">
            {t.tenants.total.replace("{count}", String(overview.total))}
            {usage ? (
              <>
                {` · ${t.tenants.totalSize.replace("{size}", formatBytes(usageTotal, locale))} · ${t.tenants.calculatedAt.replace("{time}", formatDateTime(usage.calculatedAt, locale))}`}
                <RelativeTimeChip value={usage.calculatedAt} />
              </>
            ) : null}
          </span>
          <div className={overview.total > PAGE_SIZES[0] ? "flex items-center gap-2" : "hidden"}>
            <span>{t.tenants.pageSize}</span>
            <div className="w-20">
              <OptionSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} ariaLabel={t.tenants.pageSize} />
            </div>
            <Button variant="ghost" size="icon-sm" disabled={overview.page <= 1 || loading} onClick={() => setPage(overview.page - 1)} aria-label={t.tenants.prevPage}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 text-center">{t.tenants.pageOf.replace("{page}", String(overview.page)).replace("{pages}", String(overview.pageCount))}</span>
            <Button variant="ghost" size="icon-sm" disabled={overview.page >= overview.pageCount || loading} onClick={() => setPage(overview.page + 1)} aria-label={t.tenants.nextPage}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={(open) => (saving ? undefined : setDialogOpen(open))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `${t.tenants.editTenant} · ${editing.name}` : t.tenants.newTenant}</DialogTitle>
          </DialogHeader>
          <form id="tenant-form" onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-4">
            <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="gap-4">
              <TabsList>
                <TabsTrigger value="general">{t.tenants.general}</TabsTrigger>
                <TabsTrigger value="contact">{t.tenants.contact}</TabsTrigger>
                <TabsTrigger value="modules">
                  {t.tenants.modules}
                  {form.disabledModules.length > 0 ? <Badge variant="secondary">{form.disabledModules.length}</Badge> : null}
                </TabsTrigger>
                {editing ? <TabsTrigger value="backup">{t.tenants.backup}</TabsTrigger> : null}
              </TabsList>
              <TabsContent value="general" className="min-h-72">
                <section className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.tenants.program} required>
                    <OptionSelect
                      value={form.app}
                      onChange={(value) => patch({ app: value, disabledModules: [] })}
                      options={overview.apps.filter((app) => app.online).map((app) => ({ value: app.key, label: app.name }))}
                      emptyLabel={t.tenants.programPlaceholder}
                      ariaLabel={t.tenants.program}
                      disabled={editing !== null || saving}
                    />
                  </Field>
                  <Field
                    label={t.tenants.slug}
                    htmlFor="tenant-slug"
                    required
                    labelExtra={
                      editing ? undefined : (
                        <Tooltip>
                          <TooltipTrigger render={<button type="button" aria-label={t.tenants.slugHint} className="ml-1 inline-flex text-muted-foreground hover:text-foreground" onClick={(event) => event.preventDefault()} />}>
                            <Info className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>{t.tenants.slugHint}</TooltipContent>
                        </Tooltip>
                      )
                    }
                  >
                    <Input id="tenant-slug" value={form.slug} onChange={(e) => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} disabled={editing !== null || saving} maxLength={40} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label={t.tenants.name} htmlFor="tenant-name" required>
                      <Input id="tenant-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} disabled={saving} />
                    </Field>
                  </div>
                  <Field label={t.tenants.expiresAt}>
                    <DatePicker value={form.expiresAt} onChange={(value) => patch({ expiresAt: value })} disabled={saving} />
                  </Field>
                  <Field label={t.tenants.status}>
                    <label className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30">
                      <span className={form.active ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-muted-foreground"}>{form.active ? t.tenants.active : t.tenants.passive}</span>
                      <Switch checked={form.active} onCheckedChange={(active) => patch({ active })} disabled={saving} />
                    </label>
                  </Field>
                  <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-2">
                    {form.slug && !tenantAddress(overview.apps, form.app, form.slug) && !formDomains.length ? (
                      <span className="text-xs text-muted-foreground">{t.tenants.noAddress}</span>
                    ) : form.slug ? (
                      editing ? (
                        addressLinks.map((url) => (
                          <span key={url} className="inline-flex min-w-0 items-center gap-1">
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all text-xs text-primary underline-offset-4 hover:underline">
                              <ExternalLink className="size-3 shrink-0" />
                              {url}
                            </a>
                            <Button type="button" variant="ghost" size="icon-xs" aria-label={t.tenants.copy} title={t.tenants.copy} onClick={() => void copy(url)}>
                              <Copy className="size-3" />
                            </Button>
                            <a href={panelUrl(url)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
                              <LogIn className="size-3" />
                              {t.tenants.panelLogin}
                            </a>
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <span className="break-all text-xs text-muted-foreground">{tenantAddress(overview.apps, form.app, form.slug)}</span>
                          <Button type="button" variant="ghost" size="icon-xs" aria-label={t.tenants.copy} title={t.tenants.copy} onClick={() => void copy(tenantAddress(overview.apps, form.app, form.slug))}>
                            <Copy className="size-3" />
                          </Button>
                        </span>
                      )
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                        <Field label={t.tenants.domains} htmlFor="tenant-domains" hint={t.tenants.domainsHint}>
                          <Textarea id="tenant-domains" rows={2} value={form.domains} onChange={(e) => patch({ domains: e.target.value })} placeholder="merhaba.com&#10;salon.merhaba.com" disabled={saving} className="font-mono text-xs" />
                        </Field>
                      </div>
                    </section>
              </TabsContent>

              <TabsContent value="contact" className="min-h-72">
                <section className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.tenants.contactName} htmlFor="tenant-contact">
                    <Input id="tenant-contact" value={form.contactName} onChange={(e) => patch({ contactName: e.target.value })} disabled={saving} />
                  </Field>
                  <Field label={t.tenants.email} htmlFor="tenant-email">
                    <Input id="tenant-email" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} disabled={saving} />
                  </Field>
                  <Field label={t.tenants.phone}>
                    <PhoneInput value={form.phone} onChange={(value) => patch({ phone: value })} disabled={saving} />
                  </Field>
                </section>
              </TabsContent>

              <TabsContent value="modules" className="min-h-72">
                <section className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
                  {formApp && formApp.modules.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground">{t.tenants.modulesHint}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {formApp.modules.map((module) => (
                          <label key={module.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                            {module.label}
                            <Switch checked={!form.disabledModules.includes(module.key)} onCheckedChange={(enabled) => toggleModule(module.key, enabled)} disabled={saving} />
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.tenants.modulesUnavailable}</p>
                  )}
                </section>
              </TabsContent>
              {editing ? (
                <TabsContent value="backup" className="min-h-72">
                  <section className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">{t.tenants.backupHint}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2 font-medium">
                          <Database className="size-4" />
                          {t.tenants.database}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.tenants.backupDatabaseHint}</p>
                        <Button type="button" variant="outline" onClick={() => void downloadBackup(editing, "database")} disabled={downloading !== null || restoring}>
                          {downloading === `${editing.app}:${editing.slug}:database` ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
                          {t.tenants.downloadDatabase}
                        </Button>
                        <input
                          ref={restoreInputRef}
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            event.target.value = "";
                            if (file) void restoreDatabase(editing, file);
                          }}
                        />
                        <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => restoreInputRef.current?.click()} disabled={downloading !== null || restoring}>
                          {restoring ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          {t.tenants.restoreDatabase}
                        </Button>
                      </div>
                      <div className="flex flex-col gap-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2 font-medium">
                          <FolderOpen className="size-4" />
                          {t.tenants.files}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.tenants.backupFilesHint}</p>
                        <Button type="button" variant="outline" onClick={() => void downloadBackup(editing, "files")} disabled={downloading !== null || restoring}>
                          {downloading === `${editing.app}:${editing.slug}:files` ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
                          {t.tenants.downloadFiles}
                        </Button>
                      </div>
                    </div>
                  </section>
                </TabsContent>
              ) : null}
            </Tabs>

          </form>
          <DialogFooter className="sm:justify-between">
            {editing ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void resetAdmin(editing)} disabled={saving}>
                  <KeyRound className="size-4" />
                  {t.tenants.resetAdmin}
                </Button>
                <DisabledReason reason={editing.active ? t.tenants.deleteNeedsPassive : null}>
                  <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => askDelete(editing)} disabled={saving || editing.active}>
                    <Trash2 className="size-4" />
                    {t.tenants.delete}
                  </Button>
                </DisabledReason>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                {t.common.cancel}
              </Button>
              <Button type="submit" form="tenant-form" disabled={saving || !form.app || !form.name.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {t.common.save}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => (open || deleteBusy ? undefined : setDeleting(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t.tenants.deleteTitle}</DialogTitle>
          </DialogHeader>
          {deleting ? (
            <form id="delete-form" onSubmit={(event) => { event.preventDefault(); void confirmDelete(); }} className="flex flex-col gap-3 text-sm">
              <p>{t.tenants.deleteWarning.replace("{name}", deleting.name).replace("{program}", appName(deleting.app))}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{t.tenants.deleteDatabase}</li>
                <li>{t.tenants.deleteFiles}</li>
                <li>{t.tenants.deleteRecord}</li>
              </ul>
              <Field label={t.tenants.deleteTypeCode.replace("{code}", deleting.slug)} htmlFor="delete-code" required>
                <Input id="delete-code" value={deleteCode} onChange={(e) => setDeleteCode(e.target.value.trim())} autoComplete="off" autoFocus disabled={deleteBusy} />
              </Field>
            </form>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="delete-form" variant="destructive" disabled={deleteBusy || !deleting || deleteCode !== deleting.slug}>
              {deleteBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t.tenants.deletePermanently}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTenantDialog open={createOpen} apps={overview.apps} onClose={() => setCreateOpen(false)} onCreated={() => { setUsage(null); void load(); }} onError={handleError} />
      <CredentialsDialog secret={secret} apps={overview.apps} onClose={() => setSecret(null)} onError={handleError} />
    </div>
  );
}
