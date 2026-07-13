import type { CanvasRendererHandle } from "../../components/canvas/CanvasRenderer";
import { AssetRegistry } from "../assets/AssetRegistry";

export class StoryRenderer {
  private readonly canvas: CanvasRendererHandle;
  private readonly assets: AssetRegistry;

  constructor(
    canvas: CanvasRendererHandle,
    assets: AssetRegistry,
  ) {
    this.canvas = canvas;
    this.assets = assets;
  }

  draw(frame: number) {
    const image = new Image();

    image.src = this.assets.getFramePath(frame);

    image.onload = () => {
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
    };
  }

  clear() {
    this.canvas.clear();
  }

  resize() {
    this.canvas.resize();
  }

  destroy() {
    this.canvas.destroy();
  }
}