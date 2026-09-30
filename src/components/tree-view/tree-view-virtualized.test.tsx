import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TreeView, { type TreeItem, type TreeViewProps } from ".";

// 100 regions × 99 stores - 10 000 items
const regions: TreeItem<string>[] = Array.from({ length: 100 }, (_, r) => ({
  children: Array.from({ length: 99 }, (_, s) => ({
    id: `store-${r}-${s}`,
    label: `Store ${r}-${s}`,
  })),
  id: `region-${r}`,
  label: `Region ${r}`,
}));
const allRegions = regions.map((region) => region.id);

const item = (name: string) => screen.getByRole("treeitem", { name });
const queryItem = (name: string) => screen.queryByRole("treeitem", { name });
const tree = () => screen.getByRole("tree");

// The view of the tree is 320px high - ten rows of 32px
let viewHeight = 320;

beforeEach(() => {
  viewHeight = 320;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute("role") === "tree" ? viewHeight : 0;
    },
  );
});

function renderTree(props: Partial<TreeViewProps<TreeItem<string>>> = {}) {
  return render(
    <TreeView
      aria-label="Stores"
      className="h-80"
      defaultExpanded={allRegions}
      items={regions}
      virtualized
      {...props}
    />,
  );
}

/** Scrolls the tree to `scrollTop`, as the user would. */
function scrollTo(scrollTop: number) {
  act(() => {
    tree().scrollTop = scrollTop;
    fireEvent.scroll(tree());
  });
}

describe("TreeView virtualized", () => {
  it("renders only the rows in view as one flat list of tree items", () => {
    renderTree();

    // Ten in view, eight more below
    const rows = screen.getAllByRole("treeitem");
    expect(rows).toHaveLength(18);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    expect(item("Region 0")).toHaveAttribute("aria-level", "1");
    expect(item("Region 0")).toHaveAttribute("aria-posinset", "1");
    expect(item("Region 0")).toHaveAttribute("aria-setsize", "100");
    expect(item("Region 0")).toHaveAttribute("aria-expanded", "true");
    expect(item("Region 0")).not.toHaveAttribute("aria-owns");
    expect(item("Store 0-1")).toHaveAttribute("aria-level", "2");
    expect(item("Store 0-1")).toHaveAttribute("aria-posinset", "2");
    expect(item("Store 0-1")).toHaveAttribute("aria-setsize", "99");
    expect(rows[1]).toHaveStyle({ height: "32px" });

    // The tree scrolls itself; the room of the other rows is kept
    expect(tree()).toHaveClass("overflow-y-auto", "h-80");
    const spacer = tree().lastElementChild as HTMLElement;
    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(spacer.style.height).toBe(`${(10_000 - 18) * 32}px`);
  });

  it("renders the rows scrolled to - and keeps the tab stop", () => {
    renderTree();

    // Row 1000 at the top - Region 10
    scrollTo(1000 * 32);
    expect(item("Region 10")).toBeInTheDocument();
    expect(item("Store 9-98")).toBeInTheDocument();
    expect(queryItem("Store 9-80")).not.toBeInTheDocument();
    expect(queryItem("Store 0-5")).not.toBeInTheDocument();

    // The first row is the tab stop - still there, out of view
    expect(item("Region 0")).toHaveAttribute("tabindex", "0");
  });

  it("scrolls to the row the keys move to and focuses it", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.tab();
    expect(item("Region 0")).toHaveFocus();

    // Down past the view - it scrolls by a row
    for (let press = 0; press < 10; press++) await user.keyboard("{ArrowDown}");
    expect(item("Store 0-9")).toHaveFocus();
    expect(tree().scrollTop).toBe(32);

    // To the end, far out of view: rendered, focused, scrolled to
    await user.keyboard("{End}");
    expect(item("Store 99-98")).toHaveFocus();
    expect(tree().scrollTop).toBe(10_000 * 32 - 320);
    expect(item("Store 99-98")).toHaveAttribute("aria-posinset", "99");

    // Typeahead to a row out of view
    await user.keyboard("{Home}");
    expect(item("Region 0")).toHaveFocus();
    expect(tree().scrollTop).toBe(0);
    await user.keyboard("r");
    expect(item("Region 1")).toHaveFocus();
  });

  it("collapses and expands - the flat list follows", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(item("Region 0")).toHaveAttribute("aria-expanded", "false");
    expect(queryItem("Store 0-0")).not.toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(item("Region 1")).toHaveFocus();
    expect(item("Store 1-0")).toBeInTheDocument();
  });

  it("shows the loading row of children being loaded as a row of its own", async () => {
    const user = userEvent.setup();
    render(
      <TreeView
        aria-label="Files"
        items={[
          { hasChildren: true, id: "docs", label: "Documents" },
          { id: "notes", label: "notes.txt" },
        ]}
        loadChildren={() => new Promise<TreeItem<string>[]>(() => {})}
        virtualized
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByRole("status")).toHaveStyle({ height: "32px" });
    expect(item("Documents")).toHaveAttribute("aria-busy", "true");
  });

  it("filters and checks like a tree that renders every row", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderTree({ checkable: true, filter: "store 5-9", onCheckedChange });

    // Store 5-9 and Store 5-90 … 5-98, with Region 5
    expect(screen.getAllByRole("treeitem")).toHaveLength(11);
    await user.click(item("Store 5-9"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(["store-5-9"]);
    expect(item("Store 5-9")).toHaveAttribute("aria-checked", "true");
    expect(item("Region 5")).toHaveAttribute("aria-checked", "mixed");
  });

  it("takes the row height given", () => {
    renderTree({ rowHeight: 24 });

    // 320 / 24 - 14 rows in view, eight below
    expect(screen.getAllByRole("treeitem")).toHaveLength(22);
    expect(item("Region 0")).toHaveStyle({ height: "24px" });
  });

  it("warns when it has no height of its own", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    viewHeight = 10_000 * 32;
    renderTree({ className: undefined });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("give it a height"),
    );
  });

  it("moves rows dragged from the keyboard to places out of view", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    renderTree({ onMove });

    await user.tab();
    await user.keyboard("{ArrowDown}{Control>}x{/Control}{End}");
    // The last place - after the last region, scrolled into view
    expect(item("Store 99-98")).toHaveAttribute("data-drop-edge", "bottom");
    expect(tree().scrollTop).toBe(10_000 * 32 - 320);

    await user.keyboard("{Enter}");
    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["store-0-0"],
      position: "after",
      targetId: "region-99",
    });
  });

  it("scrolls the line below the loading row of the last item into view", async () => {
    const user = userEvent.setup();
    renderTree({
      defaultExpanded: [...allRegions, "archive"],
      items: [
        ...regions,
        { hasChildren: true, id: "archive", label: "Archive" },
      ],
      loadChildren: () => new Promise<TreeItem<string>[]>(() => {}),
      onMove: () => {},
    });

    await user.tab();
    await user.keyboard("{ArrowDown}{Control>}x{/Control}{End}");
    // After Archive - below its loading row, the last of the 10 002
    const loading = screen.getByText("Loading…").parentElement;
    expect(loading).toHaveAttribute("data-drop-edge", "bottom");
    expect(tree().scrollTop).toBe(10_002 * 32 - 320);
  });
});
