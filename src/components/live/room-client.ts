import { BASE_PATH, authHeaders } from "@/lib/admin-client";
import type { LiveMessage, LiveRole } from "@/lib/live";

export type RtcState = "connecting" | "connected" | "reconnecting" | "failed";

export type RemotePeer = {
  peerId: string;
  name: string;
  role: LiveRole;
  muted: boolean;
  camera: boolean;
  connected: boolean;
  rtc: RtcState;
  stream: MediaStream | null;
  screen: MediaStream | null;
  speaking: boolean;
};

export type RoomPhase = "joining" | "pending" | "live" | "denied" | "kicked" | "ended" | "closed" | "name" | "error";

export type RoomMessage = LiveMessage & { peerId?: string };

export type RoomState = {
  phase: RoomPhase;
  error: string;
  selfId: string;
  selfName: string;
  role: LiveRole;
  peers: RemotePeer[];
  sharer: string | null;
  approveJoin: boolean;
  guestShare: boolean;
  messages: RoomMessage[];
  knocks: { peerId: string; name: string }[];
  hostLost: boolean;
  online: boolean;
  sessionId: string | null;
  hostNotes: string;
};

type MemberView = { peerId: string; name: string; role: LiveRole; muted: boolean; camera: boolean; connected: boolean };

type Snapshot = { self: MemberView; members: MemberView[]; sharer: string | null; approveJoin: boolean; guestShare: boolean; messages: LiveMessage[]; sessionName: string; sessionId: string | null; hostNotes: string };

type JoinResponse = { peerId: string; peerToken: string; pending: boolean; snapshot: Snapshot | null; iceServers: RTCIceServer[] };

type Signal = { type: "offer" | "answer"; sdp: string } | { type: "candidate"; candidate: RTCIceCandidateInit } | { type: "restart" };

type Link = {
  pc: RTCPeerConnection;
  initiator: boolean;
  queued: RTCIceCandidateInit[];
  timer: ReturnType<typeof setTimeout> | null;
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
};

export type LocalTracks = { audio: MediaStreamTrack | null; video: MediaStreamTrack | null; screen: MediaStreamTrack | null };

const API = `${BASE_PATH}/api/live/room`;

class HttpError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readEvents(response: Response, onEvent: (event: string, data: unknown) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n\n");
    while (index >= 0) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          onEvent(event, null);
        }
      }
      index = buffer.indexOf("\n\n");
    }
  }
}

