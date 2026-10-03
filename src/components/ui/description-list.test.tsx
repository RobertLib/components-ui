import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DescriptionList from "./description-list";
import UIProvider from "../../providers/ui-provider";

describe("DescriptionList", () => {
  it("pairs the terms with their descriptions", () => {
    render(
      <DescriptionList
        items={[
          { desc: "Jana Nováková", term: "Name" },
          { desc: "12 500 CZK", term: "Credit" },
        ]}
      />,
    );

    const terms = screen.getAllByRole("term");
    const descriptions = screen.getAllByRole("definition");
    expect(terms.map((term) => term.textContent)).toEqual(["Name:", "Credit:"]);
    expect(descriptions[1]).toHaveTextContent("12 500 CZK");
  });

  it("follows the terms with the label suffix of the locale", () => {
    render(
      <UIProvider messages={{ form: { labelSuffix: " :" } }}>
        <DescriptionList items={[{ desc: "Jana Nováková", term: "Nom" }]} />
      </UIProvider>,
    );

    expect(screen.getByRole("term")).toHaveTextContent("Nom :");
  });

  it("opens the term info from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <DescriptionList
        items={[
          {
            desc: "12 500 CZK",
            term: "Credit",
            termInfo: "Unpaid invoices are deducted from the credit.",
          },
        ]}
      />,
    );

    await user.tab();
    // A generic name - the explanation is its description, read once
    const button = screen.getByRole("button", { name: "More information" });
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleDescription(
      "Unpaid invoices are deducted from the credit.",
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Unpaid invoices are deducted from the credit.",
    );
  });
});

describe("DescriptionList in columns", () => {
  const items = [
    { desc: "Jana Nováková", term: "Name" },
    { desc: "jana@example.com", term: "Email" },
    { desc: "Prague", term: "City" },
    { desc: "Leave at the door", fullWidth: true, term: "Note" },
  ];

  it("puts several pairs side by side, each term above its value", () => {
    const { container } = render(<DescriptionList columns={3} items={items} />);

    const list = container.querySelector("dl")!;
    expect(list).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
    // A group of a term and its value - allowed in a <dl>
    const groups = Array.from(list.children);
    expect(groups).toHaveLength(4);
    groups.forEach((group, index) => {
      expect(group.tagName).toBe("DIV");
      expect(group.querySelector("dt")).toHaveTextContent(items[index].term);
      expect(group.querySelector("dd")).toHaveTextContent(
        String(items[index].desc),
      );
    });
    expect(groups[3]).toHaveClass("sm:col-span-full");
  });

  it("draws lines between the rows when bordered", () => {
    const { container, rerender } = render(
      <DescriptionList bordered columns={2} items={items} />,
    );

    const list = container.querySelector("dl")!;
    expect(list).toHaveClass("overflow-hidden");
    for (const group of Array.from(list.children)) {
      expect(group).toHaveClass("border-t", "-mt-px");
    }

    // One column: the rows of the grid - the term keeps its column
    rerender(<DescriptionList bordered items={items} />);
    const rows = Array.from(container.querySelector("dl")!.children);
    expect(rows).toHaveLength(4);
    expect(rows[0]).not.toHaveClass("border-t");
    expect(rows[1]).toHaveClass("border-t", "md:grid-cols-subgrid");
    expect(rows[1].querySelector("dt")).toHaveTextContent("Email");
  });

  it("keeps the placeholders of the values while loading", () => {
    const { container } = render(
      <DescriptionList columns={2} items={items} loading />,
    );

    expect(screen.queryByText("Prague")).toBeNull();
    expect(container.querySelectorAll("dd .animate-pulse")).toHaveLength(4);
  });
});
