import type { AppearancePatch } from "@/components/ListAppearanceEditor";

type AppearanceSaveQueueOptions<State> = {
  delayMs?: number;
  snapshot: () => State | undefined;
  optimistic: (patch: AppearancePatch) => void;
  write: (patch: AppearancePatch) => Promise<void>;
  rollback: (
    snapshot: State | undefined,
    failedPatch: AppearancePatch,
    pendingPatch: AppearancePatch,
  ) => void;
  onError: (error: unknown) => void;
};

export type AppearanceSaveQueue = {
  change: (patch: AppearancePatch) => void;
  flush: () => Promise<void>;
  dispose: (flush?: boolean) => void;
};

/**
 * Coalesces rapid appearance changes while keeping the UI optimistic.
 * Writes are serialized so an older response can never overwrite a newer choice.
 */
export function createAppearanceSaveQueue<State>(
  options: AppearanceSaveQueueOptions<State>,
): AppearanceSaveQueue {
  const delayMs = options.delayMs ?? 400;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AppearancePatch = {};
  let base: State | undefined;
  let saving = false;
  let disposed = false;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, delayMs);
  };

  const change = (patch: AppearancePatch) => {
    if (disposed) return;
    if (!hasPatch(pending)) base = options.snapshot();
    pending = { ...pending, ...patch };
    options.optimistic(patch);
    schedule();
  };

  const flush = async (): Promise<void> => {
    if (saving || !hasPatch(pending)) return;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    const patch = pending;
    const snapshot = base;
    pending = {};
    base = undefined;
    saving = true;
    try {
      await options.write(patch);
    } catch (error) {
      options.rollback(snapshot, patch, pending);
      if (hasPatch(pending)) base = options.snapshot();
      options.onError(error);
    } finally {
      saving = false;
      // A second batch may have accumulated while the first request was running.
      if (hasPatch(pending)) schedule();
    }
  };

  return {
    change,
    flush,
    dispose(flushPending = false) {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (flushPending && hasPatch(pending)) void flush();
      disposed = true;
    },
  };
}

function hasPatch(patch: AppearancePatch) {
  return Object.keys(patch).length > 0;
}

export function rollbackAppearancePatch<State extends Record<string, unknown>>(
  current: State,
  snapshot: State | undefined,
  failedPatch: AppearancePatch,
  pendingPatch: AppearancePatch,
): State {
  if (!snapshot) return { ...current, ...pendingPatch };
  const restored = { ...current };
  for (const key of Object.keys(failedPatch) as Array<keyof AppearancePatch>) {
    if (key in pendingPatch) continue;
    (restored as Record<string, unknown>)[key] = snapshot[key];
  }
  return { ...restored, ...pendingPatch };
}
