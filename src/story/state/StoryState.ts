export type StoryDirection = "up" | "down" | "none";

export interface StoryViewport {
  width: number;
  height: number;
}

export interface StoryStateSnapshot {
  progress: number;
  frame: number;
  scene: string;
  loading: number;
  playing: boolean;
  direction: StoryDirection;
  viewport: StoryViewport;
}

type Listener = (
  state: Readonly<StoryStateSnapshot>,
) => void;

export class StoryState {
  private state: StoryStateSnapshot = {
    progress: 0,
    frame: 1,
    scene: "intro",
    loading: 0,
    playing: false,
    direction: "none",
    viewport: {
      width:
        typeof window !== "undefined"
          ? window.innerWidth
          : 0,
      height:
        typeof window !== "undefined"
          ? window.innerHeight
          : 0,
    },
  };

  private readonly listeners =
    new Set<Listener>();

  get snapshot(): Readonly<StoryStateSnapshot> {
    return Object.freeze({
      ...this.state,
      viewport: {
        ...this.state.viewport,
      },
    });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  update(
    partial: Partial<StoryStateSnapshot>,
  ) {
    this.state = {
      ...this.state,
      ...partial,
    };

    this.emit();
  }

  setViewport(
    width: number,
    height: number,
  ) {
    this.state.viewport = {
      width,
      height,
    };

    this.emit();
  }

  destroy() {
    this.listeners.clear();
  }

  private emit() {
    const snapshot = this.snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}