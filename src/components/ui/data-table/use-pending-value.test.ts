import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import usePendingValue from "./use-pending-value";

const isSame = (a: string, b: string) => a === b;

describe("usePendingValue", () => {
  it("keeps a return to the shown value while an earlier change is on the way", () => {
    const { rerender, result } = renderHook(
      ({ incoming }) => usePendingValue(incoming, isSame),
      { initialProps: { incoming: "A" } },
    );

    // A filter typed, then cleared before the owner caught up
    result.current.set("B");
    result.current.set("A");
    expect(result.current.get()).toBe("A");

    // The owner shows the first change late - not a change from elsewhere
    rerender({ incoming: "B" });
    expect(result.current.get()).toBe("A");

    rerender({ incoming: "A" });
    expect(result.current.get()).toBe("A");

    // Caught up: a change from elsewhere wins again
    rerender({ incoming: "C" });
    expect(result.current.get()).toBe("C");
  });

  it("waits for nothing when set to the shown value", () => {
    const { rerender, result } = renderHook(
      ({ incoming }) => usePendingValue(incoming, isSame),
      { initialProps: { incoming: "A" } },
    );

    result.current.set("A");
    rerender({ incoming: "B" });
    expect(result.current.get()).toBe("B");
  });
});
