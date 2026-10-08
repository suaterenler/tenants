export const MIN_PASSWORD_LENGTH = 3;
export const MAX_PASSWORD_LENGTH = 128;

const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  const limit = 256 - (256 % PASSWORD_CHARS.length);
  let result = "";
  while (result.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && result.length < length) result += PASSWORD_CHARS[byte % PASSWORD_CHARS.length];
    }
  }
  return result;
}

export function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

export type PasswordCheck = "ok" | "empty" | "tooShort" | "tooLong" | "invalid";

export function checkOptionalPassword(value: string): PasswordCheck {
  if (value === "") return "empty";
  if (value.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (value.length > MAX_PASSWORD_LENGTH) return "tooLong";
  if (hasControlCharacter(value)) return "invalid";
  return "ok";
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
