import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import EmptyState from "./empty-state";

describe("EmptyState", () => {
  it("shows a heading, a description and the actions", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const { container } = render(
      <EmptyState
        action={
          <>
            <button onClick={onCreate} type="button">
              New invoice
            </button>
            <button type="button">Import</button>
          </>
        }
        description="Invoices you create will show up here."
        icon={<Inbox />}
        title="No invoices yet"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "No invoices yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Invoices you create will show up here."),
    ).toBeInTheDocument();
    // The icon is decoration
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "New invoice" }));
    expect(onCreate).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  it("fits into the outline of the page", () => {
    render(<EmptyState headingLevel={2} title="Welcome to Invoices" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Welcome to Invoices" }),
    ).toBeInTheDocument();
  });

  it("is compact in a small size, and takes attributes", () => {
    render(
      <EmptyState
        className="border border-dashed"
        data-testid="empty"
        size="sm"
        title="No results"
      >
        <p>Try another search.</p>
      </EmptyState>,
    );

    const empty = screen.getByTestId("empty");
    expect(empty).toHaveClass("py-6", "border-dashed");
    expect(screen.getByRole("heading", { name: "No results" })).toHaveClass(
      "text-sm",
    );
    expect(screen.getByText("Try another search.")).toBeInTheDocument();
  });
});
