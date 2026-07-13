export interface SceneDefinition {
  id: string;
  startProgress: number;
  endProgress: number;
  startFrame: number;
  endFrame: number;
}

export class SceneManager {
  private readonly scenes: SceneDefinition[];

  constructor(scenes: SceneDefinition[]) {
    this.scenes = scenes;
  }

  getScene(progress: number): SceneDefinition {
    const scene = this.scenes.find(
      (scene) =>
        progress >= scene.startProgress &&
        progress <= scene.endProgress,
    );

    if (!scene) {
      return this.scenes[this.scenes.length - 1];
    }

    return scene;
  }

  getFrame(progress: number): number {
    const scene = this.getScene(progress);

    const localProgress =
      (progress - scene.startProgress) /
      (scene.endProgress - scene.startProgress);

    const frame =
      scene.startFrame +
      localProgress * (scene.endFrame - scene.startFrame);

    return Math.round(frame);
  }
}