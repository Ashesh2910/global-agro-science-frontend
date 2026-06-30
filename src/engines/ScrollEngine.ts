export type ScrollDirection = "up" | "down" | "none";

export type ScrollEngineState = {
  progress: number;
  scrollY: number;
  velocity: number;
  direction: ScrollDirection;
  maxScrollY: number;
  viewportHeight: number;
  documentHeight: number;
  isScrolling: boolean;
};

export type ScrollEngineEvent = "scroll" | "scrollStart" | "scrollEnd" | "resize";

export type ScrollEngineSubscriber = (
  state: ScrollEngineState,
  event: ScrollEngineEvent,
) => void;

export type ScrollEngineOptions = {
  scrollEndDelayMs?: number;
  target?: Window;
};

const DEFAULT_SCROLL_END_DELAY_MS = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function canUseWindow() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getDocumentHeight() {
  const { body, documentElement } = document;

  return Math.max(
    body.scrollHeight,
    body.offsetHeight,
    documentElement.clientHeight,
    documentElement.scrollHeight,
    documentElement.offsetHeight,
  );
}

export class ScrollEngine {
  private readonly subscribers = new Set<ScrollEngineSubscriber>();
  private readonly scrollEndDelayMs: number;
  private readonly target: Window | null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollEndTimeoutId: number | null = null;
  private lastScrollY = 0;
  private lastTimestamp = 0;
  private destroyed = false;
  private state: ScrollEngineState = {
    progress: 0,
    scrollY: 0,
    velocity: 0,
    direction: "none",
    maxScrollY: 0,
    viewportHeight: 0,
    documentHeight: 0,
    isScrolling: false,
  };

  constructor(options: ScrollEngineOptions = {}) {
    this.scrollEndDelayMs = Math.max(0, options.scrollEndDelayMs ?? DEFAULT_SCROLL_END_DELAY_MS);
    this.target = options.target ?? (canUseWindow() ? window : null);

    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);

    if (!this.target || !canUseWindow()) {
      return;
    }

    this.measure();
    this.lastScrollY = this.state.scrollY;
    this.lastTimestamp = performance.now();

    this.target.addEventListener("scroll", this.handleScroll, { passive: true });
    this.target.addEventListener("resize", this.handleResize, { passive: true });

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(document.documentElement);

      if (document.body) {
        this.resizeObserver.observe(document.body);
      }
    }
  }

  getProgress() {
    return this.state.progress;
  }

  getScrollY() {
    return this.state.scrollY;
  }

  getVelocity() {
    return this.state.velocity;
  }

  getDirection() {
    return this.state.direction;
  }

  subscribe(subscriber: ScrollEngineSubscriber) {
    this.assertActive();
    this.subscribers.add(subscriber);

    return () => this.unsubscribe(subscriber);
  }

  unsubscribe(subscriber: ScrollEngineSubscriber) {
    this.subscribers.delete(subscriber);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.clearScrollEndTimeout();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.subscribers.clear();

    if (this.target) {
      this.target.removeEventListener("scroll", this.handleScroll);
      this.target.removeEventListener("resize", this.handleResize);
    }

    this.destroyed = true;
  }

  private handleScroll() {
    if (this.destroyed) {
      return;
    }

    const wasScrolling = this.state.isScrolling;
    this.measure();
    this.state.isScrolling = true;

    if (!wasScrolling) {
      this.emit("scrollStart");
    }

    this.emit("scroll");
    this.scheduleScrollEnd();
  }

  private handleResize() {
    if (this.destroyed) {
      return;
    }

    this.measure();
    this.emit("resize");
  }

  private measure() {
    if (!this.target || !canUseWindow()) {
      return;
    }

    const timestamp = performance.now();
    const scrollY = Math.max(0, this.target.scrollY || window.scrollY || 0);
    const viewportHeight = Math.max(1, this.target.innerHeight || window.innerHeight || 1);
    const documentHeight = Math.max(viewportHeight, getDocumentHeight());
    const maxScrollY = Math.max(0, documentHeight - viewportHeight);
    const progress = maxScrollY === 0 ? 1 : clamp(scrollY / maxScrollY, 0, 1);
    const deltaY = scrollY - this.lastScrollY;
    const deltaTime = Math.max(1, timestamp - this.lastTimestamp);
    const velocity = deltaY / deltaTime;
    const direction =
      deltaY > 0 ? "down" : deltaY < 0 ? "up" : this.state.direction;

    this.state = {
      ...this.state,
      progress,
      scrollY,
      velocity,
      direction,
      maxScrollY,
      viewportHeight,
      documentHeight,
    };

    this.lastScrollY = scrollY;
    this.lastTimestamp = timestamp;
  }

  private scheduleScrollEnd() {
    this.clearScrollEndTimeout();
    this.scrollEndTimeoutId = window.setTimeout(() => {
      this.state = {
        ...this.state,
        velocity: 0,
        direction: "none",
        isScrolling: false,
      };
      this.emit("scrollEnd");
      this.scrollEndTimeoutId = null;
    }, this.scrollEndDelayMs);
  }

  private clearScrollEndTimeout() {
    if (this.scrollEndTimeoutId !== null && canUseWindow()) {
      window.clearTimeout(this.scrollEndTimeoutId);
      this.scrollEndTimeoutId = null;
    }
  }

  private emit(event: ScrollEngineEvent) {
    for (const subscriber of this.subscribers) {
      subscriber({ ...this.state }, event);
    }
  }

  private assertActive() {
    if (this.destroyed) {
      throw new Error("ScrollEngine has been destroyed.");
    }
  }
}
