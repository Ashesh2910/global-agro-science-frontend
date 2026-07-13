export type AssetType = "image";

export interface AssetDefinition {
  id: string;
  type: AssetType;
  src: string;
}

export class AssetRegistry {
  private readonly assets = new Map<string, AssetDefinition>();

  constructor(
    private readonly basePath: string,
    private readonly totalFrames: number,
  ) {
    this.registerFrames();
  }

  private registerFrames() {
    for (let i = 1; i <= this.totalFrames; i++) {
      const id = `frame-${i}`;

      this.assets.set(id, {
        id,
        type: "image",
        src: `${this.basePath}/frame_${String(i).padStart(4, "0")}.jpg`,
      });
    }
  }

  getFrame(frame: number): AssetDefinition {
    const id = `frame-${frame}`;

    const asset = this.assets.get(id);

    if (!asset) {
      throw new Error(`Frame ${frame} is not registered.`);
    }

    return asset;
  }

  getFramePath(frame: number): string {
    return this.getFrame(frame).src;
  }

  getAllFrames(): AssetDefinition[] {
    return [...this.assets.values()];
  }

  hasFrame(frame: number): boolean {
    return this.assets.has(`frame-${frame}`);
  }

  getFrameCount(): number {
    return this.assets.size;
  }
}