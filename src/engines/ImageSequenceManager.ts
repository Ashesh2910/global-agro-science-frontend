export type ImageSequenceFileExtension = "jpg" | "jpeg" | "png" | "webp";

export type ImageSequenceManagerOptions = {
  folderPath: string;
  totalFrames: number;
  extension: ImageSequenceFileExtension;
  concurrency?: number;
  retryCount?: number;
  retryDelayMs?: number;
  cacheSize?: number;
  startIndex?: number;
  padLength?: number;
  filenamePrefix?: string;
  filenameSuffix?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ImageSequenceProgress) => void;
};

export type ImageSequenceProgress = {
  total: number;
  loaded: number;
  failed: number;
  pending: number;
  progress: number;
};

type CachedFrame = {
  image: HTMLImageElement;
  lastUsedAt: number;
};

type FrameStatus = "idle" | "loading" | "loaded" | "failed";

type FrameRecord = {
  index: number;
  url: string;
  status: FrameStatus;
  attempts: number;
  error: Error | null;
};

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 150;
const DEFAULT_CACHE_SIZE = Number.POSITIVE_INFINITY;
const DEFAULT_START_INDEX = 0;
const DEFAULT_PAD_LENGTH = 4;

function normalizeFolderPath(folderPath: string) {
  return folderPath.replace(/\/+$/, "");
}

function normalizeExtension(extension: ImageSequenceFileExtension) {
  return extension.toLowerCase() as ImageSequenceFileExtension;
}

function assertValidOptions(options: ImageSequenceManagerOptions) {
  if (!options.folderPath.trim()) {
    throw new Error("ImageSequenceManager requires a folderPath.");
  }

  if (!Number.isInteger(options.totalFrames) || options.totalFrames < 1) {
    throw new Error("ImageSequenceManager requires totalFrames to be at least 1.");
  }

  if (!["jpg", "jpeg", "png", "webp"].includes(options.extension)) {
    throw new Error("ImageSequenceManager supports jpg, jpeg, png, and webp.");
  }
}

function delay(ms: number, signal?: AbortSignal) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function createAbortError() {
  return new DOMException("Image sequence loading was aborted.", "AbortError");
}

