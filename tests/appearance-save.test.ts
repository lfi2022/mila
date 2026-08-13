import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAppearanceSaveQueue,
  rollbackAppearancePatch,
} from "../src/features/lists/appearance-save";

afterEach(() => vi.useRealTimers());

describe("appearance save queue", () => {
  it("updates optimistically and merges rapid changes into one delayed write", async () => {
    vi.useFakeTimers();
    const optimistic = vi.fn();
    const write = vi.fn().mockResolvedValue(undefined);
    const queue = createAppearanceSaveQueue({
      delayMs: 400,
      snapshot: () => ({ theme: "blush" }),
      optimistic,
      write,
      rollback: vi.fn(),
      onError: vi.fn(),
    });

    queue.change({ theme: "sauge" });
    queue.change({ font_pair: "serif" });
    queue.change({ accent_color: "#112233" });

    expect(optimistic).toHaveBeenCalledTimes(3);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(399);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith({
      theme: "sauge",
      font_pair: "serif",
      accent_color: "#112233",
    });
  });

  it("rolls back a failed batch and preserves a newer pending choice", () => {
    expect(
      rollbackAppearancePatch(
        { theme: "sauge", font_pair: "moderne", title: "Mila" },
        { theme: "blush", font_pair: "baloo", title: "Mila" },
        { theme: "sauge", font_pair: "serif" },
        { font_pair: "moderne" },
      ),
    ).toEqual({ theme: "blush", font_pair: "moderne", title: "Mila" });
  });
});
