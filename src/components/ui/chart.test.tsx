import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Chart from "./chart";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/ui/cs";

const series = [
  { key: "sales", label: "Sales" },
  { key: "cost", label: "Cost" },
];
const data = [
  { label: "January", sales: 10, cost: -5 },
  { label: "February", sales: 20, cost: null },
  { label: "March", sales: 30, cost: 15 },
];

describe("Chart", () => {
  it("measures its container and forwards its ref", () => {
    const width = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(360);
    const ref = { current: null as HTMLDivElement | null };
    const { container } = render(
      <Chart data={data} ref={ref} series={series} title="Results" />,
    );
    expect(container.querySelector("svg[role=group]")).toHaveAttribute(
      "viewBox",
      "0 0 360 320",
    );
    expect(ref.current).toBe(screen.getByRole("region", { name: "Results" }));
    width.mockRestore();
  });

  it("names the chart and offers all values in a table", () => {
    render(
      <Chart
        data={data}
        description="Monthly results"
        series={series}
        title="Results"
      />,
    );
    expect(screen.getByRole("region", { name: "Results" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Results" }),
    ).toHaveAccessibleDescription("Monthly results");
    fireEvent.click(screen.getByText("Show data table"));
    expect(screen.getByRole("table", { name: "Results" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(
      within(screen.getAllByRole("row")[2]).getByText("No value"),
    ).toBeInTheDocument();
  });

  it("toggles series without losing their data table values", async () => {
    const user = userEvent.setup();
    render(<Chart data={data} series={series} title="Results" />);
    await user.click(screen.getByRole("button", { name: "Cost" }));
    expect(screen.getByRole("button", { name: "Cost" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("img", { name: "January: Sales 10" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sales" }));
    expect(screen.getByText("No chart data")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sales" }));
    expect(
      screen.getByRole("img", { name: "March: Sales 30" }),
    ).toBeInTheDocument();
  });

  it("navigates tooltip points with arrows, Home and End", () => {
    render(<Chart data={data} series={series} title="Results" />);
    const points = screen.getAllByRole("img");
    points[0].focus();
    fireEvent.keyDown(points[0], { key: "ArrowRight" });
    expect(points[1]).toHaveFocus();
    fireEvent.keyDown(points[1], { key: "End" });
    expect(points[2]).toHaveFocus();
    fireEvent.keyDown(points[2], { key: "Home" });
    expect(points[0]).toHaveFocus();
    fireEvent.keyDown(points[0], { key: "Escape" });
    expect(screen.queryByText("Sales: 10")).toBeNull();
  });

  it("is one tab stop, at the point focused last", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Chart
          data={data}
          legend={false}
          series={series}
          showDataTable={false}
          title="Results"
        />
        <button type="button">After</button>
      </>,
    );
    const points = screen.getAllByRole("img");

    await user.tab();
    expect(points[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(points[1]).toHaveFocus();
    // Past the other points, out of the chart
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(points[1]).toHaveFocus();
  });

  it("breaks lines at gaps and draws grouped negative bars", () => {
    const { container, rerender } = render(
      <Chart data={data} series={series} title="Results" />,
    );
    expect(container.querySelectorAll("polyline")).toHaveLength(3);
    rerender(<Chart data={data} series={series} title="Results" type="bar" />);
    const bars = [...container.querySelectorAll("svg > g > rect")].filter(
      (bar) => !bar.hasAttribute("data-chart-point"),
    );
    expect(bars).toHaveLength(5);
    expect(bars.every((bar) => Number(bar.getAttribute("height")) > 0)).toBe(
      true,
    );
    rerender(<Chart data={data} series={series} title="Results" type="area" />);
    expect(container.querySelectorAll("path")).toHaveLength(3);
  });

  it("keeps finite coordinates for opposite numeric extremes and flat data", () => {
    const { container, rerender } = render(
      <Chart
        data={[
          { label: "A", sales: -Number.MAX_VALUE },
          { label: "B", sales: Number.MAX_VALUE },
        ]}
        series={series.slice(0, 1)}
        title="Extreme"
      />,
    );
    expect(container.querySelector("svg")!.outerHTML).not.toMatch(
      /NaN|Infinity/,
    );
    rerender(
      <Chart
        data={[{ label: "A", sales: Number.MAX_VALUE }]}
        max={Number.MAX_VALUE}
        min={Number.MAX_VALUE}
        series={series.slice(0, 1)}
        title="Flat"
      />,
    );
    expect(container.querySelector("svg")!.outerHTML).not.toMatch(
      /NaN|Infinity/,
    );
  });

  it("formats localized values and accepts a custom formatter", () => {
    const { rerender } = render(
      <UIProvider locale={cs}>
        <Chart
          data={[{ label: "A", sales: 1234.5 }]}
          series={series.slice(0, 1)}
          title="Výsledek"
        />
      </UIProvider>,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/1\s234,5/);
    rerender(
      <Chart
        data={data}
        formatValue={(value) => `${value} units`}
        series={series}
        title="Results"
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "January: Sales 10 units, Cost -5 units",
      }),
    ).toBeInTheDocument();
  });
});
