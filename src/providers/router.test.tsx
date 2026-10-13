import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserNavigate, useBrowserLocation } from "./router";
import UIProvider from "./ui-provider";
import { useRouter } from "./ui-context";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useBrowserLocation", () => {
  it("follows browserNavigate and the back button", () => {
    window.history.replaceState(null, "", "/users");
    const { result } = renderHook(() => useBrowserLocation());

    expect(result.current).toEqual({ pathname: "/users", search: "" });

    act(() => browserNavigate("/users/42?tab=notes"));
    expect(result.current).toEqual({
      pathname: "/users/42",
      search: "?tab=notes",
    });

    act(() => {
      window.history.replaceState(null, "", "/archive");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current).toEqual({ pathname: "/archive", search: "" });
  });

  it("observes History while any reader is mounted and restores it afterward", () => {
    const history = window.history;
    const originals = {
      pushState: Object.getOwnPropertyDescriptor(history, "pushState"),
      replaceState: Object.getOwnPropertyDescriptor(history, "replaceState"),
    };
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    const first = renderHook(() => useBrowserLocation());
    const second = renderHook(() => useBrowserLocation());

    act(() => history.pushState({ page: 2 }, "", "/shared?page=2"));
    expect(first.result.current).toEqual({
      pathname: "/shared",
      search: "?page=2",
    });
    expect(second.result.current).toEqual(first.result.current);
    expect(history.state).toEqual({ page: 2 });

    first.unmount();
    expect(history.pushState).not.toBe(pushState);
    act(() => history.replaceState(null, "", "/remaining"));
    expect(second.result.current.pathname).toBe("/remaining");

    second.unmount();
    expect(history.pushState).toBe(pushState);
    expect(history.replaceState).toBe(replaceState);
    expect(Object.getOwnPropertyDescriptor(history, "pushState")).toEqual(
      originals.pushState,
    );
    expect(Object.getOwnPropertyDescriptor(history, "replaceState")).toEqual(
      originals.replaceState,
    );
  });

  it("preserves History wrappers installed before and after subscribing", () => {
    const history = window.history;
    const original = history.pushState;
    const before = vi.spyOn(history, "pushState").mockImplementation(function (
      this: History,
      ...args
    ) {
      return original.apply(this, args);
    });
    const first = renderHook(() => useBrowserLocation());
    const observed = history.pushState;
    const after = vi.fn(function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      return observed.apply(this, args);
    });
    history.pushState = after;

    act(() => history.pushState(null, "", "/wrapped"));
    expect(first.result.current.pathname).toBe("/wrapped");
    expect(before).toHaveBeenCalledWith(null, "", "/wrapped");
    expect(after.mock.contexts[0]).toBe(history);
    first.unmount();
    expect(history.pushState).toBe(after);

    // The old observer retained by the outer wrapper is inactive. A new
    // reader still follows it and leaves the outer wrapper in place again.
    const second = renderHook(() => useBrowserLocation());
    act(() => history.pushState(null, "", "/wrapped-again"));
    expect(second.result.current.pathname).toBe("/wrapped-again");
    second.unmount();
    expect(history.pushState).toBe(after);
    before.mockRestore();
  });

  it("keeps History errors and continues observing successful writes", () => {
    window.history.replaceState(null, "", "/valid");
    const { result } = renderHook(() => useBrowserLocation());

    expect(() =>
      window.history.pushState(null, "", "https://another-origin.invalid/"),
    ).toThrow();
    expect(result.current.pathname).toBe("/valid");
    act(() => window.history.pushState(null, "", "/valid-again"));
    expect(result.current.pathname).toBe("/valid-again");
  });

  it("uses the Navigation API without wrapping History when available", () => {
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);
    const pushState = window.history.pushState;
    const { result, unmount } = renderHook(() => useBrowserLocation());

    expect(window.history.pushState).toBe(pushState);
    act(() => {
      window.history.pushState(null, "", "/navigation-api");
      navigation.dispatchEvent(new Event("currententrychange"));
    });
    expect(result.current.pathname).toBe("/navigation-api");
    unmount();
    vi.unstubAllGlobals();
  });
});

