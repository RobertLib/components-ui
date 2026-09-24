import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ColorSchemeScript from "../components/color-scheme-script";
import useColorScheme, { getColorSchemeScript } from "./use-color-scheme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The dark mode of the operating system, switched by the test. */
function stubSystemDark(initial: boolean) {
  let dark = initial;
  const listeners = new Set<() => void>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      get matches() {
        return query === DARK_QUERY && dark;
      },
      media: query,
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    })),
  );

  return (value: boolean) => {
    dark = value;
    listeners.forEach((listener) => listener());
  };
}

const root = document.documentElement;

afterEach(() => {
  vi.unstubAllGlobals();
  root.className = "";
  root.removeAttribute("style");
});

describe("useColorScheme", () => {
  it("follows the system while the scheme is system", () => {
    const setSystemDark = stubSystemDark(false);
    const { result } = renderHook(() => useColorScheme());

    expect(result.current.colorScheme).toBe("system");
    expect(result.current.resolvedColorScheme).toBe("light");
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");

    act(() => setSystemDark(true));
    expect(result.current.resolvedColorScheme).toBe("dark");
    expect(root).toHaveClass("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("applies and remembers the chosen scheme as plain text", () => {
    stubSystemDark(false);
    const { result } = renderHook(() => useColorScheme());

    act(() => result.current.setColorScheme("dark"));
    expect(result.current.colorScheme).toBe("dark");
    expect(root).toHaveClass("dark");
    expect(localStorage.getItem("color-scheme")).toBe("dark");

    act(() => result.current.setColorScheme("light"));
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
  });

  it("takes a storage key and a default scheme of its own", () => {
    stubSystemDark(false);
    const { result } = renderHook(() =>
      useColorScheme({ defaultColorScheme: "dark", storageKey: "crm-theme" }),
    );

    expect(result.current.colorScheme).toBe("dark");
    expect(root).toHaveClass("dark");

    act(() => result.current.setColorScheme("system"));
    expect(localStorage.getItem("crm-theme")).toBe("system");
    expect(root).not.toHaveClass("dark");
  });

  it("ignores a stored value that is no scheme", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubSystemDark(true);
    localStorage.setItem("color-scheme", '"dark"');

    const { result } = renderHook(() => useColorScheme());
    expect(result.current.colorScheme).toBe("system");
    expect(result.current.resolvedColorScheme).toBe("dark");
  });

  it("is shared by the components using it", () => {
    stubSystemDark(false);
    const { result } = renderHook(() => ({
      navbar: useColorScheme(),
      settings: useColorScheme(),
    }));

    act(() => result.current.settings.setColorScheme("dark"));
    expect(result.current.navbar.colorScheme).toBe("dark");
  });

  it("keeps the scheme the script applied while the page hydrates", async () => {
    stubSystemDark(false);

    function Page() {
      const { colorScheme } = useColorScheme();
      return <p>{colorScheme}</p>;
    }

    // The server cannot know the choice
    const html = renderToString(<Page />);
    expect(html).toContain("system");

    localStorage.setItem("color-scheme", "dark");
    new Function(getColorSchemeScript())();
    expect(root).toHaveClass("dark");

    const classNames: string[] = [];
    const observer = new MutationObserver(() =>
      classNames.push(root.className),
    );
    observer.observe(root, { attributeFilter: ["class"] });

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const hydrated = await act(async () =>
      hydrateRoot(container, <Page />, { onRecoverableError }),
    );
    observer.disconnect();

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("dark");
    // Never light for a moment
    expect(classNames.every((className) => className === "dark")).toBe(true);
    expect(root).toHaveClass("dark");

    act(() => hydrated.unmount());
    container.remove();
  });
});

describe("getColorSchemeScript", () => {
  const run = (script: string) => new Function(script)();

  it("applies the remembered scheme", () => {
    stubSystemDark(false);
    localStorage.setItem("color-scheme", "dark");

    run(getColorSchemeScript());
    expect(root).toHaveClass("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("falls back to the default scheme, and to the system for system", () => {
    stubSystemDark(true);

    run(getColorSchemeScript({ defaultColorScheme: "light" }));
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");

    localStorage.setItem("color-scheme", "nonsense");
    run(getColorSchemeScript());
    expect(root).toHaveClass("dark");
  });

  it("reads its own storage key, and survives a blocked storage", () => {
    stubSystemDark(false);
    localStorage.setItem("crm-theme", "dark");

    run(getColorSchemeScript({ storageKey: "crm-theme" }));
    expect(root).toHaveClass("dark");

    root.className = "";
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access is denied.", "SecurityError");
    });
    run(getColorSchemeScript({ defaultColorScheme: "dark" }));
    expect(root).toHaveClass("dark");
  });

  it("cannot end its script element early", () => {
    const script = getColorSchemeScript({ storageKey: "</script><b>" });
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c/script>");
  });
});

describe("ColorSchemeScript", () => {
  it("renders the script for the head of a server-rendered page", () => {
    const html = renderToString(
      <ColorSchemeScript nonce="abc" storageKey="crm-theme" />,
    );

    expect(html).toContain('nonce="abc"');
    expect(html).toContain('localStorage.getItem("crm-theme")');
    expect(html.startsWith("<script")).toBe(true);
  });
});
