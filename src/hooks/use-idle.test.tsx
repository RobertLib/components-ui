import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useIdle, { type UseIdleOptions } from "./use-idle";
import FakeBroadcastChannel from "../test/fake-broadcast-channel";

const MINUTE = 60_000;
const START = new Date(2026, 9, 15, 9, 0, 0);

const setup = (timeout: number, options?: UseIdleOptions) =>
  renderHook(({ timeout: time, options: opts }) => useIdle(time, opts), {
    initialProps: { options, timeout },
  });

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeBroadcastChannel.open.clear();
});

describe("useIdle", () => {
  it("is idle after the timeout without activity - and active again on activity", () => {
    const onIdle = vi.fn();
    const onActive = vi.fn();
    const { result } = setup(5 * MINUTE, { onActive, onIdle });

    expect(result.current.idle).toBe(false);
    advance(5 * MINUTE - 1);
    expect(result.current.idle).toBe(false);
    advance(1);
    expect(result.current.idle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.keyDown(document.body, { key: "a" });
    });
    expect(result.current.idle).toBe(false);
    expect(onActive).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("counts the time from the last activity", () => {
    const { result } = setup(5 * MINUTE);

    advance(4 * MINUTE);
    act(() => {
      fireEvent.pointerMove(document.body);
      fireEvent.mouseMove(document.body);
    });
    expect(result.current.getLastActive()).toBe(START.getTime() + 4 * MINUTE);
    advance(4 * MINUTE);
    expect(result.current.idle).toBe(false);
    advance(MINUTE);
    expect(result.current.idle).toBe(true);
  });

  it("counts a wheel, a touch and a pointer in a container", () => {
    const { result } = setup(MINUTE);
    const box = document.createElement("div");
    document.body.append(box);

    for (const fire of [
      () => fireEvent.wheel(box),
      () => fireEvent.touchStart(box),
      () => fireEvent.pointerDown(box),
    ]) {
      advance(50_000);
      act(fire);
      expect(result.current.getLastActive()).toBe(Date.now());
    }
    expect(result.current.idle).toBe(false);
    box.remove();
  });

  it("does not count a scroll - a script scrolls too", () => {
    const { result } = setup(MINUTE);
    const log = document.createElement("div");
    document.body.append(log);

    // A live log keeps its end in view
    for (let second = 0; second < 60; second += 5) {
      advance(5000);
      act(() => {
        fireEvent.scroll(log);
      });
    }
    expect(result.current.idle).toBe(true);
    log.remove();
  });

  it("counts the events given in events only", () => {
    const { result } = setup(MINUTE, { events: ["keydown"] });

    advance(30_000);
    act(() => {
      fireEvent.mouseMove(document.body);
    });
    advance(30_000);
    expect(result.current.idle).toBe(true);
  });

  it("is idle as long as it really was after the computer slept", () => {
    const { result } = setup(5 * MINUTE);

    // The clock jumps - the timers did not run meanwhile
    vi.setSystemTime(START.getTime() + 30 * MINUTE);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.idle).toBe(true);
  });

  it("tells the other tabs about the activity - throttled", () => {
    setup(5 * MINUTE, { throttle: 1000 });
    const otherTab = new FakeBroadcastChannel("components-ui:idle");
    const received: unknown[] = [];
    otherTab.onmessage = (event) => received.push(event.data);

    act(() => {
      fireEvent.keyDown(document.body, { key: "a" });
    });
    // Within a second of the start - one burst
    expect(received).toEqual([]);

    advance(1000);
    act(() => {
      fireEvent.keyDown(document.body, { key: "a" });
      fireEvent.keyDown(document.body, { key: "b" });
      fireEvent.mouseMove(document.body);
    });
    advance(500);
    act(() => {
      fireEvent.mouseMove(document.body);
    });
    expect(received).toEqual([{ at: START.getTime() + 1000 }]);
  });

  it("is not idle while the user works in another tab", () => {
    const onIdle = vi.fn();
    const { result } = setup(5 * MINUTE, { onIdle });
    const otherTab = new FakeBroadcastChannel("components-ui:idle");

    advance(4 * MINUTE);
    act(() => otherTab.postMessage({ at: Date.now() }));
    advance(4 * MINUTE);
    expect(result.current.idle).toBe(false);

    advance(MINUTE);
    expect(result.current.idle).toBe(true);
    // Active again by the activity of the other tab
    act(() => otherTab.postMessage({ at: Date.now() }));
    expect(result.current.idle).toBe(false);
    // An old message, or nonsense, changes nothing
    advance(5 * MINUTE);
    act(() => otherTab.postMessage({ at: START.getTime() }));
    act(() => otherTab.postMessage("nonsense"));
    expect(result.current.idle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(2);
  });

  it("shares the activity by localStorage without a BroadcastChannel", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const { result } = setup(5 * MINUTE, { syncKey: "app:idle", throttle: 0 });

    advance(MINUTE);
    act(() => {
      fireEvent.keyDown(document.body, { key: "a" });
    });
    expect(JSON.parse(localStorage.getItem("app:idle")!).message).toEqual({
      at: START.getTime() + MINUTE,
    });

    // Another tab writes its activity
    advance(4 * MINUTE);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "app:idle",
          newValue: JSON.stringify({ message: { at: Date.now() }, sent: "x" }),
        }),
      );
    });
    advance(4 * MINUTE);
    expect(result.current.idle).toBe(false);
    advance(MINUTE);
    expect(result.current.idle).toBe(true);
  });

  it("watches this tab only without a syncKey", () => {
    setup(MINUTE, { syncKey: false });

    expect(FakeBroadcastChannel.open.size).toBe(0);
  });

  it("is not idle while disabled - and counts anew once enabled", () => {
    const { rerender, result } = setup(MINUTE);

    advance(MINUTE);
    expect(result.current.idle).toBe(true);

    rerender({ options: { enabled: false }, timeout: MINUTE });
    expect(result.current.idle).toBe(false);
    expect(FakeBroadcastChannel.open.size).toBe(0);
    advance(5 * MINUTE);
    expect(result.current.idle).toBe(false);

    rerender({ options: { enabled: true }, timeout: MINUTE });
    expect(result.current.idle).toBe(false);
    advance(MINUTE - 1);
    expect(result.current.idle).toBe(false);
    advance(1);
    expect(result.current.idle).toBe(true);
  });

  it("counts reset as activity - also in the other tabs", () => {
    const { result } = setup(MINUTE);
    const otherTab = new FakeBroadcastChannel("components-ui:idle");
    const received: unknown[] = [];
    otherTab.onmessage = (event) => received.push(event.data);

    advance(MINUTE);
    expect(result.current.idle).toBe(true);
    act(() => result.current.reset());
    expect(result.current.idle).toBe(false);
    expect(received).toEqual([{ at: START.getTime() + MINUTE }]);
  });

  it("returns the same functions on every render", () => {
    const { rerender, result } = setup(MINUTE);
    const { getLastActive, reset } = result.current;

    rerender({ options: { throttle: 10 }, timeout: MINUTE });
    expect(result.current.getLastActive).toBe(getLastActive);
    expect(result.current.reset).toBe(reset);
  });

  it("stops listening once unmounted", () => {
    const onActive = vi.fn();
    const { unmount } = setup(MINUTE, { onActive });

    advance(MINUTE);
    unmount();
    expect(FakeBroadcastChannel.open.size).toBe(0);
    fireEvent.keyDown(document.body, { key: "a" });
    expect(onActive).not.toHaveBeenCalled();
  });

  it("is not idle on the server", () => {
    function Probe() {
      const { idle } = useIdle(MINUTE);
      return <span>{idle ? "idle" : "active"}</span>;
    }

    expect(renderToString(<Probe />)).toContain("active");
    render(<Probe />);
  });
});
