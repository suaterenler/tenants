import "server-only";
import { randomBytes } from "node:crypto";
import { LIVE_QUEUE_SECONDS, LIVE_ROOM_IDLE_HOURS, LIVE_WAIT_SECONDS, type LiveMessage, type LiveRole, type LiveSession, type LiveSettings } from "@/lib/live";
import { secretMatches } from "./secret";
import type { Emit } from "./sse";
import { addParticipant, appendMessage, closeParticipant, expireWaiting, getSettings, updateSession } from "./live-store";

export type MemberView = { peerId: string; name: string; role: LiveRole; muted: boolean; camera: boolean; connected: boolean };

type Member = {
  peerId: string;
  token: string;
  name: string;
  role: LiveRole;
  admitted: boolean;
  participantIndex: number;
  muted: boolean;
  camera: boolean;
  listeners: Set<Emit>;
  graceTimer: ReturnType<typeof setTimeout> | null;
};

type Room = {
  code: string;
  sessionId: string;
  members: Map<string, Member>;
  sharer: string | null;
  approveJoin: boolean;
  guestShare: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

type Hub = {
  rooms: Map<string, Room>;
  admins: Set<Emit>;
  requestTokens: Map<string, string>;
  requestWatchers: Map<string, Set<Emit>>;
  sweeper: ReturnType<typeof setInterval> | null;
  onMissed: ((session: LiveSession) => void) | null;
};

const GRACE_MS = 30_000;
const globalHub = globalThis as typeof globalThis & { __erenlerLiveHub?: Hub };

function hub(): Hub {
  if (!globalHub.__erenlerLiveHub) {
    globalHub.__erenlerLiveHub = { rooms: new Map(), admins: new Set(), requestTokens: new Map(), requestWatchers: new Map(), sweeper: null, onMissed: null };
  }
  const state = globalHub.__erenlerLiveHub;
  if (!state.sweeper) {
    state.sweeper = setInterval(() => {
      void expireWaiting(((hostInCall() ? LIVE_QUEUE_SECONDS : LIVE_WAIT_SECONDS) + 30) * 1000).then((expired) => {
        for (const session of expired) {
          notifyRequest(session.id, "missed", {});
          emitAdmin("session", session);
          state.onMissed?.(session);
        }
      });
    }, 15_000);
  }
  return state;
}

function token(): string {
  return randomBytes(24).toString("hex");
}

export function setMissedHandler(handler: (session: LiveSession) => void): void {
  hub().onMissed = handler;
}

export function adminSubscribe(emit: Emit): () => void {
  const state = hub();
  state.admins.add(emit);
  return () => state.admins.delete(emit);
}

export function adminOnline(): boolean {
  return hub().admins.size > 0;
}

export function emitAdmin(event: string, data: unknown): void {
  for (const emit of hub().admins) emit(event, data);
}

export function issueRequestToken(sessionId: string): string {
  const value = token();
  hub().requestTokens.set(sessionId, value);
  return value;
}

export function checkRequestToken(sessionId: string, value: string): boolean {
  const expected = hub().requestTokens.get(sessionId);
  return Boolean(expected) && secretMatches(value, expected ?? "");
}

export function requestSubscribe(sessionId: string, emit: Emit): () => void {
  const state = hub();
  const watchers = state.requestWatchers.get(sessionId) ?? new Set<Emit>();
  watchers.add(emit);
  state.requestWatchers.set(sessionId, watchers);
  return () => {
    watchers.delete(emit);
    if (watchers.size === 0) state.requestWatchers.delete(sessionId);
  };
}

export function notifyRequest(sessionId: string, event: string, data: unknown): void {
  for (const emit of hub().requestWatchers.get(sessionId) ?? []) emit(event, data);
}

function view(member: Member): MemberView {
  return { peerId: member.peerId, name: member.name, role: member.role, muted: member.muted, camera: member.camera, connected: member.listeners.size > 0 };
}

function admitted(room: Room): Member[] {
  return [...room.members.values()].filter((member) => member.admitted);
}

function broadcast(room: Room, event: string, data: unknown, except?: string): void {
  for (const member of admitted(room)) {
    if (member.peerId === except) continue;
    for (const emit of member.listeners) emit(event, data);
  }
}

function sendTo(member: Member, event: string, data: unknown): void {
  for (const emit of member.listeners) emit(event, data);
}

function hosts(room: Room): Member[] {
  return admitted(room).filter((member) => member.role === "host");
}

async function openRoom(session: LiveSession): Promise<Room> {
  const state = hub();
  const existing = state.rooms.get(session.inviteCode);
  if (existing) return existing;
  const settings: LiveSettings = await getSettings();
  const room: Room = { code: session.inviteCode, sessionId: session.id, members: new Map(), sharer: null, approveJoin: settings.approveJoin, guestShare: settings.guestShare, idleTimer: null };
  state.rooms.set(room.code, room);
  return room;
}

export function openRoomCount(): number {
  let count = 0;
  for (const room of hub().rooms.values()) if (admitted(room).length > 0) count += 1;
  return count;
}

export function hostInCall(exceptCode?: string): boolean {
  for (const room of hub().rooms.values()) {
    if (room.code === exceptCode) continue;
    if (hosts(room).length > 0) return true;
  }
  return false;
}

function emitBusy(): void {
  emitAdmin("busy", { busy: hostInCall() });
}

export function roomOf(code: string): Room | null {
  return hub().rooms.get(code) ?? null;
}

export function memberByToken(code: string, value: string): Member | null {
  const room = roomOf(code);
  if (!room || !value) return null;
  for (const member of room.members.values()) {
    if (secretMatches(value, member.token)) return member;
  }
  return null;
}

export type RoomSnapshot = { self: MemberView; members: MemberView[]; sharer: string | null; approveJoin: boolean; guestShare: boolean; messages: LiveMessage[]; sessionName: string; sessionId: string | null; hostNotes: string };

function snapshot(room: Room, member: Member, session: LiveSession): RoomSnapshot {
  return {
    self: view(member),
    members: admitted(room).filter((item) => item.peerId !== member.peerId).map(view),
    sharer: room.sharer,
    approveJoin: room.approveJoin,
    guestShare: room.guestShare,
    messages: session.messages,
    sessionName: session.name,
    sessionId: member.role === "host" ? session.id : null,
    hostNotes: member.role === "host" ? session.hostNotes : "",
  };
}

async function admit(room: Room, member: Member): Promise<void> {
  member.admitted = true;
  member.participantIndex = await addParticipant(room.sessionId, { name: member.name, role: member.role, joinedAt: new Date().toISOString(), leftAt: null, inviteCode: room.code });
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = null;
  broadcast(room, "join", view(member), member.peerId);
}

export async function joinRoom(session: LiveSession, input: { name: string; role: LiveRole; trusted: boolean }): Promise<{ member: Member; pending: boolean; snapshot: RoomSnapshot | null }> {
  const room = await openRoom(session);
  const member: Member = {
    peerId: token().slice(0, 12),
    token: token(),
    name: input.name || (input.role === "host" ? "Erenler Yazılım" : "Ziyaretçi"),
    role: input.role,
    admitted: false,
    participantIndex: -1,
    muted: false,
    camera: true,
    listeners: new Set(),
    graceTimer: null,
  };
  room.members.set(member.peerId, member);
  const needsApproval = input.role === "guest" && !input.trusted && room.approveJoin && hosts(room).length > 0;
  if (needsApproval) {
    for (const host of hosts(room)) sendTo(host, "knock", { peerId: member.peerId, name: member.name });
    scheduleGrace(room, member);
    return { member, pending: true, snapshot: null };
  }
  await admit(room, member);
  if (input.role === "host") {
    await updateSession(session.id, (item) => {
      item.status = "active";
      item.isNew = false;
      if (!item.startedAt) item.startedAt = new Date().toISOString();
      item.endedAt = null;
    });
    broadcast(room, "host-back", {}, member.peerId);
    emitBusy();
  }
  scheduleGrace(room, member);
  return { member, pending: false, snapshot: snapshot(room, member, session) };
}

function scheduleGrace(room: Room, member: Member): void {
  if (member.graceTimer) clearTimeout(member.graceTimer);
  member.graceTimer = setTimeout(() => {
    if (member.listeners.size === 0) void removeMember(room, member, "timeout");
  }, GRACE_MS);
}

export function attachStream(code: string, member: Member, emit: Emit): () => void {
  const room = roomOf(code);
  if (!room) return () => undefined;
  const wasOffline = member.listeners.size === 0;
  member.listeners.add(emit);
  if (member.graceTimer) clearTimeout(member.graceTimer);
  member.graceTimer = null;
  if (wasOffline && member.admitted) {
    broadcast(room, "presence", { peerId: member.peerId, connected: true }, member.peerId);
    if (member.role === "host") broadcast(room, "host-back", {}, member.peerId);
  }
  return () => {
    member.listeners.delete(emit);
    if (member.listeners.size > 0 || !room.members.has(member.peerId)) return;
    if (member.admitted) {
      broadcast(room, "presence", { peerId: member.peerId, connected: false }, member.peerId);
      if (member.role === "host" && hosts(room).every((host) => host.listeners.size === 0)) broadcast(room, "host-lost", {});
    }
    scheduleGrace(room, member);
  };
}

async function removeMember(room: Room, member: Member, reason: string): Promise<void> {
  if (!room.members.delete(member.peerId)) return;
  if (member.graceTimer) clearTimeout(member.graceTimer);
  if (member.admitted) {
    if (member.participantIndex >= 0) await closeParticipant(room.sessionId, member.participantIndex);
    if (room.sharer === member.peerId) {
      room.sharer = null;
      broadcast(room, "share", { peerId: null });
    }
    broadcast(room, "leave", { peerId: member.peerId, reason });
    if (member.role === "host") emitBusy();
  }
  if (admitted(room).length === 0) {
    if (room.idleTimer) clearTimeout(room.idleTimer);
    room.idleTimer = setTimeout(() => void closeRoom(room, "idle"), LIVE_ROOM_IDLE_HOURS * 60 * 60 * 1000);
  }
}

async function closeRoom(room: Room, reason: string): Promise<void> {
  broadcast(room, "ended", { reason });
  for (const member of [...room.members.values()]) {
    if (member.graceTimer) clearTimeout(member.graceTimer);
    if (member.admitted && member.participantIndex >= 0) await closeParticipant(room.sessionId, member.participantIndex);
  }
  room.members.clear();
  if (room.idleTimer) clearTimeout(room.idleTimer);
  hub().rooms.delete(room.code);
  emitBusy();
  const session = await updateSession(room.sessionId, (item) => {
    if (item.status === "active") item.status = "completed";
    item.endedAt = new Date().toISOString();
  });
  if (session) emitAdmin("session", session);
}

export function closeRoomByCode(code: string): Promise<void> {
  const room = roomOf(code);
  return room ? closeRoom(room, "deleted") : Promise.resolve();
}

export type RoomCommand =
  | { kind: "signal"; to: string; data: unknown }
  | { kind: "state"; muted: boolean; camera: boolean }
  | { kind: "share"; on: boolean }
  | { kind: "admit"; peerId: string; allow: boolean }
  | { kind: "settings"; approveJoin?: boolean; guestShare?: boolean }
  | { kind: "chat"; text: string; file?: { name: string; url: string; size: number } }
  | { kind: "rename"; name: string }
  | { kind: "kick"; peerId: string }
  | { kind: "leave" }
  | { kind: "end" };

export async function command(code: string, member: Member, input: RoomCommand): Promise<{ ok: boolean; error?: string }> {
  const room = roomOf(code);
  if (!room || !room.members.has(member.peerId)) return { ok: false, error: "notFound" };
  if (!member.admitted && input.kind !== "leave") return { ok: false, error: "forbidden" };
  switch (input.kind) {
    case "signal": {
      const target = room.members.get(input.to);
      if (!target || !target.admitted) return { ok: false, error: "notFound" };
      sendTo(target, "signal", { from: member.peerId, data: input.data });
      return { ok: true };
    }
    case "state":
      member.muted = input.muted;
      member.camera = input.camera;
      broadcast(room, "state", { peerId: member.peerId, muted: member.muted, camera: member.camera }, member.peerId);
      return { ok: true };
    case "share":
      if (input.on) {
        if (member.role !== "host" && !room.guestShare) return { ok: false, error: "forbidden" };
        if (room.sharer && room.sharer !== member.peerId && member.role !== "host") return { ok: false, error: "forbidden" };
        room.sharer = member.peerId;
      } else if (room.sharer === member.peerId) {
        room.sharer = null;
      }
      broadcast(room, "share", { peerId: room.sharer });
      return { ok: true };
    case "admit": {
      if (member.role !== "host") return { ok: false, error: "forbidden" };
      const target = room.members.get(input.peerId);
      if (!target || target.admitted) return { ok: false, error: "notFound" };
      if (!input.allow) {
        sendTo(target, "denied", {});
        room.members.delete(target.peerId);
        if (target.graceTimer) clearTimeout(target.graceTimer);
        return { ok: true };
      }
      await admit(room, target);
      const session = await updateSession(room.sessionId, () => undefined);
      if (session) sendTo(target, "admitted", snapshot(room, target, session));
      return { ok: true };
    }
    case "settings":
      if (member.role !== "host") return { ok: false, error: "forbidden" };
      if (typeof input.approveJoin === "boolean") room.approveJoin = input.approveJoin;
      if (typeof input.guestShare === "boolean") room.guestShare = input.guestShare;
      if (!room.guestShare && room.sharer && room.members.get(room.sharer)?.role !== "host") {
        room.sharer = null;
        broadcast(room, "share", { peerId: null });
      }
      broadcast(room, "settings", { approveJoin: room.approveJoin, guestShare: room.guestShare });
      return { ok: true };
    case "chat": {
      const message = await appendMessage(room.sessionId, { author: member.name, role: member.role, text: input.text, file: input.file });
      if (!message) return { ok: false, error: "notFound" };
      broadcast(room, "chat", { ...message, peerId: member.peerId });
      return { ok: true };
    }
    case "rename": {
      if (!input.name) return { ok: false, error: "invalidRecord" };
      member.name = input.name;
      const index = member.participantIndex;
      await updateSession(room.sessionId, (item) => {
        const participant = item.participants[index];
        if (participant) participant.name = input.name;
        if (member.role === "guest" && !item.name) item.name = input.name;
      });
      broadcast(room, "rename", { peerId: member.peerId, name: member.name });
      return { ok: true };
    }
    case "kick": {
      if (member.role !== "host") return { ok: false, error: "forbidden" };
      const target = room.members.get(input.peerId);
      if (!target || target.role === "host") return { ok: false, error: "notFound" };
      sendTo(target, "kicked", {});
      await removeMember(room, target, "kicked");
      return { ok: true };
    }
    case "leave":
      await removeMember(room, member, "left");
      return { ok: true };
    case "end":
      if (member.role !== "host") return { ok: false, error: "forbidden" };
      await closeRoom(room, "ended");
      return { ok: true };
  }
}

export function sessionIdOf(code: string): string | null {
  return roomOf(code)?.sessionId ?? null;
}
