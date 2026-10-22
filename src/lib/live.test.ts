import { describe, expect, it } from "vitest";
import { cleanEmail, cleanName, cleanPage, cleanPhone, durationMinutes, initials, inviteCode, isInviteCode, isReminderDue, liveBadgeCount, parseSessionPatch, previousSessions, type LiveSession } from "./live";

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
