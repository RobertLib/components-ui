import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Button from "./button";
import ButtonGroup from "./button-group";
import Dialog from "./dialog";
import Dropdown from "./dropdown";
import Tooltip from "./tooltip";

describe("ButtonGroup", () => {
  it("is a named group of joined buttons", () => {
    render(
      <ButtonGroup aria-label="Invoice actions">
        <Button>Edit</Button>
        <Button>Duplicate</Button>
        <Button>Delete</Button>
      </ButtonGroup>,
    );

    const group = screen.getByRole("group", { name: "Invoice actions" });
    expect(group).toHaveClass("inline-flex");

    const [edit, duplicate, remove] = screen.getAllByRole("button");
    // Only the outer corners are round
    expect(edit).toHaveClass("rounded-l-md");
    expect(edit).not.toHaveClass("rounded-md", "rounded-r-md", "-ml-px");
    expect(duplicate).not.toHaveClass("rounded-md", "rounded-l-md");
    expect(duplicate).toHaveClass("-ml-px");
    expect(remove).toHaveClass("rounded-r-md", "-ml-px");
  });

  it("gives its size, variant and color to buttons without their own", () => {
    render(
      <ButtonGroup
        aria-label="Filters"
        color="secondary"
        size="sm"
        variant="outline"
      >
        <Button>All</Button>
        <Button color="danger" size="lg" variant="solid">
          Overdue
        </Button>
      </ButtonGroup>,
    );

    const all = screen.getByRole("button", { name: "All" });
    expect(all).toHaveClass("px-2", "border-[1.5px]", "text-secondary-600");
    // The outline border overlaps the one before
    const overdue = screen.getByRole("button", { name: "Overdue" });
    expect(overdue).toHaveClass("px-4", "from-danger-600", "-ml-px");
  });

  it("joins the buttons in a column", () => {
    render(
      <ButtonGroup aria-label="Zoom" orientation="vertical" variant="outline">
        <Button>In</Button>
        <Button>Out</Button>
      </ButtonGroup>,
    );

    expect(screen.getByRole("group")).toHaveClass("flex-col");
    expect(screen.getByRole("button", { name: "In" })).toHaveClass(
      "rounded-t-md",
    );
    expect(screen.getByRole("button", { name: "Out" })).toHaveClass(
      "rounded-b-md",
      "-mt-[1.5px]",
    );
  });

  it("joins the button of a Dropdown or a Tooltip too", async () => {
    const user = userEvent.setup();
    render(
      <ButtonGroup aria-label="Actions" variant="outline">
        <Tooltip title="Edit the invoice">
          <Button>Edit</Button>
        </Tooltip>
        {false}
        <Dropdown
          buttonTrigger
          items={[{ label: "Archive" }]}
          trigger={<Button aria-label="More actions">…</Button>}
        />
      </ButtonGroup>,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass(
      "rounded-l-md",
    );
    const more = screen.getByRole("button", { name: "More actions" });
    expect(more).toHaveClass("rounded-r-md", "border-[1.5px]");

    await user.click(more);
    expect(
      screen.getByRole("menuitem", { name: "Archive" }),
    ).toBeInTheDocument();
  });

  it("passes on what a group around it sets", () => {
    render(
      <ButtonGroup aria-label="Toolbar" size="sm">
        <ButtonGroup aria-label="History" variant="ghost">
          <Button>Undo</Button>
        </ButtonGroup>
      </ButtonGroup>,
    );

    expect(screen.getByRole("button", { name: "Undo" })).toHaveClass(
      "px-2",
      "border-transparent",
    );
  });

  it("renders on the server", () => {
    const html = renderToString(
      <ButtonGroup aria-label="Actions">
        <Button>Edit</Button>
      </ButtonGroup>,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain("rounded-l-md");
  });
});

describe("ButtonGroup and overlays", () => {
  it("does not style the buttons of a dialog opened from inside it", () => {
    function DeleteButton() {
      return (
        <>
          <Button>Delete</Button>
          <Dialog open title="Delete the invoice?">
            <Button>Confirm</Button>
          </Dialog>
        </>
      );
    }

    render(
      <ButtonGroup aria-label="Invoice" color="default" variant="ghost">
        <Button>Edit</Button>
        <DeleteButton />
      </ButtonGroup>,
    );

    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm.className).not.toMatch(/-ml-|rounded-r-md|rounded-l-md/);
    // The default solid primary look, not the group's ghost one
    expect(confirm.className).toMatch(
      /from-primary-600 to-primary-700 text-white/,
    );
  });
});