export class RoomClient {
  state: RoomState;
  private code: string;
  private token: string;
  private peerToken = "";
  private iceServers: RTCIceServer[] = [];
  private links = new Map<string, Link>();
  private listeners = new Set<() => void>();
  private abort: AbortController | null = null;
  private tracks: LocalTracks = { audio: null, video: null, screen: null };
  private disposed = false;
  private audioContext: AudioContext | null = null;
  private analysers = new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; track: MediaStreamTrack }>();
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private lastLoud = new Map<string, number>();
  private joinName = "";
  onIncoming: ((message: RoomMessage) => void) | null = null;

  constructor(options: { code: string; role: LiveRole; token: string }) {
    this.code = options.code;
    this.token = options.token;
    this.state = {
      phase: "joining",
      error: "",
      selfId: "",
      selfName: "",
      role: options.role,
      peers: [],
      sharer: null,
      approveJoin: true,
      guestShare: true,
      messages: [],
      knocks: [],
      hostLost: false,
      online: true,
      sessionId: null,
      hostNotes: "",
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<RoomState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private patchPeer(peerId: string, patch: Partial<RemotePeer>) {
    this.set({ peers: this.state.peers.map((peer) => (peer.peerId === peerId ? { ...peer, ...patch } : peer)) });
  }

  private headers(json = true): Record<string, string> {
    const headers: Record<string, string> = { "X-Peer-Token": this.peerToken };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  private readPass(): string {
    try {
      return window.sessionStorage.getItem(`erenler_live_pass_${this.code}`) ?? "";
    } catch {
      return "";
    }
  }

  private storePass(pass: string) {
    try {
      window.sessionStorage.setItem(`erenler_live_pass_${this.code}`, pass);
    } catch {
      return;
    }
  }

  async check(): Promise<{ valid: boolean; hostName: string }> {
    const response = await fetch(`${API}/${this.code}/join`, { cache: "no-store" }).catch(() => null);
    if (!response) return { valid: true, hostName: "" };
    if (response.status === 404 || response.status === 410) {
      this.set({ phase: "closed", error: response.status === 404 ? "notFound" : "" });
      return { valid: false, hostName: "" };
    }
    const payload = (await response.json().catch(() => null)) as { data?: { hostName?: string } } | null;
    return { valid: true, hostName: payload?.data?.hostName ?? "" };
  }

  async join(name: string): Promise<void> {
    this.joinName = name;
    this.set({ phase: "joining", error: "" });
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(this.state.role === "host" ? authHeaders() : {}) };
    const response = await fetch(`${API}/${this.code}/join`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: this.state.role, name, token: this.token || undefined, pass: this.readPass() || undefined }),
    }).catch(() => null);
    if (!response) {
      this.set({ phase: "error", error: "network" });
      return;
    }
    const payload = (await response.json().catch(() => null)) as { ok: boolean; data?: JoinResponse; error?: string; code?: string } | null;
    if (!payload?.ok || !payload.data) {
      const code = payload?.code ?? "";
      this.set({ phase: code === "liveNameRequired" ? "name" : response.status === 410 || response.status === 404 ? "closed" : "error", error: response.status === 404 ? "notFound" : (payload?.error ?? "") });
      return;
    }
    const data = payload.data;
    this.peerToken = data.peerToken;
    this.iceServers = data.iceServers;
    this.set({ selfId: data.peerId, selfName: name });
    void this.listen();
    if (data.pending) {
      this.set({ phase: "pending" });
      return;
    }
    if (data.snapshot) this.applySnapshot(data.snapshot);
  }

  private applySnapshot(snapshot: Snapshot) {
    this.closeAllLinks();
    this.set({
      phase: "live",
      selfName: snapshot.self.name,
      peers: snapshot.members.map((member) => ({ ...member, rtc: "connecting", stream: null, screen: null, speaking: false })),
      sharer: snapshot.sharer,
      approveJoin: snapshot.approveJoin,
      guestShare: snapshot.guestShare,
      messages: snapshot.messages,
      sessionId: snapshot.sessionId,
      hostNotes: snapshot.hostNotes,
      hostLost: false,
    });
    for (const member of snapshot.members) void this.call(member.peerId);
    this.startLevels();
  }

  private async listen(): Promise<void> {
    while (!this.disposed) {
      this.abort = new AbortController();
      let status = 0;
      try {
        const response = await fetch(`${API}/${this.code}/stream`, { headers: this.headers(false), signal: this.abort.signal, cache: "no-store" });
        status = response.status;
        if (response.ok) {
          this.set({ online: true });
          await readEvents(response, (event, data) => this.onEvent(event, data));
        }
      } catch {
        status = status || 0;
      }
      if (this.disposed || ["ended", "kicked", "denied", "closed"].includes(this.state.phase)) return;
      if (status === 410) {
        if (this.state.phase === "live") {
          void this.join(this.joinName || this.state.selfName);
        } else {
          this.set({ phase: "closed" });
        }
        return;
      }
      this.set({ online: false });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private onEvent(event: string, raw: unknown) {
    const data = (raw ?? {}) as Record<string, unknown>;
    switch (event) {
      case "join": {
        const member = raw as MemberView;
        if (member.peerId === this.state.selfId) return;
        this.set({ peers: [...this.state.peers.filter((peer) => peer.peerId !== member.peerId), { ...member, rtc: "connecting", stream: null, screen: null, speaking: false }], knocks: this.state.knocks.filter((knock) => knock.peerId !== member.peerId) });
        return;
      }
      case "leave":
        this.dropPeer(String(data.peerId));
        return;
      case "presence":
        this.patchPeer(String(data.peerId), { connected: data.connected === true });
        return;
      case "state":
        this.patchPeer(String(data.peerId), { muted: data.muted === true, camera: data.camera !== false });
        return;
      case "signal":
        void this.onSignal(String(data.from), data.data as Signal);
        return;
      case "share":
        this.set({ sharer: typeof data.peerId === "string" ? data.peerId : null });
        if (typeof data.peerId === "string") this.watchShareStats();
        return;
      case "settings":
        this.set({ approveJoin: data.approveJoin === true, guestShare: data.guestShare === true });
        return;
      case "chat": {
        const message = raw as RoomMessage;
        this.set({ messages: [...this.state.messages, message] });
        if (message.peerId !== this.state.selfId) this.onIncoming?.(message);
        return;
      }
      case "rename":
        if (data.peerId === this.state.selfId) this.set({ selfName: String(data.name) });
        else this.patchPeer(String(data.peerId), { name: String(data.name) });
        return;
      case "knock":
        this.set({ knocks: [...this.state.knocks.filter((knock) => knock.peerId !== data.peerId), { peerId: String(data.peerId), name: String(data.name) }] });
        return;
      case "admitted":
        if (typeof data.pass === "string") this.storePass(data.pass);
        this.applySnapshot(raw as Snapshot);
        return;
      case "denied":
        this.set({ phase: "denied" });
        this.stop();
        return;
      case "kicked":
        this.set({ phase: "kicked" });
        this.stop();
        return;
      case "host-lost":
        this.set({ hostLost: true });
        return;
      case "host-back":
        this.set({ hostLost: false });
        return;
      case "ended":
        this.set({ phase: "ended" });
        this.stop();
        return;
    }
  }

  private signal(to: string, data: Signal) {
    void fetch(`${API}/${this.code}/send`, { method: "POST", headers: this.headers(), body: JSON.stringify({ kind: "signal", to, data }) }).catch(() => undefined);
  }

  private createLink(peerId: string, initiator: boolean): Link {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const link: Link = { pc, initiator, queued: [], timer: null, audio: null, video: null };
    if (initiator) {
      pc.addTransceiver(this.tracks.audio ?? "audio", { direction: "sendrecv" });
      pc.addTransceiver(this.tracks.video ?? "video", { direction: "sendrecv" });
      pc.addTransceiver(this.tracks.screen ?? "video", { direction: "sendrecv" });
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) this.signal(peerId, { type: "candidate", candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      const index = pc.getTransceivers().indexOf(event.transceiver);
      const peer = this.state.peers.find((item) => item.peerId === peerId);
      if (!peer) return;
      if (index === 2) {
        const track = event.track;
        this.patchPeer(peerId, { screen: new MediaStream([track]) });
        track.onunmute = () => this.patchPeer(peerId, { screen: new MediaStream([track]) });
        return;
      }
      if (index === 0) link.audio = event.track;
      if (index === 1) link.video = event.track;
      const stream = new MediaStream([link.audio, link.video].filter((track): track is MediaStreamTrack => track !== null));
      this.patchPeer(peerId, { stream });
      if (index === 0) this.watchLevel(peerId, event.track);
    };
    pc.onconnectionstatechange = () => this.onConnectionState(peerId, link);
    this.links.set(peerId, link);
    return link;
  }

  private tuneSenders(pc: RTCPeerConnection) {
    const transceivers = pc.getTransceivers();
    const limits: [number, number][] = [
      [1, this.tracks.screen ? 600_000 : 2_500_000],
      [2, 3_000_000],
    ];
    for (const [index, maxBitrate] of limits) {
      const sender = transceivers[index]?.sender;
      if (!sender) continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) continue;
      params.encodings = params.encodings.map((encoding) => ({ ...encoding, maxBitrate }));
      void sender.setParameters(params).catch(() => undefined);
    }
  }

  private onConnectionState(peerId: string, link: Link) {
    const state = link.pc.connectionState;
    if (state === "connected") {
      if (link.timer) clearTimeout(link.timer);
      link.timer = null;
      this.patchPeer(peerId, { rtc: "connected" });
      this.tuneSenders(link.pc);
      return;
    }
    if (state === "disconnected" || state === "failed") {
      this.patchPeer(peerId, { rtc: "reconnecting" });
      if (link.timer) return;
      link.timer = setTimeout(
        () => {
          link.timer = null;
          if (link.pc.connectionState === "connected") return;
          if (link.initiator) void this.offer(peerId, link, true);
          else this.signal(peerId, { type: "restart" });
          link.timer = setTimeout(() => {
            link.timer = null;
            if (link.pc.connectionState !== "connected") this.patchPeer(peerId, { rtc: "failed" });
          }, 15_000);
        },
        state === "failed" ? 0 : 4000,
      );
    }
  }

  private async call(peerId: string) {
    const link = this.createLink(peerId, true);
    await this.offer(peerId, link, false);
  }

  private async offer(peerId: string, link: Link, iceRestart: boolean) {
    try {
      const offer = await link.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await link.pc.setLocalDescription(offer);
      if (link.pc.localDescription) this.signal(peerId, { type: "offer", sdp: link.pc.localDescription.sdp });
    } catch {
      this.patchPeer(peerId, { rtc: "failed" });
    }
  }

  private async flush(link: Link) {
    for (const candidate of link.queued.splice(0)) await link.pc.addIceCandidate(candidate).catch(() => undefined);
  }

  private async onSignal(from: string, data: Signal) {
    if (!data || !this.state.peers.some((peer) => peer.peerId === from)) return;
    if (data.type === "offer") {
      const existing = this.links.get(from);
      const link = existing ?? this.createLink(from, false);
      await link.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
      if (!existing) {
        const transceivers = link.pc.getTransceivers();
        const local = [this.tracks.audio, this.tracks.video, this.tracks.screen];
        transceivers.forEach((transceiver, index) => {
          transceiver.direction = "sendrecv";
          if (index < 3) void transceiver.sender.replaceTrack(local[index]).catch(() => undefined);
        });
      }
      await this.flush(link);
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      if (link.pc.localDescription) this.signal(from, { type: "answer", sdp: link.pc.localDescription.sdp });
      return;
    }
    const link = this.links.get(from);
    if (!link) return;
    if (data.type === "answer") {
      if (link.pc.signalingState !== "have-local-offer") return;
      await link.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      await this.flush(link);
    } else if (data.type === "candidate") {
      if (link.pc.remoteDescription) await link.pc.addIceCandidate(data.candidate).catch(() => undefined);
      else link.queued.push(data.candidate);
    } else if (data.type === "restart" && link.initiator) {
      await this.offer(from, link, true);
    }
  }

  setTracks(next: Partial<LocalTracks>) {
    this.tracks = { ...this.tracks, ...next };
    for (const link of this.links.values()) {
      const transceivers = link.pc.getTransceivers();
      const order: (keyof LocalTracks)[] = ["audio", "video", "screen"];
      order.forEach((key, index) => {
        if (key in next && transceivers[index]) void transceivers[index].sender.replaceTrack(this.tracks[key]).catch(() => undefined);
      });
      if ("screen" in next && link.pc.connectionState === "connected") this.tuneSenders(link.pc);
    }
  }

  private dropPeer(peerId: string) {
    const link = this.links.get(peerId);
    if (link) {
      if (link.timer) clearTimeout(link.timer);
      link.pc.close();
      this.links.delete(peerId);
    }
    const watched = this.analysers.get(peerId);
    if (watched) {
      watched.source.disconnect();
      this.analysers.delete(peerId);
    }
    this.set({ peers: this.state.peers.filter((peer) => peer.peerId !== peerId), knocks: this.state.knocks.filter((knock) => knock.peerId !== peerId), sharer: this.state.sharer === peerId ? null : this.state.sharer });
  }

  private closeAllLinks() {
    for (const peerId of [...this.links.keys()]) {
      const link = this.links.get(peerId);
      if (link?.timer) clearTimeout(link.timer);
      link?.pc.close();
    }
    this.links.clear();
  }

  private watchLevel(peerId: string, track: MediaStreamTrack) {
    try {
      this.audioContext ??= new AudioContext();
      const previous = this.analysers.get(peerId);
      if (previous?.track === track) return;
      previous?.source.disconnect();
      const source = this.audioContext.createMediaStreamSource(new MediaStream([track]));
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.analysers.set(peerId, { analyser, source, track });
    } catch {
      return;
    }
  }

  resumeAudio() {
    if (this.audioContext?.state === "suspended") void this.audioContext.resume();
  }

  private startLevels() {
    if (this.levelTimer) return;
    const data = new Uint8Array(128);
    this.levelTimer = setInterval(() => {
      let changed = false;
      const peers = this.state.peers.map((peer) => {
        const entry = this.analysers.get(peer.peerId);
        if (!entry) return peer;
        entry.analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        const now = Date.now();
        if (!peer.muted && average / 60 > 0.15) this.lastLoud.set(peer.peerId, now);
        const speaking = !peer.muted && now - (this.lastLoud.get(peer.peerId) ?? 0) < 900;
        if (speaking === peer.speaking) return peer;
        changed = true;
        return { ...peer, speaking };
      });
      if (changed) this.set({ peers });
    }, 150);
  }

  async post(body: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${API}/${this.code}/send`, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
      throw new HttpError(payload?.error ?? `HTTP ${response.status}`, response.status, payload?.code ?? "");
    }
  }

  async upload(file: File): Promise<{ name: string; size: number; url: string }> {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API}/${this.code}/upload`, { method: "POST", headers: this.headers(false), body: form });
    const payload = (await response.json().catch(() => null)) as { ok: boolean; data?: { name: string; size: number; url: string }; error?: string; code?: string } | null;
    if (!payload?.ok || !payload.data) throw new HttpError(payload?.error ?? `HTTP ${response.status}`, response.status, payload?.code ?? "");
    return payload.data;
  }

  admit(peerId: string, allow: boolean) {
    this.set({ knocks: this.state.knocks.filter((knock) => knock.peerId !== peerId) });
    return this.post({ kind: "admit", peerId, allow });
  }

  async leave() {
    await this.post({ kind: "leave" }).catch(() => undefined);
    this.set({ phase: "ended" });
    this.stop();
  }

  async end() {
    await this.post({ kind: "end" }).catch(() => undefined);
    this.set({ phase: "ended" });
    this.stop();
  }

  leaveOnUnload() {
    if (!this.peerToken || this.state.phase !== "live") return;
    void fetch(`${API}/${this.code}/send`, { method: "POST", headers: this.headers(), body: JSON.stringify({ kind: "leave" }), keepalive: true }).catch(() => undefined);
  }

  private stop() {
    this.closeAllLinks();
    this.abort?.abort();
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
  }

  revive() {
    this.disposed = false;
  }

  private shareStatsTimer: ReturnType<typeof setInterval> | null = null;

  private watchShareStats() {
    if (this.shareStatsTimer) clearInterval(this.shareStatsTimer);
    let rounds = 0;
    this.shareStatsTimer = setInterval(() => {
      rounds += 1;
      if (rounds > 12 || this.disposed || !this.state.sharer) {
        if (this.shareStatsTimer) clearInterval(this.shareStatsTimer);
        this.shareStatsTimer = null;
        return;
      }
      void this.reportShareStats();
    }, 5000);
  }

  private async reportShareStats() {
    const sending = this.state.sharer === this.state.selfId;
    const rows: Record<string, unknown>[] = [];
    for (const [peerId, link] of this.links) {
      const transceiver = link.pc.getTransceivers()[2];
      if (!transceiver) continue;
      const report = await (sending ? transceiver.sender.getStats() : transceiver.receiver.getStats()).catch(() => null);
      const pair = await link.pc.getStats().catch(() => null);
      const row: Record<string, unknown> = { peer: peerId, conn: link.pc.connectionState, track: sending ? Boolean(transceiver.sender.track) : transceiver.receiver.track.readyState + (transceiver.receiver.track.muted ? ":muted" : "") };
      report?.forEach((entry: Record<string, unknown>) => {
        if (entry.type === "outbound-rtp" || entry.type === "inbound-rtp") {
          for (const key of ["bytesSent", "bytesReceived", "framesEncoded", "framesSent", "framesReceived", "framesDecoded", "keyFramesDecoded", "frameWidth", "frameHeight", "framesPerSecond", "packetsLost", "nackCount", "pliCount", "qualityLimitationReason", "targetBitrate"]) if (entry[key] !== undefined) row[key] = entry[key];
        }
      });
      pair?.forEach((entry: Record<string, unknown>) => {
        if (entry.type === "candidate-pair" && entry.nominated && entry.state === "succeeded") {
          row.rtt = entry.currentRoundTripTime;
          row.outgoing = entry.availableOutgoingBitrate;
          const local = pair.get(String(entry.localCandidateId)) as Record<string, unknown> | undefined;
          row.path = local ? `${String(local.candidateType)}/${String(local.protocol)}` : "";
        }
      });
      rows.push(row);
    }
    if (rows.length > 0) void this.post({ kind: "stats", role: sending ? "sender" : "receiver", rows }).catch(() => undefined);
  }

  dispose() {
    if (this.shareStatsTimer) clearInterval(this.shareStatsTimer);
    this.disposed = true;
    this.stop();
    void this.audioContext?.close().catch(() => undefined);
    this.listeners.clear();
  }
}

export { HttpError };
