import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { browserNavigate, isActivePath, useBrowserLocation } from "./router";
import UIProvider from "./ui-provider";
import { useRouter } from "./ui-context";

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

describe("isActivePath", () => {
  it("matches the page and its sub-pages only", () => {
    expect(isActivePath("/users", "/users")).toBe(true);
    expect(isActivePath("/users/42", "/users")).toBe(true);
    expect(isActivePath("/users/42", "/users/")).toBe(true);
    expect(isActivePath("/users-archive", "/users")).toBe(false);
    expect(isActivePath("/users", "/users?tab=all#top")).toBe(true);
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/users", "/")).toBe(false);
    expect(isActivePath("/users", "")).toBe(false);
    expect(isActivePath("/users", "?tab=all")).toBe(false);
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
});
