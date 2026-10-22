import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { BASE_PATH } from "@/lib/admin-client";

export type BackgroundMode = { kind: "none" } | { kind: "blur"; strength: number } | { kind: "color"; color: string } | { kind: "image"; src: string };

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL = `${BASE_PATH}/live/mediapipe/selfie_segmenter.tflite`;

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function loadSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = { runningMode: "VIDEO" as const, outputCategoryMask: false, outputConfidenceMasks: true };
      try {
        return await ImageSegmenter.createFromOptions(fileset, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" } });
      } catch {
        return ImageSegmenter.createFromOptions(fileset, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" } });
      }
    })();
    segmenterPromise.catch(() => {
      segmenterPromise = null;
    });
  }
  return segmenterPromise;
}

export class BackgroundEffect {
  private video = document.createElement("video");
  private canvas = document.createElement("canvas");
  private mask = document.createElement("canvas");
  private image: HTMLImageElement | null = null;
  private mode: BackgroundMode = { kind: "none" };
  private segmenter: ImageSegmenter | null = null;
  private output: MediaStream | null = null;
  private running = false;
  private lastTime = -1;

  constructor() {
    this.video.muted = true;
    this.video.playsInline = true;
  }

  async start(source: MediaStream, mode: BackgroundMode): Promise<MediaStream> {
    this.segmenter = await loadSegmenter();
    this.setMode(mode);
    await this.setSource(source);
    if (!this.output) this.output = this.canvas.captureStream(30);
    if (!this.running) {
      this.running = true;
      this.loop();
    }
    return this.output;
  }

  async setSource(source: MediaStream) {
    const track = source.getVideoTracks()[0];
    this.video.srcObject = track ? new MediaStream([track]) : null;
    await this.video.play().catch(() => undefined);
  }

  setMode(mode: BackgroundMode) {
    this.mode = mode;
    if (mode.kind === "image") {
      const image = new Image();
      image.src = mode.src;
      this.image = image;
    } else {
      this.image = null;
    }
  }

  stop() {
    this.running = false;
    this.output?.getTracks().forEach((track) => track.stop());
    this.output = null;
    this.video.srcObject = null;
  }

  private loop = () => {
    if (!this.running) return;
    this.render();
    window.requestAnimationFrame(this.loop);
  };

  private render() {
    const video = this.video;
    const segmenter = this.segmenter;
    if (!segmenter || video.readyState < 2 || video.videoWidth === 0) return;
    if (video.currentTime === this.lastTime) return;
    this.lastTime = video.currentTime;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const result = segmenter.segmentForVideo(video, performance.now());
    const confidence = result.confidenceMasks?.[0];
    if (!confidence) {
      ctx.drawImage(video, 0, 0, width, height);
      result.close();
      return;
    }
    const values = confidence.getAsFloat32Array();
    const maskWidth = confidence.width;
    const maskHeight = confidence.height;
    if (this.mask.width !== maskWidth || this.mask.height !== maskHeight) {
      this.mask.width = maskWidth;
      this.mask.height = maskHeight;
    }
    const maskCtx = this.mask.getContext("2d");
    if (!maskCtx) {
      result.close();
      return;
    }
    const pixels = maskCtx.createImageData(maskWidth, maskHeight);
    for (let index = 0; index < values.length; index += 1) {
      pixels.data[index * 4 + 3] = Math.round(values[index] * 255);
    }
    maskCtx.putImageData(pixels, 0, 0);
    result.close();

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.filter = "blur(2px)";
    ctx.drawImage(this.mask, 0, 0, width, height);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "destination-over";
    this.drawBackground(ctx, width, height);
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const mode = this.mode;
    if (mode.kind === "blur") {
      ctx.filter = `blur(${mode.strength}px)`;
      ctx.drawImage(this.video, -mode.strength * 2, -mode.strength * 2, width + mode.strength * 4, height + mode.strength * 4);
      ctx.filter = "none";
      return;
    }
    if (mode.kind === "image" && this.image?.complete && this.image.naturalWidth > 0) {
      const image = this.image;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      return;
    }
    ctx.fillStyle = mode.kind === "color" ? mode.color : "#1f2937";
    ctx.fillRect(0, 0, width, height);
    const shade = ctx.createRadialGradient(width / 2, height * 0.4, height * 0.2, width / 2, height / 2, Math.max(width, height) * 0.75);
    shade.addColorStop(0, "rgba(255, 255, 255, 0.10)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
  }
}
