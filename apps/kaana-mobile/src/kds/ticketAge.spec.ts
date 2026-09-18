import { describe, expect, it } from "vitest";
import { ageTone, elapsedMinutes, formatElapsed } from "./ticketAge";

describe("ticketAge", () => {
  const now = new Date("2026-09-07T12:00:00.000Z").getTime();

  it("formats elapsed minutes", () => {
    const fired = new Date(now - 4 * 60_000).toISOString();
    expect(elapsedMinutes(fired, now)).toBe(4);
    expect(formatElapsed(fired, now)).toBe("4 min");
  });

  it("shows sub-minute as less than one minute", () => {
    const fired = new Date(now - 30_000).toISOString();
    expect(formatElapsed(fired, now)).toBe("<1 min");
  });

  it("escalates age tone", () => {
    expect(ageTone(new Date(now - 5 * 60_000).toISOString(), now)).toBe("normal");
    expect(ageTone(new Date(now - 10 * 60_000).toISOString(), now)).toBe("warn");
    expect(ageTone(new Date(now - 20 * 60_000).toISOString(), now)).toBe("late");
  });
});
