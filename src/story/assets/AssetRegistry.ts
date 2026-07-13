export type ImageSequenceAsset = {
  id: string;
  folderPath: string;
  filenamePrefix: string;
  extension: "jpg" | "jpeg" | "png" | "webp";
  totalFrames: number;
  startIndex: number;
  padLength: number;
  width: number;
  height: number;
  fps: number;
};

export class AssetRegistry {
  static readonly seedStory: ImageSequenceAsset = {
    id: "seed-story",

    folderPath: "/seed-story",

    filenamePrefix: "frame_",

    extension: "jpg",

    totalFrames: 240,

    startIndex: 1,

    padLength: 4,

    width: 1920,

    height: 1080,

    fps: 30,
  };

  static getAsset(id: string): ImageSequenceAsset {
    switch (id) {
      case "seed-story":
        return this.seedStory;

      default:
        throw new Error(`Unknown asset: ${id}`);
    }
  }
}