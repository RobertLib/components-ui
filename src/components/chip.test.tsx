import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { Truck } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import Chip from "./chip";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

describe("Chip", () => {
  it("is phrasing content that fits into a paragraph", () => {
    const html = renderToString(
      <p>
        Status: <Chip color="success">Paid</Chip>
      </p>,
    );

    // The HTML parser would close the paragraph before a <div>
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.body.children).toHaveLength(1);
    expect(parsed.querySelector("p > span")?.textContent).toBe("Paid");
  });

  it("passes classes and attributes on", () => {
    render(
      <Chip className="ml-2" color="danger" title="Overdue" variant="solid">
        Overdue
      </Chip>,
    );

    const chip = screen.getByTitle("Overdue");
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveClass("ml-2", "bg-danger-600", "inline-flex");
  });

  it("renders a static chip as it always did", () => {
    expect(renderToString(<Chip>Paid</Chip>)).toBe(
      '<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-sm border-neutral-300 dark:border-neutral-700 bg-surface dark:bg-surface-dark text-neutral-800 dark:text-neutral-200">Paid</span>',
    );
  });

  it("shows an icon sized to the chip, and comes in sizes", () => {
    render(
      <>
        <Chip icon={<Truck data-testid="truck" size={40} />} size="sm">
          Shipped
        </Chip>
        <Chip size="lg">Large</Chip>
      </>,
    );

    const icon = screen.getByTestId("truck");
    expect(icon.parentElement).toHaveClass("[&>svg]:size-3");
    expect(icon.closest(".inline-flex.rounded-full")).toHaveClass(
      "text-xs",
      "gap-1",
    );
    expect(screen.getByText("Large")).toHaveClass("px-3", "text-base");
  });

  it("dims a disabled chip", () => {
    render(<Chip disabled>Archived</Chip>);

    expect(screen.getByText("Archived")).toHaveClass("opacity-50");
  });
});

