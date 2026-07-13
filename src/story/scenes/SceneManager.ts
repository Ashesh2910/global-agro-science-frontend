export type Scene = {
  id: string;
  name: string;

  start: number;
  end: number;

  startFrame: number;
  endFrame: number;
};

export class SceneManager {
  private readonly scenes: Scene[];

  constructor(scenes: Scene[]) {
    this.scenes = [...scenes].sort(
      (a, b) => a.start - b.start,
    );
  }

  public getScene(progress: number): Scene | undefined {
    return this.scenes.find(
      scene =>
        progress >= scene.start &&
        progress <= scene.end,
    );
  }

  public getFrame(progress: number): number {
    const scene = this.getScene(progress);

    if (!scene) {
      return 0;
    }

    const localProgress =
      (progress - scene.start) /
      (scene.end - scene.start);

    return Math.round(
      scene.startFrame +
        localProgress *
          (scene.endFrame - scene.startFrame),
    );
  }

  public getScenes() {
    return [...this.scenes];
  }
}