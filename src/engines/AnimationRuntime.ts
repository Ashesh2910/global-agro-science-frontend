export type AnimationRuntimeTaskContext = {
  delta: number;
  elapsed: number;
  fps: number;
  frame: number;
  timestamp: number;
};

export type AnimationRuntimeTask = (context: AnimationRuntimeTaskContext) => void;

export type AnimationRuntimeOptions = {
  autoPauseOnHidden?: boolean;
  autoResumeOnVisible?: boolean;
  fpsSampleSize?: number;
  maxDelta?: number;
};

type RegisteredTask = {
  id: string;
  task: AnimationRuntimeTask;
};

const DEFAULT_FPS_SAMPLE_SIZE = 30;
const DEFAULT_MAX_DELTA = 100;

function canUseDocument() {
  return typeof document !== "undefined";
}

function canUseAnimationFrame() {
  return typeof window !== "undefined" && "requestAnimationFrame" in window;
}

export class AnimationRuntime {
  private readonly tasks = new Map<string, RegisteredTask>();
  private readonly autoPauseOnHidden: boolean;
  private readonly autoResumeOnVisible: boolean;
  private readonly fpsSampleSize: number;
  private readonly maxDelta: number;
  private rafId: number | null = null;
  private running = false;
  private paused = false;
  private disposed = false;
  private hiddenPaused = false;
  private frame = 0;
  private startedAt = 0;
  private lastFrameAt = 0;
  private elapsedBeforePause = 0;
  private fps = 0;
  private readonly frameDurations: number[] = [];

  constructor(options: AnimationRuntimeOptions = {}) {
    this.autoPauseOnHidden = options.autoPauseOnHidden ?? true;
    this.autoResumeOnVisible = options.autoResumeOnVisible ?? true;
    this.fpsSampleSize = Math.max(1, Math.floor(options.fpsSampleSize ?? DEFAULT_FPS_SAMPLE_SIZE));
    this.maxDelta = Math.max(0, options.maxDelta ?? DEFAULT_MAX_DELTA);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    if (canUseDocument() && (this.autoPauseOnHidden || this.autoResumeOnVisible)) {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  start() {
    this.assertActive();

    if (this.running) {
      return;
    }

    this.running = true;
    this.paused = false;
    this.hiddenPaused = false;
    this.frame = 0;
    this.startedAt = 0;
    this.lastFrameAt = 0;
    this.elapsedBeforePause = 0;
    this.fps = 0;
    this.frameDurations.length = 0;
    this.scheduleNextFrame();
  }

  stop() {
    this.cancelFrame();
    this.running = false;
    this.paused = false;
    this.hiddenPaused = false;
    this.frame = 0;
    this.startedAt = 0;
    this.lastFrameAt = 0;
    this.elapsedBeforePause = 0;
    this.fps = 0;
    this.frameDurations.length = 0;
  }

  pause() {
    if (!this.running || this.paused) {
      return;
    }

    this.cancelFrame();
    this.paused = true;
    this.elapsedBeforePause = this.getElapsed();
    this.lastFrameAt = 0;
  }

  resume() {
    this.assertActive();

    if (!this.running || !this.paused) {
      return;
    }

    this.paused = false;
    this.startedAt = 0;
    this.lastFrameAt = 0;
    this.scheduleNextFrame();
  }

  registerTask(id: string, task: AnimationRuntimeTask) {
    this.assertActive();

    if (!id.trim()) {
      throw new Error("AnimationRuntime task id cannot be empty.");
    }

    if (this.tasks.has(id)) {
      throw new Error(`AnimationRuntime task already registered: ${id}`);
    }

    this.tasks.set(id, { id, task });

    return () => this.unregisterTask(id);
  }

  unregisterTask(id: string) {
    this.tasks.delete(id);
  }

  getDelta() {
    return this.lastFrameAt === 0 ? 0 : Math.min(performance.now() - this.lastFrameAt, this.maxDelta);
  }

  getElapsed() {
    if (!this.running || this.startedAt === 0) {
      return this.elapsedBeforePause;
    }

    return this.elapsedBeforePause + performance.now() - this.startedAt;
  }

  getFps() {
    return this.fps;
  }

  isRunning() {
    return this.running;
  }

  isPaused() {
    return this.paused;
  }

  destroy() {
    this.stop();
    this.tasks.clear();
    this.disposed = true;

    if (canUseDocument()) {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private tick(timestamp: number) {
    if (!this.running || this.paused || this.disposed) {
      return;
    }

    if (this.startedAt === 0) {
      this.startedAt = timestamp;
      this.lastFrameAt = timestamp;
    }

    const rawDelta = timestamp - this.lastFrameAt;
    const delta = Math.min(Math.max(0, rawDelta), this.maxDelta);
    const elapsed = this.elapsedBeforePause + timestamp - this.startedAt;

    this.updateFps(delta);

    const context: AnimationRuntimeTaskContext = {
      delta,
      elapsed,
      fps: this.fps,
      frame: this.frame,
      timestamp,
    };

    for (const { task } of this.tasks.values()) {
      task(context);
    }

    this.frame += 1;
    this.lastFrameAt = timestamp;
    this.scheduleNextFrame();
  }

  private scheduleNextFrame() {
    if (!canUseAnimationFrame()) {
      return;
    }

    this.cancelFrame();
    this.rafId = window.requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  private cancelFrame() {
    if (this.rafId !== null && canUseAnimationFrame()) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updateFps(delta: number) {
    if (delta <= 0) {
      return;
    }

    this.frameDurations.push(delta);

    if (this.frameDurations.length > this.fpsSampleSize) {
      this.frameDurations.shift();
    }

    const total = this.frameDurations.reduce((sum, duration) => sum + duration, 0);
    this.fps = total > 0 ? 1000 / (total / this.frameDurations.length) : 0;
  }

  private handleVisibilityChange() {
    if (!canUseDocument()) {
      return;
    }

    if (document.hidden && this.autoPauseOnHidden && this.running && !this.paused) {
      this.hiddenPaused = true;
      this.pause();
      return;
    }

    if (!document.hidden && this.autoResumeOnVisible && this.hiddenPaused) {
      this.hiddenPaused = false;
      this.resume();
    }
  }

  private assertActive() {
    if (this.disposed) {
      throw new Error("AnimationRuntime has been destroyed.");
    }
  }
}
