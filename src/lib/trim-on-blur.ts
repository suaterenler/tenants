const NO_TRIM_TYPES = new Set(["password", "file", "checkbox", "radio", "range", "color", "hidden"]);

function nativeValueSetter(element: HTMLInputElement | HTMLTextAreaElement): ((value: string) => void) | null {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (!descriptor?.set) return null;
  return descriptor.set.bind(element);
}

export function trimElementValue(element: HTMLInputElement | HTMLTextAreaElement): void {
  if (element instanceof HTMLInputElement && NO_TRIM_TYPES.has(element.type)) return;
  if (element.dataset.noTrim === "true") return;

  const current = element.value;
  const trimmed = current.trim();
  if (current === trimmed) return;

  const setter = nativeValueSetter(element);
  if (!setter) return;
  setter(trimmed);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
