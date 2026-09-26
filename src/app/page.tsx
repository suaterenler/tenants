"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Building2, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, KeyRound, Loader2, LogOut, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MadeBy } from "@/components/made-by";
import { ConfirmProvider, useConfirm } from "@/components/panel/confirm-dialog";
import { DatePicker } from "@/components/panel/date-picker";
import { Field } from "@/components/panel/field";
import { OptionSelect } from "@/components/panel/option-select";
import { PhoneInput } from "@/components/panel/phone-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

const BASE_PATH = "/admin";
const TOKEN_KEY = "erenler_platform_token";
const PAGE_SIZES = [25, 50, 100];
const EMPTY_OVERVIEW: Overview = { apps: [], rows: [], total: 0, page: 1, pageCount: 1, pageSize: 25, today: "" };

type PlatformModule = { key: string; label: string };
type AppInfo = { key: string; name: string; publicPath: string; online: boolean; modules: PlatformModule[] };
type Tenant = {
  app: string;
  slug: string;
  name: string;
  active: boolean;
  expiresAt: string | null;
  contactName: string;
  phone: string;
  email: string;
  disabledModules: string[];
  createdAt: string;
};
type Overview = { apps: AppInfo[]; rows: Tenant[]; total: number; page: number; pageCount: number; pageSize: number; today: string };
type Secret = { title: string; tenant: Tenant; password: string };
type Form = { app: string; slug: string; name: string; active: boolean; contactName: string; phone: string; email: string; expiresAt: string; disabledModules: string[] };
type ApiBody<T> = { ok: true; data: T } | { ok: false; error: string };

const EMPTY_FORM: Form = { app: "education", slug: "", name: "", active: true, contactName: "", phone: "", email: "", expiresAt: "", disabledModules: [] };

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

class PlatformError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function platformDownload(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/api${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiBody<unknown> | null;
    throw new PlatformError(payload && !payload.ok ? payload.error : `HTTP ${response.status}`, response.status);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function platformFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers = authHeaders();
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE_PATH}/api${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as ApiBody<T> | null;
  if (!payload) throw new PlatformError(`HTTP ${response.status}`, response.status);
  if (!payload.ok) throw new PlatformError(payload.error, response.status);
  return payload.data;
}

function tenantAddress(apps: AppInfo[], app: string, slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicPath = apps.find((item) => item.key === app)?.publicPath ?? `/${app}`;
  return `${origin}${publicPath}/${slug}`;
}

function isExpired(tenant: Tenant, today: string): boolean {
  return tenant.expiresAt !== null && tenant.expiresAt <= today;
}

function noopSubscribe(): () => void {
  return () => undefined;
}

export default function PlatformPage() {
  return (
    <ConfirmProvider>
      <PlatformScreen />
    </ConfirmProvider>
  );
}

function readResetToken(): string | null {
  return new URLSearchParams(window.location.search).get("reset");
}

function PlatformScreen() {
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
  return signedIn ? <TenantManager onSignOut={signOut} /> : <PlatformLogin onSignedIn={() => setSignedIn(true)} />;
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
          <CardTitle className="text-2xl font-semibold">{t.platform.title}</CardTitle>
          <CardDescription>{t.platform.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <div className="absolute bottom-4">
        <MadeBy />
      </div>
    </div>
  );
}

function PlatformLogin({ onSignedIn }: { onSignedIn: () => void }) {
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
      const result = await platformFetch<{ token: string }>("/login", { method: "POST", body: { password } });
      storeToken(result.token);
      onSignedIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.unexpected);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot() {
    const ok = await confirm({ message: t.platform.forgotConfirm, confirmText: t.platform.forgotSend });
    if (!ok) return;
    setSending(true);
    try {
      const result = await platformFetch<{ sentTo: string }>("/password/forgot", { method: "POST", body: {} });
      toast.success(t.platform.forgotSent.replace("{email}", result.sentTo));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.unexpected);
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <Field label={t.platform.password} htmlFor="platform-password" required>
          <Input id="platform-password" type="password" clearable={false} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        </Field>
        <Button type="submit" disabled={submitting || !password}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t.platform.login}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => void handleForgot()} disabled={sending}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t.platform.forgotPassword}
        </Button>
      </form>
    </AuthShell>
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
      await platformFetch<{ changed: boolean }>("/password/reset", { method: "POST", body: { token, password } });
      toast.success(t.platform.resetDone);
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
        <p className="text-center text-sm font-medium">{t.platform.resetTitle}</p>
        <Field label={t.platform.newPassword} htmlFor="new-password" required hint={t.platform.passwordHint}>
          <Input id="new-password" type="password" clearable={false} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <Field label={t.platform.newPasswordRepeat} htmlFor="new-password-repeat" required hint={mismatch ? t.platform.passwordMismatch : undefined}>
          <Input id="new-password-repeat" type="password" clearable={false} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
        </Field>
        <Button type="submit" disabled={submitting || !password || password !== repeat}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t.platform.resetSubmit}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={onDone}>
          {t.platform.backToLogin}
        </Button>
      </form>
    </AuthShell>
  );
}

