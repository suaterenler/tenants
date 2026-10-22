(function () {
  if (window.ErenlerLiveWidget) return;

  var LANG = /^en/i.test(document.documentElement.getAttribute("lang") || "") ? "en" : "tr";
  var TEXT = {
    tr: {
      bannerTitle: "Ücretsiz canlı görüşme ve sunum",
      subOn: "Uzmanımız şimdi görüntülü bağlansın, ürünü birlikte inceleyelim.",
      subOff: "Şu an müsait değiliz. Talebinizi bırakın, sizi arayalım.",
      stateOn: "Şu an müsait",
      stateOff: "Şu an müsait değil",
      startNow: "Hemen görüşme başlat",
      requestCall: "Canlı görüşme talep et",
      dismiss: "Şeridi kapat",
      openLive: "Canlı görüşmeyi aç",
      close: "Kapat",
      prepTitle: "Görüşmeye hazırlanın",
      nameLabel: "Adınız",
      namePh: "Adınız Soyadınız",
      preview: "Kamera önizleme",
      camOff: "Kamera kapalı",
      camToggleOff: "Kamerayı kapat",
      camToggleOn: "Kamerayı aç",
      micToggleOff: "Mikrofonu kapat",
      micToggleOn: "Mikrofonu aç",
      level: "Mikrofon seviyesi",
      denied: "Kamera ve mikrofon erişimi verilmedi. Tarayıcı ayarlarından izin verip tekrar deneyebilir ya da yalnız sesle devam edebilirsiniz.",
      notFound: "Kamera veya mikrofon bulunamadı. Yalnız sesle devam edebilirsiniz.",
      mediaFail: "Kamera ve mikrofon başlatılamadı. Yalnız sesle devam edebilirsiniz.",
      unsupported: "Bu tarayıcı kamera ve mikrofonu desteklemiyor. Talebinizi yine de gönderebilirsiniz.",
      retry: "Tekrar dene",
      audioOnly: "Yalnız sesle devam et",
      audioOnlyNote: "Yalnız ses modundasınız.",
      privacy: "Görüşme kaydedilmez. Adınız ve yazışmalar yalnız görüşme geçmişinde tutulur.",
      request: "Görüşme talep et",
      waitHead: "Görüşme talebi",
      waitTitle: "Talebiniz iletildi, bağlantı bekleniyor…",
      elapsed: "Geçen süre",
      cancel: "Vazgeç",
      rejectTitle: "Şu an görüşme yapılamıyor",
      rejectText: "Uzmanlarımız şu an canlı görüşmeye müsait değil. Telefon numaranızı bırakın, sizi arayalım.",
      timeoutTitle: "Talebiniz alındı",
      timeoutText: "Talebiniz alındı. Kısa sürede yanıt verebilirsek bağlantıyı biz kuracağız; uzun sürerse size telefonla bilgi verilecek.",
      name: "Ad Soyad",
      phone: "Telefon",
      phoneHint: "0 5xx xxx xx xx",
      email: "E-posta (isteğe bağlı)",
      note: "Kısa not (isteğe bağlı)",
      notePh: "Hangi ürünle ilgileniyorsunuz?",
      offTitle: "Canlı görüşme şu an müsait değil",
      sendRequest: "Talep gönder",
      send: "Gönder",
      thanksTitle: "Teşekkürler!",
      thanksText: "Talebiniz alındı, en kısa sürede sizi arayacağız.",
      required: "Bu alan zorunlu.",
      badPhone: "Telefonu 0 5xx xxx xx xx biçiminde girin.",
      badEmail: "Geçerli bir e-posta adresi girin.",
      callTitle: "Canlı görüşme",
      minimize: "Küçült",
      maximize: "Büyüt",
      endCall: "Görüşmeyi kapat",
      unavailableErr: "Şu an canlı görüşme yapılamıyor. Talebinizi bırakın, sizi arayalım.",
      rateErr: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
      netErr: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
      failErr: "Talebiniz gönderilemedi. Lütfen tekrar deneyin.",
      goneErr: "Talebin süresi doldu. Lütfen yeni bir talep oluşturun."
    },
    en: {
      bannerTitle: "Free live consultation and demo",
      subOn: "Our specialist can connect with you on video now and walk you through the product.",
      subOff: "We are not available right now. Leave your request and we will call you.",
      stateOn: "Available now",
      stateOff: "Not available now",
      startNow: "Start a call now",
      requestCall: "Request a live call",
      dismiss: "Hide banner",
      openLive: "Open live call",
      close: "Close",
      prepTitle: "Get ready for the call",
      nameLabel: "Your name (optional)",
      namePh: "Your full name",
      preview: "Camera preview",
      camOff: "Camera off",
      camToggleOff: "Turn camera off",
      camToggleOn: "Turn camera on",
      micToggleOff: "Mute microphone",
      micToggleOn: "Unmute microphone",
      level: "Microphone level",
      denied: "Camera and microphone access was not granted. Allow it in your browser settings and try again, or continue with audio only.",
      notFound: "No camera or microphone was found. You can continue with audio only.",
      mediaFail: "The camera and microphone could not be started. You can continue with audio only.",
      unsupported: "This browser does not support camera and microphone access. You can still send your request.",
      retry: "Try again",
      audioOnly: "Continue with audio only",
      audioOnlyNote: "You are in audio-only mode.",
      privacy: "The call is not recorded. Your name and messages are kept only in the call history.",
      request: "Request a call",
      waitHead: "Call request",
      waitTitle: "Your request was sent, waiting for the connection…",
      elapsed: "Elapsed",
      cancel: "Cancel",
      rejectTitle: "A live call is not possible right now",
      rejectText: "Our specialists are not available for a live call at the moment. Leave your phone number and we will call you.",
      timeoutTitle: "Your request was received",
      timeoutText: "Your request was received. If we can respond soon we will connect you; if it takes longer we will inform you by phone.",
      name: "Full name",
      phone: "Phone",
      phoneHint: "0 5xx xxx xx xx",
      email: "Email (optional)",
      note: "Short note (optional)",
      notePh: "Which product are you interested in?",
      offTitle: "Live call is not available right now",
      sendRequest: "Send request",
      send: "Send",
      thanksTitle: "Thank you!",
      thanksText: "Your request was received. We will call you as soon as possible.",
      required: "This field is required.",
      badPhone: "Enter the phone as 0 5xx xxx xx xx.",
      badEmail: "Enter a valid email address.",
      callTitle: "Live call",
      minimize: "Minimize",
      maximize: "Maximize",
      endCall: "End call",
      unavailableErr: "A live call is not available right now. Leave your request and we will call you.",
      rateErr: "Too many attempts. Please try again in a few minutes.",
      netErr: "Could not connect. Check your internet connection and try again.",
      failErr: "Your request could not be sent. Please try again.",
      goneErr: "This request has expired. Please send a new request."
    }
  };
  const t = TEXT[LANG];

  const ICONS = {
    video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    videoOff: '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h.34"/><path d="m2 2 20 20"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/>',
    micOff: '<path d="m2 2 20 20"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M12 18v4"/><path d="M8 22h8"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    minimize: '<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>',
    maximize: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
  };

  const CSS = `
:host{--navy:#0b1a36;--blue:#2f7bff;--sky:#5fd4ff;--bg:#ffffff;--fg:#0b1a36;--muted:#5b6b85;--line:#e1e8f5;--surface:#f4f7fd;--shadow:0 24px 60px rgba(11,26,54,.25);--danger:#c62828;--ok:#15803d;--warn:#b45309;color-scheme:light}
@media (prefers-color-scheme: dark){:host{--bg:#0f2143;--fg:#e8eefb;--muted:#9fb0cc;--line:#263d66;--surface:#132a52;--shadow:0 24px 60px rgba(0,0,0,.55);--danger:#f87171;--ok:#4ade80;--warn:#fbbf24;color-scheme:dark}}
.w{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:15px;line-height:1.45;color:var(--fg)}
*,*::before,*::after{box-sizing:border-box}
button,input,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:3px solid var(--sky);outline-offset:2px}
[hidden]{display:none !important}
.ico{display:inline-grid;place-items:center;flex:none}
.ico svg{display:block;width:20px;height:20px}
.banner{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;align-items:center;gap:14px;padding:12px var(--ew-side-r,var(--ew-side,max(18px,calc((100% - var(--ew-max,1280px)) / 2 + var(--ew-pad,24px))))) 12px var(--ew-side,max(18px,calc((100% - var(--ew-max,1280px)) / 2 + var(--ew-pad,24px))));color:#fff;background:linear-gradient(90deg,#0b1a36 0%,#14336b 100%);box-shadow:0 8px 24px rgba(11,26,54,.28);min-width:0}
.dot{width:10px;height:10px;border-radius:50%;flex:none}
.dot.on{background:#22c55e;animation:pulse 1.8s ease-out infinite}
.dot.off{background:#8b97ad}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.65)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.btext{flex:1;min-width:0}
.btitle{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bsub{font-size:13px;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cta{flex:none;border:0;border-radius:999px;padding:9px 18px;font-weight:650;color:#fff;background:linear-gradient(135deg,#2f7bff,#4fb8ff);box-shadow:0 6px 18px rgba(47,123,255,.4);white-space:nowrap}
.cta:hover{filter:brightness(1.08)}
.icon-btn{flex:none;width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:inherit;opacity:.8}
.icon-btn:hover{opacity:1;background:rgba(127,127,127,.18)}
.fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#0b1a36,#2f7bff);box-shadow:0 14px 34px rgba(11,26,54,.4);transition:transform .15s ease}
.fab:hover{transform:translateY(-2px)}
.layer{position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:20px}
.backdrop{position:absolute;inset:0;background:rgba(5,11,24,.62);backdrop-filter:blur(4px)}
.dialog{position:relative;width:min(460px,100%);min-height:540px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.dhead{display:flex;align-items:center;gap:12px;padding:18px 18px 8px 20px}
.badge{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#2f7bff,#5fd4ff);flex:none}
.dtitle{flex:1;margin:0;font-size:17px;font-weight:700;min-width:0}
.dialog .icon-btn{color:var(--muted)}
.dbody{flex:1;display:flex;flex-direction:column;padding:8px 20px 20px;min-height:0;overflow:auto}
.step{display:flex;flex-direction:column;gap:14px;flex:1;margin:0}
.lead{margin:0;color:var(--muted)}
.flabel{display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:600}
.field{display:flex;flex-direction:column;gap:4px}
input,textarea{width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--fg);outline:none;font-weight:400}
input:focus,textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(47,123,255,.25)}
input[aria-invalid="true"],textarea[aria-invalid="true"]{border-color:var(--danger)}
textarea{resize:vertical;min-height:80px}
.ferr{min-height:18px;font-size:12.5px;color:var(--danger)}
.preview{position:relative;aspect-ratio:16/10;border-radius:16px;overflow:hidden;background:radial-gradient(circle at 30% 20%,#23509a,#0b1a36 70%)}
.preview video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block}
.preview .off{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#cfe0ff;font-size:14px}
.preview .off .ico svg{width:34px;height:34px}
.preview.nocam .off{display:flex}
.preview.nocam video{visibility:hidden}
.controls{display:flex;align-items:center;gap:10px}
.ibtn{flex:none;width:46px;height:46px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--fg);display:grid;place-items:center}
.ibtn.off{background:rgba(198,40,40,.12);border-color:rgba(198,40,40,.35);color:var(--danger)}
.ibtn:disabled{opacity:.45;cursor:not-allowed}
.meter{flex:1;height:10px;border-radius:99px;background:var(--surface);border:1px solid var(--line);overflow:hidden}
.meter i{display:block;width:100%;height:100%;background:linear-gradient(90deg,#22c55e,#2f7bff 60%,#5fd4ff);transform:scaleX(0);transform-origin:left center;transition:transform .08s linear}
.warn-slot{display:flex;flex-direction:column;gap:8px;min-height:0}
.notice{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:14px;background:rgba(217,119,6,.13);font-size:13.5px}
.notice .ico{color:var(--warn);margin-top:1px}
.row{display:flex;gap:8px;flex-wrap:wrap}
.mini-btn{border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:10px;padding:7px 12px;font-size:13px;font-weight:600}
.hint{margin:0;font-size:13px;color:var(--muted)}
.privacy{margin:0;display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--muted)}
.privacy .ico{color:var(--blue);margin-top:1px}
.btn{width:100%;border:0;border-radius:14px;padding:13px 16px;font-size:15px;font-weight:650}
.btn.primary{color:#fff;background:linear-gradient(135deg,#2f7bff,#4fb8ff);box-shadow:0 10px 24px rgba(47,123,255,.32)}
.btn.primary:hover{filter:brightness(1.06)}
.btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}
.btn.end{margin-top:auto}
.wait{align-items:center;justify-content:center;text-align:center}
.avatar{position:relative;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#0b1a36,#2f7bff)}
.avatar .ico svg{width:40px;height:40px}
.avatar::before,.avatar::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(47,123,255,.55);animation:ring 2.2s ease-out infinite}
.avatar::after{animation-delay:1.1s}
@keyframes ring{from{transform:scale(1);opacity:.9}to{transform:scale(1.6);opacity:0}}
.wait .avatar{margin:40px 0 36px}
.wait-title{margin:0;font-weight:600}
.elapsed-line{margin:0;display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px}
.elapsed-line .tm{font-variant-numeric:tabular-nums}
.ok{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;color:var(--ok);background:rgba(34,197,94,.14)}
.ok .ico svg{width:34px;height:34px}
.done{align-items:center;text-align:center;justify-content:center}
.call{position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;background:#050b18}
.call .bar{display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;min-height:52px;color:#fff;background:linear-gradient(90deg,#0b1a36,#14336b);user-select:none}
.live-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;flex:none}
.call .ttl{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.call .icon-btn{color:#fff}
.call iframe{flex:1;width:100%;min-height:0;border:0;background:#000}
.call.mini{inset:auto;right:16px;bottom:16px;width:min(340px,calc(100vw - 32px));height:230px;border-radius:16px;overflow:hidden;box-shadow:var(--shadow);border:1px solid rgba(255,255,255,.14)}
.call.mini .bar{cursor:grab;touch-action:none;min-height:44px;padding:6px 8px 6px 12px;font-size:13px}
@media (max-width:640px){
.banner{padding:9px 12px;gap:10px}
.bsub{display:none}
.btitle{font-size:14px}
.cta{padding:8px 13px;font-size:13px}
.fab{right:14px;bottom:14px}
.layer{padding:0;align-items:flex-end}
.dialog{width:100%;min-height:72vh;max-height:92vh;border-radius:22px 22px 0 0;border-bottom:0}
.call.mini{right:8px;bottom:8px;width:calc(100vw - 16px);height:200px}
}
@media (prefers-reduced-motion: reduce){.dot,.avatar::before,.avatar::after{animation:none}.fab{transition:none}}
`;

  const ACCEPT_DELAY = 4000;
  const DEMO = !!window.ErenlerLiveDemo;
  const WAIT_MS = 60000;
  const POLL_MS = 60000;
  const RETRY_MS = 2000;
  const CALL_PATH = "/admin/live/j/DEMO42";
  const PHONE_RE = /^0 5\d{2} \d{3} \d{2} \d{2}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let ORIGIN = window.location.origin;
  const SCRIPT = document.currentScript;
  if (SCRIPT && SCRIPT.src) {
    try { ORIGIN = new URL(SCRIPT.src).origin; } catch { ORIGIN = window.location.origin; }
  }

  let root = null;
  let wrap = null;
  let banner = null;
  let fab = null;
  let layer = null;
  let dialog = null;
  let dialogTitle = null;
  let dialogBody = null;
  let callEl = null;
  let callBar = null;
  let callToggle = null;
  let frame = null;
  let basePad = 0;
  let bannerOn = true;
  let refs = {};
  let drag = null;
  const live = { known: false, available: false };
  const net = { ctl: null };

  function fresh() {
    return {
      step: "closed", variant: "", opener: null, name: "", answer: "timeout",
      elapsed: 0, mediaError: "", audioOnly: false, camOn: true, micOn: true, timers: [],
      error: "", id: null, token: ""
    };
  }
  let st = fresh();

  const media = { token: 0, stream: null, ctx: null, analyser: null, data: null, raf: 0 };

  function config() {
    if (!DEMO) return { available: live.available, answer: "timeout", waitSeconds: WAIT_MS / 1000 };
    const d = window.ErenlerLiveDemo;
    return {
      available: d.available === true,
      answer: d.answer === "accept" || d.answer === "reject" ? d.answer : "timeout",
      waitSeconds: typeof d.waitSeconds === "number" ? d.waitSeconds : 60
    };
  }

  function el(tag, props, kids) {
    const node = document.createElement(tag);
    const p = props || {};
    Object.keys(p).forEach(function (k) {
      const v = p[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else if (k === "on") Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
      else node.setAttribute(k, v === true ? "" : String(v));
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function icon(name, cls) {
    const span = el("span", { class: cls || "ico", "aria-hidden": "true" });
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + "</svg>";
    return span;
  }

  function fmt(n) {
    const m = Math.floor(n / 60);
    const s = n % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function maskPhone(v) {
    let d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length && d.charAt(0) !== "0") d = ("0" + d).slice(0, 11);
    return [d.slice(0, 1), d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean).join(" ");
  }

  function isPhone(v) { return PHONE_RE.test(v); }
  function isEmail(v) { return EMAIL_RE.test(v); }

  function later(fn, ms) { st.timers.push(setTimeout(fn, ms)); }
  function every(fn, ms) { st.timers.push(setInterval(fn, ms)); }
  function clearTimers() {
    st.timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
    st.timers = [];
  }

  function stopStream(stream) {
    stream.getTracks().forEach(function (tr) { tr.stop(); });
  }

  function stopMeter() {
    if (media.raf) cancelAnimationFrame(media.raf);
    media.raf = 0;
    if (media.ctx) media.ctx.close().catch(function () {});
    media.ctx = null;
    media.analyser = null;
    media.data = null;
  }

  function stopMedia() {
    media.token += 1;
    stopMeter();
    if (media.stream) stopStream(media.stream);
    media.stream = null;
    if (refs.video) refs.video.srcObject = null;
  }

  function meterTick() {
    if (!media.analyser) return;
    media.analyser.getByteTimeDomainData(media.data);
    let sum = 0;
    for (let i = 0; i < media.data.length; i++) {
      const v = (media.data[i] - 128) / 128;
      sum += v * v;
    }
    const level = Math.min(1, Math.sqrt(sum / media.data.length) * 4);
    if (refs.meter) refs.meter.style.transform = "scaleX(" + level.toFixed(3) + ")";
    media.raf = requestAnimationFrame(meterTick);
  }

  function startMeter(stream) {
    stopMeter();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !stream.getAudioTracks().length) return;
    try {
      media.ctx = new AC();
      const source = media.ctx.createMediaStreamSource(stream);
      media.analyser = media.ctx.createAnalyser();
      media.analyser.fftSize = 512;
      source.connect(media.analyser);
      media.data = new Uint8Array(media.analyser.fftSize);
      if (media.ctx.state === "suspended") media.ctx.resume().catch(function () {});
      meterTick();
    } catch {
      stopMeter();
    }
  }

  function mediaErrorText(err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") return t.denied;
    if (name === "NotFoundError" || name === "OverconstrainedError") return t.notFound;
    return t.mediaFail;
  }

  function startMedia(audioOnly) {
    stopMedia();
    const token = media.token;
    st.audioOnly = !!audioOnly;
    st.mediaError = "";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      st.mediaError = t.unsupported;
      renderWarn();
      syncControls();
      return;
    }
    navigator.mediaDevices.getUserMedia(audioOnly ? { audio: true } : { video: true, audio: true }).then(function (stream) {
      if (token !== media.token) {
        stopStream(stream);
        return;
      }
      media.stream = stream;
      stream.getVideoTracks().forEach(function (tr) { tr.enabled = st.camOn; });
      stream.getAudioTracks().forEach(function (tr) { tr.enabled = st.micOn; });
      if (refs.video) {
        refs.video.srcObject = stream;
        refs.video.play().catch(function () {});
      }
      startMeter(stream);
      syncControls();
      renderWarn();
    }).catch(function (err) {
      if (token !== media.token) return;
      st.mediaError = mediaErrorText(err);
      syncControls();
      renderWarn();
    });
  }

  function syncControls() {
    const hasVideo = !!(media.stream && media.stream.getVideoTracks().length);
    const hasAudio = !!(media.stream && media.stream.getAudioTracks().length);
    const camLive = hasVideo && st.camOn;
    const micLive = hasAudio && st.micOn;
    if (refs.preview) refs.preview.classList.toggle("nocam", !camLive);
    if (refs.camBtn) {
      const label = camLive ? t.camToggleOff : t.camToggleOn;
      refs.camBtn.replaceChildren(icon(camLive ? "video" : "videoOff"));
      refs.camBtn.title = label;
      refs.camBtn.setAttribute("aria-label", label);
      refs.camBtn.classList.toggle("off", !camLive);
      refs.camBtn.disabled = !hasVideo;
    }
    if (refs.micBtn) {
      const label = micLive ? t.micToggleOff : t.micToggleOn;
      refs.micBtn.replaceChildren(icon(micLive ? "mic" : "micOff"));
      refs.micBtn.title = label;
      refs.micBtn.setAttribute("aria-label", label);
      refs.micBtn.classList.toggle("off", !micLive);
      refs.micBtn.disabled = !hasAudio;
    }
  }

  function toggleCam() {
    st.camOn = !st.camOn;
    if (media.stream) media.stream.getVideoTracks().forEach(function (tr) { tr.enabled = st.camOn; });
    syncControls();
  }

  function toggleMic() {
    st.micOn = !st.micOn;
    if (media.stream) media.stream.getAudioTracks().forEach(function (tr) { tr.enabled = st.micOn; });
    syncControls();
  }

  function renderWarn() {
    if (!refs.warn) return;
    refs.warn.textContent = "";
    if (!st.mediaError) {
      if (st.audioOnly && media.stream) refs.warn.appendChild(el("p", { class: "hint", text: t.audioOnlyNote }));
      return;
    }
    refs.warn.appendChild(el("div", { class: "notice" }, [icon("alert"), el("span", { text: st.mediaError })]));
    refs.warn.appendChild(el("div", { class: "row" }, [
      el("button", { type: "button", class: "mini-btn", text: t.retry, on: { click: function () { startMedia(st.audioOnly); } } }),
      el("button", { type: "button", class: "mini-btn", text: t.audioOnly, on: { click: function () { startMedia(true); } } })
    ]));
  }

  function buildPrepare() {
    const video = el("video", { autoplay: true, muted: true, playsinline: true });
    const preview = el("div", { class: "preview", role: "img", "aria-label": t.preview }, [
      video,
      el("div", { class: "off" }, [icon("videoOff"), el("span", { text: t.camOff })])
    ]);
    refs.video = video;
    refs.preview = preview;
    refs.camBtn = el("button", { type: "button", class: "ibtn", on: { click: toggleCam } });
    refs.micBtn = el("button", { type: "button", class: "ibtn", on: { click: toggleMic } });
    refs.meter = el("i");
    refs.warn = el("div", { class: "warn-slot", "aria-live": "polite" });
    const nameField = makeField({ key: "name", label: t.nameLabel, auto: "name", ph: t.namePh, value: st.name, onType: setName, required: true });
    return el("form", { class: "step", novalidate: true, on: { submit: function (e) { e.preventDefault(); if (validateAll([nameField])) go("waiting"); } } }, [
      nameField.wrap,
      preview,
      el("div", { class: "controls" }, [
        refs.camBtn,
        refs.micBtn,
        el("div", { class: "meter", role: "img", "aria-label": t.level }, [refs.meter])
      ]),
      refs.warn,
      el("p", { class: "privacy" }, [icon("shield"), el("span", { text: t.privacy })]),
      formSlot(),
      submitButton(t.request)
    ]);
  }

  function buildWaiting() {
    refs.elapsed = el("span", { class: "tm", text: fmt(st.elapsed) });
    return el("div", { class: "step wait" }, [
      el("div", { class: "avatar" }, [icon("user")]),
      el("p", { class: "wait-title", text: t.waitTitle }),
      el("p", { class: "elapsed-line" }, [icon("clock"), el("span", { text: t.elapsed + ": " }), refs.elapsed]),
      el("button", { type: "button", class: "btn ghost end", text: t.cancel, on: { click: cancelWaiting } })
    ]);
  }

  function setName(v) { st.name = v; }

  function makeField(o) {
    const input = el(o.multi ? "textarea" : "input", {
      type: o.multi ? null : (o.type || "text"),
      name: o.key,
      autocomplete: o.auto || null,
      placeholder: o.ph || null,
      value: o.multi ? null : (o.value || null),
      rows: o.multi ? 3 : null,
      "aria-invalid": "false"
    });
    if (o.multi) input.textContent = "";
    const err = el("div", { class: "ferr", "aria-live": "polite" });
    const f = { input: input, err: err, required: !!o.required, check: o.check || null, msg: o.msg || "" };
    f.wrap = el("div", { class: "field" }, [
      el("label", { class: "flabel" }, [el("span", { text: o.label || "" }), input]),
      err
    ]);
    input.addEventListener("input", function () {
      if (o.mask) input.value = o.mask(input.value);
      if (o.onType) o.onType(input.value);
      if (err.textContent) validateOne(f);
    });
    return f;
  }

  function validateOne(f) {
    const v = f.input.value.trim();
    let msg = "";
    if (f.required && !v) msg = t.required;
    else if (v && f.check && !f.check(v)) msg = f.msg;
    f.err.textContent = msg;
    f.input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }

  function validateAll(fields) {
    let ok = true;
    let first = null;
    fields.forEach(function (f) {
      if (!validateOne(f)) {
        ok = false;
        if (!first) first = f;
      }
    });
    if (first) first.input.focus();
    return ok;
  }

  function buildOffline() {
    const fields = [
      makeField({ key: "name", label: t.name, auto: "name", required: true, value: st.name, onType: setName }),
      makeField({ key: "phone", label: t.phone, type: "tel", auto: "tel", ph: t.phoneHint, required: true, mask: maskPhone, check: isPhone, msg: t.badPhone }),
      makeField({ key: "email", label: t.email, type: "email", auto: "email", check: isEmail, msg: t.badEmail }),
      makeField({ key: "note", label: t.note, multi: true, ph: t.notePh })
    ];
    refs.fields = fields;
    return el("form", {
      class: "step",
      novalidate: true,
      on: {
        submit: function (e) {
          e.preventDefault();
          if (validateAll(fields)) submitCallback(fields);
        }
      }
    }, fields.map(function (f) { return f.wrap; }).concat([
      formSlot(),
      submitButton(t.sendRequest)
    ]));
  }

  function buildPhone() {
    const fields = [
      makeField({ key: "name", label: t.name, auto: "name", value: st.name, onType: setName }),
      makeField({ key: "phone", label: t.phone, type: "tel", auto: "tel", ph: t.phoneHint, required: true, mask: maskPhone, check: isPhone, msg: t.badPhone })
    ];
    refs.fields = fields;
    const intro = el("p", { class: "lead", text: st.variant === "reject" ? t.rejectText : t.timeoutText });
    return el("form", {
      class: "step",
      novalidate: true,
      on: {
        submit: function (e) {
          e.preventDefault();
          if (validateAll(fields)) submitPhone(fields);
        }
      }
    }, [intro, fields[0].wrap, fields[1].wrap, formSlot(), submitButton(t.send)]);
  }

  function buildThanks() {
    return el("div", { class: "step done" }, [
      el("div", { class: "ok" }, [icon("check")]),
      el("p", { class: "lead", text: t.thanksText }),
      el("button", { type: "button", class: "btn primary end", text: t.close, on: { click: closeModal } })
    ]);
  }

  const BUILD = { prepare: buildPrepare, waiting: buildWaiting, offline: buildOffline, phone: buildPhone, thanks: buildThanks };

  function stepTitle() {
    switch (st.step) {
      case "prepare": return t.prepTitle;
      case "waiting": return t.waitHead;
      case "offline": return t.offTitle;
      case "phone": return st.variant === "reject" ? t.rejectTitle : t.timeoutTitle;
      case "thanks": return t.thanksTitle;
      default: return "";
    }
  }

  function focusFirst() {
    const target = dialog.querySelector("input, textarea") || dialog.querySelector(".btn");
    if (target) target.focus({ preventScroll: true });
  }

  function renderStep() {
    refs = { fields: [] };
    dialogTitle.textContent = stepTitle();
    dialogBody.textContent = "";
    dialogBody.appendChild(BUILD[st.step]());
    if (st.error) {
      setFormError(st.error);
      st.error = "";
    }
    if (st.step === "prepare") {
      syncControls();
      renderWarn();
    }
    focusFirst();
  }

  function startCall(url) {
    stopMedia();
    st.step = "call";
    layer.hidden = true;
    callEl.hidden = false;
    callEl.classList.remove("mini");
    frame.src = url;
    syncCallToggle();
    syncFab();
  }

  function endCall() {
    frame.src = "about:blank";
    callEl.hidden = true;
    callEl.classList.remove("mini");
    callEl.style.left = "";
    callEl.style.top = "";
    callEl.style.right = "";
    callEl.style.bottom = "";
    st = fresh();
    syncFab();
  }

  var closeTimer = 0;
  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN || !event.data || typeof event.data.type !== "string") return;
    if (event.data.type === "erenler-live:close") {
      window.clearTimeout(closeTimer);
      endCall();
    } else if (event.data.type === "erenler-live:ended") {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(endCall, 5000);
    }
  });

  function toggleMini() {
    const mini = !callEl.classList.contains("mini");
    callEl.classList.toggle("mini", mini);
    if (!mini) {
      callEl.style.left = "";
      callEl.style.top = "";
      callEl.style.right = "";
      callEl.style.bottom = "";
    }
    syncCallToggle();
  }

  function syncCallToggle() {
    const mini = callEl.classList.contains("mini");
    const label = mini ? t.maximize : t.minimize;
    callToggle.replaceChildren(icon(mini ? "maximize" : "minimize"));
    callToggle.title = label;
    callToggle.setAttribute("aria-label", label);
  }

  function formSlot() {
    refs.formErr = el("div", { class: "warn-slot", "aria-live": "polite" });
    return refs.formErr;
  }

  function setFormError(msg) {
    if (!refs.formErr) return;
    refs.formErr.textContent = "";
    if (msg) refs.formErr.appendChild(el("div", { class: "notice" }, [icon("alert"), el("span", { text: msg })]));
  }

  function submitButton(text) {
    refs.submit = el("button", { type: "submit", class: "btn primary end", text: text });
    return refs.submit;
  }

  function setBusy(on) {
    if (refs.submit) refs.submit.disabled = on;
  }

  function abortLive() {
    if (net.ctl) net.ctl.abort();
    net.ctl = null;
  }

  function errText(status, code) {
    if (status === 429 || code === "rateLimited") return t.rateErr;
    if (status === 0) return t.netErr;
    if (code === "unavailable") return t.unavailableErr;
    if (code === "nameRequired" || code === "phoneRequired") return t.required;
    if (status === 401 || status === 404) return t.goneErr;
    return t.failErr;
  }

  function postJson(path, body, signal, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["X-Live-Token"] = token;
    return fetch(ORIGIN + "/admin/api/live/public" + path, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: signal
    });
  }

  function failOf(res) {
    return res.json().catch(function () { return {}; }).then(function (j) {
      return { status: res.status, code: (j && j.error) || "" };
    });
  }

  function send(path, body, token, onOk) {
    const ctl = new AbortController();
    const step = st.step;
    net.ctl = ctl;
    setBusy(true);
    const fail = function (status, code) {
      if (ctl.signal.aborted || st.step !== step) return;
      net.ctl = null;
      setBusy(false);
      setFormError(errText(status, code));
    };
    postJson(path, body, ctl.signal, token).then(function (res) {
      if (ctl.signal.aborted) return;
      if (res.ok) {
        net.ctl = null;
        onOk();
        return;
      }
      return failOf(res).then(function (f) { fail(f.status, f.code); });
    }).catch(function () { fail(0, ""); });
  }

  function submitCallback(fields) {
    if (DEMO) {
      go("thanks", { variant: "request" });
      return;
    }
    send("/requests", {
      mode: "callback",
      name: fields[0].input.value.trim(),
      phone: fields[1].input.value.trim(),
      email: fields[2].input.value.trim(),
      note: fields[3].input.value.trim(),
      page: location.pathname
    }, "", function () { go("thanks", { variant: "request" }); });
  }

  function submitPhone(fields) {
    if (DEMO || !st.id) {
      go("thanks", { variant: "callback" });
      return;
    }
    const id = st.id;
    const token = st.token;
    send("/requests/" + id + "/phone", {
      phone: fields[1].input.value.trim(),
      name: fields[0].input.value.trim()
    }, token, function () {
      st.id = null;
      st.token = "";
      go("thanks", { variant: "callback" });
    });
  }

  function dropWaiting() {
    const id = st.id;
    const token = st.token;
    abortLive();
    st.id = null;
    st.token = "";
    if (id) {
      fetch(ORIGIN + "/admin/api/live/public/requests/" + id, {
        method: "DELETE",
        headers: { "X-Live-Token": token },
        keepalive: true
      }).catch(function () {});
    }
  }

  function cancelWaiting() {
    dropWaiting();
    go("prepare");
  }

  function parseEvent(block) {
    let name = "";
    let data = "";
    block.split("\n").forEach(function (line) {
      if (line.indexOf("event:") === 0) name = line.slice(6).trim();
      else if (line.indexOf("data:") === 0) data += line.slice(5).trim();
    });
    if (!name) return null;
    let parsed = {};
    try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = {}; }
    return { name: name, data: parsed };
  }

  function onLiveEvent(name, data, ctl, token) {
    if (ctl.signal.aborted || st.step !== "waiting") return;
    if (name === "accepted" && data.code) {
      abortLive();
      clearTimers();
      startCall(ORIGIN + "/admin/live/j/" + encodeURIComponent(data.code) + "#t=" + encodeURIComponent(token));
    } else if (name === "rejected" || name === "missed") {
      abortLive();
      go("phone", { variant: name === "rejected" ? "reject" : "timeout" });
    }
  }

  function pump(reader, ctl, token) {
    const dec = new TextDecoder();
    let buf = "";
    const step = function () {
      return reader.read().then(function (r) {
        if (ctl.signal.aborted) return "stop";
        if (r.done) return "end";
        buf += dec.decode(r.value, { stream: true });
        let idx = buf.indexOf("\n\n");
        while (idx >= 0) {
          const ev = parseEvent(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
          if (ev) onLiveEvent(ev.name, ev.data, ctl, token);
          if (ctl.signal.aborted) return "stop";
          idx = buf.indexOf("\n\n");
        }
        return step();
      });
    };
    return step();
  }

  function reconnect(ctl) {
    later(function () {
      if (!ctl.signal.aborted && st.step === "waiting") listen(ctl);
    }, RETRY_MS);
  }

  function listen(ctl) {
    const token = st.token;
    const url = ORIGIN + "/admin/api/live/public/requests/" + st.id + "/events";
    fetch(url, {
      headers: { "X-Live-Token": token, Accept: "text/event-stream" },
      cache: "no-store",
      signal: ctl.signal
    }).then(function (res) {
      if (res.status === 401 || res.status === 404) return "gone";
      if (!res.ok || !res.body) return "retry";
      return pump(res.body.getReader(), ctl, token);
    }).then(function (out) {
      if (ctl.signal.aborted || st.step !== "waiting") return;
      if (out === "gone") {
        abortLive();
        go("phone", { variant: "timeout" });
        return;
      }
      reconnect(ctl);
    }).catch(function () {
      if (!ctl.signal.aborted) reconnect(ctl);
    });
  }

  function requestFailed(f) {
    if (st.step !== "waiting") return;
    net.ctl = null;
    st.error = errText(f.status, f.code);
    if (f.status === 409) {
      live.available = false;
      renderBanner();
      go("offline");
      return;
    }
    go("prepare");
  }

  function startRequest() {
    const ctl = new AbortController();
    net.ctl = ctl;
    postJson("/requests", { mode: "call", name: st.name.trim(), page: location.pathname }, ctl.signal, "").then(function (res) {
      if (ctl.signal.aborted) return;
      if (res.status !== 201) return failOf(res).then(requestFailed);
      return res.json().then(function (j) {
        if (ctl.signal.aborted || st.step !== "waiting") return;
        st.id = j.id;
        st.token = j.token;
        listen(ctl);
      });
    }).catch(function () {
      if (!ctl.signal.aborted) requestFailed({ status: 0, code: "" });
    });
  }

  function refreshStatus() {
    if (DEMO) return;
    fetch(ORIGIN + "/admin/api/live/public/status", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (j) {
        if (!j) return;
        const next = j.available === true;
        if (!live.known || next !== live.available) {
          live.known = true;
          live.available = next;
          renderBanner();
        }
      })
      .catch(function () {});
  }

  function go(step, data) {
    clearTimers();
    if (step !== "prepare") stopMedia();
    if (step !== "waiting" && step !== "phone" && step !== "call") abortLive();
    st.step = step;
    st.variant = (data && data.variant) || "";
    if (step === "call") {
      startCall(ORIGIN + CALL_PATH);
      return;
    }
    if (step === "prepare") startMedia(st.audioOnly);
    if (step === "waiting") {
      st.elapsed = 0;
      every(function () {
        st.elapsed += 1;
        if (refs.elapsed) refs.elapsed.textContent = fmt(st.elapsed);
      }, 1000);
      if (DEMO) {
        const c = config();
        st.answer = c.answer;
        if (c.answer === "accept") later(function () { go("call"); }, ACCEPT_DELAY);
        else if (c.answer === "reject") later(function () { go("phone", { variant: "reject" }); }, ACCEPT_DELAY);
        else later(function () { go("phone", { variant: "timeout" }); }, c.waitSeconds * 1000);
      } else {
        later(function () {
          abortLive();
          go("phone", { variant: "timeout" });
        }, WAIT_MS);
        startRequest();
      }
    }
    renderStep();
  }

  function openModal(step, opener) {
    const keep = st.name;
    clearTimers();
    stopMedia();
    st = fresh();
    st.name = keep;
    st.opener = opener;
    layer.hidden = false;
    syncFab();
    go(step);
  }

  function closeModal() {
    if (st.step === "waiting") dropWaiting();
    else abortLive();
    clearTimers();
    stopMedia();
    const back = st.opener;
    st.step = "closed";
    layer.hidden = true;
    syncFab();
    if (back && back.isConnected) back.focus();
  }

  function onLayerKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.prototype.slice.call(dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled])"));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = root.activeElement;
    const outside = items.indexOf(active) < 0;
    if (e.shiftKey && (active === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  }

  function syncPadding() {
    if (!banner) return;
    var style = document.getElementById("erenler-live-offset");
    if (!style) {
      style = document.createElement("style");
      style.id = "erenler-live-offset";
      document.head.appendChild(style);
    }
    style.textContent = bannerOn ? "body{padding-top:" + (basePad + banner.offsetHeight) + "px !important}" : "";
  }

  function syncFab() {
    if (fab) fab.hidden = bannerOn || st.step === "call";
  }

  function hideBanner() {
    bannerOn = false;
    banner.hidden = true;
    syncPadding();
    syncFab();
  }

  function showBanner() {
    bannerOn = true;
    renderBanner();
    syncFab();
  }

  function renderBanner() {
    const c = config();
    const cta = el("button", {
      type: "button",
      class: "cta",
      text: c.available ? t.startNow : t.requestCall,
      on: { click: function () { openModal(c.available ? "prepare" : "offline", cta); } }
    });
    banner.textContent = "";
    banner.hidden = !bannerOn;
    banner.append(
      el("span", { class: "dot " + (c.available ? "on" : "off"), role: "img", "aria-label": c.available ? t.stateOn : t.stateOff }),
      el("div", { class: "btext" }, [
        el("div", { class: "btitle", text: t.bannerTitle }),
        el("div", { class: "bsub", text: c.available ? t.subOn : t.subOff })
      ]),
      cta,
      el("button", { type: "button", class: "icon-btn", title: t.dismiss, "aria-label": t.dismiss, on: { click: hideBanner } }, [icon("x")])
    );
    syncPadding();
  }

  function buildShell() {
    banner = el("div", { class: "banner", role: "region", "aria-label": t.bannerTitle });
    fab = el("button", { type: "button", class: "fab", title: t.openLive, "aria-label": t.openLive, hidden: true, on: { click: showBanner } }, [icon("video")]);

    dialogTitle = el("h2", { id: "ttl", class: "dtitle" });
    dialogBody = el("div", { class: "dbody" });
    dialog = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "ttl" }, [
      el("div", { class: "dhead" }, [
        el("span", { class: "badge" }, [icon("video")]),
        dialogTitle,
        el("button", { type: "button", class: "icon-btn", title: t.close, "aria-label": t.close, on: { click: closeModal } }, [icon("x")])
      ]),
      dialogBody
    ]);
    layer = el("div", { class: "layer", hidden: true }, [el("div", { class: "backdrop" }), dialog]);
    layer.addEventListener("keydown", onLayerKey);

    callToggle = el("button", { type: "button", class: "icon-btn", on: { click: toggleMini } });
    callBar = el("div", { class: "bar" }, [
      el("span", { class: "live-dot", "aria-hidden": "true" }),
      el("span", { class: "ttl", text: t.callTitle }),
      callToggle,
      el("button", { type: "button", class: "icon-btn", title: t.endCall, "aria-label": t.endCall, on: { click: endCall } }, [icon("x")])
    ]);
    frame = el("iframe", { title: t.callTitle, allow: "camera; microphone; display-capture; autoplay; fullscreen" });
    callEl = el("div", { class: "call", hidden: true }, [callBar, frame]);

    callBar.addEventListener("pointerdown", function (e) {
      if (!callEl.classList.contains("mini") || e.target.closest("button")) return;
      const r = callEl.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
      callBar.setPointerCapture(e.pointerId);
    });
    callBar.addEventListener("pointermove", function (e) {
      if (!drag) return;
      const x = Math.max(0, Math.min(window.innerWidth - callEl.offsetWidth, e.clientX - drag.dx));
      const y = Math.max(0, Math.min(window.innerHeight - callEl.offsetHeight, e.clientY - drag.dy));
      callEl.style.left = x + "px";
      callEl.style.top = y + "px";
      callEl.style.right = "auto";
      callEl.style.bottom = "auto";
    });
    const stopDrag = function () { drag = null; };
    callBar.addEventListener("pointerup", stopDrag);
    callBar.addEventListener("pointercancel", stopDrag);

    wrap = el("div", { class: "w" });
    wrap.append(el("style", { text: CSS }), banner, fab, layer, callEl);
    root.appendChild(wrap);
  }

  function alignToSite(host) {
    if (SCRIPT && SCRIPT.dataset.container) return;
    var width = document.documentElement.clientWidth;
    var scope = document.querySelector("header") || document.body;
    var nodes = scope.querySelectorAll("div,nav,section,header");
    var found = null;
    for (var index = 0; index < nodes.length && index < 400; index += 1) {
      var node = nodes[index];
      if (host.contains(node)) continue;
      var rect = node.getBoundingClientRect();
      if (rect.width < width * 0.5 || rect.width > width - 4 || rect.height === 0) continue;
      if (Math.abs(rect.left - (width - rect.right)) > 3) continue;
      found = node;
      break;
    }
    if (!found) {
      host.style.removeProperty("--ew-side");
      host.style.removeProperty("--ew-side-r");
      return;
    }
    var box = found.getBoundingClientRect();
    var style = window.getComputedStyle(found);
    var left = Math.round(box.left + (parseFloat(style.paddingLeft) || 0));
    var right = Math.round(width - box.right + (parseFloat(style.paddingRight) || 0));
    host.style.setProperty("--ew-side", left + "px");
    host.style.setProperty("--ew-side-r", right + "px");
  }

  function init() {
    const host = document.createElement("div");
    host.id = "erenler-live";
    if (SCRIPT && SCRIPT.dataset.container) host.style.setProperty("--ew-max", SCRIPT.dataset.container);
    if (SCRIPT && SCRIPT.dataset.gutter) host.style.setProperty("--ew-pad", SCRIPT.dataset.gutter);
    document.body.appendChild(host);
    root = host.attachShadow({ mode: "open" });
    basePad = parseFloat(window.getComputedStyle(document.body).paddingTop) || 0;
    buildShell();
    renderBanner();
    syncFab();
    if (!DEMO) {
      refreshStatus();
      setInterval(function () { if (document.visibilityState === "visible") refreshStatus(); }, POLL_MS);
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshStatus(); });
    }
    if (window.ResizeObserver) new ResizeObserver(syncPadding).observe(banner);
    window.addEventListener("resize", syncPadding);
    var realign = function () { if (window.innerWidth > 640) alignToSite(host); };
    realign();
    window.setTimeout(realign, 800);
    window.addEventListener("resize", realign);
    window.ErenlerLiveWidget = {
      refresh: function () {
        renderBanner();
        syncFab();
      }
    };
  }

  function start() {
    window.setTimeout(init, 0);
  }

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
