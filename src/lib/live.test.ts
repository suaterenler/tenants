import { describe, expect, it } from "vitest";
import { cleanEmail, cleanName, cleanTime, formatPhone, isValidPhone, cleanPage, cleanPhone, durationMinutes, initials, inviteCode, isAutoOffDue, isInviteCode, isReminderDue, liveBadgeCount, parseSessionPatch, previousSessions, type LiveSession } from "./live";

function session(overrides: Partial<LiveSession>): LiveSession {
  return {
    id: "s",
    status: "completed",
    createdAt: "2026-10-20T10:00:00.000Z",
    startedAt: null,
    endedAt: null,
    name: "Ali",
    phone: "",
    email: "",
    note: "",
    inviteCode: "",
    participants: [],
    messages: [],
    hostNotes: "",
    reminderAt: null,
    reminderDone: false,
    reminderMailedAt: null,
    isNew: false,
    page: "/",
    ...overrides,
  };
}

describe("live input cleaning", () => {
  it("trims names and strips control characters", () => {
    expect(cleanName("  Ayşe\u0007 Kaya  ")).toBe("Ayşe Kaya");
    expect(cleanName(42)).toBe("");
    expect(cleanName("x".repeat(80))).toHaveLength(60);
  });

  it("accepts phone numbers and rejects garbage", () => {
    expect(cleanPhone("0532 418 22 90")).toBe("0532 418 22 90");
    expect(cleanPhone("+90 (532) 418-22-90")).toBe("+90 (532) 418-22-90");
    expect(cleanPhone("abc")).toBe("");
    expect(cleanPhone("12")).toBe("");
  });

  it("normalizes email and page", () => {
    expect(cleanEmail("Ali@Example.COM")).toBe("ali@example.com");
    expect(cleanEmail("ali@")).toBe("");
    expect(cleanPage("/urunler/x")).toBe("/urunler/x");
    expect(cleanPage("https://evil.example")).toBe("/");
  });
});

describe("parseSessionPatch", () => {
  it("requires a non-empty name when the name is sent", () => {
    expect(parseSessionPatch({ name: "   " })).toBeNull();
    expect(parseSessionPatch({ name: "Veli" })).toEqual({ name: "Veli" });
  });

  it("validates phone, email, reminder and flags", () => {
    expect(parseSessionPatch({ phone: "xx" })).toBeNull();
    expect(parseSessionPatch({ phone: "" })).toEqual({ phone: "" });
    expect(parseSessionPatch({ email: "bad" })).toBeNull();
    expect(parseSessionPatch({ reminderAt: "not-a-date" })).toBeNull();
    expect(parseSessionPatch({ reminderAt: null })).toEqual({ reminderAt: null });
    expect(parseSessionPatch({ reminderDone: "yes" })).toBeNull();
    expect(parseSessionPatch({ reminderAt: "2026-10-25T10:00:00.000Z", reminderDone: true })).toEqual({ reminderAt: "2026-10-25T10:00:00.000Z", reminderDone: true });
  });
});

describe("live helpers", () => {
  it("counts waiting and new request/missed sessions for the badge", () => {
    const items = [session({ status: "waiting" }), session({ status: "request", isNew: true }), session({ status: "missed", isNew: false }), session({ status: "completed", isNew: true })];
    expect(liveBadgeCount(items)).toBe(2);
  });

  it("computes call duration in minutes", () => {
    expect(durationMinutes(session({ startedAt: "2026-10-20T10:00:00.000Z", endedAt: "2026-10-20T10:34:20.000Z" }))).toBe(34);
    expect(durationMinutes(session({ startedAt: null }))).toBeNull();
  });

  it("detects reminders due today or earlier", () => {
    const now = new Date("2026-10-22T08:00:00");
    expect(isReminderDue(session({ reminderAt: new Date("2026-10-22T10:00:00").toISOString() }), now)).toBe(true);
    expect(isReminderDue(session({ reminderAt: new Date("2026-10-23T10:00:00").toISOString() }), now)).toBe(false);
    expect(isReminderDue(session({ reminderAt: new Date("2026-10-20T10:00:00").toISOString(), reminderDone: true }), now)).toBe(false);
  });

  it("finds previous sessions by phone or email", () => {
    const current = session({ id: "a", phone: "0532 111 22 33" });
    const others = [current, session({ id: "b", phone: "05321112233" }), session({ id: "c", email: "x@y.com" }), session({ id: "d" })];
    expect(previousSessions(others, current).map((item) => item.id)).toEqual(["b"]);
    expect(previousSessions(others, session({ id: "e" }))).toEqual([]);
  });

  it("builds initials and invite codes", () => {
    expect(initials("ayşe nur kaya")).toBe("AK");
    expect(initials("")).toBe("?");
    let step = 0;
    const code = inviteCode(() => (step++ % 10) / 10);
    expect(isInviteCode(code)).toBe(true);
    expect(isInviteCode("abc-123")).toBe(false);
  });
});

describe("phone formatting", () => {
  it("accepts mobile and landline numbers with or without a leading 0 or +90", () => {
    expect(formatPhone("5321234567")).toBe("532 123 45 67");
    expect(formatPhone("05321234567")).toBe("0 532 123 45 67");
    expect(formatPhone("+905321234567")).toBe("+90 532 123 45 67");
    expect(formatPhone("2161234567")).toBe("216 123 45 67");
    for (const value of ["532 123 45 67", "0 532 123 45 67", "+90 532 123 45 67", "212 123 45 67", "0 216 123 45 67", "+4915112345678"]) expect(isValidPhone(value)).toBe(true);
    for (const value of ["532", "123 456 78 90", "0 532 12"]) expect(isValidPhone(value)).toBe(false);
  });
});

describe("auto off", () => {
  it("accepts empty or HH:MM time", () => {
    expect(cleanTime("")).toBe("");
    expect(cleanTime(" 22:00 ")).toBe("22:00");
    expect(cleanTime("24:00")).toBeNull();
    expect(cleanTime("9:00")).toBeNull();
    expect(cleanTime(5)).toBeNull();
  });

  it("closes at the first cutoff after becoming available", () => {
    const settings = { available: true, autoOffAt: "22:00", availableSince: "2026-10-28T06:00:00.000Z" };
    expect(isAutoOffDue(settings, new Date("2026-10-28T18:59:00.000Z"))).toBe(false);
    expect(isAutoOffDue(settings, new Date("2026-10-28T19:00:00.000Z"))).toBe(true);
    expect(isAutoOffDue(settings, new Date("2026-10-30T08:00:00.000Z"))).toBe(true);
  });

  it("waits until the next day when opened after the cutoff", () => {
    const settings = { available: true, autoOffAt: "22:00", availableSince: "2026-10-28T20:00:00.000Z" };
    expect(isAutoOffDue(settings, new Date("2026-10-28T21:30:00.000Z"))).toBe(false);
    expect(isAutoOffDue(settings, new Date("2026-10-29T18:59:00.000Z"))).toBe(false);
    expect(isAutoOffDue(settings, new Date("2026-10-29T19:00:00.000Z"))).toBe(true);
  });

  it("never closes without a time or when not available", () => {
    const now = new Date("2026-10-29T19:00:00.000Z");
    expect(isAutoOffDue({ available: true, autoOffAt: "", availableSince: "2026-10-28T06:00:00.000Z" }, now)).toBe(false);
    expect(isAutoOffDue({ available: false, autoOffAt: "22:00", availableSince: null }, now)).toBe(false);
  });
});
