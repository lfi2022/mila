import { describe, expect, it } from "vitest";

import {
  acceptsSecondHand,
  canIncludeMemoryMessage,
  classifyMedia,
} from "../src/modules/memories/service.js";

describe("second-hand, media and memory policy", () => {
  it("enforces the gift's explicit second-hand preference", () => {
    expect(acceptsSecondHand("NEW_ONLY")).toBe(false);
    expect(acceptsSecondHand("SECOND_HAND_ALLOWED")).toBe(true);
    expect(acceptsSecondHand("SECOND_HAND_PREFERRED")).toBe(true);
  });

  it("allows only controlled audio/video formats, sizes and durations", () => {
    expect(classifyMedia("audio/mpeg", 1_000, 299, 2_000, 4_000)).toBe("AUDIO");
    expect(classifyMedia("video/mp4", 3_000, 180, 2_000, 4_000)).toBe("VIDEO");
    expect(classifyMedia("video/mp4", 3_000, 181, 2_000, 4_000)).toBeNull();
    expect(classifyMedia("text/html", 100, undefined, 2_000, 4_000)).toBeNull();
    expect(classifyMedia("audio/mpeg", 2_001, 10, 2_000, 4_000)).toBeNull();
  });

  it("requires explicit parental approval and visible content for the memory book", () => {
    expect(canIncludeMemoryMessage({ approvedForMemory: true, hiddenAt: null })).toBe(true);
    expect(canIncludeMemoryMessage({ approvedForMemory: false, hiddenAt: null })).toBe(false);
    expect(canIncludeMemoryMessage({ approvedForMemory: true, hiddenAt: new Date() })).toBe(false);
  });
});
