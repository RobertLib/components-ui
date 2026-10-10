import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Award } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import List, { ListItem } from "./list";
import type { LinkComponentProps } from "../../providers/router";
import UIProvider from "../../providers/ui-provider";

describe("List", () => {
  it("is a list of rows with a title, a description and content at the end", () => {
    render(
      <List aria-label="Sections">
        <ListItem
          description="5 records"
          end={<span>New</span>}
          icon={<Award />}
          title="Grades"
        />
      </List>,
    );

    const list = screen.getByRole("list", { name: "Sections" });
    const item = within(list).getByRole("listitem");
    expect(item).toHaveTextContent("Grades 5 records New");
    // The icon is decorative - on a tinted square
    const icon = item.querySelector("svg")!.parentElement!;
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("bg-primary-50");
  });

  it("makes the whole row a link of the router, with a chevron", () => {
    function RouterLink({ href, ...props }: LinkComponentProps) {
      return <a data-router="" href={href} {...props} />;
    }
    render(
      <UIProvider router={{ Link: RouterLink }}>
        <nav aria-label="Menu">
          <List variant="plain">
            <ListItem current href="/card" title="Licence" />
            <ListItem
              description="2 records"
              href="/card/notes"
              title="Notes"
            />
          </List>
        </nav>
      </UIProvider>,
    );

    const current = screen.getByRole("link", { name: "Licence" });
    expect(current).toHaveAttribute("data-router");
    expect(current).toHaveAttribute("aria-current", "page");
    // Highlighted in a menu
    expect(current).toHaveClass("bg-primary-50");
    const notes = screen.getByRole("link", { name: "Notes 2 records" });
    expect(notes).toHaveAttribute("href", "/card/notes");
    expect(notes.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("makes the row a button with onClick, its actions beside it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onEdit = vi.fn();
    render(
      <List variant="separate">
        <ListItem
          actions={
            <button onClick={onEdit} type="button">
              Edit
            </button>
          }
          onClick={onClick}
          title="Jana Nováková"
        />
      </List>,
    );

    const row = screen.getByRole("button", { name: "Jana Nováková" });
    // The actions are no part of the row's button
    expect(row).not.toContainElement(
      screen.getByRole("button", { name: "Edit" }),
    );
    await user.click(row);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("calls onClick of a link before it is followed - e.g. to close a drawer", async () => {
    const user = userEvent.setup();
    const targets: EventTarget[] = [];
    const onClick = vi.fn((event: React.MouseEvent) => {
      targets.push(event.currentTarget);
      event.preventDefault();
    });
    render(
      <List>
        <ListItem href="/card" onClick={onClick} title="Licence" />
      </List>,
    );

    await user.click(screen.getByRole("link", { name: "Licence" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(targets).toEqual([screen.getByRole("link")]);
  });

  it("marks a button that switches a view as the current one, not as the page", () => {
    render(
      <List variant="plain">
        <ListItem current onClick={() => {}} title="Licence" />
        <ListItem onClick={() => {}} title="Grades" />
      </List>,
    );

    expect(screen.getByRole("button", { name: "Licence" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Grades" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("highlights and rings the whole row of a link with actions", () => {
    render(
      <List variant="plain">
        <ListItem
          actions={<button type="button">Edit</button>}
          current
          href="/card"
          title="Licence"
        />
        <ListItem href="/card/notes" title="Notes" />
      </List>,
    );

    // The padded row around the link and its actions - not the link alone
    const link = screen.getByRole("link", { name: "Licence" });
    const row = link.closest("li")!;
    expect(row).toHaveClass(
      "px-3",
      "bg-primary-50",
      "has-[>:focus-visible]:ring-2",
    );
    expect(link).not.toHaveClass("bg-primary-50");
    expect(link).not.toHaveClass("focus-visible:ring-2");
    // A row without actions has them on its link, as before
    const notes = screen.getByRole("link", { name: "Notes" });
    expect(notes).toHaveClass("px-3", "focus-visible:ring-2");
    expect(notes.closest("li")!.className).toBe("");
  });

  it("cannot be used while disabled - a link without an href", () => {
    render(
      <List>
        <ListItem disabled href="/card" title="Licence" />
        <ListItem disabled onClick={() => {}} title="Switch" />
      </List>,
    );

    const link = screen.getByRole("link", { name: "Licence" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
    expect(screen.getByRole("button", { name: "Switch" })).toBeDisabled();
  });

  it("announces a disabled link as the page shown, as it is highlighted", () => {
    render(
      <List variant="plain">
        <ListItem current disabled href="/card" title="Licence" />
      </List>,
    );

    const link = screen.getByRole("link", { name: "Licence", current: "page" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveClass("bg-primary-50");
  });

  it("frames, divides or separates the rows by its variant", () => {
    const { rerender } = render(
      <List data-testid="list" variant="framed">
        <ListItem title="One" />
      </List>,
    );
    expect(screen.getByTestId("list")).toHaveClass("rounded-xl", "divide-y");

    rerender(
      <List data-testid="list" size="md">
        <ListItem title="One" />
      </List>,
    );
    expect(screen.getByTestId("list")).toHaveClass("divide-y");
    expect(screen.getByText("One")).toHaveClass("text-base");
  });
});
