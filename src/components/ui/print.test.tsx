import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import Dialog, { DialogFooter } from "./dialog";
import Dropdown from "./dropdown";
import Header from "./header";
import { BACKGROUND_ATTRIBUTE } from "./overlay-stack";
import Sheet from "./sheet";
import Table, {
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableRow,
} from "./table";
import Tabs from "./tabs";
import Tooltip from "./tooltip";
import { useSnackbar } from "../../providers/snackbar-context";
import SnackbarProvider from "../../providers/snackbar-provider";

// The print styles of the stylesheet - jsdom loads no CSS, so the rules
// the components rely on are checked in its text
const stylesheet = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../styles.css"),
  "utf8",
);
const printRules = /@media print \{([\s\S]*?)\n\}/.exec(stylesheet)?.[1] ?? "";

const openAnimation = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("Printing", () => {
  it("leaves the frame of the app out and gives the content the width", () => {
    expect(printRules).toMatch(
      /\.cui-drawer,\s*\.cui-banners,\s*\.cui-navbar \{\s*display: none !important;/,
    );
    expect(printRules).toMatch(
      /\.cui-drawer ~ main \{\s*margin-inline-start: 0 !important;\s*width: auto !important;/,
    );
    // Light parts of the browser on a dark page
    expect(printRules).toMatch(/color-scheme: light !important/);
  });

  it("prints an open Dialog alone - the page behind it is marked", async () => {
    const { container, rerender } = render(
      <Dialog open title="Invoice 2026-0042">
        Total 12 100 Kč
        <DialogFooter>
          <button type="button">Close</button>
        </DialogFooter>
      </Dialog>,
    );
    await act(openAnimation);

    expect(container).toHaveAttribute(BACKGROUND_ATTRIBUTE);
    const dialog = screen.getByRole("dialog", { name: "Invoice 2026-0042" });
    // In the flow of the page, as long as its content (styles.css)
    expect(dialog).toHaveClass("cui-modal-dialog");
    expect(printRules).toMatch(
      /\[data-cui-background\] \{\s*display: none !important;/,
    );
    expect(printRules).toMatch(
      /\.cui-modal-dialog \{\s*position: static !important;/,
    );
    // No buttons and no backdrop on paper
    expect(
      screen.getByRole("button", { name: "Close" }).parentElement,
    ).toHaveClass("print:hidden");
    expect(dialog.previousElementSibling).toHaveClass("print:hidden");
    expect(dialog.querySelector("header")).toHaveClass("print:static");

    rerender(
      <Dialog open={false} title="Invoice 2026-0042">
        Total
      </Dialog>,
    );
    expect(container).not.toHaveAttribute(BACKGROUND_ATTRIBUTE);
  });

  it("prints an open Sheet alone too", async () => {
    const { container } = render(
      <Sheet open title="Order 42">
        Details
      </Sheet>,
    );
    await act(openAnimation);

    expect(container).toHaveAttribute(BACKGROUND_ATTRIBUTE);
    expect(screen.getByRole("dialog", { name: "Order 42" })).toHaveClass(
      "cui-modal-dialog",
    );
  });

  it("leaves the tooltips, menus and toasts out", async () => {
    const user = userEvent.setup();

    function Page() {
      const { enqueueSnackbar } = useSnackbar();
      return (
        <>
          <Tooltip title="Saves the draft">
            <button
              onClick={() => enqueueSnackbar("Saved", "success")}
              type="button"
            >
              Save
            </button>
          </Tooltip>
          <Dropdown
            aria-label="Actions"
            items={[{ label: "Archive" }]}
            trigger={<span>Actions</span>}
          />
        </>
      );
    }

    render(
      <SnackbarProvider>
        <Page />
      </SnackbarProvider>,
    );

    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveClass("print:hidden");
    await user.keyboard("{Enter}");
    expect(document.querySelector("[data-focus-trap-exempt]")).toHaveClass(
      "print:hidden",
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(
      screen.getByRole("menu").closest(".pointer-events-none.relative"),
    ).toHaveClass("print:hidden");
  });

  it("prints a scrolling table whole - the header on every page, no row split", () => {
    render(
      <Table caption="Invoices" maxHeight="12rem" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Number</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>2026-0042</TableCell>
          </TableRow>
        </TableBody>
        <TableFoot>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFoot>
      </Table>,
    );

    const table = screen.getByRole("table", { name: "Invoices" });
    const frame = table.parentElement!;
    expect(frame).toHaveClass("print:overflow-visible", "print:max-h-none!");
    const [head, body, foot] = Array.from(table.children).filter(
      (child) => child.tagName !== "CAPTION",
    );
    expect(head).toHaveClass("print:table-header-group");
    expect(body).toHaveClass("print:[&>tr]:break-inside-avoid");
    // The totals once, at the end - not on every page
    expect(foot).toHaveClass("print:table-row-group");
    expect(screen.getByRole("columnheader", { name: "Number" })).toHaveClass(
      "print:static",
    );
  });

  it("prints the active tab with its panel alone", () => {
    render(
      <Tabs
        items={[
          { content: "Customer details", label: "Overview", value: "overview" },
          { content: "Invoices", label: "Invoices", value: "invoices" },
        ]}
        value="overview"
      />,
    );

    expect(
      screen.getByRole("tab", { name: "Overview" }).closest("li"),
    ).not.toHaveClass("print:hidden");
    expect(
      screen.getByRole("tab", { name: "Invoices" }).closest("li"),
    ).toHaveClass("print:hidden");
    // Not scrolled on paper
    expect(screen.getByRole("tablist").parentElement).toHaveClass(
      "print:overflow-visible",
    );
  });

  it("leaves the commands of a Header out", () => {
    render(
      <Header
        actions={<button type="button">Export</button>}
        back
        breadcrumbs={[{ href: "/orders", label: "Orders" }, { label: "42" }]}
        title="Order 42"
      />,
    );

    expect(screen.getByRole("button", { name: "Back" })).toHaveClass(
      "print:hidden",
    );
    expect(
      screen.getByRole("button", { name: "Export" }).parentElement,
    ).toHaveClass("print:hidden");
    // The path stays - it tells what was printed
    expect(
      screen.getByRole("navigation").closest(".print\\:hidden"),
    ).toBeNull();
  });
});