function loadImage(url: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? createAbortError());
      return;
    }

    const image = new Image();

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      image.src = "";
      reject(signal.reason ?? createAbortError());
    };

    image.decoding = "async";
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${url}`));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    image.src = url;
  });
}

export class ImageSequenceManager {
  private readonly folderPath: string;
  private readonly totalFrames: number;
  private readonly extension: ImageSequenceFileExtension;
  private readonly concurrency: number;
  private readonly retryCount: number;
  private readonly retryDelayMs: number;
  private readonly cacheSize: number;
  private readonly startIndex: number;
  private readonly padLength: number;
  private readonly filenamePrefix: string;
  private readonly filenameSuffix: string;
  private readonly externalSignal?: AbortSignal;
  private readonly onProgress?: (progress: ImageSequenceProgress) => void;
  private readonly records: FrameRecord[];
  private readonly cache = new Map<number, CachedFrame>();
  private internalAbortController: AbortController | null = null;
  private loadPromise: Promise<void> | null = null;
  private destroyed = false;

  constructor(options: ImageSequenceManagerOptions) {
    assertValidOptions(options);

    this.folderPath = normalizeFolderPath(options.folderPath);
    this.totalFrames = options.totalFrames;
    this.extension = normalizeExtension(options.extension);
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY));
    this.retryCount = Math.max(0, Math.floor(options.retryCount ?? DEFAULT_RETRY_COUNT));
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    this.cacheSize = Math.max(0, options.cacheSize ?? DEFAULT_CACHE_SIZE);
    this.startIndex = options.startIndex ?? DEFAULT_START_INDEX;
    this.padLength = Math.max(0, options.padLength ?? DEFAULT_PAD_LENGTH);
    this.filenamePrefix = options.filenamePrefix ?? "";
    this.filenameSuffix = options.filenameSuffix ?? "";
    this.externalSignal = options.signal;
    this.onProgress = options.onProgress;
    this.records = Array.from({ length: this.totalFrames }, (_, index) => ({
      index,
      url: this.buildFrameUrl(index),
      status: "idle",
      attempts: 0,
      error: null,
    }));
  }

  load() {
    this.assertActive();

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.internalAbortController = new AbortController();
    const signal = this.createCompositeSignal();
    this.loadPromise = this.loadFrames(signal);

    return this.loadPromise;
  }

  dispose() {
    this.internalAbortController?.abort(createAbortError());
    this.internalAbortController = null;
    this.loadPromise = null;
    this.cache.clear();

    for (const record of this.records) {
      if (record.status === "loading") {
        record.status = "idle";
      }
    }
  }

  getFrame(index: number) {
    const record = this.getRecord(index);
    const cached = this.cache.get(record.index);

    if (!cached) {
      return null;
    }

    cached.lastUsedAt = performance.now();
    return cached.image;
  }

  isLoaded(index: number) {
    return this.getRecord(index).status === "loaded";
  }

  getProgress(): ImageSequenceProgress {
    let loaded = 0;
    let failed = 0;

    for (const record of this.records) {
      if (record.status === "loaded") {
        loaded += 1;
      }

      if (record.status === "failed") {
        failed += 1;
      }
    }

    const pending = this.totalFrames - loaded - failed;

    return {
      total: this.totalFrames,
      loaded,
      failed,
      pending,
      progress: this.totalFrames === 0 ? 1 : loaded / this.totalFrames,
    };
  }

  destroy() {
    this.dispose();
    this.destroyed = true;
  }

  private buildFrameUrl(index: number) {
    const frameNumber = String(this.startIndex + index).padStart(this.padLength, "0");
    const filename = `${this.filenamePrefix}${frameNumber}${this.filenameSuffix}.${this.extension}`;

    return `${this.folderPath}/${filename}`;
  }

  private async loadFrames(signal: AbortSignal) {
    const queue = [...this.records];
    const workerCount = Math.min(this.concurrency, queue.length);
    const workers = Array.from({ length: workerCount }, () => this.runWorker(queue, signal));

    await Promise.all(workers);
  }

  private async runWorker(queue: FrameRecord[], signal: AbortSignal) {
    while (queue.length > 0) {
      if (signal.aborted) {
        throw signal.reason ?? createAbortError();
      }

      const record = queue.shift();

      if (!record || record.status === "loaded") {
        continue;
      }

      await this.loadRecord(record, signal);
    }
  }

  private async loadRecord(record: FrameRecord, signal: AbortSignal) {
    record.status = "loading";
    record.error = null;
    this.emitProgress();

    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      try {
        record.attempts = attempt + 1;
        const image = await loadImage(record.url, signal);
        this.setCachedFrame(record.index, image);
        record.status = "loaded";
        record.error = null;
        this.emitProgress();
        return;
      } catch (error) {
        if (signal.aborted) {
          record.status = "idle";
          record.error = null;
          throw error;
        }

        record.error = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryCount) {
          await delay(this.retryDelayMs, signal);
        }
      }
    }

    record.status = "failed";
    this.emitProgress();
  }

  private setCachedFrame(index: number, image: HTMLImageElement) {
    if (this.cacheSize === 0) {
      return;
    }

    this.cache.set(index, {
      image,
      lastUsedAt: performance.now(),
    });
    this.evictFrames();
  }

  private evictFrames() {
    while (this.cache.size > this.cacheSize) {
      let oldestIndex: number | null = null;
      let oldestUsedAt = Number.POSITIVE_INFINITY;

      for (const [index, cached] of this.cache) {
        if (cached.lastUsedAt < oldestUsedAt) {
          oldestIndex = index;
          oldestUsedAt = cached.lastUsedAt;
        }
      }

      if (oldestIndex === null) {
        return;
      }

      this.cache.delete(oldestIndex);
    }
  }

  private createCompositeSignal() {
    const controller = this.internalAbortController;

    if (!controller) {
      throw new Error("ImageSequenceManager load controller is unavailable.");
    }

    if (!this.externalSignal) {
      return controller.signal;
    }

    if (this.externalSignal.aborted) {
      controller.abort(this.externalSignal.reason ?? createAbortError());
      return controller.signal;
    }

    this.externalSignal.addEventListener(
      "abort",
      () => controller.abort(this.externalSignal?.reason ?? createAbortError()),
      { once: true },
    );

    return controller.signal;
  }

  private getRecord(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= this.totalFrames) {
      throw new RangeError(`Frame index ${index} is outside the sequence range.`);
    }

    return this.records[index];
  }

  private emitProgress() {
    this.onProgress?.(this.getProgress());
  }

  private assertActive() {
    if (this.destroyed) {
      throw new Error("ImageSequenceManager has been destroyed.");
    }
  }
}
