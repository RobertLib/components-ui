import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
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

  it("tells its state to styles - on the panel, the toggle and the content", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <Accordion data-testid="section" header="Shipping" ref={ref}>
        Details
      </Accordion>,
    );
    const section = screen.getByTestId("section");
    const toggle = screen.getByRole("button", { name: "Shipping" });

    expect(ref.current).toBe(section);
    expect(section).toHaveAttribute("data-state", "open");
    expect(toggle).toHaveAttribute("data-state", "open");
    expect(screen.getByText("Details")).toHaveAttribute("data-state", "open");
    expect(section).not.toHaveAttribute("data-disabled");

    await user.click(toggle);
    expect(section).toHaveAttribute("data-state", "closed");
    expect(toggle).toHaveAttribute("data-state", "closed");

    rerender(
      <Accordion data-testid="section" disabled header="Shipping" ref={ref}>
        Details
      </Accordion>,
    );
    expect(section).toHaveAttribute("data-disabled", "");
    expect(toggle).toHaveAttribute("data-disabled", "");
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

describe("Accordion - disabled and kept mounted", () => {
  it("cannot be toggled while disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Accordion
        defaultOpen={false}
        disabled
        header="Shipping"
        onOpenChange={onOpenChange}
      >
        Details
      </Accordion>,
    );

    const toggle = screen.getByRole("button", { name: "Shipping" });
    expect(toggle).toBeDisabled();
    await user.click(screen.getByText("Shipping"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Details")).toBeNull();
    // Not a Tab stop
    await user.tab();
    expect(toggle).not.toHaveFocus();
  });

  it("keeps closed content in the page, hidden, with keepMounted", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultOpen={false} header="Notes" keepMounted>
        <input aria-label="Note" />
      </Accordion>,
    );

    const toggle = screen.getByRole("button", { name: "Notes" });
    const content = document.getElementById(
      toggle.getAttribute("aria-controls")!,
    );
    // Pointed at also while closed - it is there
    expect(content).not.toBeNull();
    expect(content).toHaveAttribute("hidden");
    expect(screen.queryByRole("textbox")).toBeNull();

    await user.click(toggle);
    expect(content).not.toHaveAttribute("hidden");
    await user.type(screen.getByRole("textbox", { name: "Note" }), "Fragile");

    await user.click(toggle);
    await waitFor(() => expect(content).toHaveAttribute("hidden"));
    // The same element with its state
    await user.click(toggle);
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue(
      "Fragile",
    );
  });
});
