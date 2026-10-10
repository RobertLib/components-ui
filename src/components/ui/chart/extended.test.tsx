import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Chart from "../chart";
const series = [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
];

describe("extended charts", () => {
  it.each([10, -10, 0])(
    "keeps a flat nonzero line within its scale (%s)",
    (value) => {
      const { container } = render(
        <Chart
          data={[
            { label: "Jan", a: value },
            { label: "Feb", a: value },
          ]}
          series={series.slice(0, 1)}
          title="Flat"
        />,
      );
      const points = container
        .querySelector("polyline")!
        .getAttribute("points")!
        .split(" ")
        .map((point) => Number(point.split(",")[1]));
      expect(points.every((y) => y > 16 && y < 272)).toBe(true);
    },
  );
  it("stacks positive and negative bars separately and scales to their sums", () => {
    const { container } = render(
      <Chart
        data={[
          { label: "Jan", a: 10, b: 20 },
          { label: "Feb", a: -5, b: -10 },
        ]}
        series={series}
        stacked
        title="Stacked"
        type="bar"
      />,
    );
    const bars = [...container.querySelectorAll("svg > g > rect")].filter(
      (bar) => !bar.hasAttribute("data-chart-point"),
    );
    expect(bars).toHaveLength(4);
    expect(bars[0].getAttribute("x")).toBe(bars[2].getAttribute("x"));
    expect(
      Number(bars[2].getAttribute("y")) +
        Number(bars[2].getAttribute("height")),
    ).toBeCloseTo(Number(bars[0].getAttribute("y")));
    expect(
      Number(bars[1].getAttribute("y")) +
        Number(bars[1].getAttribute("height")),
    ).toBeCloseTo(Number(bars[3].getAttribute("y")));
    expect(container.querySelector("svg")!.outerHTML).not.toMatch(
      /NaN|Infinity/,
    );
  });
  it("renders mixed series and stacked areas without bridging gaps", () => {
    const { container, rerender } = render(
      <Chart
        data={[
          { label: "Jan", a: 10, b: 20 },
          { label: "Feb", a: 15, b: 25 },
        ]}
        series={[
          { ...series[0], type: "bar" },
          { ...series[1], type: "line" },
        ]}
        title="Mixed"
        type="mixed"
      />,
    );
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    expect(container.querySelectorAll("svg[role=group] circle")).toHaveLength(
      2,
    );
    rerender(
      <Chart
        data={[
          { label: "Jan", a: 10, b: 20 },
          { label: "Feb", a: 15, b: null },
          { label: "Mar", a: 20, b: 30 },
        ]}
        series={series}
        stacked
        title="Areas"
        type="area"
      />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(3);
  });
  it.each(["pie", "donut"] as const)(
    "draws accessible %s sectors, ignores nonpositive values and toggles categories",
    (type) => {
      const { container } = render(
        <Chart
          data={[
            { label: "One", a: 10 },
            { label: "Two", a: 20 },
            { label: "Negative", a: -5 },
            { label: "Zero", a: 0 },
          ]}
          series={series.slice(0, 1)}
          title="Share"
          type={type}
        />,
      );
      expect(screen.getAllByRole("img")).toHaveLength(2);
      // The legend offers only what the chart can draw
      expect(
        screen.queryByRole("button", { name: "Negative" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Zero" }),
      ).not.toBeInTheDocument();
      const first = screen.getByRole("img", { name: "One: A 10" });
      first.focus();
      fireEvent.keyDown(first, { key: "ArrowRight" });
      expect(screen.getByRole("img", { name: "Two: A 20" })).toHaveFocus();
      fireEvent.click(screen.getByRole("button", { name: "One" }));
      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(container.querySelector("svg")!.outerHTML).not.toMatch(
        /NaN|Infinity/,
      );
      fireEvent.click(screen.getByRole("button", { name: "Two" }));
      expect(screen.getByText("No chart data")).toBeInTheDocument();
    },
  );
  it("tells of a sector what it draws, over the sector", () => {
    const consoleError = vi.spyOn(console, "error");
    const { container } = render(
      <Chart
        data={[
          { label: "Other", a: 10, b: 1 },
          { label: "Other", a: 10, b: 2 },
        ]}
        series={series}
        title="Share"
        type="pie"
      />,
    );
    // Repeated labels are two categories of the legend
    expect(screen.getAllByRole("button", { name: "Other" })).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();

    // The first series alone - the pie draws no other
    const [right, left] = screen.getAllByRole("img", { name: "Other: A 10" });
    const tooltip = () =>
      container.querySelector<HTMLElement>(".pointer-events-none.absolute")!;
    fireEvent.mouseEnter(right);
    expect(tooltip()).toHaveTextContent(/^OtherA: 10$/);
    // Over the middle of the sector - the right half, then the left one
    expect(tooltip().style.left).toBe("60.5%");
    fireEvent.mouseEnter(left);
    expect(tooltip().style.left).toBe("39.5%");
  });
});
