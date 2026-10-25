import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let folder = "";

beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "live-store-"));
  process.env.DATA_DIR = folder;
});

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("silinen görüşmeler", () => {
  it("silinince listeden ve koddan gizlenir, süre dolunca kalıcı silinir", async () => {
    const store = await import("./live-store");
    const session = await store.createSession({ status: "waiting", name: "Test", phone: "", email: "", note: "", page: "/" });
    expect(await store.deleteSession(session.id)).toBe(true);
    expect((await store.listSessions()).some((item) => item.id === session.id)).toBe(false);
    expect(await store.getSession(session.id)).toBeNull();
    expect(await store.findByCode(session.inviteCode)).toBeNull();
    expect(await store.deleteSession(session.id)).toBe(false);
    expect(await store.purgeDeleted(10 * 24 * 60 * 60 * 1000)).toEqual([]);
    expect(await store.purgeDeleted(-1)).toEqual([session.id]);
    expect(await store.purgeDeleted(-1)).toEqual([]);
  });
});
