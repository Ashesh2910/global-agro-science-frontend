export type TimelineControllerStatus = "idle" | "playing" | "paused" | "stopped";

export type TimelineControllerState = {
  progress: number;
  status: TimelineControllerStatus;
};

export type TimelineControllerSubscriber = (
  state: TimelineControllerState,
  timelineId: string,
) => void;

export type TimelineControllerOptions = {
  initialProgress?: number;
};

type TimelineRecord = {
  id: string;
  progress: number;
  status: TimelineControllerStatus;
  subscribers: Set<TimelineControllerSubscriber>;
};

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    throw new Error("Timeline progress must be a finite number.");
  }

  return Math.min(Math.max(progress, 0), 1);
}

function createState(record: TimelineRecord): TimelineControllerState {
  return {
    progress: record.progress,
    status: record.status,
  };
}

export class TimelineController {
  private readonly timelines = new Map<string, TimelineRecord>();
  private readonly initialProgress: number;
  private destroyed = false;

  constructor(options: TimelineControllerOptions = {}) {
    this.initialProgress = clampProgress(options.initialProgress ?? 0);
  }

  registerTimeline(id: string) {
    this.assertActive();
    this.assertValidId(id);

    if (this.timelines.has(id)) {
      throw new Error(`Timeline already registered: ${id}`);
    }

    this.timelines.set(id, {
      id,
      progress: this.initialProgress,
      status: "idle",
      subscribers: new Set(),
    });
  }

  unregisterTimeline(id: string) {
    const record = this.timelines.get(id);

    if (!record) {
      return;
    }

    record.subscribers.clear();
    this.timelines.delete(id);
  }

  seek(progress: number, timelineId?: string) {
    this.updateTimelineOrAll(timelineId, (record) => {
      record.progress = clampProgress(progress);
    });
  }

  play(timelineId?: string) {
    this.updateTimelineOrAll(timelineId, (record) => {
      record.status = "playing";
    });
  }

  pause(timelineId?: string) {
    this.updateTimelineOrAll(timelineId, (record) => {
      record.status = "paused";
    });
  }

  stop(timelineId?: string) {
    this.updateTimelineOrAll(timelineId, (record) => {
      record.status = "stopped";
    });
  }

  reset(timelineId?: string) {
    this.updateTimelineOrAll(timelineId, (record) => {
      record.progress = this.initialProgress;
      record.status = "idle";
    });
  }

  subscribe(timelineId: string, subscriber: TimelineControllerSubscriber) {
    this.assertActive();
    const record = this.getTimeline(timelineId);
    record.subscribers.add(subscriber);

    return () => this.unsubscribe(timelineId, subscriber);
  }

  unsubscribe(timelineId: string, subscriber: TimelineControllerSubscriber) {
    const record = this.timelines.get(timelineId);
    record?.subscribers.delete(subscriber);
  }

  getProgress(timelineId: string) {
    return this.getTimeline(timelineId).progress;
  }

  getStatus(timelineId: string) {
    return this.getTimeline(timelineId).status;
  }

  getState(timelineId: string): TimelineControllerState {
    return createState(this.getTimeline(timelineId));
  }

  hasTimeline(timelineId: string) {
    return this.timelines.has(timelineId);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    for (const record of this.timelines.values()) {
      record.subscribers.clear();
    }

    this.timelines.clear();
    this.destroyed = true;
  }

  private updateTimelineOrAll(
    timelineId: string | undefined,
    update: (record: TimelineRecord) => void,
  ) {
    this.assertActive();

    if (timelineId) {
      const record = this.getTimeline(timelineId);
      update(record);
      this.emit(record);
      return;
    }

    for (const record of this.timelines.values()) {
      update(record);
      this.emit(record);
    }
  }

  private emit(record: TimelineRecord) {
    const state = createState(record);

    for (const subscriber of record.subscribers) {
      subscriber(state, record.id);
    }
  }

  private getTimeline(timelineId: string) {
    const record = this.timelines.get(timelineId);

    if (!record) {
      throw new Error(`Timeline is not registered: ${timelineId}`);
    }

    return record;
  }

  private assertValidId(id: string) {
    if (!id.trim()) {
      throw new Error("Timeline id cannot be empty.");
    }
  }

  private assertActive() {
    if (this.destroyed) {
      throw new Error("TimelineController has been destroyed.");
    }
  }
}
