import { ScrollEngine } from "../../engines/ScrollEngine";
import { TimelineController } from "../../engines/TimelineController";
import { SceneManager } from "../scenes/SceneManager";
import { StoryRenderer } from "../renderers/StoryRenderer";

export class StoryController {
  private readonly scroll: ScrollEngine;
  private readonly timeline: TimelineController;
  private readonly scenes: SceneManager;
  private readonly renderer: StoryRenderer;

  constructor(
    scroll: ScrollEngine,
    timeline: TimelineController,
    scenes: SceneManager,
    renderer: StoryRenderer,
  ) {
    this.scroll = scroll;
    this.timeline = timeline;
    this.scenes = scenes;
    this.renderer = renderer;
  }

  initialize() {
    if (!this.timeline.hasTimeline("seed-story")) {
      this.timeline.registerTimeline("seed-story");
    }

    this.timeline.play("seed-story");

    this.scroll.subscribe((state) => {
      this.timeline.seek(state.progress, "seed-story");

      const frame = this.scenes.getFrame(state.progress);

      this.renderer.draw(frame);
    });
  }

  destroy() {
    this.timeline.stop("seed-story");
    this.renderer.destroy();
    this.scroll.destroy();
    this.timeline.destroy();
  }
}