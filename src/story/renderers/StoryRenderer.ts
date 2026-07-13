import type {
  CanvasRendererHandle,
} from "../../components/canvas/CanvasRenderer";

import { ImageSequenceManager } from "../../engines/ImageSequenceManager";

export class StoryRenderer {
  private readonly canvas: CanvasRendererHandle;
  private readonly images: ImageSequenceManager;

  constructor(
    canvas: CanvasRendererHandle,
    images: ImageSequenceManager,
  ) {
    this.canvas = canvas;
    this.images = images;
  }

  public draw(frameIndex: number) {
    const image = this.images.getFrame(frameIndex);

    if (!image) {
      return;
    }

    this.canvas.render(({ context, width, height }) => {
      context.clearRect(0, 0, width, height);

      context.drawImage(
        image,
        0,
        0,
        width,
        height,
      );
    });
  }

  public clear() {
    this.canvas.clear();
  }

  public resize() {
    this.canvas.resize();
  }

  public destroy() {
    this.canvas.destroy();
  }
}