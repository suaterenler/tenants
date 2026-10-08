"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Copy, ExternalLink, Info, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { DatePicker } from "@/components/panel/date-picker";
import { Field } from "@/components/panel/field";
import { OptionSelect } from "@/components/panel/option-select";
import { PhoneInput } from "@/components/panel/phone-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { adminFetch, AdminRequestError } from "@/lib/admin-client";
import { isReservedTenantCode, isValidTenantCode, tenantCodeFromName, TENANT_CODE_MAX, uniqueTenantCode } from "@/lib/slug";

export type ProgramModule = { key: string; label: string };
export type AppInfo = { key: string; name: string; publicPath: string; publicUrl: string | null; rootPort: number | null; hostOnly: boolean; online: boolean; modules: ProgramModule[] };
export type Tenant = {
  app: string;
  slug: string;
  name: string;
  active: boolean;
  expiresAt: string | null;
  contactName: string;
  phone: string;
  email: string;
  disabledModules: string[];
  domains: string[];
  createdAt: string;
};
export type Secret = { title: string; tenant: Tenant; username?: string; password: string };
export type TenantForm = { app: string; slug: string; name: string; active: boolean; contactName: string; phone: string; email: string; expiresAt: string; disabledModules: string[]; domains: string };
export type CreatedTenant = { app: string; slug: string; tenant: Tenant; adminPassword: string };

export const EMPTY_FORM: TenantForm = { app: "", slug: "", name: "", active: true, contactName: "", phone: "", email: "", expiresAt: "", disabledModules: [], domains: "" };

export function panelUrl(address: string): string {
  return `${address.replace(/\/+$/, "")}/panel/giris`;
}

export function domainUrl(apps: AppInfo[], app: string, domain: string): string {
  const info = apps.find((item) => item.key === app);
  if (domain.endsWith(".localhost")) return `http://${domain}${info?.rootPort ? `:${info.rootPort}` : ""}`;
  return `https://${domain}`;
}