describe("Chip with onRemove", () => {
  it("has a remove button named after the chip", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Status: Paid</Chip>);

    await user.click(
      screen.getByRole("button", { name: "Remove Status: Paid" }),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("is removed with Backspace or Delete on its button", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>urgent</Chip>);

    await user.tab();
    expect(screen.getByRole("button", { name: "Remove urgent" })).toHaveFocus();
    await user.keyboard("{Backspace}");
    await user.keyboard("{Delete}");
    expect(onRemove).toHaveBeenCalledTimes(2);

    // A held key does not go on to the next chip
    fireEvent.keyDown(screen.getByRole("button"), {
      key: "Delete",
      repeat: true,
    });
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it("takes a name of its own and localized texts", () => {
    render(
      <UIProvider locale={cs}>
        <Chip onRemove={() => {}}>Zaplaceno</Chip>
        <Chip onRemove={() => {}} removeLabel="Remove Jana from the team">
          <img alt="Jana" src="data:," /> Jana
        </Chip>
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Odebrat Zaplaceno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Jana from the team" }),
    ).toBeInTheDocument();
  });

  it("cannot be removed while disabled", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <Chip disabled onRemove={onRemove}>
        Paid
      </Chip>,
    );

    const button = screen.getByRole("button", { name: "Remove Paid" });
    expect(button).toBeDisabled();
    await user.click(button);
    fireEvent.keyDown(button, { key: "Delete" });
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("does not pass the click on to a row or card around it", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <div onClick={onRowClick}>
        <Chip onRemove={onRemove}>Paid</Chip>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Remove Paid" }));
    expect(onRemove).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  function Filters({ initial }: { initial: string[] }) {
    const [filters, setFilters] = useState(initial);

    return (
      <>
        <div>
          {filters.map((filter) => (
            <Chip
              key={filter}
              onRemove={() =>
                setFilters((current) => current.filter((f) => f !== filter))
              }
            >
              {filter}
            </Chip>
          ))}
        </div>
        <button type="button">Apply</button>
      </>
    );
  }

  it("moves the focus to the next chip, the previous one, then on", async () => {
    const user = userEvent.setup();
    render(<Filters initial={["Paid", "Overdue", "Mine"]} />);

    await user.click(screen.getByRole("button", { name: "Remove Overdue" }));
    expect(screen.getByRole("button", { name: "Remove Mine" })).toHaveFocus();

    await user.keyboard("{Delete}");
    expect(screen.getByRole("button", { name: "Remove Paid" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Apply" })).toHaveFocus();
  });

  it("prefers the previous chip to a control after the last chip", async () => {
    const user = userEvent.setup();

    function FiltersWithReset() {
      const [filters, setFilters] = useState(["Paid", "Mine"]);
      return (
        <div>
          {filters.map((filter) => (
            <Chip
              key={filter}
              onRemove={() =>
                setFilters((current) => current.filter((f) => f !== filter))
              }
            >
              {filter}
            </Chip>
          ))}
          <button type="button">Reset</button>
        </div>
      );
    }

    render(<FiltersWithReset />);

    await user.click(screen.getByRole("button", { name: "Remove Mine" }));
    expect(screen.getByRole("button", { name: "Remove Paid" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();
  });

  it("leaves the focus alone when the chip stays", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Chip onRemove={() => {}}>Paid</Chip>
        <Chip onRemove={() => {}}>Mine</Chip>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Remove Paid" }));
    expect(screen.getByRole("button", { name: "Remove Paid" })).toHaveFocus();
  });
});

describe("Chip as a toggle", () => {
  it("is a button that tells whether it is pressed", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    const { rerender } = render(
      <Chip onSelectedChange={onSelectedChange} selected={false}>
        Overdue
      </Chip>,
    );

    const chip = screen.getByRole("button", { name: "Overdue" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(onSelectedChange).toHaveBeenLastCalledWith(true);
    // Controlled - it shows what the parent says
    expect(chip).toHaveAttribute("aria-pressed", "false");

    rerender(
      <Chip onSelectedChange={onSelectedChange} selected>
        Overdue
      </Chip>,
    );
    expect(chip).toHaveAttribute("aria-pressed", "true");
    // Filled, with a check mark besides the color
    expect(chip).toHaveClass("bg-neutral-500");
    expect(chip.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    chip.focus();
    await user.keyboard(" ");
    expect(onSelectedChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps its own state without selected", async () => {
    const user = userEvent.setup();
    render(
      <Chip color="primary" defaultSelected>
        Mine
      </Chip>,
    );

    const chip = screen.getByRole("button", { name: "Mine", pressed: true });
    expect(chip).toHaveClass("bg-primary-600");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).toHaveClass("bg-surface", "text-primary-800");
    await user.keyboard("{Enter}");
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the check mark in place of the icon when selected", () => {
    render(
      <Chip icon={<Truck data-testid="truck" />} selected>
        Shipped
      </Chip>,
    );

    expect(screen.queryByTestId("truck")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Shipped", pressed: true }),
    ).toBeInTheDocument();
  });

  it("runs onClick first - preventDefault keeps the state", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(
      <Chip
        onClick={(event) => event.preventDefault()}
        onSelectedChange={onSelectedChange}
      >
        Mine
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: "Mine" }));
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it("cannot be toggled while disabled", () => {
    render(
      <Chip disabled selected={false}>
        Mine
      </Chip>,
    );

    expect(screen.getByRole("button", { name: "Mine" })).toBeDisabled();
  });

  it("can be removable as well", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onSelectedChange = vi.fn();
    render(
      <Chip
        onRemove={onRemove}
        onSelectedChange={onSelectedChange}
        selected={false}
      >
        Mine
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: "Mine" }));
    expect(onSelectedChange).toHaveBeenCalledWith(true);

    // Delete on the toggle removes the chip too
    expect(screen.getByRole("button", { name: "Mine" })).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(onRemove).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Remove Mine" }));
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(onSelectedChange).toHaveBeenCalledTimes(1);
  });

  it("runs onClick first also with the remove button", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Chip
        onClick={onClick}
        onRemove={() => {}}
        onSelectedChange={onSelectedChange}
      >
        Mine
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: "Mine" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSelectedChange).not.toHaveBeenCalled();

    // A click on the remove button is no click on the chip
    await user.click(screen.getByRole("button", { name: "Remove Mine" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
