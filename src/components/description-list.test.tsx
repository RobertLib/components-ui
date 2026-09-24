import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DescriptionList from "./description-list";
import UIProvider from "../providers/ui-provider";

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