describe("browserNavigate", () => {
  it("adds a history entry or replaces the current one", () => {
    window.history.replaceState({ scroll: 10 }, "", "/a");
    const length = window.history.length;

    browserNavigate("/b");
    expect(window.location.pathname).toBe("/b");
    expect(window.history.length).toBe(length + 1);

    window.history.replaceState({ scroll: 20 }, "", "/b");
    browserNavigate("/c?x=1", { replace: true });
    expect(window.location.pathname + window.location.search).toBe("/c?x=1");
    expect(window.history.length).toBe(length + 1);
    // The state of the entry (e.g. of the app's router) stays
    expect(window.history.state).toEqual({ scroll: 20 });
  });
});

describe("a router given only as navigate", () => {
  function Location() {
    const router = useRouter();
    return (
      <button onClick={() => router.navigate("/orders?page=2")} type="button">
        {router.pathname + router.search}
      </button>
    );
  }

  it("is followed without the Navigation API", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/orders");
    // jsdom has no Navigation API, like Firefox before 2025 or Safari
    expect("navigation" in window).toBe(false);

    render(
      <UIProvider
        router={{
          // A router that changes the URL with the History API itself
          navigate: (href) => window.history.pushState(null, "", href),
        }}
      >
        <Location />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "/orders" }));
    expect(
      screen.getByRole("button", { name: "/orders?page=2" }),
    ).toBeInTheDocument();
  });

  it("follows the back button", () => {
    window.history.replaceState(null, "", "/orders");
    render(
      <UIProvider router={{ navigate() {} }}>
        <Location />
      </UIProvider>,
    );

    act(() => {
      window.history.replaceState(null, "", "/archive?page=3");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      screen.getByRole("button", { name: "/archive?page=3" }),
    ).toBeInTheDocument();
  });

  it("is followed when it changes the URL asynchronously", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/orders");

    render(
      <UIProvider
        router={{
          navigate: (href) =>
            queueMicrotask(() => window.history.pushState(null, "", href)),
        }}
      >
        <Location />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "/orders" }));
    expect(
      await screen.findByRole("button", { name: "/orders?page=2" }),
    ).toBeInTheDocument();
  });

  it.each(["pushState", "replaceState"] as const)(
    "follows delayed %s from a void-returning adapter",
    async (method) => {
      vi.useFakeTimers();
      window.history.replaceState(null, "", "/orders");
      render(
        <UIProvider
          router={{
            navigate: (href) => {
              setTimeout(() => window.history[method](null, "", href), 25);
            },
          }}
        >
          <Location />
        </UIProvider>,
      );

      act(() => screen.getByRole("button", { name: "/orders" }).click());
      await act(() => vi.advanceTimersByTimeAsync(24));
      expect(
        screen.getByRole("button", { name: "/orders" }),
      ).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(
        screen.getByRole("button", { name: "/orders?page=2" }),
      ).toBeInTheDocument();
      vi.useRealTimers();
    },
  );
});

describe("a router given with its location", () => {
  /** Tells each render - a `Profiler` misses one a context change causes. */
  function Location({ onRender }: { onRender: (location: string) => void }) {
    const { pathname, search } = useRouter();
    onRender(pathname + search);
    return null;
  }

  it("renders nothing again for a change of the URL it has not given yet", () => {
    const rendered = vi.fn();
    window.history.replaceState(null, "", "/a");
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    render(
      <UIProvider router={{ navigate() {}, pathname: "/a", search: "" }}>
        <Location onRender={rendered} />
      </UIProvider>,
    );
    expect(window.history.pushState).toBe(pushState);
    expect(window.history.replaceState).toBe(replaceState);
    rendered.mockClear();

    // The router renders the new location itself - a render before it would
    // show its old one again
    act(() => {
      window.history.pushState(null, "", "/b?page=2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    act(() => browserNavigate("/c"));
    expect(rendered).not.toHaveBeenCalled();
  });

  it("hydrates in one render", async () => {
    const rendered = vi.fn();
    window.history.replaceState(null, "", "/orders");
    const page = (
      <UIProvider router={{ navigate() {}, pathname: "/orders", search: "" }}>
        <Location onRender={rendered} />
      </UIProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);
    rendered.mockClear();

    const root = await act(async () => hydrateRoot(container, page));
    expect(rendered).toHaveBeenCalledOnce();
    expect(rendered).toHaveBeenCalledWith("/orders");

    act(() => root.unmount());
    container.remove();
  });
});
