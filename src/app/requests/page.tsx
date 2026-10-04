"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { AdminHeader } from "@/components/panel/admin-header";
import { ConfirmProvider, useConfirm } from "@/components/panel/confirm-dialog";
import { CreateTenantDialog, tenantAddress, type AppInfo, type CreatedTenant } from "@/components/panel/tenant-create";
import { Field } from "@/components/panel/field";
import { HeaderDateRange, HeaderSelect, HeaderText } from "@/components/panel/header-filters";
import { OptionSelect } from "@/components/panel/option-select";
import { RelativeTimeChip } from "@/components/panel/relative-time-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminFetch, AdminRequestError, BASE_PATH, readToken, storeToken } from "@/lib/admin-client";
import { formatDateTime } from "@/lib/format";
import { excelDate, writeExcel } from "@/lib/excel";
import { columnMatches, findSimilarRequests, inDateRange, programForProduct, programNameForProduct, REQUEST_STATUSES, trialExpiry, type RequestStatus, type SimilarReason, type TrialRequest } from "@/lib/requests";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [25, 50, 100];

type TextFilters = { name: string; company: string; email: string; phone: string; note: string };

const STATUS_TONE: Record<RequestStatus, string> = {
  new: "text-sky-600 dark:text-sky-400",
  contacted: "text-amber-600 dark:text-amber-400",
  trial: "text-violet-600 dark:text-violet-400",
  converted: "text-emerald-600 dark:text-emerald-400",
  rejected: "text-muted-foreground",
};

function noopSubscribe(): () => void {
  return () => undefined;
}

export default function RequestsPage() {
  return (
    <ConfirmProvider>
      <RequestsScreen />
    </ConfirmProvider>
  );
}

function RequestsScreen() {
  const signedIn = useSyncExternalStore(noopSubscribe, () => Boolean(readToken()), () => null);

  useEffect(() => {
    if (signedIn === false) window.location.replace(BASE_PATH);
  }, [signedIn]);

  function signOut() {
    storeToken(null);
    window.location.replace(BASE_PATH);
  }

  if (!signedIn) return null;
  return <RequestManager onSignOut={signOut} />;
}

