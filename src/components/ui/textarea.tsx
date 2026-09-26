"use client"

import { useT } from "@/components/i18n-provider"
import * as React from "react"
import { X } from "lucide-react"
import { cn } from "cn"
import { trimElementValue } from "@/lib/trim-on-blur"

function Textarea({
  className,
  onBlur,
  clearable,
  ...props
}: React.ComponentProps<"textarea"> & { clearable?: boolean }) {
  const t = useT()
  const supportsClear =
    clearable !== false &&
    !props.disabled &&
    !props.readOnly &&
    typeof props.onChange === "function" &&
    typeof props.value === "string"
  const hasValue = props.value !== ""

  const control = (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      onBlur={(event) => {
        trimElementValue(event.currentTarget)
        onBlur?.(event)
      }}
      {...props}
    />
  )

  if (!supportsClear) return control

  return (
    <span className="relative flex w-full min-w-0 flex-col">
      {control}
      {hasValue ? (
      <button
        type="button"
        tabIndex={-1}
        title={t.common.clear}
        aria-label={t.common.clear}
        onClick={(event) => {
          const field = event.currentTarget.previousElementSibling as HTMLTextAreaElement | null
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
          if (!field || !setter) return
          setter.call(field, "")
          field.dispatchEvent(new Event("input", { bubbles: true }))
          field.focus()
        }}
        className="absolute top-1.5 right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <X className="size-3" />
      </button>
      ) : null}
    </span>
  )
}

export { Textarea }
