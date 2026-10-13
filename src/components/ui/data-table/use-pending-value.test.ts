import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import usePendingValue from "./use-pending-value";

const isSame = (a: string, b: string) => a === b;
const isSameObject = (a: { value: string }, b: { value: string }) =>
  a.value === b.value;

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

    // A render caused by loading or other props confirms no change.
    rerender({ incoming: "A" });

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

  it("acknowledges the last of repeated values when the owner coalesces updates", () => {
    const { rerender, result } = renderHook(
      ({ incoming }) => usePendingValue(incoming, isSame),
      { initialProps: { incoming: "A" } },
    );

    result.current.set("B");
    result.current.set("C");
    result.current.set("B");
    rerender({ incoming: "B" });

    // All pending changes have finished. C is now an external change,
    // rather than the intermediate value the owner skipped.
    rerender({ incoming: "C" });
    expect(result.current.get()).toBe("C");
    result.current.set("D");
    expect(result.current.get()).toBe("D");
  });

  it("acknowledges coalesced updates returning to the shown value", () => {
    const initial = { value: "A" };
    const first = { value: "B" };
    const last = { value: "A" };
    const { rerender, result } = renderHook(
      ({ incoming }) => usePendingValue(incoming, isSameObject),
      { initialProps: { incoming: initial } },
    );

    result.current.set(first);
    result.current.set(last);
    // Returning the submitted object confirms it even when its value is A.
    rerender({ incoming: last });
    rerender({ incoming: first });
    expect(result.current.get()).toBe(first);
  });

  it("keeps a return pending through equal inline copies of the old value", () => {
    const initial = { value: "A" };
    const first = { value: "B" };
    const last = { value: "A" };
    const { rerender, result } = renderHook(
      ({ incoming }) => usePendingValue(incoming, isSameObject),
      { initialProps: { incoming: initial } },
    );

    result.current.set(first);
    result.current.set(last);
    rerender({ incoming: { ...initial } });
    rerender({ incoming: { ...first } });
    expect(result.current.get()).toBe(last);
    rerender({ incoming: { ...last } });
    expect(result.current.get()).toEqual(last);
  });

  it("keeps newer pending changes after acknowledging a repeated earlier value", () => {
    const { rerender, result } = renderHook(
      ({ incoming }) => usePendingValue(incoming, isSame),
      { initialProps: { incoming: "A" } },
    );

    result.current.set("B");
    result.current.set("C");
    result.current.set("B");
    result.current.set("D");
    rerender({ incoming: "B" });
    expect(result.current.get()).toBe("D");
    rerender({ incoming: "D" });
    rerender({ incoming: "C" });
    expect(result.current.get()).toBe("C");
  });
});
