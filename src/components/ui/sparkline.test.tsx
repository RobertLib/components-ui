import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Sparkline, { type SparklineColor } from "./sparkline";
import Stat from "./stat";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
import { colorOf, contrast, pageBackgrounds } from "../../test/contrast";

const pathsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("path"));

describe("Sparkline", () => {
  it("is an image named by a summary of its values", () => {
    render(<Sparkline data={[12, 9, 21, 18]} />);

    expect(
      screen.getByRole("img", {
        name: "From 12 to 18, lowest 9, highest 21",
      }),
    ).toBeInTheDocument();
  });

  it("says what the values are with a label - in the language and format", () => {
    render(
      <UIProvider locale={cs}>
        <Sparkline
          data={[1200, 1500.5]}
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Tržby"
        />
      </UIProvider>,
    );

    const format = (value: number) =>
      new Intl.NumberFormat("cs-CZ", {
        currency: "CZK",
        style: "currency",
      }).format(value);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      `Tržby: Od ${format(1200)} do ${format(1500.5)}, minimum ${format(1200)}, maximum ${format(1500.5)}`,
    );
  });

  it("takes a summary of its own, or a name from elsewhere", () => {
    const { rerender } = render(
      <Sparkline data={[1, 2]} summary="Growing steadily" />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName("Growing steadily");

    rerender(
      <>
        <span id="name">Visitors</span>
        <Sparkline aria-labelledby="name" data={[1, 2]} />
      </>,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName("Visitors");
  });

  it("draws a line from the start to the end, the highest at the top", () => {
    const { container } = render(<Sparkline data={[0, 10, 5]} />);

    const [line] = pathsOf(container);
    expect(line).toHaveAttribute("d", "M0 100L50 0L100 50");
    // As thick in a chart stretched wide
    expect(line).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(line).toHaveAttribute("stroke-width", "2");
    expect(container.querySelector("svg")).toHaveAttribute(
      "preserveAspectRatio",
      "none",
    );
  });

  it("scales to min and max - values beyond them at the edge", () => {
    const { container } = render(
      <Sparkline data={[-5, 50, 150]} max={100} min={0} />,
    );

    expect(pathsOf(container)[0]).toHaveAttribute("d", "M0 100L50 50L100 0");
  });

  it("draws finite extremes without overflowing the line, area or last dot", () => {
    const { container } = render(
      <Sparkline
        area
        data={[-Number.MAX_VALUE, 0, Number.MAX_VALUE]}
        highlightLast
      />,
    );

    const [area, line, dot] = pathsOf(container);
    expect(area).toHaveAttribute("d", "M0 100L50 50L100 0L100 100L0 100Z");
    expect(line).toHaveAttribute("d", "M0 100L50 50L100 0");
    expect(dot).toHaveAttribute("d", "M100 0h0");
  });

  it("clamps finite values to an explicit scale whose range overflows", () => {
    const { container } = render(
      <Sparkline
        data={[-Number.MAX_VALUE, -5e307, 0, 5e307, Number.MAX_VALUE]}
        max={1e308}
        min={-1e308}
      />,
    );

    expect(pathsOf(container)[0]).toHaveAttribute(
      "d",
      "M0 100L25 75L50 50L75 25L100 0",
    );
  });

  it("draws a flat series through the middle", () => {
    const { container } = render(<Sparkline data={[3, 3, 3]} />);

    expect(pathsOf(container)[0]).toHaveAttribute("d", "M0 50L50 50L100 50");
  });

  it("leaves gaps for missing values - a lone value is a dot", () => {
    const { container } = render(
      <Sparkline data={[1, 2, null, 3, Number.NaN, 4, 5]} />,
    );

    const ds = pathsOf(container).map((path) => path.getAttribute("d"));
    expect(ds).toHaveLength(3);
    expect(ds[0]).toMatch(/^M0 [\d.]+L[\d.]+ [\d.]+$/);
    // The 3 between two gaps
    expect(ds.find((d) => d?.endsWith("h0"))).toBeDefined();
  });

  it("fills the area under the line and marks the last value", () => {
    const { container } = render(
      <Sparkline area color="success" data={[1, 3, 2]} highlightLast />,
    );

    const [area, line, dot] = pathsOf(container);
    expect(area.getAttribute("d")).toMatch(/Z$/);
    expect(area).toHaveClass("fill-success-600/15");
    expect(line).toHaveClass("stroke-success-700");
    expect(dot).toHaveAttribute("d", "M100 50h0");
    expect(dot).toHaveAttribute("stroke-width", "6");
  });

  it("is hidden without values to tell", () => {
    const { container } = render(<Sparkline data={[]} />);

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(pathsOf(container)).toHaveLength(0);
  });

  it("draws its line at 3:1 on the page", () => {
    const colors: SparklineColor[] = [
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "info",
      "neutral",
    ];
    const low: string[] = [];

    for (const color of colors) {
      const { container, unmount } = render(
        <Sparkline color={color} data={[1, 2]} />,
      );
      const className = pathsOf(container)[0].getAttribute("class") ?? "";
      unmount();

      for (const dark of [false, true]) {
        const stroke = colorOf(className, "stroke", { dark })!;
        for (const page of pageBackgrounds(dark)) {
          if (contrast(stroke, page) < 3) {
            low.push(`${color}${dark ? " dark" : ""}: ${stroke} on ${page}`);
          }
        }
      }
    }

    expect(low).toEqual([]);
  });
});

describe("Stat with a sparkline", () => {
  it("draws the values under the figure, named by its label", () => {
    const { container } = render(
      <Stat label="Revenue" sparkline={[10, 12, 18]} value={18} />,
    );

    const chart = screen.getByRole("img", {
      name: "Revenue: From 10 to 18, lowest 10, highest 18",
    });
    expect(chart).toHaveClass("h-10", "w-full");
    // A tinted area by default
    expect(pathsOf(container)).toHaveLength(2);
  });

  it("takes the props of a sparkline and the format of the figure", () => {
    render(
      <Stat
        formatOptions={{ currency: "USD", style: "currency" }}
        label="Costs"
        sparkline={{ area: false, color: "danger", data: [5, 3] }}
        value={3}
      />,
    );

    const chart = screen.getByRole("img", {
      name: "Costs: From $5.00 to $3.00, lowest $3.00, highest $5.00",
    });
    const paths = chart.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveClass("stroke-danger-600");
  });

  it("shows a placeholder while loading", () => {
    const { container } = render(
      <Stat label="Revenue" loading sparkline={[1, 2]} value={undefined} />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".h-10.animate-pulse")).not.toBeNull();
  });
});
