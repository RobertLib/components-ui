import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import useIsMobile from "./use-is-mobile";
import useMediaQuery from "./use-media-query";

/** A `matchMedia` whose queries the test switches. */
function stubMatchMedia(initial: Record<string, boolean> = {}) {
  const matches = { ...initial };
  const listeners = new Map<string, Set<() => void>>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: (_type: string, listener: () => void) => {
        const set = listeners.get(query) ?? new Set();
        set.add(listener);
        listeners.set(query, set);
      },
      get matches() {
        return matches[query] ?? false;
      },
      media: query,
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.get(query)?.delete(listener);
      },
    })),
  );

  return {
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
    set(query: string, value: boolean) {
      matches[query] = value;
      listeners.get(query)?.forEach((listener) => listener());
    },
  };
}

const WIDE = "(min-width: 1024px)";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("reads the query on the first render and follows its changes", () => {
    const media = stubMatchMedia({ [WIDE]: true });
    const { result } = renderHook(() => useMediaQuery(WIDE));

    expect(result.current).toBe(true);

    act(() => media.set(WIDE, false));
    expect(result.current).toBe(false);
  });

  it("listens to the new query when it changes, and to none once unmounted", () => {
    const media = stubMatchMedia({ "(prefers-contrast: more)": true });
    const { result, rerender, unmount } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: WIDE } },
    );

    expect(result.current).toBe(false);
    expect(media.listenerCount(WIDE)).toBe(1);

    rerender({ query: "(prefers-contrast: more)" });
    expect(result.current).toBe(true);
    expect(media.listenerCount(WIDE)).toBe(0);
    expect(media.listenerCount("(prefers-contrast: more)")).toBe(1);

    unmount();
    expect(media.listenerCount("(prefers-contrast: more)")).toBe(0);
  });

  it("renders the serverValue on the server, then hydrates to the real value", async () => {
    function Layout() {
      return useMediaQuery(WIDE, { serverValue: true }) ? "desktop" : "phone";
    }

    const html = renderToString(<Layout />);
    expect(html).toBe("desktop");

    stubMatchMedia({ [WIDE]: false });
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, <Layout />, { onRecoverableError }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("phone");

    act(() => root.unmount());
    container.remove();
  });

  it("answers width queries from the window width without matchMedia (jsdom)", () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.stubGlobal("innerWidth", 1280);

    const { result } = renderHook(() => ({
      narrow: useMediaQuery("(max-width: 767.98px)"),
      other: useMediaQuery("(hover: hover)", { serverValue: true }),
      wide: useMediaQuery(WIDE),
    }));

    expect(result.current).toEqual({ narrow: false, other: true, wide: true });

    act(() => {
      vi.stubGlobal("innerWidth", 500);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ narrow: true, other: true, wide: false });
  });
});

describe("useIsMobile", () => {
  it("matches below the md breakpoint", () => {
    const media = stubMatchMedia({ "(max-width: 767.98px)": true });
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);

    act(() => media.set("(max-width: 767.98px)", false));
    expect(result.current).toBe(false);
  });

  it("follows the window width without matchMedia, as it always did", () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.stubGlobal("innerWidth", 767);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);

    act(() => {
      vi.stubGlobal("innerWidth", 768);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });

  it("is false on the server", () => {
    function Probe() {
      return String(useIsMobile());
    }

    expect(renderToString(<Probe />)).toBe("false");
  });
});
