import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Accordion from "./accordion";
import AccordionGroup from "./accordion-group";

const toggle = (name: string) => screen.getByRole("button", { name });

/** Whether the content of a section is shown - closed content unmounts. */
const isShown = (text: string) => screen.queryByText(text) !== null;

function Sections() {
  return (
    <>
      <Accordion header="Billing" value="billing">
        Billing details
      </Accordion>
      <Accordion header="Shipping" value="shipping">
        Shipping details
      </Accordion>
      <Accordion header="Notes" value="notes">
        Order notes
      </Accordion>
    </>
  );
}

describe("AccordionGroup", () => {
  it("opens one section at a time", async () => {
    const user = userEvent.setup();
    render(
      <AccordionGroup defaultValue="billing">
        <Sections />
      </AccordionGroup>,
    );

    expect(toggle("Billing")).toHaveAttribute("aria-expanded", "true");
    expect(toggle("Shipping")).toHaveAttribute("aria-expanded", "false");
    expect(isShown("Shipping details")).toBe(false);

    await user.click(screen.getByText("Shipping"));

    expect(toggle("Shipping")).toHaveAttribute("aria-expanded", "true");
    expect(toggle("Billing")).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(isShown("Billing details")).toBe(false));
  });

  it("keeps the open section open unless collapsible", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <AccordionGroup defaultValue="billing" onValueChange={onValueChange}>
        <Sections />
      </AccordionGroup>,
    );

    // The toggle says it cannot close the section (APG)
    expect(toggle("Billing")).toHaveAttribute("aria-disabled", "true");
    expect(toggle("Shipping")).not.toHaveAttribute("aria-disabled");

    await user.click(toggle("Billing"));
    await user.click(screen.getByText("Billing"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(isShown("Billing details")).toBe(true);

    rerender(
      <AccordionGroup
        collapsible
        defaultValue="billing"
        onValueChange={onValueChange}
      >
        <Sections />
      </AccordionGroup>,
    );
    expect(toggle("Billing")).not.toHaveAttribute("aria-disabled");

    await user.click(toggle("Billing"));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(toggle("Billing")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens any number of sections when multiple", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <AccordionGroup
        defaultValue={["billing"]}
        onValueChange={onValueChange}
        type="multiple"
      >
        <Sections />
      </AccordionGroup>,
    );

    await user.click(toggle("Notes"));
    expect(onValueChange).toHaveBeenLastCalledWith(["billing", "notes"]);
    expect(isShown("Billing details")).toBe(true);
    expect(isShown("Order notes")).toBe(true);

    await user.click(toggle("Billing"));
    expect(onValueChange).toHaveBeenLastCalledWith(["notes"]);
    expect(toggle("Billing")).toHaveAttribute("aria-expanded", "false");
    expect(toggle("Billing")).not.toHaveAttribute("aria-disabled");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = useState<string | null>("shipping");

      return (
        <>
          <AccordionGroup
            collapsible
            onValueChange={(next) => {
              onValueChange(next);
              // Notes cannot be opened from the group
              if (next !== "notes") setValue(next);
            }}
            value={value}
          >
            <Sections />
          </AccordionGroup>
          <button onClick={() => setValue("notes")} type="button">
            Show notes
          </button>
        </>
      );
    }

    render(<Controlled />);
    expect(toggle("Shipping")).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle("Notes"));
    expect(onValueChange).toHaveBeenLastCalledWith("notes");
    expect(toggle("Notes")).toHaveAttribute("aria-expanded", "false");
    expect(toggle("Shipping")).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Show notes" }));
    expect(toggle("Notes")).toHaveAttribute("aria-expanded", "true");
    expect(toggle("Shipping")).toHaveAttribute("aria-expanded", "false");
  });

  it("moves between the section toggles with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <AccordionGroup type="multiple">
        <Sections />
      </AccordionGroup>,
    );

    await user.tab();
    expect(toggle("Billing")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(toggle("Shipping")).toHaveFocus();
    await user.keyboard("{End}");
    expect(toggle("Notes")).toHaveFocus();
    // Around the ends
    await user.keyboard("{ArrowDown}");
    expect(toggle("Billing")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(toggle("Notes")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(toggle("Billing")).toHaveFocus();

    // Moving the focus opens nothing
    expect(toggle("Billing")).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves an accordion nested in a section on its own", async () => {
    const user = userEvent.setup();
    render(
      <AccordionGroup defaultValue="order">
        <Accordion header="Order" value="order">
          <Accordion defaultOpen={false} header="Items">
            Two items
          </Accordion>
        </Accordion>
        <Accordion header="Customer" value="customer">
          Jana Nováková
        </Accordion>
      </AccordionGroup>,
    );

    // Opening the nested one closes nothing of the group
    await user.click(toggle("Items"));
    expect(isShown("Two items")).toBe(true);
    expect(toggle("Order")).toHaveAttribute("aria-expanded", "true");

    // The arrow keys skip it
    toggle("Order").focus();
    await user.keyboard("{ArrowDown}");
    expect(toggle("Customer")).toHaveFocus();

    // And it keeps its own arrow keys to itself
    toggle("Items").focus();
    await user.keyboard("{ArrowDown}");
    expect(toggle("Items")).toHaveFocus();
  });

  it("gives every section a value of its own", async () => {
    const user = userEvent.setup();
    render(
      <AccordionGroup>
        <Accordion header="First">One</Accordion>
        <Accordion header="Second">Two</Accordion>
      </AccordionGroup>,
    );

    // Sections without a value start closed in a group
    expect(isShown("One")).toBe(false);

    await user.click(toggle("First"));
    await user.click(toggle("Second"));

    expect(toggle("Second")).toHaveAttribute("aria-expanded", "true");
    expect(toggle("First")).toHaveAttribute("aria-expanded", "false");
  });

  it("warns about a value that cannot change and an open section", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <AccordionGroup value="billing">
        <Accordion header="Billing" open value="billing">
          Billing details
        </Accordion>
      </AccordionGroup>,
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AccordionGroup: `value` without"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("`open` has no effect in an AccordionGroup"),
    );
  });

  it("passes the native attributes to its wrapper", () => {
    render(
      <AccordionGroup aria-label="Order" data-testid="group" role="group">
        <Sections />
      </AccordionGroup>,
    );

    const group = screen.getByRole("group", { name: "Order" });
    expect(group).toBe(screen.getByTestId("group"));
    expect(within(group).getAllByRole("button")).toHaveLength(3);
  });

  it("types the value by the type of the group", () => {
    const groups = [
      // @ts-expect-error - a single group has one open section
      <AccordionGroup key="single" value={["billing"]} />,
      // @ts-expect-error - a multiple group has an array of them
      <AccordionGroup key="multiple" type="multiple" value="billing" />,
      // @ts-expect-error - only a single group can be collapsible
      <AccordionGroup collapsible key="collapsible" type="multiple" />,
      <AccordionGroup
        key="handler"
        onValueChange={(value) => value?.toUpperCase()}
      />,
      <AccordionGroup
        key="handlers"
        onValueChange={(values) => values.map((value) => value.length)}
        type="multiple"
      />,
    ];

    expect(groups).toHaveLength(5);
  });

  it("renders on the server", () => {
    const html = renderToString(
      <AccordionGroup defaultValue="shipping">
        <Sections />
      </AccordionGroup>,
    );

    expect(html).toContain("Shipping details");
    expect(html).not.toContain("Billing details");
  });
});
