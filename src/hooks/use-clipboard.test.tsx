import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useClipboard from "./use-clipboard";

/** Gives the page a Clipboard API - `undefined` takes it away (http://). */
function setClipboard(clipboard: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
}

/** A promise the test settles. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

afterEach(() => {
  setClipboard(undefined);
  vi.useRealTimers();
});

describe("useClipboard", () => {
  it("copies the text and says so for the timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    const { result } = renderHook(() => useClipboard({ timeout: 1000 }));

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy("IBAN CZ65 0800");
    });

    expect(writeText).toHaveBeenCalledWith("IBAN CZ65 0800");
    expect(copied).toBe(true);
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => vi.advanceTimersByTime(999));
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copied).toBe(false);
  });

  it("calls the Clipboard API right away, within the user action", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    const { result } = renderHook(() => useClipboard());

    let copying: Promise<boolean> | undefined;
    act(() => {
      copying = result.current.copy("now");
    });
    expect(writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      await copying;
    });
  });

  it("reports a failure without rejecting", async () => {
    const denied = new DOMException(
      "Write permission denied.",
      "NotAllowedError",
    );
    setClipboard({ writeText: vi.fn(() => Promise.reject(denied)) });
    const { result } = renderHook(() => useClipboard());

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy("secret");
    });

    expect(copied).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe(denied);

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it("shows the result of the last copy only", async () => {
    const first = deferred();
    const second = deferred();
    setClipboard({
      writeText: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    });
    const { result } = renderHook(() => useClipboard());

    let firstCopy: Promise<boolean> | undefined;
    let secondCopy: Promise<boolean> | undefined;
    act(() => {
      firstCopy = result.current.copy("first");
      secondCopy = result.current.copy("second");
    });

    await act(async () => {
      second.resolve();
      await secondCopy;
    });
    expect(result.current.copied).toBe(true);

    // The older copy failing late changes nothing
    await act(async () => {
      first.reject(new Error("Late failure"));
      await firstCopy;
    });
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("copies with the old command where the Clipboard API is missing", async () => {
    setClipboard(undefined);
    const copiedTexts: string[] = [];
    const execCommand = vi.fn(() => {
      // What the browser does on the command - fire the copy event
      const data = new Map<string, string>();
      const event = Object.assign(new Event("copy", { cancelable: true }), {
        clipboardData: {
          setData: (type: string, text: string) => data.set(type, text),
        },
      });
      document.dispatchEvent(event);
      copiedTexts.push(data.get("text/plain") ?? "");
      return true;
    });
    document.execCommand = execCommand;
    const { result } = renderHook(() => useClipboard());

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy("line 1\nline 2");
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copiedTexts).toEqual(["line 1\nline 2"]);
    expect(copied).toBe(true);
    // The text it selected is gone again
    expect(document.body).not.toHaveTextContent("line 1");
  });

  it("fails where even the old command is refused", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn(() => false);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("text");
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.copied).toBe(false);
  });

  it("copies with the old command where the Clipboard API refuses", async () => {
    // A frame without the `clipboard-write` permission
    const denied = new DOMException(
      "Write permission denied.",
      "NotAllowedError",
    );
    setClipboard({ writeText: vi.fn(() => Promise.reject(denied)) });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    const { result } = renderHook(() => useClipboard());

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy("text");
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe(true);
    expect(result.current.error).toBeNull();

    // Refused there too - the error of the Clipboard API tells why
    document.execCommand = vi.fn(() => false);
    await act(async () => {
      copied = await result.current.copy("text");
    });
    expect(copied).toBe(false);
    expect(result.current.error).toBe(denied);
  });
});
