import { describe, expect, it } from "vitest";
import {
  getGracePolygon,
  isPointInPolygon,
  placeAtAnchor,
  placeSubmenu,
  pointRect,
} from "./position";

const viewport = { height: 800, width: 1200 };
const menu = { height: 200, width: 180 };

describe("placeAtAnchor", () => {
  it("opens below the pointer, from its left", () => {
    expect(
      placeAtAnchor(pointRect({ x: 100, y: 50 }), menu, viewport, 2),
    ).toEqual({ left: 100, top: 52 });
  });

  it("ends at the pointer near the right edge, and opens above it near the bottom", () => {
    expect(
      placeAtAnchor(pointRect({ x: 1150, y: 700 }), menu, viewport, 2),
    ).toEqual({ left: 970, top: 498 });
  });

  it("opens below a focused element, or above it without room", () => {
    const row = { bottom: 140, left: 20, right: 900, top: 100 };
    expect(placeAtAnchor(row, menu, viewport, 4)).toEqual({
      left: 20,
      top: 144,
    });

    const lastRow = { bottom: 780, left: 20, right: 900, top: 740 };
    expect(placeAtAnchor(lastRow, menu, viewport, 4)).toEqual({
      left: 20,
      top: 536,
    });
  });

  it("stays in the viewport when it fits on neither side", () => {
    expect(
      placeAtAnchor(
        pointRect({ x: 300, y: 150 }),
        { height: 500, width: 180 },
        { height: 600, width: 1200 },
        2,
      ),
    ).toEqual({ left: 300, top: 92 });
  });

  it("scrolls when it is taller than the viewport", () => {
    expect(
      placeAtAnchor(
        pointRect({ x: 300, y: 150 }),
        { height: 900, width: 180 },
        viewport,
        2,
      ),
    ).toEqual({ left: 300, maxHeight: 784, top: 8 });
  });
});

describe("placeSubmenu", () => {
  const item = { bottom: 132, left: 405, right: 595, top: 100 };

  it("opens right of its item, its first item level with it", () => {
    expect(placeSubmenu(item, menu, viewport)).toEqual({ left: 599, top: 95 });
  });

  it("opens to the left near the right edge of the viewport", () => {
    expect(placeSubmenu(item, menu, { height: 800, width: 700 })).toEqual({
      left: 221,
      top: 95,
    });
  });

  it("opens below its item with room on neither side", () => {
    const phoneItem = { bottom: 132, left: 170, right: 360, top: 100 };
    expect(placeSubmenu(phoneItem, menu, { height: 800, width: 375 })).toEqual({
      left: 182,
      top: 134,
    });
  });

  it("moves up into the viewport", () => {
    const lowItem = { bottom: 780, left: 405, right: 595, top: 748 };
    expect(placeSubmenu(lowItem, menu, viewport)).toEqual({
      left: 599,
      top: 592,
    });
  });
});

describe("the grace area of a submenu", () => {
  const submenu = { bottom: 300, left: 600, right: 780, top: 100 };
  const polygon = getGracePolygon({ x: 590, y: 120 }, submenu);

  it("covers the way to the submenu and the submenu itself", () => {
    expect(isPointInPolygon({ x: 595, y: 125 }, polygon)).toBe(true);
    expect(isPointInPolygon({ x: 598, y: 200 }, polygon)).toBe(true);
    expect(isPointInPolygon({ x: 700, y: 250 }, polygon)).toBe(true);
  });

  it("leaves out moves away from it", () => {
    expect(isPointInPolygon({ x: 560, y: 150 }, polygon)).toBe(false);
    expect(isPointInPolygon({ x: 595, y: 320 }, polygon)).toBe(false);
  });

  it("points left to a submenu on the left", () => {
    const left = getGracePolygon(
      { x: 610, y: 120 },
      { bottom: 300, left: 420, right: 600, top: 100 },
    );
    expect(isPointInPolygon({ x: 605, y: 125 }, left)).toBe(true);
    expect(isPointInPolygon({ x: 640, y: 125 }, left)).toBe(false);
  });
});
