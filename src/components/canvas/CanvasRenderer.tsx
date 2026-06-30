import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { CSSProperties } from "react";

export type CanvasRenderPayload = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  frame: number;
  elapsed: number;
  delta: number;
};

export type CanvasRenderCallback = (payload: CanvasRenderPayload) => void;

export type CanvasRendererHandle = {
  clear: () => void;
  render: (callback?: CanvasRenderCallback) => void;
  destroy: () => void;
  resize: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  getContext: () => CanvasRenderingContext2D | null;
};

export type CanvasRendererProps = {
  className?: string;
  style?: CSSProperties;
  renderFrame?: CanvasRenderCallback;
  autoStart?: boolean;
  ariaLabel?: string;
};

type RendererState = {
  context: CanvasRenderingContext2D | null;
  dpr: number;
  width: number;
  height: number;
  frame: number;
  startedAt: number;
  lastFrameAt: number;
  rafId: number | null;
  callback: CanvasRenderCallback | null;
  resizeObserver: ResizeObserver | null;
  destroyed: boolean;
};

const canvasStyles: CSSProperties = {
  display: "block",
  width: "100vw",
  height: "100vh",
  position: "fixed",
  inset: 0,
};

function getDevicePixelRatio() {
  return Math.max(1, window.devicePixelRatio || 1);
}

function getCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();

  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

function configureBackingStore(
  canvas: HTMLCanvasElement,
  state: RendererState,
) {
  const { width, height } = getCanvasSize(canvas);
  const dpr = getDevicePixelRatio();
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth;
  }

  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight;
  }

  state.width = width;
  state.height = height;
  state.dpr = dpr;
  state.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearCanvas(canvas: HTMLCanvasElement, state: RendererState) {
  const context = state.context;

  if (!context) {
    return;
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

export const CanvasRenderer = forwardRef<
  CanvasRendererHandle,
  CanvasRendererProps
>(function CanvasRenderer(
  {
    className,
    style,
    renderFrame = null,
    autoStart = false,
    ariaLabel = "Canvas rendering surface",
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<RendererState>({
    context: null,
    dpr: 1,
    width: 1,
    height: 1,
    frame: 0,
    startedAt: 0,
    lastFrameAt: 0,
    rafId: null,
    callback: renderFrame,
    resizeObserver: null,
    destroyed: false,
  });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || stateRef.current.destroyed) {
      return;
    }

    configureBackingStore(canvas, stateRef.current);
  }, []);

  const stopLoop = useCallback(() => {
    const state = stateRef.current;

    if (state.rafId !== null) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }, []);

  const tick = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;

    if (!canvas || !state.context || state.destroyed) {
      stopLoop();
      return;
    }

    if (state.startedAt === 0) {
      state.startedAt = timestamp;
      state.lastFrameAt = timestamp;
    }

    const payload: CanvasRenderPayload = {
      canvas,
      context: state.context,
      width: state.width,
      height: state.height,
      dpr: state.dpr,
      frame: state.frame,
      elapsed: timestamp - state.startedAt,
      delta: timestamp - state.lastFrameAt,
    };

    state.callback?.(payload);
    state.frame += 1;
    state.lastFrameAt = timestamp;
    state.rafId = window.requestAnimationFrame(tick);
  }, [stopLoop]);

  const render = useCallback((callback?: CanvasRenderCallback) => {
    const state = stateRef.current;

    if (state.destroyed) {
      return;
    }

    if (callback) {
      state.callback = callback;
    }

    stopLoop();
    resize();
    state.startedAt = 0;
    state.lastFrameAt = 0;
    state.rafId = window.requestAnimationFrame(tick);
  }, [resize, stopLoop, tick]);

  const destroy = useCallback(() => {
    const canvas = canvasRef.current;
    const state = stateRef.current;

    stopLoop();
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    state.callback = null;
    state.destroyed = true;

    if (canvas) {
      clearCanvas(canvas, state);
    }
  }, [stopLoop]);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        const canvas = canvasRef.current;

        if (canvas) {
          clearCanvas(canvas, stateRef.current);
        }
      },
      render,
      destroy,
      resize,
      getCanvas() {
        return canvasRef.current;
      },
      getContext() {
        return stateRef.current.context;
      },
    }),
    [destroy, render, resize],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const state = stateRef.current;

    if (!canvas) {
      return undefined;
    }

    state.destroyed = false;
    state.context = canvas.getContext("2d", { alpha: true });
    state.callback = renderFrame;
    resize();

    if ("ResizeObserver" in window) {
      state.resizeObserver = new ResizeObserver(resize);
      state.resizeObserver.observe(canvas);
    }

    window.addEventListener("resize", resize, { passive: true });

    if (autoStart) {
      render();
    }

    return () => {
      window.removeEventListener("resize", resize);
      destroy();
    };
  }, [autoStart, destroy, render, renderFrame, resize]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={ariaLabel}
      className={className}
      role="img"
      style={{ ...canvasStyles, ...style }}
    />
  );
});

CanvasRenderer.displayName = "CanvasRenderer";
