"use client"

import { useT } from "@/components/i18n-provider"
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { X } from "lucide-react"
import { cn } from "cn"
import { trimElementValue } from "@/lib/trim-on-blur"

const NO_CLEAR_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "color",
  "range",
  "hidden",
  "submit",
  "button",
  "image",
  "password",
])
const LAYOUT_CLASS = /^(w-|min-w-|max-w-|flex-|basis-|grow|shrink|col-span-|sm:w-|sm:col-span-|ml-|mr-|mx-)/

function splitClasses(className: string | undefined): { wrapper: string; input: string } {
  if (!className) return { wrapper: "", input: "" }
  const wrapper: string[] = []
  const input: string[] = []
  for (const token of className.split(/\s+/).filter(Boolean)) {
    if (LAYOUT_CLASS.test(token)) wrapper.push(token)
    else input.push(token)
  }
  return { wrapper: wrapper.join(" "), input: input.join(" ") }
}

const BASE_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&:-webkit-autofill]:shadow-[0_0_0_1000px_var(--background)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)] [&:-webkit-autofill]:caret-foreground"

function Input({
  className,
  type,
  onBlur,
  clearable,
  ...props
}: React.ComponentProps<"input"> & { clearable?: boolean }) {
  const t = useT()
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    trimElementValue(event.currentTarget)
    onBlur?.(event)
  }

  const supportsClear =
    clearable !== false &&
    !NO_CLEAR_TYPES.has(type ?? "text") &&
    !props.disabled &&
    !props.readOnly &&
    typeof props.onChange === "function" &&
    typeof props.value === "string"

  if (!supportsClear) {
    return (
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(BASE_CLASS, className)}
        onBlur={handleBlur}
        {...props}
      />
    )
  }

  const { wrapper, input } = splitClasses(className)
  const hasValue = props.value !== ""

  return (
    <span className={cn("relative flex w-full min-w-0 items-center", wrapper)}>
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(BASE_CLASS, hasValue && "pr-8", input)}
        onBlur={handleBlur}
        {...props}
      />
      {hasValue ? (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          title={t.common.clear}
          aria-label={t.common.clear}
          onClick={(event) => {
            const field = event.currentTarget.previousElementSibling as HTMLInputElement | null
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
            if (!field || !setter) return
            setter.call(field, "")
            field.dispatchEvent(new Event("input", { bubbles: true }))
            field.focus()
          }}
          className="absolute right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

export { Input }
