import { cn } from "@/lib/utils";

const LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']*[^\s<>"'.,!?;:)])/gi;

export function isImageFile(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

export function LinkedText({ text }: { text: string }) {
  const parts = text.split(LINK_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part.startsWith("www.") ? `https://${part}` : part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

const FILE_KINDS: { pattern: RegExp; color: string }[] = [
  { pattern: /\.pdf$/i, color: "bg-red-600" },
  { pattern: /\.(zip|rar|7z|tar|gz|tgz|bz2)$/i, color: "bg-amber-600" },
  { pattern: /\.(xls|xlsx|csv|ods|numbers)$/i, color: "bg-emerald-600" },
  { pattern: /\.(doc|docx|odt|rtf|txt|md|pages)$/i, color: "bg-sky-600" },
  { pattern: /\.(ppt|pptx|odp|key)$/i, color: "bg-orange-600" },
  { pattern: /\.(png|jpe?g|gif|webp|bmp|svg|heic|tiff?)$/i, color: "bg-violet-600" },
  { pattern: /\.(mp4|mov|avi|mkv|webm|m4v)$/i, color: "bg-pink-600" },
  { pattern: /\.(mp3|wav|ogg|m4a|aac|flac)$/i, color: "bg-teal-600" },
];

export function FileIcon({ name, className }: { name: string; className?: string }) {
  const kind = FILE_KINDS.find((item) => item.pattern.test(name));
  const extension = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1].toUpperCase() ?? "";
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[9px] font-bold tracking-tight text-white", kind?.color ?? "bg-neutral-600", className)}>
      {extension.slice(0, 4) || "?"}
    </span>
  );
}
