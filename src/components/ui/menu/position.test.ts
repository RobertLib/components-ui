import { describe, expect, it, vi } from "vitest";
import {
  getArrowOffset,
  getClippingAncestors,
  getGracePolygon,
  isOutOfView,
  isPointInPolygon,
  isSameBox,
  measureAnchor,
  placeAtAnchor,
  placeSubmenu,
  pointRect,
  resolveSide,
} from "./position";

// The part of the page that is seen - all of a 1200 x 800 window
const viewport = { bottom: 800, left: 0, right: 1200, top: 0 };
const menu = { height: 200, width: 180 };

describe("placeAtAnchor", () => {
  it("opens below the pointer, from its left", () => {
    expect(
      placeAtAnchor(pointRect({ x: 100, y: 50 }), menu, viewport, 2),
    ).toEqual({ align: "start", left: 100, side: "bottom", top: 52 });
  });

  it("ends at the pointer near the right edge, and opens above it near the bottom", () => {
    expect(
      placeAtAnchor(pointRect({ x: 1150, y: 700 }), menu, viewport, 2),
    ).toEqual({ align: "end", left: 970, side: "top", top: 498 });
  });

  it("opens below a focused element, or above it without room", () => {
    const row = { bottom: 140, left: 20, right: 900, top: 100 };
    expect(placeAtAnchor(row, menu, viewport, 4)).toEqual({
      align: "start",
      left: 20,
      side: "bottom",
      top: 144,
    });

    const lastRow = { bottom: 780, left: 20, right: 900, top: 740 };
    expect(placeAtAnchor(lastRow, menu, viewport, 4)).toEqual({
      align: "start",
      left: 20,
      side: "top",
      top: 536,
    });
  });

  it("stays in the viewport when it fits on neither side", () => {
    expect(
      placeAtAnchor(
        pointRect({ x: 300, y: 150 }),
        { height: 500, width: 180 },
        { bottom: 600, left: 0, right: 1200, top: 0 },
        2,
      ),
    ).toEqual({ align: "start", left: 300, side: "bottom", top: 92 });
  });

  it("scrolls when it is taller than the viewport", () => {
    expect(
      placeAtAnchor(
        pointRect({ x: 300, y: 150 }),
        { height: 900, width: 180 },
        viewport,
        2,
      ),
    ).toEqual({
      align: "start",
      left: 300,
      maxHeight: 784,
      side: "bottom",
      top: 8,
    });
  });

  it("stays in the part of the page that is seen - above the on-screen keyboard, in a zoomed-in part", () => {
    // The keyboard covers all below 400
    expect(
      placeAtAnchor(
        pointRect({ x: 100, y: 300 }),
        menu,
        { ...viewport, bottom: 400 },
        2,
      ),
    ).toEqual({ align: "start", left: 100, side: "top", top: 98 });
    // Pinch zoom shows 400 x 300 from 600, 200
    const zoomed = { bottom: 500, left: 600, right: 1000, top: 200 };
    expect(
      placeAtAnchor(pointRect({ x: 950, y: 250 }), menu, zoomed, 2),
    ).toEqual({ align: "end", left: 770, side: "bottom", top: 252 });
    expect(
      // Near the right edge of what is seen, and moved up into it
      placeSubmenu(
        { bottom: 492, left: 850, right: 990, top: 460 },
        menu,
        zoomed,
      ),
    ).toEqual({
      align: "start",
      left: 666,
      side: "left",
      top: 292,
    });
  });
});

describe("placeAtAnchor right to left", () => {
  it("ends at the pointer, and starts there near the left edge", () => {
    expect(
      placeAtAnchor(pointRect({ x: 500, y: 50 }), menu, viewport, 2, true),
    ).toEqual({ align: "start", left: 320, side: "bottom", top: 52 });
    expect(
      placeAtAnchor(pointRect({ x: 100, y: 50 }), menu, viewport, 2, true),
    ).toEqual({ align: "end", left: 100, side: "bottom", top: 52 });
  });
});

describe("placeSubmenu right to left", () => {
  it("opens left of its item, and to the right near the left edge", () => {
    const item = { bottom: 132, left: 405, right: 595, top: 100 };
    expect(placeSubmenu(item, menu, viewport, true)).toEqual({
      align: "start",
      left: 221,
      side: "left",
      top: 95,
    });

    const nearEdge = { bottom: 132, left: 100, right: 290, top: 100 };
    expect(placeSubmenu(nearEdge, menu, viewport, true)).toEqual({
      align: "start",
      left: 294,
      side: "right",
      top: 95,
    });
  });

  it("opens below its item from its right with room on neither side", () => {
    const phoneItem = { bottom: 132, left: 170, right: 360, top: 100 };
    expect(
      placeSubmenu(
        phoneItem,
        menu,
        { bottom: 800, left: 0, right: 375, top: 0 },
        true,
      ),
    ).toEqual({ align: "start", left: 168, side: "bottom", top: 134 });
  });
});

