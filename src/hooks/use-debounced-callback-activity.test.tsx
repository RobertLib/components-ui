import { act, render, renderHook } from "@testing-library/react";
import {
  Activity,
  StrictMode,
  createRef,
  useImperativeHandle,
  useState,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDebouncedCallback, {
  type DebouncedCallback,
} from "./use-debounced-callback";

interface HarnessProps {
  callback: (value: string) => void;
  delay?: number;
  flushOnUnmount: boolean;
  ref: React.Ref<DebouncedCallback<[string]>>;
}

function Harness({ callback, delay = 300, flushOnUnmount, ref }: HarnessProps) {
  const debounced = useDebouncedCallback(callback, delay, { flushOnUnmount });
  useImperativeHandle(ref, () => debounced, [debounced]);
  return null;
}

function content(mode: "hidden" | "visible", props: HarnessProps) {
  return (
    <StrictMode>
      <Activity mode={mode}>
        <Harness {...props} />
      </Activity>
    </StrictMode>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each([false, true])(
  "useDebouncedCallback with Activity (flushOnUnmount: %s)",
  (flushOnUnmount) => {
    it.each([false, true])(
      "keeps a pending call and its deadline across hiding (show before deadline: %s)",
      async (showBeforeDeadline) => {
        const callback = vi.fn();
        const ref = createRef<DebouncedCallback<[string]>>();
        const props = { callback, flushOnUnmount, ref };
        const { rerender } = render(content("visible", props));
        ref.current!("draft");
        act(() => vi.advanceTimersByTime(100));

        await act(async () => rerender(content("hidden", props)));
        expect(callback).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(100));
        if (showBeforeDeadline) rerender(content("visible", props));
        act(() => vi.advanceTimersByTime(99));
        expect(callback).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(callback).toHaveBeenCalledExactlyOnceWith("draft");
      },
    );

    it("uses the callback and delay committed while hidden", async () => {
      const first = vi.fn();
      const latest = vi.fn();
      const ref = createRef<DebouncedCallback<[string]>>();
      const props = { callback: first, flushOnUnmount, ref };
      const { rerender } = render(content("visible", props));
      const debounced = ref.current!;
      debounced("previous");

      await act(async () => rerender(content("hidden", props)));
      await act(async () =>
        rerender(content("hidden", { ...props, callback: latest, delay: 500 })),
      );
      debounced("latest");
      act(() => vi.advanceTimersByTime(499));
      expect(first).not.toHaveBeenCalled();
      expect(latest).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(latest).toHaveBeenCalledExactlyOnceWith("latest");
    });

    it("cleans up a pending call when it really unmounts while hidden", async () => {
      const saved = renderHook(() => useState(""));
      const consoleError = vi.spyOn(console, "error");
      const callback = vi.fn((value: string) => saved.result.current[1](value));
      const ref = createRef<DebouncedCallback<[string]>>();
      const props = { callback, flushOnUnmount, ref };
      const { rerender, unmount } = render(content("visible", props));
      ref.current!("draft");

      await act(async () => rerender(content("hidden", props)));
      expect(callback).not.toHaveBeenCalled();
      await act(async () => unmount());
      act(() => vi.advanceTimersByTime(1000));

      if (flushOnUnmount)
        expect(callback).toHaveBeenCalledExactlyOnceWith("draft");
      else expect(callback).not.toHaveBeenCalled();
      expect(saved.result.current[0]).toBe(flushOnUnmount ? "draft" : "");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("uses an unmount option changed while hidden", async () => {
      const callback = vi.fn();
      const ref = createRef<DebouncedCallback<[string]>>();
      const props = { callback, flushOnUnmount, ref };
      const { rerender, unmount } = render(content("visible", props));
      ref.current!("draft");

      await act(async () => rerender(content("hidden", props)));
      await act(async () =>
        rerender(
          content("hidden", { ...props, flushOnUnmount: !flushOnUnmount }),
        ),
      );
      await act(async () => unmount());
      act(() => vi.advanceTimersByTime(1000));

      if (flushOnUnmount) expect(callback).not.toHaveBeenCalled();
      else expect(callback).toHaveBeenCalledExactlyOnceWith("draft");
    });
  },
);
