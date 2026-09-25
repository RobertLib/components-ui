import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import useLocalStorage from "./use-local-storage";

// Values that could not be saved last until the page is reloaded - every
// test uses keys of its own

/** Another tab of the app writing `value` (or removing it with `null`). */
function writeFromOtherTab(key: string | null, value: string | null) {
  if (key === null) localStorage.clear();
  else if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);

  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue: value,
      storageArea: localStorage,
    }),
  );
}

describe("useLocalStorage", () => {
  it("returns the default value while nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("empty", 25));

    expect(result.current[0]).toBe(25);
    expect(localStorage.getItem("empty")).toBeNull();
  });

  it("reads and writes the value as JSON", () => {
    localStorage.setItem("filters", JSON.stringify({ status: "open" }));
    const { result } = renderHook(() =>
      useLocalStorage("filters", { status: "all" }),
    );

    expect(result.current[0]).toEqual({ status: "open" });

    act(() => result.current[1]({ status: "closed" }));
    expect(result.current[0]).toEqual({ status: "closed" });
    expect(localStorage.getItem("filters")).toBe('{"status":"closed"}');
  });

  it("returns the same object while the stored text stays", () => {
    localStorage.setItem("columns", '["name","email"]');
    const { rerender, result } = renderHook(() =>
      useLocalStorage<string[]>("columns", []),
    );
    const first = result.current[0];

    rerender();
    expect(result.current[0]).toBe(first);
  });

  it("applies updater functions to the latest value", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      result.current[1]((count) => count + 1);
      result.current[1]((count) => count + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem("count")).toBe("2");
  });

  it("removes the value - with remove() or undefined", () => {
    localStorage.setItem("view", '"cards"');
    const { result } = renderHook(() =>
      useLocalStorage<string | undefined>("view", "table"),
    );
    expect(result.current[0]).toBe("cards");

    act(() => result.current[2]());
    expect(result.current[0]).toBe("table");
    expect(localStorage.getItem("view")).toBeNull();

    act(() => result.current[1]("list"));
    act(() => result.current[1](undefined));
    expect(result.current[0]).toBe("table");
    expect(localStorage.getItem("view")).toBeNull();
  });

  it("keeps the setter and the removal the same between renders", () => {
    const { rerender, result } = renderHook(() =>
      useLocalStorage("stable", ""),
    );
    const [, setValue, remove] = result.current;

    rerender();
    expect(result.current[1]).toBe(setValue);
    expect(result.current[2]).toBe(remove);
  });

  it("shares the value between the hooks with the same key", () => {
    const { result } = renderHook(() => ({
      first: useLocalStorage("shared", "a"),
      other: useLocalStorage("other-key", "a"),
      second: useLocalStorage("shared", "a"),
    }));

    act(() => result.current.first[1]("b"));

    expect(result.current.second[0]).toBe("b");
    expect(result.current.other[0]).toBe("a");
  });

  it("follows the changes made in other tabs", () => {
    const { result } = renderHook(() => useLocalStorage("tabs", "light"));

    act(() => writeFromOtherTab("tabs", '"dark"'));
    expect(result.current[0]).toBe("dark");

    act(() => writeFromOtherTab("unrelated", '"x"'));
    expect(result.current[0]).toBe("dark");

    // Cleared storage - `key` is null
    act(() => writeFromOtherTab(null, null));
    expect(result.current[0]).toBe("light");
  });

  it("returns the default value for text it cannot read", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("broken", "{not json");

    const { rerender, result } = renderHook(() =>
      useLocalStorage("broken", { page: 1 }),
    );
    rerender();

    expect(result.current[0]).toEqual({ page: 1 });
    // Once for the text, not on every render
    expect(warn).toHaveBeenCalledTimes(1);

    act(() => result.current[1]({ page: 2 }));
    expect(result.current[0]).toEqual({ page: 2 });
  });

  it("keeps a stored null - a deserialize that checks the shape gives the default", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("columns", "null");

    // `null` is JSON, and may be the value on purpose
    const { result: plain } = renderHook(() =>
      useLocalStorage<string[] | null>("columns", ["name"]),
    );
    expect(plain.current[0]).toBeNull();

    const { result: checked } = renderHook(() =>
      useLocalStorage<string[]>("columns", ["name"], {
        deserialize: (text) => {
          const value: unknown = JSON.parse(text);
          if (!Array.isArray(value)) throw new Error("No list");
          return value as string[];
        },
      }),
    );
    expect(checked.current[0]).toEqual(["name"]);
  });

  it("uses a custom serialize and deserialize", () => {
    localStorage.setItem("since", "2026-09-24");
    const { result } = renderHook(() =>
      useLocalStorage("since", new Date(2026, 0, 1), {
        deserialize: (stored) => new Date(`${stored}T00:00`),
        serialize: (date) => date.toISOString().slice(0, 10),
      }),
    );

    expect(result.current[0].getDate()).toBe(24);

    act(() => result.current[1](new Date(Date.UTC(2026, 9, 1))));
    expect(localStorage.getItem("since")).toBe("2026-10-01");
  });

  it("keeps a value it cannot save until the page is reloaded", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError",
        );
      });

    const { result } = renderHook(() => ({
      first: useLocalStorage("quota", "compact"),
      second: useLocalStorage("quota", "compact"),
    }));

    act(() => result.current.first[1]("comfortable"));

    expect(result.current.first[0]).toBe("comfortable");
    expect(result.current.second[0]).toBe("comfortable");
    expect(error).toHaveBeenCalled();

    // Saved again once the storage works
    setItem.mockRestore();
    act(() => result.current.first[1]("spacious"));
    expect(localStorage.getItem("quota")).toBe('"spacious"');
  });

  it("returns the default value when the storage cannot be read", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access is denied.", "SecurityError");
    });

    const { result } = renderHook(() => useLocalStorage("blocked", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("renders the default value on the server and hydrates to the stored one", async () => {
    function Density() {
      const [density] = useLocalStorage("density", "comfortable");
      return <span>{density}</span>;
    }

    const html = renderToString(<Density />);
    expect(html).toContain("comfortable");

    localStorage.setItem("density", '"compact"');
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, <Density />, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("compact");

    act(() => root.unmount());
    container.remove();
  });
});
