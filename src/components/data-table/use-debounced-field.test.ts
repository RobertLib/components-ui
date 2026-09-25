import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useDebouncedField from "./use-debounced-field";

describe("useDebouncedField", () => {
  const setup = () => {
    const onCommit = vi.fn();
    const hook = renderHook(
      ({ value }) => useDebouncedField(value, onCommit, 10),
      { initialProps: { value: "" } },
    );
    return { ...hook, onCommit };
  };

  it("does not bring back an older commit that arrives late", async () => {
    const { onCommit, rerender, result } = setup();

    act(() => result.current.change("ab"));
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith("ab"));
    act(() => result.current.change("abc"));
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith("abc"));

    // The owner (a router) shows the first commit only now
    rerender({ value: "ab" });
    expect(result.current.value).toBe("abc");

    act(() => result.current.change("abcd"));
    rerender({ value: "abc" });
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith("abcd"));
    rerender({ value: "abcd" });
    expect(result.current.value).toBe("abcd");
  });

  it("keeps a text typed back to what the owner still shows", async () => {
    const { onCommit, rerender, result } = setup();

    act(() => result.current.change("ab"));
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith("ab"));
    // Erased again before the owner showed "ab"
    act(() => result.current.change(""));
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith(""));

    // The owner shows the commits in order, late
    rerender({ value: "ab" });
    expect(result.current.value).toBe("");
    rerender({ value: "" });
    expect(result.current.value).toBe("");

    // And follows outside changes again afterwards
    rerender({ value: "xy" });
    expect(result.current.value).toBe("xy");
  });

  it("follows a value changed from outside", async () => {
    const { onCommit, rerender, result } = setup();

    act(() => result.current.change("ab"));
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith("ab"));

    // The back button - before the commit even arrived
    rerender({ value: "xy" });
    expect(result.current.value).toBe("xy");

    // The commit it replaced is forgotten - "ab" is the next outside change
    rerender({ value: "ab" });
    expect(result.current.value).toBe("ab");
  });

  it("drops a text still to be committed when the key resets it", () => {
    vi.useFakeTimers();
    try {
      const onCommit = vi.fn();
      const { rerender, result } = renderHook(
        ({ resetKey, value }) =>
          useDebouncedField(value, onCommit, 300, resetKey),
        { initialProps: { resetKey: 0, value: "" } },
      );

      act(() => result.current.change("abc"));
      // "Clear filters" before the text was committed - the value stays ""
      rerender({ resetKey: 1, value: "" });
      expect(result.current.value).toBe("");

      act(() => vi.advanceTimersByTime(500));
      expect(onCommit).not.toHaveBeenCalled();

      // Typing afterwards commits as before
      act(() => result.current.change("de"));
      act(() => vi.advanceTimersByTime(500));
      expect(onCommit).toHaveBeenLastCalledWith("de");
    } finally {
      vi.useRealTimers();
    }
  });
});
