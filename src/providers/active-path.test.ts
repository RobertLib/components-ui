import { describe, expect, it } from "vitest";
import { findActiveLink, isActivePath } from "./active-path";

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
    expect(isActivePath("/users", "#top")).toBe(false);
  });

  it("ignores percent-encoding and a trailing slash of the page", () => {
    // The browser and the routers give the path percent-encoded
    expect(isActivePath("/nastaven%C3%AD", "/nastavení")).toBe(true);
    expect(isActivePath("/nastavení", "/nastaven%C3%AD")).toBe(true);
    expect(
      isActivePath("/files/My%20Documents/cv", "/files/My Documents"),
    ).toBe(true);
    expect(isActivePath("/caf%c3%a9", "/café")).toBe(true);
    expect(isActivePath("/users/", "/users")).toBe(true);
    expect(isActivePath("/", "/users")).toBe(false);
  });

  it("resolves a relative path against the page, as the browser does", () => {
    expect(isActivePath("/projects/42/settings", "settings")).toBe(true);
    expect(isActivePath("/projects/42/settings", "overview")).toBe(false);
    expect(isActivePath("/projects/42/settings", "../42")).toBe(true);
  });

  it("matches no link with a scheme or a host", () => {
    expect(isActivePath("/users", "https://example.com/users")).toBe(false);
    expect(isActivePath("/users", "http://localhost/users")).toBe(false);
    expect(isActivePath("/users", "//example.com/users")).toBe(false);
    expect(isActivePath("/users", "/\\example.com/users")).toBe(false);
    expect(isActivePath("/users", "mailto:users@example.com")).toBe(false);
  });

  it("matches nothing without a page - on the server of the default adapter", () => {
    expect(isActivePath("", "/")).toBe(false);
  });
});

describe("findActiveLink", () => {
  const href = (item: { href?: string }) => item.href;

  it("picks the most specific link - the longest path", () => {
    const users = { href: "/users" };
    const newUser = { href: "/users/new" };
    expect(findActiveLink([users, newUser], href, "/users/new")).toBe(newUser);
    expect(findActiveLink([users, newUser], href, "/users/42")).toBe(users);
    expect(findActiveLink([users, newUser], href, "/orders")).toBeUndefined();
  });

  it("prefers the link whose query the page has, of links to one path", () => {
    const all = { href: "/tasks?filter=all" };
    const mine = { href: "/tasks?filter=mine" };
    const plain = { href: "/tasks" };

    expect(findActiveLink([all, mine], href, "/tasks", "?filter=mine")).toBe(
      mine,
    );
    // None of them fits the query - the first one
    expect(findActiveLink([all, mine], href, "/tasks", "?page=2")).toBe(all);
    expect(findActiveLink([all, mine], href, "/tasks/42")).toBe(all);
    // The page itself, without a query, over a link with one it lacks
    expect(findActiveLink([all, plain], href, "/tasks", "?filter=mine")).toBe(
      plain,
    );
  });
});