export function tenantAddress(apps: AppInfo[], app: string, slug: string, domains: string[] = []): string {
  const info = apps.find((item) => item.key === app);
  if (domains[0]) return domainUrl(apps, app, domains[0]);
  if (info?.hostOnly) return "";
  if (info?.publicUrl) return `${info.publicUrl.replace(/\/+$/, "")}/${slug}`;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${info?.publicPath ?? `/${app}`}/${slug}`;
}

async function copyText(value: string, message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    return;
  }
}

export function CredentialsDialog({ secret, apps, onClose, onError }: { secret: Secret | null; apps: AppInfo[]; onClose: () => void; onError: (error: unknown) => void }) {
  return (
    <Dialog open={secret !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {secret ? <CredentialsBody key={`${secret.tenant.app}:${secret.tenant.slug}:${secret.username ?? ""}:${secret.password}`} secret={secret} apps={apps} onClose={onClose} onError={onError} /> : null}
    </Dialog>
  );
}

function CredentialsBody({ secret, apps, onClose, onError }: { secret: Secret; apps: AppInfo[]; onClose: () => void; onError: (error: unknown) => void }) {
  const t = useI18n().messages;
  const [mailTo, setMailTo] = useState(secret.tenant.email ?? "");
  const [mailing, setMailing] = useState(false);
  const address = tenantAddress(apps, secret.tenant.app, secret.tenant.slug, secret.tenant.domains);
  const rows = [
    { label: t.tenants.address, value: address || t.tenants.noAddress, link: address !== "" },
    { label: t.tenants.adminUser, value: secret.username ?? "admin", link: false },
    { label: t.tenants.adminPassword, value: secret.password, link: false },
  ];

  async function mailCredentials() {
    if (!mailTo.trim()) return;
    setMailing(true);
    try {
      const result = await adminFetch<{ sentTo: string }>(`/tenants/${secret.tenant.app}/${secret.tenant.slug}/send-credentials`, { method: "POST", body: { to: mailTo.trim(), password: secret.password, username: secret.username ?? "admin" } });
      toast.success(t.tenants.credentialsSent.replace("{email}", result.sentTo));
    } catch (error) {
      onError(error);
    } finally {
      setMailing(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{secret.title}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">{t.tenants.createdHint}</p>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{row.label}</div>
              <div className="break-all font-mono">{row.value}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              {row.link ? (
                <Button variant="ghost" size="icon-sm" aria-label={t.tenants.open} title={t.tenants.open} render={<a href={row.value} target="_blank" rel="noreferrer" />}>
                  <ExternalLink className="size-4" />
                </Button>
              ) : null}
              <Button variant="ghost" size="icon-sm" aria-label={t.tenants.copy} title={t.tenants.copy} onClick={() => void copyText(row.value, t.tenants.copied)}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void mailCredentials();
          }}
          className="flex flex-col gap-2 rounded-md border border-dashed p-3"
        >
          <Field label={t.tenants.sendTo} htmlFor="credentials-mail" hint={secret.tenant.email ? undefined : t.tenants.sendToHint}>
            <div className="flex flex-wrap gap-2">
              <Input id="credentials-mail" type="email" className="min-w-0 flex-1 basis-56" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="ornek@kurum.com" disabled={mailing} />
              <Button type="submit" variant="outline" className="shrink-0" disabled={mailing || !mailTo.trim()}>
                {mailing ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                {t.tenants.sendMail}
              </Button>
            </div>
          </Field>
        </form>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button variant="outline" onClick={() => void copyText(rows.map((row) => `${row.label}: ${row.value}`).join("\n"), t.tenants.copied)}>
          <Copy className="size-4" />
          {t.tenants.copyAll}
        </Button>
        <Button onClick={onClose}>{t.common.ok}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function CreateTenantDialog({ open, apps, initial, notice, onClose, onCreated, onError }: { open: boolean; apps: AppInfo[]; initial?: Partial<TenantForm>; notice?: ReactNode; onClose: () => void; onCreated: (created: CreatedTenant) => void; onError: (error: unknown) => void }) {
  const t = useI18n().messages;
  const [secret, setSecret] = useState<Secret | null>(null);

  return (
    <>
      {open ? (
        <CreateTenantForm
          apps={apps}
          initial={initial}
          notice={notice}
          onClose={onClose}
          onError={onError}
          onCreated={(created) => {
            setSecret({ title: t.tenants.created, tenant: created.tenant, password: created.adminPassword });
            onCreated(created);
          }}
        />
      ) : null}
      <CredentialsDialog secret={secret} apps={apps} onClose={() => setSecret(null)} onError={onError} />
    </>
  );
}

function CreateTenantForm({ apps, initial, notice, onClose, onCreated, onError }: { apps: AppInfo[]; initial?: Partial<TenantForm>; notice?: ReactNode; onClose: () => void; onCreated: (created: CreatedTenant) => void; onError: (error: unknown) => void }) {
  const t = useI18n().messages;
  const [form, setForm] = useState<TenantForm>({ ...EMPTY_FORM, ...initial });
  const [manualSlug, setManualSlug] = useState(initial?.slug ?? "");
  const [loadedSlugs, setLoadedSlugs] = useState<{ app: string; slugs: string[] } | null>(null);
  const [tab, setTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const formApp = apps.find((app) => app.key === form.app);

  useEffect(() => {
    if (!form.app) return;
    let alive = true;
    adminFetch<{ slugs: string[] }>(`/tenants/slugs?app=${encodeURIComponent(form.app)}`)
      .then((data) => {
        if (alive) setLoadedSlugs({ app: form.app, slugs: data.slugs });
      })
      .catch(() => {
        if (alive) setLoadedSlugs(null);
      });
    return () => {
      alive = false;
    };
  }, [form.app]);

  const taken = useMemo(() => new Set(loadedSlugs && loadedSlugs.app === form.app ? loadedSlugs.slugs : []), [loadedSlugs, form.app]);
  const slug = manualSlug || uniqueTenantCode(tenantCodeFromName(form.name), taken);
  const slugError = !manualSlug ? undefined : !isValidTenantCode(manualSlug) ? t.errors.tenantInvalidSlug : isReservedTenantCode(manualSlug) ? t.tenants.slugReserved : taken.has(manualSlug) ? t.tenants.slugTaken : undefined;

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
      const result = await adminFetch<{ tenant: Tenant; adminPassword: string }>("/tenants", { method: "POST", body: { ...payload, app: form.app, slug, active: form.active } });
      onClose();
      onCreated({ app: form.app, slug, tenant: result.tenant, adminPassword: result.adminPassword });
    } catch (error) {
      if (error instanceof AdminRequestError && error.code === "tenantSlugTaken") await handleSlugTaken(slug);
      else onError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSlugTaken(failed: string) {
    const fresh = await adminFetch<{ slugs: string[] }>(`/tenants/slugs?app=${encodeURIComponent(form.app)}`)
      .then((data) => data.slugs)
      .catch(() => []);
    const slugs = [...fresh, failed];
    setLoadedSlugs({ app: form.app, slugs });
    if (manualSlug) return;
    const next = uniqueTenantCode(tenantCodeFromName(form.name), new Set(slugs));
    toast.info(t.tenants.slugRetaken.replace("{code}", next));
  }

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.tenants.newTenant}</DialogTitle>
        </DialogHeader>
        {notice}
        <form id="tenant-form" onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="gap-4">
            <TabsList>
              <TabsTrigger value="general">{t.tenants.general}</TabsTrigger>
              <TabsTrigger value="contact">{t.tenants.contact}</TabsTrigger>
              <TabsTrigger value="modules">
                {t.tenants.modules}
                {form.disabledModules.length > 0 ? <Badge variant="secondary">{form.disabledModules.length}</Badge> : null}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="min-h-72">
              <section className="grid gap-4 sm:grid-cols-2">
                <Field label={t.tenants.program} required>
                  <OptionSelect
                    value={form.app}
                    onChange={(value) => patch({ app: value, disabledModules: [] })}
                    options={apps.map((app) => ({ value: app.key, label: app.online ? app.name : `${app.name} (${t.tenants.versionState.offline})` }))}
                    emptyLabel={t.tenants.programPlaceholder}
                    ariaLabel={t.tenants.program}
                    disabled={saving}
                  />
                </Field>
                <Field
                  label={t.tenants.slug}
                  htmlFor="tenant-slug"
                  required
                  hint={slugError ?? t.tenants.slugMax}
                  labelExtra={
                    <Tooltip>
                      <TooltipTrigger render={<button type="button" aria-label={t.tenants.slugHint} className="ml-1 inline-flex text-muted-foreground hover:text-foreground" onClick={(event) => event.preventDefault()} />}>
                        <Info className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>{t.tenants.slugHint}</TooltipContent>
                    </Tooltip>
                  }
                >
                  <Input id="tenant-slug" value={slug} onChange={(e) => setManualSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} disabled={saving} maxLength={TENANT_CODE_MAX} />
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
                <div className="flex min-h-6 items-center gap-1 sm:col-span-2">
                  {slug && !tenantAddress(apps, form.app, slug) ? (
                    <span className="text-xs text-muted-foreground">{t.tenants.noAddress}</span>
                  ) : slug ? (
                    <>
                      <span className="break-all text-xs text-muted-foreground">{tenantAddress(apps, form.app, slug)}</span>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={t.tenants.copy} title={t.tenants.copy} onClick={() => void copyText(tenantAddress(apps, form.app, slug), t.tenants.copied)}>
                        <Copy className="size-3" />
                      </Button>
                    </>
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
          </Tabs>

          {saving ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t.tenants.creating}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form="tenant-form" disabled={saving || !form.app || !form.name.trim() || !slug || slugError !== undefined}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t.tenants.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
