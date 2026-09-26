import { cn } from "@/lib/utils";

export type Tone = "success" | "danger" | "warning" | "info" | "muted" | "violet" | "blue" | "pink";

const TONES: Record<Tone, { dot: string; text: string }> = {
  success: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  danger: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  warning: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  info: { dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-400" },
  muted: { dot: "bg-slate-400", text: "text-muted-foreground" },
  violet: { dot: "bg-violet-500", text: "text-violet-700 dark:text-violet-400" },
  blue: { dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-400" },
  pink: { dot: "bg-pink-500", text: "text-pink-700 dark:text-pink-400" },
};

export type ToneProps = { tone?: Tone; color?: string | null };

export function hasTone(option: ToneProps): boolean {
  return Boolean(option.tone || option.color);
}

export function ToneLabel({ label, tone, color, hint }: { label: string; hint?: string } & ToneProps) {
  const palette = tone ? TONES[tone] : null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", palette?.dot)} style={!palette && color ? { backgroundColor: color } : undefined} />
      <span className={cn("truncate", palette?.text)} style={!palette && color ? { color } : undefined}>
        {label}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </span>
  );
}

export const GENDER_TONE: Record<string, Tone> = { male: "blue", female: "pink" };

export const ACTIVE_TONE: Record<string, Tone> = { active: "success", passive: "danger" };
