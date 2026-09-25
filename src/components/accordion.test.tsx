import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Accordion from "./accordion";
import CollapsibleContent from "./collapsible-content";

describe("Accordion", () => {
  it("shows open content without animating it in", () => {
    render(<CollapsibleContent isOpen>Details</CollapsibleContent>);

    expect(screen.getByText("Details").style.height).toBe("");
  });

  it("collapses and unmounts the content", async () => {
    const user = userEvent.setup();
    render(<Accordion header="Shipping">Details</Accordion>);

    await user.click(screen.getByText("Shipping"));

    await waitFor(() => expect(screen.queryByText("Details")).toBeNull());
    expect(
      screen.getByRole("button", { expanded: false, name: "Shipping" }),
    ).toBeInTheDocument();
  });

  it("starts collapsed with defaultOpen and toggles from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultOpen={false} header="Shipping">
        Details
      </Accordion>,
    );
    expect(screen.queryByText("Details")).toBeNull();

    // One control - no button nested in another
    await user.tab();
    expect(screen.getByRole("button", { name: "Shipping" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("opens and closes at once for users who prefer reduced motion", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: () => {},
      matches: query === "(prefers-reduced-motion: reduce)",
      removeEventListener: () => {},
    }));

    try {
      render(<Accordion header="Shipping">Details</Accordion>);

      await user.click(screen.getByText("Shipping"));
      expect(screen.queryByText("Details")).toBeNull();

      await user.click(screen.getByText("Shipping"));
      expect(screen.getByText("Details").style.height).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("follows a controlled open", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Accordion header="Shipping" onOpenChange={onOpenChange} open>
        Details
      </Accordion>,
    );

    await user.click(screen.getByText("Shipping"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    // The parent has not closed it
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("leaves links and buttons in the header to themselves", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <Accordion
        header={
          <span>
            Shipping{" "}
            <button onClick={onEdit} type="button">
              Edit
            </button>{" "}
            <a href="#terms">Terms</a> <input aria-label="Note" />
          </span>
        }
      >
        Details
      </Accordion>,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("link", { name: "Terms" }));
    await user.click(screen.getByRole("textbox", { name: "Note" }));

    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.getByText("Details")).toBeInTheDocument();

    // The rest of the header still toggles
    await user.click(screen.getByText(/Shipping/));
    await waitFor(() => expect(screen.queryByText("Details")).toBeNull());
  });

  it("points the toggle at the content it controls", () => {
    render(<Accordion header="Shipping">Details</Accordion>);

    const toggle = screen.getByRole("button", { expanded: true });
    const content = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(content).toHaveTextContent("Details");
  });

  it("stops pointing at the content once it is gone", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultOpen={false} header="Shipping">
        Details
      </Accordion>,
    );

    const toggle = screen.getByRole("button", { name: "Shipping" });
    expect(toggle).not.toHaveAttribute("aria-controls");

    await user.click(toggle);
    expect(
      document.getElementById(toggle.getAttribute("aria-controls") ?? ""),
    ).toHaveTextContent("Details");
  });

  it("makes the header a heading of the level given", () => {
    render(
      <>
        <Accordion header="Shipping">Details</Accordion>
        <Accordion header="Billing" headingLevel={2}>
          Details
        </Accordion>
        {/* A heading of its own is not wrapped in another one */}
        <Accordion header={<h4>Payment</h4>}>Details</Accordion>
      </>,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Shipping" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Billing" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Payment" })).toHaveLength(1);
    // The toggle is named by the heading
    expect(
      screen.getByRole("button", { expanded: true, name: "Shipping" }),
    ).toBeInTheDocument();
  });
});
