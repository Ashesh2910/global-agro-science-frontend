import { AnimationRuntime } from "../../engines/AnimationRuntime";
import { ScrollEngine } from "../../engines/ScrollEngine";
import { TimelineController } from "../../engines/TimelineController";

import { StoryState } from "../state/StoryState";
import { SceneManager } from "../scenes/SceneManager";
import { StoryRenderer } from "../renderers/StoryRenderer";

export class StoryController {
  private readonly runtime: AnimationRuntime;
  private readonly scroll: ScrollEngine;
  private readonly timeline: TimelineController;
  private readonly state: StoryState;
  private readonly scenes: SceneManager;
  private readonly renderer: StoryRenderer;

  constructor(
    runtime: AnimationRuntime,
    scroll: ScrollEngine,
    timeline: TimelineController,
    state: StoryState,
    scenes: SceneManager,
    renderer: StoryRenderer,
  ) {
    this.runtime = runtime;
    this.scroll = scroll;
    this.timeline = timeline;
    this.state = state;
    this.scenes = scenes;
    this.renderer = renderer;
  }

  initialize() {
    if (!this.timeline.hasTimeline("seed-story")) {
      this.timeline.registerTimeline("seed-story");
    }

    this.runtime.registerTask("story-update", () => {
      this.update();
    });

    this.runtime.start();
  }

  private update() {
    const progress = this.scroll.getProgress();

    this.timeline.seek(progress, "seed-story");

    const frame = this.scenes.getFrame(progress);

    this.state.update({
      progress,
      currentFrame: frame,
      isPlaying: true,
    });

    this.renderer.draw(frame);
  }

  destroy() {
    this.runtime.unregisterTask("story-update");
    this.renderer.destroy();
    this.state.destroy();
  }
}