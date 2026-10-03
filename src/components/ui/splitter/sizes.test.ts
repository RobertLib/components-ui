import { describe, expect, it } from "vitest";
import {
  fitSizes,
  getPairRange,
  normalizeSizes,
  resetPair,
  resizeTo,
  stepSize,
  type PaneLimits,
} from "./sizes";

const limits = (
  overrides: Partial<PaneLimits> = {},
  count = 2,
): PaneLimits => ({
  collapsible: Array.from({ length: count }, () => false),
  max: Array.from({ length: count }, () => 100),
  min: Array.from({ length: count }, () => 0),
  ...overrides,
});

describe("normalizeSizes", () => {
  it("scales sizes to add up to 100", () => {
    expect(normalizeSizes([1, 3], 2)).toEqual([25, 75]);
    expect(normalizeSizes([30, 70], 2)).toEqual([30, 70]);
  });

  it("falls back to equal sizes when they do not fit", () => {
    expect(normalizeSizes(undefined, 4)).toEqual([25, 25, 25, 25]);
    expect(normalizeSizes([50, 50], 3)).toEqual([100 / 3, 100 / 3, 100 / 3]);
    expect(normalizeSizes([-10, 110], 2)).toEqual([50, 50]);
    expect(normalizeSizes([0, 0], 2)).toEqual([50, 50]);
    expect(normalizeSizes([Number.NaN, 50], 2)).toEqual([50, 50]);
  });
});

describe("fitSizes", () => {
  it("leaves sizes within the limits as they are", () => {
    const sizes = [30, 70];
    expect(fitSizes(sizes, limits({ min: [20, 20] }))).toBe(sizes);
  });

  it("moves a pane into its limits - the others make up for it", () => {
    expect(fitSizes([5, 95], limits({ min: [20, 20] }))).toEqual([20, 80]);
    expect(fitSizes([90, 10], limits({ max: [60, 100] }))).toEqual([60, 40]);
    // Each as much as it has room for
    expect(
      fitSizes(
        [10, 45, 45],
        limits({ max: [100, 50, 100], min: [30, 0, 0] }, 3),
      ),
    ).toEqual([30, 35, 35]);
  });

  it("keeps a collapsed pane that may collapse collapsed", () => {
    expect(
      fitSizes([0, 100], limits({ collapsible: [true, false], min: [20, 0] })),
    ).toEqual([0, 100]);
    // One that may not comes back at its minimum
    expect(fitSizes([0, 100], limits({ min: [20, 0] }))).toEqual([20, 80]);
  });

  it("keeps limits that cannot all hold as far as they go", () => {
    const [first, second] = fitSizes([50, 50], limits({ min: [70, 70] }));
    expect(first + second).toBeCloseTo(100);
    expect(first).toBeCloseTo(50);
  });
});

describe("getPairRange", () => {
  it("keeps both panes of a handle within their limits", () => {
    const range = getPairRange(
      [20, 50, 30],
      1,
      limits({ max: [100, 60, 100], min: [0, 10, 25] }, 3),
    );

    // Panes 2 and 3 share 80 - pane 2 needs 10 and may have 60, pane 3
    // needs 25
    expect(range).toMatchObject({ max: 55, min: 10, total: 80 });

    // A maximum of the other pane raises the minimum
    expect(
      getPairRange([50, 50], 0, limits({ max: [100, 70], min: [10, 0] })).min,
    ).toBe(30);
  });

  it("collapses only where the other pane can take all the space", () => {
    const range = getPairRange(
      [30, 70],
      0,
      limits({ collapsible: [true, true], max: [100, 80] }),
    );

    expect(range.canCollapsePrimary).toBe(false);
    expect(range.canCollapseSecondary).toBe(true);
  });
});

describe("resizeTo", () => {
  it("clamps to the limits of both panes", () => {
    const paneLimits = limits({ max: [70, 100], min: [20, 0] });

    expect(resizeTo([50, 50], 0, 10, paneLimits)).toEqual([20, 80]);
    expect(resizeTo([50, 50], 0, 90, paneLimits)).toEqual([70, 30]);
    expect(resizeTo([50, 50], 0, 40, paneLimits)).toEqual([40, 60]);
  });

  it("collapses a collapsible pane dragged below half its minimum", () => {
    const paneLimits = limits({ collapsible: [true, false], min: [20, 0] });

    expect(resizeTo([50, 50], 0, 12, paneLimits)).toEqual([20, 80]);
    expect(resizeTo([50, 50], 0, 8, paneLimits)).toEqual([0, 100]);
  });

  it("leaves the other panes alone", () => {
    expect(resizeTo([20, 50, 30], 1, 30, limits({}, 3))).toEqual([20, 30, 50]);
  });
});

describe("stepSize", () => {
  const paneLimits = limits({ collapsible: [true, true], min: [20, 10] });

  it("stops at the minimum, then collapses", () => {
    expect(stepSize([25, 75], 0, -10, paneLimits)).toEqual([20, 80]);
    expect(stepSize([20, 80], 0, -10, paneLimits)).toEqual([0, 100]);
    // Back at its minimum
    expect(stepSize([0, 100], 0, 1, paneLimits)).toEqual([20, 80]);
  });

  it("collapses the other pane from the maximum and brings it back", () => {
    expect(stepSize([85, 15], 0, 10, paneLimits)).toEqual([90, 10]);
    expect(stepSize([90, 10], 0, 1, paneLimits)).toEqual([100, 0]);
    expect(stepSize([100, 0], 0, -1, paneLimits)).toEqual([90, 10]);
  });

  it("does not collapse a pane that may not", () => {
    expect(stepSize([20, 80], 0, -1, limits({ min: [20, 0] }))).toEqual([
      20, 80,
    ]);
  });
});

describe("resetPair", () => {
  it("brings back the ratio of the default sizes of the two panes", () => {
    // The pair shares 60 now - 1 : 2 as by default
    expect(resetPair([10, 50, 40], 0, [20, 40, 40], limits({}, 3))).toEqual([
      20, 40, 40,
    ]);
  });
});
