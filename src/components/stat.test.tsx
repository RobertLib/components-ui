import { render, screen } from "@testing-library/react";
import { Banknote } from "lucide-react";
import { describe, expect, it } from "vitest";
import Stat from "./stat";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

describe("Stat", () => {
  it("is a term with its value and change", () => {
    render(
      <Stat
        change={0.125}
        description="vs last month"
        label="Orders"
        value={12345}
      />,
    );

    expect(screen.getByRole("term")).toHaveTextContent("Orders");
    const [value, change] = screen.getAllByRole("definition");
    expect(value).toHaveTextContent("12,345");
    expect(change).toHaveTextContent("+12.5%vs last month");
  });

  it("writes numbers as the language does", () => {
    render(
      <UIProvider locale={cs}>
        <Stat
          change={-0.034}
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Tržby"
          value={128400}
        />
      </UIProvider>,
    );

    const [value, change] = screen.getAllByRole("definition");
    expect(value.textContent).toBe("128 400,00 Kč");
    expect(change.textContent).toBe("-3,4 %");
  });

  it("colors a rise green and a fall red - or the other way round", () => {
    render(
      <>
        <Stat change={0.1} label="Revenue" value={1} />
        <Stat change={-0.1} label="Margin" value={1} />
        <Stat change={0.1} invertTrend label="Costs" value={1} />
        <Stat change={0} label="Refunds" value={1} />
      </>,
    );

    const [revenue, costs] = screen.getAllByText("+10%");
    expect(revenue).toHaveClass("text-success-700");
    expect(screen.getByText("-10%")).toHaveClass("text-danger-700");
    expect(costs).toHaveClass("text-danger-700");
    expect(screen.getByText("0%")).toHaveClass("text-neutral-600");
    // An arrow besides the color - hidden, the sign says it
    expect(costs.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("takes the direction from the change as it is written", () => {
    render(
      <>
        <Stat change={-0.0003} label="Churn" value={1} />
        <Stat change={-0.0005} label="Margin" value={1} />
      </>,
    );

    // -0.03% is written "0%" - no fall in red
    const unchanged = screen.getByText("0%");
    expect(unchanged).toHaveClass("text-neutral-600");
    expect(unchanged.querySelector("svg")).toHaveClass("lucide-minus");
    // -0.05% is written "-0.1%" - a fall
    expect(screen.getByText("-0.1%")).toHaveClass("text-danger-700");
  });

  it("shows other content as it is, colored by trend", () => {
    render(
      <>
        <Stat change="3 new" label="Customers" trend="up" value="1 h 20 min" />
        <Stat change="unchanged" label="Plan" value="Pro" />
      </>,
    );

    expect(screen.getByText("1 h 20 min")).toBeInTheDocument();
    expect(screen.getByText("3 new")).toHaveClass("text-success-700");
    // Without a trend - no color, no arrow
    const unchanged = screen.getByText("unchanged");
    expect(unchanged).toHaveClass("text-neutral-600");
    expect(unchanged.querySelector("svg")).toBeNull();
  });

  it("leaves out a change that is no finite number", () => {
    render(<Stat change={Number.NaN} label="Conversion" value={0.5} />);

    expect(screen.getAllByRole("definition")).toHaveLength(1);
  });

  it("shows placeholders while loading - the label stays", () => {
    const { container } = render(
      <Stat
        data-testid="stat"
        description="vs last month"
        icon={<Banknote />}
        label="Revenue"
        loading
        value={undefined}
      />,
    );

    expect(screen.getByTestId("stat")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("term")).toHaveTextContent("Revenue");
    expect(screen.queryByText("vs last month")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
    expect(container.querySelector(".lucide-banknote")).toBeInTheDocument();
  });
});
