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
});