function TenantManager({ onSignOut }: { onSignOut: () => void }) {
  const { messages: t, locale } = useI18n();
  const confirm = useConfirm();
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [appFilter, setAppFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const today = overview.today;

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof PlatformError && error.status === 401) {
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
      if (appFilter) params.set("app", appFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (paged) {
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
      }
      const value = params.toString();
      return value ? `?${value}` : "";
    },
    [debouncedSearch, appFilter, statusFilter, page, pageSize],
  );

  const load = useCallback(
    () =>
      platformFetch<Overview>(`/tenants${queryString(true)}`)
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function exportExcel() {
    setExporting(true);
    try {
      await platformDownload(`/tenants/export${queryString(false)}`, "kurumlar.xlsx");
    } catch (error) {
      handleError(error);
    } finally {
      setExporting(false);
    }
  }

  const appName = useCallback((key: string) => overview.apps.find((app) => app.key === key)?.name ?? key, [overview.apps]);

  const rows = overview.rows;

  const formApp = overview.apps.find((app) => app.key === form.app);

  function openCreate() {
    const firstOnline = overview.apps.find((app) => app.online)?.key ?? "education";
    setEditing(null);
    setForm({ ...EMPTY_FORM, app: appFilter || firstOnline });
    setDialogOpen(true);
  }

  function openEdit(tenant: Tenant) {
    setEditing(tenant);
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
    });
    setDialogOpen(true);
  }

  function patch(changes: Partial<Form>) {
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
    };
    try {
      if (editing) {
        await platformFetch<Tenant>(`/tenants/${editing.app}/${editing.slug}`, { method: "PATCH", body: { ...payload, active: form.active } });
        toast.success(t.platform.saved);
        setDialogOpen(false);
      } else {
        const result = await platformFetch<{ tenant: Tenant; adminPassword: string }>("/tenants", { method: "POST", body: { ...payload, app: form.app, slug: form.slug } });
        setDialogOpen(false);
        setSecret({ title: t.platform.created, tenant: result.tenant, password: result.adminPassword });
      }
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tenant: Tenant, next: boolean) {
    const message = (next ? t.platform.activateConfirm : t.platform.deactivateConfirm).replace("{name}", tenant.name);
    const ok = await confirm({ message, confirmText: next ? t.platform.activate : t.platform.deactivate, danger: !next });
    if (!ok) return;
    try {
      await platformFetch<Tenant>(`/tenants/${tenant.app}/${tenant.slug}`, { method: "PATCH", body: { active: next } });
      await load();
    } catch (error) {
      handleError(error);
    }
  }

  async function resetAdmin(tenant: Tenant) {
    const ok = await confirm({ message: t.platform.resetAdminConfirm.replace("{name}", tenant.name), confirmText: t.platform.resetAdmin, danger: true });
    if (!ok) return;
    try {
      const result = await platformFetch<{ password: string }>(`/tenants/${tenant.app}/${tenant.slug}/reset-admin`, { method: "POST", body: {} });
      setDialogOpen(false);
      setSecret({ title: t.platform.passwordReset, tenant, password: result.password });
    } catch (error) {
      handleError(error);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.platform.copied);
    } catch {
      return;
    }
  }

  const appOptions = [{ value: "", label: t.platform.allPrograms }, ...overview.apps.map((app) => ({ value: app.key, label: app.online ? app.name : `${app.name} (${t.platform.notConnected})` }))];
  const statusOptions = [
    { value: "", label: t.platform.allStatuses },
    { value: "active", label: t.platform.active },
    { value: "passive", label: t.platform.passive },
    { value: "expired", label: t.platform.expired },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold">
          <Building2 className="size-5" />
          {t.platform.title}
        </div>
        <div className="flex items-center gap-1">
          <Toolbar />
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="size-4" />
            {t.platform.logout}
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.platform.searchPlaceholder} aria-label={t.common.search} />
          </div>
          <div className="w-48">
            <OptionSelect value={appFilter} onChange={(value) => { setAppFilter(value); setPage(1); }} options={appOptions} ariaLabel={t.platform.program} />
          </div>
          <div className="w-44">
            <OptionSelect value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={statusOptions} ariaLabel={t.platform.status} />
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label={t.platform.refresh} title={t.platform.refresh}>
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || overview.total === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t.platform.export}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t.platform.newTenant}
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.platform.program}</TableHead>
                  <TableHead>{t.platform.name}</TableHead>
                  <TableHead>{t.platform.contact}</TableHead>
                  <TableHead>{t.platform.expiresAt}</TableHead>
                  <TableHead className="w-24">{t.platform.status}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t.platform.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((tenant) => {
                    const expired = isExpired(tenant, today);
                    return (
                      <TableRow key={`${tenant.app}:${tenant.slug}`}>
                        <TableCell>
                          <Badge variant="outline">{appName(tenant.app)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="font-mono text-xs text-amber-600 dark:text-amber-400">{tenant.slug}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{tenant.contactName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{[tenant.phone, tenant.email].filter(Boolean).join(" · ")}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {tenant.expiresAt ? (
                            <span className={expired ? "font-medium text-destructive" : undefined} title={expired ? t.platform.expiredHint : undefined}>
                              {formatDate(tenant.expiresAt, locale)}
                              {expired ? ` · ${t.platform.expired}` : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t.platform.noExpiry}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch checked={tenant.active} onCheckedChange={(next) => void toggleActive(tenant, next)} aria-label={t.platform.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" aria-label={t.platform.open} title={t.platform.open} render={<a href={tenantAddress(overview.apps, tenant.app, tenant.slug)} target="_blank" rel="noreferrer" />}>
                              <ExternalLink className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label={t.platform.edit} title={t.platform.edit} onClick={() => openEdit(tenant)}>
                              <Pencil className="size-4" />
                            </Button>
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
          <span>{t.platform.total.replace("{count}", String(overview.total))}</span>
          <div className="flex items-center gap-2">
            <span>{t.platform.pageSize}</span>
            <div className="w-20">
              <OptionSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} ariaLabel={t.platform.pageSize} />
            </div>
            <Button variant="ghost" size="icon-sm" disabled={overview.page <= 1 || loading} onClick={() => setPage(overview.page - 1)} aria-label={t.platform.prevPage}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 text-center">{t.platform.pageOf.replace("{page}", String(overview.page)).replace("{pages}", String(overview.pageCount))}</span>
            <Button variant="ghost" size="icon-sm" disabled={overview.page >= overview.pageCount || loading} onClick={() => setPage(overview.page + 1)} aria-label={t.platform.nextPage}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={(open) => (saving ? undefined : setDialogOpen(open))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `${t.platform.editTenant} · ${editing.name}` : t.platform.newTenant}</DialogTitle>
          </DialogHeader>
          <form id="tenant-form" onSubmit={(event) => void handleSave(event)} className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
            <section className="grid gap-4 sm:grid-cols-2">
              <Field label={t.platform.program} required>
                <OptionSelect
                  value={form.app}
                  onChange={(value) => patch({ app: value, disabledModules: [] })}
                  options={overview.apps.filter((app) => app.online).map((app) => ({ value: app.key, label: app.name }))}
                  ariaLabel={t.platform.program}
                  disabled={editing !== null || saving}
                />
              </Field>
              <Field label={t.platform.slug} htmlFor="tenant-slug" required hint={editing ? undefined : t.platform.slugHint}>
                <Input id="tenant-slug" value={form.slug} onChange={(e) => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} disabled={editing !== null || saving} maxLength={40} />
              </Field>
              <div className={editing ? undefined : "sm:col-span-2"}>
                <Field label={t.platform.name} htmlFor="tenant-name" required>
                  <Input id="tenant-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} disabled={saving} />
                </Field>
              </div>
              {editing ? (
                <Field label={t.platform.status}>
                  <label className="flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm">
                    <span className={form.active ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-muted-foreground"}>{form.active ? t.platform.active : t.platform.passive}</span>
                    <Switch checked={form.active} onCheckedChange={(active) => patch({ active })} disabled={saving} />
                  </label>
                </Field>
              ) : null}
              {form.slug ? (
                <div className="flex items-center gap-1 sm:col-span-2">
                  {editing ? (
                    <a href={tenantAddress(overview.apps, form.app, form.slug)} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all text-xs text-primary underline-offset-4 hover:underline">
                      <ExternalLink className="size-3 shrink-0" />
                      {tenantAddress(overview.apps, form.app, form.slug)}
                    </a>
                  ) : (
                    <span className="break-all text-xs text-muted-foreground">{tenantAddress(overview.apps, form.app, form.slug)}</span>
                  )}
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={t.platform.copy} title={t.platform.copy} onClick={() => void copy(tenantAddress(overview.apps, form.app, form.slug))}>
                    <Copy className="size-3" />
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <h3 className="text-sm font-semibold sm:col-span-2">{t.platform.contact}</h3>
              <Field label={t.platform.contactName} htmlFor="tenant-contact">
                <Input id="tenant-contact" value={form.contactName} onChange={(e) => patch({ contactName: e.target.value })} disabled={saving} />
              </Field>
              <Field label={t.platform.phone}>
                <PhoneInput value={form.phone} onChange={(value) => patch({ phone: value })} disabled={saving} />
              </Field>
              <Field label={t.platform.email} htmlFor="tenant-email">
                <Input id="tenant-email" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} disabled={saving} />
              </Field>
              <Field label={t.platform.expiresAt}>
                <DatePicker value={form.expiresAt} onChange={(value) => patch({ expiresAt: value })} disabled={saving} />
              </Field>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t.platform.modules}</h3>
              {formApp && formApp.modules.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">{t.platform.modulesHint}</p>
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
                <p className="text-xs text-muted-foreground">{t.platform.modulesUnavailable}</p>
              )}
            </section>

            {saving && !editing ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t.platform.creating}
              </p>
            ) : null}
          </form>
          <DialogFooter className="sm:justify-between">
            {editing ? (
              <Button type="button" variant="outline" onClick={() => void resetAdmin(editing)} disabled={saving}>
                <KeyRound className="size-4" />
                {t.platform.resetAdmin}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                {t.common.cancel}
              </Button>
              <Button type="submit" form="tenant-form" disabled={saving || !form.name.trim() || (!editing && !form.slug)}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {editing ? t.common.save : t.platform.create}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secret !== null} onOpenChange={(open) => (open ? undefined : setSecret(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{secret?.title}</DialogTitle>
          </DialogHeader>
          {secret ? (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{t.platform.createdHint}</p>
              {[
                { label: t.platform.address, value: tenantAddress(overview.apps, secret.tenant.app, secret.tenant.slug) },
                { label: t.platform.adminUser, value: "admin" },
                { label: t.platform.adminPassword, value: secret.password },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{row.label}</div>
                    <div className="break-all font-mono">{row.value}</div>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={t.platform.copy} title={t.platform.copy} onClick={() => void copy(row.value)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>{t.common.ok}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