function RequestManager({ onSignOut }: { onSignOut: () => void }) {
  const { messages: t, locale } = useI18n();
  const confirm = useConfirm();
  const [items, setItems] = useState<TrialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TextFilters>({ name: "", company: "", email: "", phone: "", note: "" });
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [creating, setCreating] = useState<TrialRequest | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const load = useCallback(
    () =>
      adminFetch<TrialRequest[]>("/requests")
        .then(setItems)
        .catch(handleError)
        .finally(() => setLoading(false)),
    [handleError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    adminFetch<{ apps: AppInfo[] }>("/tenants")
      .then((data) => setApps(data.apps))
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => items.filter((item) => (!statusFilter || item.status === statusFilter) && (!programFilter || programForProduct(item.product) === programFilter) && inDateRange(item.receivedAt, dates.from, dates.to) && columnMatches(item.name, filters.name) && columnMatches(item.company, filters.company) && columnMatches(item.email, filters.email) && columnMatches(item.phone, filters.phone) && columnMatches(item.note, filters.note)), [items, statusFilter, programFilter, dates, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const newCount = items.filter((item) => item.status === "new").length;
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const similarById = useMemo(() => new Map(items.map((item) => [item.id, findSimilarRequests(item, items)])), [items]);
  const selectedSimilar = selected ? (similarById.get(selected.id) ?? []) : [];
  const creatingAccounts = creating ? (similarById.get(creating.id) ?? []).filter((entry) => entry.request.tenantSlug && entry.request.tenantApp) : [];

  function reasonText(reasons: SimilarReason[]): string {
    const names: Record<SimilarReason, string> = { company: t.requests.reasonCompany, email: t.requests.reasonEmail, phone: t.requests.reasonPhone };
    return [...new Set(reasons)].map((reason) => names[reason]).join(", ");
  }

  const statusOptions = REQUEST_STATUSES.map((status) => ({ value: status, label: t.requests.statuses[status] }));

  const programOptions = apps.map((app) => ({ value: app.key, label: app.name }));

  async function exportExcel() {
    setExporting(true);
    try {
      await writeExcel({
        fileName: `talepler-${new Date().toLocaleDateString("sv-SE")}.xlsx`,
        sheetName: t.requests.title,
        header: [t.requests.receivedAt, t.requests.name, t.requests.company, t.requests.email, t.requests.phone, t.requests.product, t.requests.status, t.requests.note, t.requests.account],
        rows: filtered.map((item) => [
          excelDate(item.receivedAt) ?? item.receivedAt,
          item.name,
          item.company,
          item.email,
          item.phone,
          item.product ? productLabel(item.product) : "",
          t.requests.statuses[item.status],
          item.note,
          item.tenantApp && item.tenantSlug ? `${appName(item.tenantApp)} / ${item.tenantSlug}` : "",
        ]),
      });
    } catch (error) {
      handleError(error);
    } finally {
      setExporting(false);
    }
  }

  function setFilter(key: keyof TextFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function productLabel(value: string): string {
    return programNameForProduct(value, apps);
  }

  function canCreate(item: TrialRequest): boolean {
    return item.status !== "converted" && !item.tenantSlug;
  }

  function startCreate(item: TrialRequest) {
    setSelectedId(null);
    setCreating(item);
  }

  async function linkCreated(item: TrialRequest, created: CreatedTenant) {
    try {
      replaceItem(await adminFetch<TrialRequest>(`/requests/${item.id}`, { method: "PATCH", body: { status: "trial", tenantApp: created.app, tenantSlug: created.slug, tenantCreatedAt: new Date().toISOString() } }));
      toast.success(t.requests.accountLinked);
    } catch (error) {
      handleError(error);
    }
  }

  function accountLink(app: string | undefined, slug: string | undefined): string {
    return app && slug ? tenantAddress(apps, app, slug) : "";
  }

  function appName(key: string): string {
    return apps.find((app) => app.key === key)?.name ?? key;
  }

  function replaceItem(next: TrialRequest) {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  async function changeStatus(item: TrialRequest, status: string) {
    try {
      replaceItem(await adminFetch<TrialRequest>(`/requests/${item.id}`, { method: "PATCH", body: { status } }));
      toast.success(t.common.statusUpdated);
    } catch (error) {
      handleError(error);
    }
  }

  async function saveNote(item: TrialRequest) {
    setBusy(true);
    try {
      replaceItem(await adminFetch<TrialRequest>(`/requests/${item.id}`, { method: "PATCH", body: { note: noteDraft } }));
      toast.success(t.common.saved);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: TrialRequest) {
    const ok = await confirm({ message: t.requests.deleteConfirm, confirmText: t.common.delete, danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await adminFetch<{ deleted: boolean }>(`/requests/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setSelectedId(null);
      toast.success(t.requests.deleted);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  function open(item: TrialRequest) {
    setNoteDraft(item.note);
    setSelectedId(item.id);
  }

  const detailRows = selected
    ? [
        { label: t.requests.company, value: selected.company || "—" },
        { label: t.requests.source, value: `${selected.formName} (${selected.formSlug} · #${selected.submissionId})` },
        { label: t.requests.submittedAt, value: formatDateTime(selected.submittedAt, locale) },
        { label: t.requests.ip, value: selected.ip ?? "—" },
        { label: t.requests.userAgent, value: selected.userAgent ?? "—" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader active="requests" onSignOut={onSignOut} newCount={loading ? undefined : newCount} />
      <main className="mx-auto flex max-w-[100rem] flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-xl font-semibold">{t.requests.title}</h2>
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true);
              void Promise.all([load(), new Promise((resolve) => window.setTimeout(resolve, 600))]).finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            aria-label={t.tenants.refresh}
            title={t.tenants.refresh}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            {t.tenants.refresh}
          </Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || filtered.length === 0} aria-label={t.tenants.export} title={t.tenants.export}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t.tenants.export}
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">{t.requests.receivedAt}</TableHead>
                  <TableHead className="min-w-32">{t.requests.name}</TableHead>
                  <TableHead className="min-w-32">{t.requests.company}</TableHead>
                  <TableHead className="min-w-32">{t.requests.email}</TableHead>
                  <TableHead className="min-w-32">{t.requests.phone}</TableHead>
                  <TableHead className="min-w-32">{t.requests.product}</TableHead>
                  <TableHead className="w-36 min-w-36 max-w-36 whitespace-nowrap">{t.requests.status}</TableHead>
                  <TableHead className="min-w-32">{t.requests.note}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderDateRange from={dates.from} to={dates.to} onChange={(from, to) => { setDates({ from, to }); setPage(1); }} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.name} onChange={(value) => setFilter("name", value)} label={t.requests.name} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.company} onChange={(value) => setFilter("company", value)} label={t.requests.company} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.email} onChange={(value) => setFilter("email", value)} label={t.requests.email} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.phone} onChange={(value) => setFilter("phone", value)} label={t.requests.phone} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderSelect value={programFilter} onChange={(value) => { setProgramFilter(value); setPage(1); }} options={programOptions} allLabel={t.common.all} label={t.requests.product} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderSelect value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={statusOptions} allLabel={t.common.all} label={t.requests.status} className="min-w-0" />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal">
                    <HeaderText value={filters.note} onChange={(value) => setFilter("note", value)} label={t.requests.note} />
                  </TableHead>
                  <TableHead className="h-auto bg-muted/40 py-1.5 font-normal" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      {t.requests.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => open(item)}>
                      <TableCell className="text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="tabular-nums">{formatDateTime(item.receivedAt, locale)}</span>
                          <RelativeTimeChip value={item.receivedAt} />
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-sm", item.status === "new" && "font-semibold")}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {item.name || "—"}
                          {(similarById.get(item.id) ?? []).length > 0 ? (
                            <span
                              className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                              title={t.requests.duplicateTitle.replace("{count}", String((similarById.get(item.id) ?? []).length)).replace("{reasons}", reasonText((similarById.get(item.id) ?? []).flatMap((entry) => entry.reasons)))}
                            >
                              {t.requests.duplicate}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{item.company || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {item.email ? (
                          <a href={`mailto:${item.email}`} className="text-primary underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>
                            {item.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.phone ? (
                          <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline-offset-4 hover:underline" onClick={(event) => event.stopPropagation()}>
                            {item.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{item.product ? productLabel(item.product) : "—"}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <OptionSelect value={item.status} onChange={(value) => void changeStatus(item, value)} options={statusOptions} ariaLabel={t.requests.status} />
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm text-muted-foreground" title={item.note}>
                        {item.note || "—"}
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        {canCreate(item) ? (
                          <Button variant="ghost" size="icon-sm" aria-label={t.requests.createAccount} title={t.requests.createAccount} onClick={() => startCreate(item)}>
                            <UserPlus className="size-4 text-emerald-600 dark:text-emerald-400" />
                          </Button>
                        ) : null}
                        {item.tenantApp && item.tenantSlug && accountLink(item.tenantApp, item.tenantSlug) ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t.requests.openAccount}
                            title={t.requests.openAccount}
                            render={<a href={accountLink(item.tenantApp, item.tenantSlug)} target="_blank" rel="noreferrer" />}
                          >
                            <ExternalLink className="size-4 text-primary" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t.requests.total.replace("{count}", String(filtered.length))}</span>
          <div className={filtered.length > PAGE_SIZES[0] ? "flex items-center gap-2" : "hidden"}>
            <span>{t.tenants.pageSize}</span>
            <div className="w-20">
              <OptionSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} ariaLabel={t.tenants.pageSize} />
            </div>
            <Button variant="ghost" size="icon-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label={t.tenants.prevPage}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 text-center">{t.tenants.pageOf.replace("{page}", String(currentPage)).replace("{pages}", String(pageCount))}</span>
            <Button variant="ghost" size="icon-sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label={t.tenants.nextPage}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={selected !== null} onOpenChange={(next) => (next || busy ? undefined : setSelectedId(null))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t.requests.detail}
              {selected?.name ? ` · ${selected.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.requests.status}>
                  <OptionSelect value={selected.status} onChange={(value) => void changeStatus(selected, value)} options={statusOptions} ariaLabel={t.requests.status} />
                </Field>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t.requests.receivedAt}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {formatDateTime(selected.receivedAt, locale)}
                    <RelativeTimeChip value={selected.receivedAt} />
                  </span>
                </div>
              </div>
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">{t.requests.fields}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(selected.fields).map(([key, value]) => (
                    <div key={key} className="rounded-md border px-3 py-2">
                      <div className="text-xs text-muted-foreground">{selected.labels[key] ?? key}</div>
                      <div className="break-words">{key === "urun" ? productLabel(value) : value || "—"}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="grid gap-2">
                {detailRows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="break-all">{row.value}</span>
                  </div>
                ))}
              </section>
              <Field label={t.requests.note} htmlFor="request-note">
                <Textarea id="request-note" rows={3} value={noteDraft} maxLength={4000} onChange={(event) => setNoteDraft(event.target.value)} disabled={busy} />
              </Field>
              {selectedSimilar.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">{t.requests.similar}</h3>
                  <div className="flex flex-col gap-1.5">
                    {selectedSimilar.map((entry) => (
                      <button key={entry.request.id} type="button" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-left hover:bg-muted" onClick={() => open(entry.request)}>
                        <span className="tabular-nums">{formatDateTime(entry.request.receivedAt, locale)}</span>
                        <span className="font-medium">{entry.request.name || "—"}</span>
                        <span className={STATUS_TONE[entry.request.status]}>{t.requests.statuses[entry.request.status]}</span>
                        {entry.request.tenantApp && entry.request.tenantSlug ? <span className="font-mono text-xs">{appName(entry.request.tenantApp)} / {entry.request.tenantSlug}</span> : null}
                        <span className="text-xs text-muted-foreground">{reasonText(entry.reasons)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {selected.tenantSlug && selected.tenantApp ? (
                <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                  {t.requests.createdAccount.replace("{program}", appName(selected.tenantApp)).replace("{slug}", selected.tenantSlug)}{" "}
                  <a href={BASE_PATH} className="text-primary underline-offset-4 hover:underline">
                    {t.requests.openTenants}
                  </a>
                  {accountLink(selected.tenantApp, selected.tenantSlug) ? (
                    <>
                      {" · "}
                      <a href={accountLink(selected.tenantApp, selected.tenantSlug)} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        {t.requests.openAccount}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              <span className={cn("text-xs", STATUS_TONE[selected.status])}>{t.requests.statuses[selected.status]}</span>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => (selected ? void remove(selected) : undefined)} disabled={busy}>
              <Trash2 className="size-4" />
              {t.common.delete}
            </Button>
            <div className="flex gap-2">
              {selected && canCreate(selected) ? (
                <Button type="button" variant="secondary" onClick={() => startCreate(selected)} disabled={busy}>
                  <UserPlus className="size-4" />
                  {t.requests.createAccount}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setSelectedId(null)} disabled={busy}>
                {t.common.close}
              </Button>
              <Button type="button" onClick={() => (selected ? void saveNote(selected) : undefined)} disabled={busy || !selected || noteDraft.trim() === selected.note}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t.requests.saveNote}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateTenantDialog
        open={creating !== null}
        apps={apps}
        notice={creatingAccounts.length > 0 ? <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-300">{t.requests.existingAccount.replace("{accounts}", creatingAccounts.map((entry) => `${appName(entry.request.tenantApp ?? "")} / ${entry.request.tenantSlug}`).join(", "))}</p> : undefined}
        initial={creating ? { name: creating.company, app: apps.some((app) => app.key === programForProduct(creating.product)) ? programForProduct(creating.product) : "", contactName: creating.name, phone: creating.phone, email: creating.email, expiresAt: trialExpiry() } : undefined}
        onClose={() => setCreating(null)}
        onCreated={(created) => (creating ? void linkCreated(creating, created) : undefined)}
        onError={handleError}
      />
    </div>
  );
}
