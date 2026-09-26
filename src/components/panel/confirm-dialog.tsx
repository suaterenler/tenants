"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  alert?: "warning" | "danger";
  infoOnly?: boolean;
  checkboxLabel?: string;
  checkboxDefault?: boolean;
};

export type ConfirmResult = { confirmed: boolean; checked: boolean };

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

const ConfirmDetailContext = createContext<(options: ConfirmOptions) => Promise<ConfirmResult>>(async () => ({
  confirmed: false,
  checked: false,
}));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [checked, setChecked] = useState(false);
  const resolveRef = useRef<((value: ConfirmResult) => void) | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const confirmDetail = useCallback((options: ConfirmOptions) => {
    return new Promise<ConfirmResult>((resolve) => {
      resolveRef.current = resolve;
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setChecked(options.checkboxDefault === true);
      setState(options);
    });
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => confirmDetail(options).then((result) => result.confirmed),
    [confirmDetail],
  );

  const close = (value: boolean) => {
    resolveRef.current?.({ confirmed: value, checked });
    resolveRef.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      <ConfirmDetailContext.Provider value={confirmDetail}>
      {children}
      <AlertDialog open={state !== null} onOpenChange={(open) => { if (!open) close(false); }}>
        <AlertDialogContent finalFocus={() => (returnFocusRef.current?.isConnected ? returnFocusRef.current : false)}>
          <AlertDialogHeader>
            {state?.alert ? (
              <span
                className={cn(
                  "mb-1 flex size-12 items-center justify-center rounded-full",
                  state.alert === "danger" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                )}
              >
                <TriangleAlert className="size-6" />
              </span>
            ) : null}
            <AlertDialogTitle
              className={cn(
                state?.alert === "danger" && "text-destructive",
                state?.alert === "warning" && "text-amber-600 dark:text-amber-400",
              )}
            >
              {state?.title ?? t.common.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>{state?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          {state?.checkboxLabel ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              {state.checkboxLabel}
            </label>
          ) : null}
          <AlertDialogFooter>
            {state?.infoOnly ? null : (
              <AlertDialogCancel onClick={() => close(false)}>
                {state?.cancelText ?? t.common.cancel}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              variant={state?.danger === true ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {state?.confirmText ?? (state?.infoOnly || state?.danger !== true ? t.common.ok : t.common.delete)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </ConfirmDetailContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
export function useConfirmDetail() {
  return useContext(ConfirmDetailContext);
}
