"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Dices } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { Field } from "@/components/panel/field";
import { PasswordInput } from "@/components/panel/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkOptionalPassword, generatePassword, isValidUsername } from "@/lib/password";

export function ResetAdminDialog({
  name,
  isDemo,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  name: string;
  isDemo: boolean;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next || busy ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <ResetAdminBody name={name} isDemo={isDemo} busy={busy} onClose={onClose} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  );
}

function ResetAdminBody({
  name,
  isDemo,
  busy,
  onClose,
  onSubmit,
}: {
  name: string;
  isDemo: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
}) {
  const t = useT();
  const [password, setPassword] = useState(() => generatePassword());
  const defaultUsername = isDemo ? "demo" : "admin";
  const [username, setUsername] = useState(defaultUsername);

  const check = checkOptionalPassword(password);
  const error = check === "tooShort" ? t.tenants.resetAdminTooShort : check === "tooLong" ? t.tenants.resetAdminTooLong : check === "invalid" ? t.errors.invalidPassword : null;

  const usernameError = isValidUsername(username) ? null : t.tenants.resetAdminUsernameInvalid;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (error || usernameError || busy) return;
    onSubmit(username, password);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.tenants.resetAdminTitle}</DialogTitle>
        <DialogDescription>{t.tenants.resetAdminIntro.replace("{name}", name)}</DialogDescription>
      </DialogHeader>
      <form id="reset-admin-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t.tenants.resetAdminUsername} htmlFor="reset-admin-username">
          <Input id="reset-admin-username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} autoComplete="off" clearable={false} aria-invalid={usernameError !== null} disabled={busy} />
          <p className={usernameError ? "min-h-4 text-xs text-destructive" : "min-h-4 text-xs text-muted-foreground"}>{usernameError ?? t.tenants.resetAdminUsernameHint.replace("{default}", defaultUsername)}</p>
        </Field>
        <Field label={t.tenants.resetAdminPassword} htmlFor="reset-admin-password">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <PasswordInput id="reset-admin-password" value={password} onChange={setPassword} autoFocus invalid={error !== null} defaultVisible />
            </div>
            <Button type="button" variant="outline" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => setPassword(generatePassword())} disabled={busy}>
              <Dices className="size-4" />
              {t.tenants.resetAdminGenerate}
            </Button>
          </div>
          <p className={error ? "min-h-4 text-xs text-destructive" : "min-h-4 text-xs text-muted-foreground"}>{error ?? (password === "" ? t.tenants.resetAdminHint : t.tenants.resetAdminGeneratedHint)}</p>
        </Field>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button type="submit" form="reset-admin-form" variant="destructive" disabled={busy || error !== null || usernameError !== null}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {t.tenants.resetAdminSubmit}
        </Button>
      </DialogFooter>
    </>
  );
}
