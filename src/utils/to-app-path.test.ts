import { describe, expect, it } from "vitest";
import toAppPath from "./to-app-path";

describe("toAppPath", () => {
  it("leaves a link in the app as it is", () => {
    expect(toAppPath("/orders/42?tab=items#notes")).toBe(
      "/orders/42?tab=items#notes",
    );
    expect(toAppPath("orders/42")).toBe("orders/42");
    expect(toAppPath("?page=2")).toBe("?page=2");
    expect(toAppPath("#notes")).toBe("#notes");
  });

  it("gives the path as the browser reads it - without spaces and controls around it, nor tabs and line breaks in it", () => {
    // A router would take ` /orders` for a path relative to the page
    expect(toAppPath(" /orders")).toBe("/orders");
    expect(toAppPath("/orders \n")).toBe("/orders");
    expect(toAppPath("\u0000/orders\u001f")).toBe("/orders");
    expect(toAppPath("/or\tders?pa\nge=2\r")).toBe("/orders?page=2");
    // Spaces in it stay - they are a part of the path
    expect(toAppPath("/my orders")).toBe("/my orders");
  });

  it("gives no path for a URL of the page's own origin - its path has the base path of the router", () => {
    const { origin, host } = window.location;
    expect(toAppPath(`${origin}/app/orders/42`)).toBeNull();
    expect(toAppPath(`//${host}/app/orders/42`)).toBeNull();
  });

  it("gives no path for a link out of the app", () => {
    expect(toAppPath("https://example.com/orders")).toBeNull();
    expect(toAppPath("//example.com/orders")).toBeNull();
    // The browser reads the backslash as a slash - another origin
    expect(toAppPath("/\\example.com/orders")).toBeNull();
    expect(toAppPath("mailto:jana@example.com")).toBeNull();
    expect(toAppPath("tel:+420123456789")).toBeNull();
    expect(toAppPath("javascript:alert(1)")).toBeNull();
    // Also with what the browser drops around and in it
    expect(toAppPath(" https://example.com/orders")).toBeNull();
    expect(toAppPath("\t//example.com/orders")).toBeNull();
    expect(toAppPath("java\nscript:alert(1)")).toBeNull();
  });
});
