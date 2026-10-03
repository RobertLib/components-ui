import { act, render } from "@testing-library/react";
import { Activity, StrictMode, createRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import useLocalStorage, {
  type UseLocalStorageOptions,
  type UseLocalStorageResult,
} from "./use-local-storage";

interface HarnessProps {
  defaultValue: number;
  options?: UseLocalStorageOptions<number>;
  ref: React.Ref<UseLocalStorageResult<number>>;
  storageKey: string;
}

function Harness({ defaultValue, options, ref, storageKey }: HarnessProps) {
  const stored = useLocalStorage(storageKey, defaultValue, options);
  useImperativeHandle(ref, () => stored, [stored]);
  return <span>{stored[0]}</span>;
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

describe("useLocalStorage with Activity", () => {
  it.each(["replace", "remove", "clear"] as const)(
    "follows another tab's %s after a failed write while hidden",
    async (operation) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const ref = createRef<UseLocalStorageResult<number>>();
      const props = {
        defaultValue: 0,
        ref,
        storageKey: `hidden-failed-write-${operation}`,
      };
      localStorage.setItem(props.storageKey, "10");
      const { rerender } = render(content("visible", props));
      const write = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementationOnce(() => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        });
      act(() => ref.current![1](1));
      write.mockRestore();
      expect(ref.current![0]).toBe(1);

      await act(async () => rerender(content("hidden", props)));
      act(() => {
        if (operation === "replace")
          localStorage.setItem(props.storageKey, "2");
        else if (operation === "remove")
          localStorage.removeItem(props.storageKey);
        else localStorage.clear();
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: operation === "clear" ? null : props.storageKey,
            newValue: operation === "replace" ? "2" : null,
            storageArea: localStorage,
          }),
        );
      });
      await act(async () => rerender(content("visible", props)));

      expect(ref.current![0]).toBe(operation === "replace" ? 2 : 0);
    },
  );

  it("uses another tab's newer value for an updater while still hidden", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ref = createRef<UseLocalStorageResult<number>>();
    const props = { defaultValue: 0, ref, storageKey: "hidden-failed-updater" };
    const { rerender } = render(content("visible", props));
    const setValue = ref.current![1];
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    act(() => setValue(1));
    write.mockRestore();
    await act(async () => rerender(content("hidden", props)));

    act(() => {
      localStorage.setItem(props.storageKey, "2");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: props.storageKey,
          newValue: "2",
          storageArea: localStorage,
        }),
      );
    });
    await act(async () => setValue((value) => value + 1));

    expect(localStorage.getItem(props.storageKey)).toBe("3");
    await act(async () => rerender(content("visible", props)));
    expect(ref.current![0]).toBe(3);
  });

  it("keeps an unsaved value across unrelated and sessionStorage events while hidden", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ref = createRef<UseLocalStorageResult<number>>();
    const props = {
      defaultValue: 0,
      ref,
      storageKey: "hidden-failed-isolation",
    };
    const { rerender } = render(content("visible", props));
    const setValue = ref.current![1];
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    act(() => setValue(1));
    write.mockRestore();
    await act(async () => rerender(content("hidden", props)));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "unrelated-hidden-key",
          newValue: "2",
          storageArea: localStorage,
        }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: null, storageArea: sessionStorage }),
      );
    });
    await act(async () => rerender(content("visible", props)));

    expect(ref.current![0]).toBe(1);
    act(() => setValue((value) => value + 1));
    expect(localStorage.getItem(props.storageKey)).toBe("2");
  });

  it("uses the default value committed while hidden for a pending update", async () => {
    const ref = createRef<UseLocalStorageResult<number>>();
    const props = { defaultValue: 1, ref, storageKey: "hidden-default" };
    const { rerender } = render(content("visible", props));
    const setValue = ref.current![1];

    await act(async () => rerender(content("hidden", props)));
    const updated = { ...props, defaultValue: 100 };
    await act(async () => rerender(content("hidden", updated)));
    await act(async () => setValue((value) => value + 1));

    expect(localStorage.getItem(props.storageKey)).toBe("101");
    rerender(content("visible", updated));
    expect(ref.current![0]).toBe(101);
    expect(ref.current![1]).toBe(setValue);
  });

  it.each(["update", "replace"] as const)(
    "uses serialization committed while hidden for a pending %s",
    async (operation) => {
      const ref = createRef<UseLocalStorageResult<number>>();
      const props = {
        defaultValue: 0,
        options: {
          deserialize: (text: string) => Number(text),
          serialize: (value: number) => String(value),
        },
        ref,
        storageKey: `hidden-serialization-${operation}`,
      };
      localStorage.setItem(props.storageKey, "3");
      const { rerender } = render(content("visible", props));
      const setValue = ref.current![1];

      await act(async () => rerender(content("hidden", props)));
      const updated = {
        ...props,
        options: {
          deserialize: (text: string) => Number(text) * 2,
          serialize: (value: number) => String(value / 2),
        },
      };
      await act(async () => rerender(content("hidden", updated)));
      await act(async () => {
        if (operation === "update") setValue((value) => value + 2);
        else setValue(8);
      });

      expect(localStorage.getItem(props.storageKey)).toBe("4");
      await act(async () => setValue((value) => value + 2));
      expect(localStorage.getItem(props.storageKey)).toBe("5");
      rerender(content("visible", updated));
      expect(ref.current![0]).toBe(10);
      expect(ref.current![1]).toBe(setValue);
    },
  );
});
