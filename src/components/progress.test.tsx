import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Progress, { CircularProgress } from "./progress";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

describe("Progress", () => {
  it("is named by its label and described by its description", () => {
    render(<Progress description="report.pdf" label="Uploading" value={40} />);

    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    expect(bar).toHaveAccessibleDescription("report.pdf");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
  });

  it("can be named without a label", () => {
    render(
      <>
        <Progress aria-label="Disk usage" value={30} />
        <h2 id="quota">Quota</h2>
        <Progress aria-labelledby="quota" max={5} value={4} />
      </>,
    );

    expect(
      screen.getByRole("progressbar", { name: "Disk usage" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Quota" })).toHaveAttribute(
      "aria-valuemax",
      "5",
    );
  });

  it("clamps the value to the range of the bar", () => {
    render(
      <>
        <Progress aria-label="Over" showPercentage value={150} />
        <Progress aria-label="Under" value={-5} />
      </>,
    );

    expect(screen.getByRole("progressbar", { name: "Over" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Under" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("shows a value that is no finite number as no progress", () => {
    const { container } = render(
      <Progress aria-label="Upload" showPercentage value={Number.NaN} />,
    );

    const bar = screen.getByRole("progressbar", { name: "Upload" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(
      container.querySelector<HTMLElement>("[role=progressbar] > div")?.style
        .width,
    ).toBe("0%");
  });

  it("writes the percentage as the language does", () => {
    render(
      <UIProvider locale={cs}>
        <Progress aria-label="Upload" showPercentage value={40} />
      </UIProvider>,
    );

    // With a non-breaking space - the queries see a plain one
    expect(screen.getByText("40 %").textContent).toBe("40\u00a0%");
  });

  it("says 100% only once the work is done", () => {
    render(
      <>
        <Progress aria-label="Upload" showPercentage value={99.6} />
        <Progress aria-label="Files" max={100} showPercentage value={57} />
      </>,
    );

    expect(screen.getByText("99%")).toBeInTheDocument();
    expect(screen.getByText("57%")).toBeInTheDocument();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("gives the props of a div to the bar - the class and style to the wrapper", () => {
    const { container } = render(
      <>
        <p id="hint">Five files in all</p>
        <Progress
          aria-describedby="hint"
          aria-valuetext="3 of 5 files"
          className="mt-4"
          data-testid="files"
          description="report.pdf"
          id="files-progress"
          label="Files"
          max={5}
          style={{ maxWidth: 320 }}
          value={3}
        />
      </>,
    );

    const bar = screen.getByRole("progressbar", { name: "Files" });
    expect(bar).toHaveAttribute("id", "files-progress");
    expect(bar).toHaveAttribute("aria-valuetext", "3 of 5 files");
    expect(bar).toHaveAttribute("data-testid", "files");
    // Its own description and the one it is given
    expect(bar).toHaveAccessibleDescription("report.pdf Five files in all");

    const wrapper = container.querySelector<HTMLElement>(".mt-4");
    expect(wrapper).toContainElement(bar);
    expect(wrapper?.style.maxWidth).toBe("320px");
  });

  it("moves without a value, telling none", () => {
    const { container } = render(
      <>
        <Progress label="Processing" showPercentage />
        <Progress aria-label="Waiting" indeterminate value={40} />
      </>,
    );

    for (const name of ["Processing", "Waiting"]) {
      const bar = screen.getByRole("progressbar", { name });
      expect(bar).not.toHaveAttribute("aria-valuenow");
      expect(bar).not.toHaveAttribute("aria-valuemax");
      expect(bar.firstElementChild).toHaveClass(
        "animate-[progress-indeterminate_1.5s_ease-in-out_infinite]",
        // Fading in place instead for reduced motion
        "motion-reduce:animate-[progress-fade_2s_ease-in-out_infinite]",
        "motion-reduce:left-[30%]",
      );
    }
    // No percentage of an unknown progress
    expect(container).not.toHaveTextContent("%");
  });

  it("takes null as no value", () => {
    render(<Progress aria-label="Import" value={null} />);

    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
  });
});

describe("CircularProgress", () => {
  it("is a named progress bar with the percentage in its middle", () => {
    const { container } = render(
      <CircularProgress aria-label="Storage" showPercentage value={73.4} />,
    );

    const ring = screen.getByRole("progressbar", { name: "Storage" });
    expect(ring).toHaveAttribute("aria-valuenow", "73.4");
    expect(ring).toHaveAttribute("aria-valuemin", "0");
    expect(ring).toHaveAttribute("aria-valuemax", "100");
    expect(ring).toHaveTextContent("73%");

    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    const length = Number(circles[1].getAttribute("stroke-dasharray"));
    expect(
      Number(circles[1].getAttribute("stroke-dashoffset")) / length,
    ).toBeCloseTo(0.266);
  });

  it("clamps its value and shows content of its own", () => {
    const { container } = render(
      <CircularProgress aria-label="Checklist" max={5} value={7}>
        5/5
      </CircularProgress>,
    );

    const ring = screen.getByRole("progressbar", { name: "Checklist" });
    expect(ring).toHaveAttribute("aria-valuenow", "5");
    expect(ring).toHaveTextContent("5/5");
    expect(
      Number(
        container
          .querySelectorAll("circle")[1]
          .getAttribute("stroke-dashoffset"),
      ),
    ).toBe(0);
  });

  it("rounds the percentage down", () => {
    render(<CircularProgress aria-label="Quota" showPercentage value={99.5} />);

    expect(screen.getByRole("progressbar")).toHaveTextContent("99%");
  });

  it("draws no arc at zero", () => {
    const { container } = render(
      <CircularProgress aria-label="Empty" value={0} />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("spins without a value", () => {
    const { container } = render(
      <CircularProgress aria-label="Loading" showPercentage />,
    );

    const ring = screen.getByRole("progressbar", { name: "Loading" });
    expect(ring).not.toHaveAttribute("aria-valuenow");
    expect(ring).toHaveTextContent("");
    expect(container.querySelector("svg")).toHaveClass("animate-spin");
  });

  it("takes sizes, a stroke width and native attributes", () => {
    const { container } = render(
      <CircularProgress
        aria-labelledby="quota"
        data-testid="ring"
        size="xl"
        strokeWidth={20}
        value={50}
        variant="success"
      />,
    );

    const ring = screen.getByTestId("ring");
    expect(ring).toHaveClass("size-24");
    expect(ring).toHaveAttribute("aria-labelledby", "quota");
    const [track, arc] = container.querySelectorAll("circle");
    expect(track).toHaveAttribute("stroke-width", "20");
    expect(track).toHaveAttribute("r", "40");
    expect(arc).toHaveClass("stroke-success-700");
  });
});
