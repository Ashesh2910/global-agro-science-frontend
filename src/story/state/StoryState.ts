export type StoryDirection = "up" | "down" | "none";

export type StoryStateSnapshot = {
  progress: number;
  currentFrame: number;
  currentScene: string | null;
  loadingProgress: number;
  isPlaying: boolean;
  direction: StoryDirection;
  viewportWidth: number;
  viewportHeight: number;
};

type Listener = (state: Readonly<StoryStateSnapshot>) => void;

export class StoryState {
  private state: StoryStateSnapshot = {
    progress: 0,
    currentFrame: 0,
    currentScene: null,
    loadingProgress: 0,
    isPlaying: false,
    direction: "none",
    viewportWidth:
      typeof window !== "undefined" ? window.innerWidth : 0,
    viewportHeight:
      typeof window !== "undefined" ? window.innerHeight : 0,
  };

  private readonly listeners = new Set<Listener>();

  get snapshot(): Readonly<StoryStateSnapshot> {
    return Object.freeze({ ...this.state });
  }

  update(partial: Partial<StoryStateSnapshot>) {
    this.state = {
      ...this.state,
      ...partial,
    };

    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
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