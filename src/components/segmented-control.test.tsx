import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import SegmentedControl from "./segmented-control";

afterEach(() => {
  vi.unstubAllGlobals();
});

const periods = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

const radio = (name: string) =>
  screen.getByRole<HTMLInputElement>("radio", { name });

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe("SegmentedControl", () => {
  it("is a radio group of its options", () => {
    render(
      <SegmentedControl
        aria-label="Period"
        defaultValue="week"
        options={periods}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Period" });
    expect(group.tagName).toBe("DIV");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(radio("Week")).toBeChecked();
    expect(radio("Day")).not.toBeChecked();
  });

  it("names icon-only options by their aria-label", () => {
    render(
      <SegmentedControl
        aria-label="View"
        options={[
          { "aria-label": "List", icon: <svg />, value: "list" },
          { "aria-label": "Board", icon: <svg />, value: "board" },
        ]}
      />,
    );

    expect(radio("List")).toBeInTheDocument();
    // The name is also the tooltip of the icon
    expect(radio("Board").closest("label")).toHaveAttribute("title", "Board");
  });

  it("moves and picks with the arrow keys, skipping disabled options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Period"
        defaultValue="day"
        onChange={onChange}
        options={[periods[0], { ...periods[1], disabled: true }, periods[2]]}
      />,
    );

    await user.tab();
    expect(radio("Day")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(radio("Month")).toHaveFocus();
    expect(radio("Month")).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith("month");

    await user.keyboard("{ArrowLeft}");
    expect(radio("Day")).toBeChecked();
    expect(radio("Week")).toBeDisabled();
  });

  it("is one tab stop", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <SegmentedControl
          aria-label="Period"
          defaultValue="month"
          name="period"
          options={periods}
        />
        <button type="button">After</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(radio("Month")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("reports the value of the option, a number too", async () => {
    const user = userEvent.setup();

    function Pages() {
      const [size, setSize] = useState(25);
      return (
        <>
          <SegmentedControl
            aria-label="Rows"
            onChange={setSize}
            options={[
              { label: "25", value: 25 },
              { label: "50", value: 50 },
            ]}
            value={size}
          />
          <output>{typeof size}</output>
        </>
      );
    }

    render(<Pages />);
    await user.click(radio("50"));

    expect(radio("50")).toBeChecked();
    expect(document.querySelector("output")).toHaveTextContent("number");
  });

  it("shows the value of a controlled control only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Period"
        onChange={onChange}
        options={periods}
        value="day"
      />,
    );

    await user.click(radio("Week"));

    expect(onChange).toHaveBeenCalledWith("week");
    expect(radio("Day")).toBeChecked();
    expect(radio("Week")).not.toBeChecked();
  });

  it("submits the picked value under its name - without a name nothing", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <SegmentedControl
          aria-label="Period"
          defaultValue="day"
          name="period"
          options={periods}
        />
        <SegmentedControl
          aria-label="Chart"
          defaultValue="bar"
          options={[
            { label: "Bar", value: "bar" },
            { label: "Line", value: "line" },
          ]}
        />
      </form>,
    );

    await user.click(radio("Month"));

    // jsdom builds a FormData without firing the event browsers fire
    const formData = new FormData(getForm());
    getForm().dispatchEvent(Object.assign(new Event("formdata"), { formData }));
    expect([...formData]).toEqual([["period", "month"]]);
  });

  it("brings back the defaultValue on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <SegmentedControl
          aria-label="Period"
          defaultValue="week"
          name="period"
          options={periods}
        />
      </form>,
    );

    await user.click(radio("Month"));
    act(() => getForm().reset());

    expect(radio("Week")).toBeChecked();
    expect(new FormData(getForm()).get("period")).toBe("week");
  });

  it("leaves a controlled control showing its value after a form reset", async () => {
    const user = userEvent.setup();

    function Report() {
      const [period, setPeriod] = useState("day");
      return (
        <form aria-label="Report">
          <SegmentedControl
            aria-label="Period"
            name="period"
            onChange={setPeriod}
            options={periods}
            value={period}
          />
        </form>
      );
    }

    render(<Report />);
    await user.click(radio("Month"));
    act(() => getForm().reset());

    expect(radio("Month")).toBeChecked();
    expect(new FormData(getForm()).get("period")).toBe("month");
  });

  it("requires a pick when required", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Report">
        <SegmentedControl
          label="Period"
          name="period"
          options={periods}
          required
        />
      </form>,
    );

    const group = screen.getByRole("radiogroup", { name: "Period:" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveAttribute("aria-required", "true");
    expect(getForm().checkValidity()).toBe(false);

    await user.click(radio("Day"));
    expect(getForm().checkValidity()).toBe(true);
  });

  it("is described by its error first, then its description", () => {
    render(
      <>
        <p id="hint">Hint</p>
        <SegmentedControl
          aria-describedby="hint"
          description="Applies to all charts."
          error="Pick a period"
          id="period"
          label="Period"
          options={periods}
        />
      </>,
    );

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAccessibleDescription(
      "Pick a period Applies to all charts. Hint",
    );
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute(
      "aria-describedby",
      "period-error period-description hint",
    );
  });

  it("disables all options", () => {
    render(<SegmentedControl aria-label="Period" disabled options={periods} />);

    for (const option of screen.getAllByRole("radio")) {
      expect(option).toBeDisabled();
    }
  });

  it("slides the indicator under the picked option", async () => {
    const user = userEvent.setup();
    const rect = (left: number, width: number) => ({ left, width }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.hasAttribute("data-option")) {
          const index = [...this.parentElement!.children]
            .filter((child) => child.hasAttribute("data-option"))
            .indexOf(this);
          return rect(14 + index * 60, 60);
        }
        return rect(10, 200);
      },
    );

    const { container } = render(
      <SegmentedControl
        aria-label="Period"
        defaultValue="day"
        options={periods}
      />,
    );
    const indicator = container.querySelector<HTMLElement>(
      "[aria-hidden='true']",
    )!;

    expect(indicator.style.left).toBe("4px");
    expect(indicator.style.width).toBe("60px");

    await user.click(radio("Month"));
    expect(indicator.style.left).toBe("124px");
  });

  it("measures the indicator once where ResizeObserver is missing", async () => {
    // Like the jsdom of the tests of an app
    vi.stubGlobal("ResizeObserver", undefined);
    const user = userEvent.setup();
    const { container } = render(
      <SegmentedControl
        aria-label="Period"
        defaultValue="day"
        options={periods}
      />,
    );

    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
    await user.click(radio("Week"));
    expect(radio("Week")).toBeChecked();
  });

  it("points its ref at the group", () => {
    const ref = createRef<HTMLElement>();
    render(
      <SegmentedControl aria-label="Period" options={periods} ref={ref} />,
    );

    expect(ref.current).toBe(screen.getByRole("radiogroup"));
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const control = (
      <SegmentedControl
        aria-label="Period"
        defaultValue="week"
        description="Help"
        name="period"
        options={periods}
      />
    );

    const html = renderToString(control);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);

    // The picked option has its own background until the indicator is measured
    expect(
      container.querySelector("input[value='week']")?.closest("label"),
    ).toHaveClass("bg-surface");

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, control, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(radio("Week")).toBeChecked();

    act(() => root.unmount());
    container.remove();
  });
});