describe("placeSubmenu", () => {
  const item = { bottom: 132, left: 405, right: 595, top: 100 };

  it("opens right of its item, its first item level with it", () => {
    expect(placeSubmenu(item, menu, viewport)).toEqual({
      align: "start",
      left: 599,
      side: "right",
      top: 95,
    });
  });

  it("opens to the left near the right edge of the viewport", () => {
    expect(
      placeSubmenu(item, menu, { bottom: 800, left: 0, right: 700, top: 0 }),
    ).toEqual({
      align: "start",
      left: 221,
      side: "left",
      top: 95,
    });
  });

  it("opens below its item with room on neither side", () => {
    const phoneItem = { bottom: 132, left: 170, right: 360, top: 100 };
    expect(
      placeSubmenu(phoneItem, menu, {
        bottom: 800,
        left: 0,
        right: 375,
        top: 0,
      }),
    ).toEqual({
      align: "start",
      left: 182,
      side: "bottom",
      top: 134,
    });
  });

  it("moves up into the viewport", () => {
    const lowItem = { bottom: 780, left: 405, right: 595, top: 748 };
    expect(placeSubmenu(lowItem, menu, viewport)).toEqual({
      align: "start",
      left: 599,
      side: "right",
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

describe("resolveSide", () => {
  it("turns start and end into the physical sides of the direction", () => {
    expect(resolveSide("start", false)).toBe("left");
    expect(resolveSide("end", false)).toBe("right");
    expect(resolveSide("start", true)).toBe("right");
    expect(resolveSide("end", true)).toBe("left");
  });

  it("keeps the physical sides as they are", () => {
    for (const side of ["top", "bottom", "left", "right"] as const) {
      expect(resolveSide(side, true)).toBe(side);
    }
  });
});

describe("measureAnchor", () => {
  it("measures an element, a rect and a point", () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      bottom: 40,
      height: 30,
      left: 20,
      right: 120,
      top: 10,
      width: 100,
    } as DOMRect);

    expect(measureAnchor(element)).toEqual({
      bottom: 40,
      height: 30,
      left: 20,
      right: 120,
      top: 10,
      width: 100,
    });
    expect(measureAnchor({ bottom: 60, left: 5, right: 25, top: 50 })).toEqual({
      bottom: 60,
      height: 10,
      left: 5,
      right: 25,
      top: 50,
      width: 20,
    });
    expect(measureAnchor({ x: 300, y: 200 })).toEqual({
      bottom: 200,
      height: 0,
      left: 300,
      right: 300,
      top: 200,
      width: 0,
    });
  });

  it("tells a box that did not move", () => {
    const box = measureAnchor({ x: 1, y: 2 });
    expect(isSameBox(box, { ...box })).toBe(true);
    expect(isSameBox(box, { ...box, top: 3 })).toBe(false);
    expect(isSameBox(null, box)).toBe(false);
  });
});

describe("isOutOfView", () => {
  // The viewport of jsdom is 1024 x 768
  it("tells an anchor scrolled out of the viewport", () => {
    const at = (top: number, left = 10) => ({
      bottom: top + 30,
      left,
      right: left + 80,
      top,
    });
    expect(isOutOfView(at(100), [])).toBe(false);
    // Partly in view still counts as in view
    expect(isOutOfView(at(-10), [])).toBe(false);
    expect(isOutOfView(at(-35), [])).toBe(true);
    expect(isOutOfView(at(800), [])).toBe(true);
    expect(isOutOfView(at(100, 1100), [])).toBe(true);
  });

  it("tells an anchor scrolled out of a container around it", () => {
    const list = document.createElement("div");
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      left: 0,
      right: 400,
      top: 100,
    } as DOMRect);

    const inside = { bottom: 150, left: 10, right: 90, top: 120 };
    const above = { bottom: 90, left: 10, right: 90, top: 60 };
    expect(isOutOfView(inside, [list])).toBe(false);
    expect(isOutOfView(above, [list])).toBe(true);
  });
});

describe("getClippingAncestors", () => {
  it("finds the scrolling ancestors, up to a fixed one", () => {
    document.body.innerHTML = `
      <div id="page" style="overflow: auto">
        <div id="fixed" style="position: fixed">
          <div id="plain">
            <div id="list" style="overflow-y: auto">
              <button id="anchor">Anchor</button>
            </div>
          </div>
        </div>
      </div>`;
    const anchor = document.getElementById("anchor")!;

    // Not the page around the fixed panel - it does not scroll with it
    expect(getClippingAncestors(anchor).map((element) => element.id)).toEqual([
      "list",
    ]);
    document.body.innerHTML = "";
  });
});

describe("getArrowOffset", () => {
  it("points at the center of the anchor, inside the panel's edge", () => {
    // Centered on a trigger from 100 to 140
    expect(getArrowOffset(100, 140, 50, 250, 12)).toBe(120);
    // A panel moved away along the edge - the arrow stays inside it
    expect(getArrowOffset(100, 140, 130, 330, 12)).toBe(142);
    expect(getArrowOffset(100, 140, -100, 110, 12)).toBe(98);
  });
});
