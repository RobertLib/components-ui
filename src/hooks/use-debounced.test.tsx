import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDebouncedCallback from "./use-debounced-callback";
import useDebouncedValue from "./use-debounced-value";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("takes over the last value once it stops changing", () => {
    const { rerender, result } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );
    expect(result.current).toBe("a");

    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("abc");
  });

  it("waits 300 ms by default and keeps functions as values", () => {
    const first = () => "first";
    const second = () => "second";
    const { rerender, result } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: first } },
    );
    expect(result.current).toBe(first);

    rerender({ value: second });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe(first);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(second);
  });
});

describe("useDebouncedCallback", () => {
  it("calls once with the arguments of the last call", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    result.current("a");
    result.current("b", 2);
    act(() => vi.advanceTimersByTime(499));
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("b", 2);
  });

  it("stays the same function and calls the callback of the latest render", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, result } = renderHook(
      ({ callback }) => useDebouncedCallback(callback),
      { initialProps: { callback: first } },
    );
    const debounced = result.current;

    debounced("draft");
    rerender({ callback: latest });
    expect(result.current).toBe(debounced);

    act(() => vi.advanceTimersByTime(300));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith("draft");
  });

  it("drops the pending call on cancel and makes it at once on flush", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback));

    result.current(1);
    result.current.cancel();
    act(() => vi.advanceTimersByTime(1000));
    expect(callback).not.toHaveBeenCalled();

    result.current(2);
    result.current.flush();
    expect(callback).toHaveBeenCalledWith(2);

    // Nothing pending any more
    result.current.flush();
    act(() => vi.advanceTimersByTime(1000));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("drops a pending call on unmount - or makes it with flushOnUnmount", () => {
    const dropped = vi.fn();
    const flushed = vi.fn();
    const first = renderHook(() => useDebouncedCallback(dropped));
    const second = renderHook(() =>
      useDebouncedCallback(flushed, 300, { flushOnUnmount: true }),
    );

    first.result.current("x");
    second.result.current("y");
    first.unmount();
    second.unmount();
    act(() => vi.advanceTimersByTime(1000));

    expect(dropped).not.toHaveBeenCalled();
    expect(flushed).toHaveBeenCalledTimes(1);
    expect(flushed).toHaveBeenCalledWith("y");
  });
});
