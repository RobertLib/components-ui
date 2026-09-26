import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TreeView, { type TreeItem, type TreeViewProps } from ".";
import type { LinkComponentProps } from "../../providers/router";
import UIProvider from "../../providers/ui-provider";

const categories: TreeItem<string>[] = [
  {
    children: [
      {
        children: [
          { id: "ultrabooks", label: "Ultrabooks" },
          { id: "gaming", label: "Gaming laptops" },
        ],
        id: "laptops",
        label: "Laptops",
      },
      { id: "phones", label: "Phones" },
      { id: "cameras", label: "Cameras" },
    ],
    id: "electronics",
    label: "Electronics",
  },
  {
    children: [
      { id: "fiction", label: "Fiction" },
      { id: "science", label: "Science" },
    ],
    id: "books",
    label: "Books",
  },
  { id: "garden", label: "Garden" },
];

const item = (name: string) => screen.getByRole("treeitem", { name });
const queryItem = (name: string) => screen.queryByRole("treeitem", { name });
const itemNames = () =>
  screen.getAllByRole("treeitem").map((element) => element.textContent);

function renderTree(props: Partial<TreeViewProps<TreeItem<string>>> = {}) {
  return render(
    <TreeView aria-label="Categories" items={categories} {...props} />,
  );
}

/** Lays the page out right to left - jsdom knows no `dir`. */
function mockRightToLeft() {
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return new Proxy(style, {
      get: (target, property) => {
        if (property === "direction") return "rtl";
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

describe("TreeView", () => {
  it("renders the top level as a named tree with positions and states", () => {
    renderTree();

    expect(
      screen.getByRole("tree", { name: "Categories" }),
    ).toBeInTheDocument();
    expect(itemNames()).toEqual(["Electronics", "Books", "Garden"]);

    expect(item("Electronics")).toHaveAttribute("aria-level", "1");
    expect(item("Electronics")).toHaveAttribute("aria-posinset", "1");
    expect(item("Electronics")).toHaveAttribute("aria-setsize", "3");
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "false");
    // A leaf has no expanded state
    expect(item("Garden")).not.toHaveAttribute("aria-expanded");
  });

  it("puts the children in a group the parent owns and names", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(item("Electronics"));
    // Selecting does not expand - the chevron does
    expect(queryItem("Phones")).not.toBeInTheDocument();

    const chevron = item("Electronics").querySelector("[data-tree-toggle]");
    await user.click(chevron as Element);

    const group = screen.getByRole("group", { name: "Electronics" });
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "true");
    expect(item("Electronics")).toHaveAttribute("aria-owns", group.id);
    expect(within(group).getAllByRole("treeitem")[0]).toHaveTextContent(
      "Laptops",
    );
    expect(item("Phones")).toHaveAttribute("aria-level", "2");
    expect(item("Phones")).toHaveAttribute("aria-posinset", "2");
    expect(item("Phones")).toHaveAttribute("aria-setsize", "3");
  });

  it("is one tab stop - the selected item, else the first", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TreeView
          aria-label="Categories"
          defaultExpanded={["books"]}
          defaultSelected={["science"]}
          items={categories}
        />
        <button type="button">After</button>
      </>,
    );

    const tabStops = screen
      .getAllByRole("treeitem")
      .filter((element) => element.tabIndex === 0);
    expect(tabStops).toEqual([item("Science")]);

    await user.tab();
    expect(item("Science")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("moves with the arrow keys, Home and End, and expands with Right", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.tab();
    expect(item("Electronics")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(item("Books")).toHaveFocus();

    // Right expands, again moves to the first child, Left goes back
    await user.keyboard("{ArrowRight}");
    expect(item("Books")).toHaveAttribute("aria-expanded", "true");
    expect(item("Books")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Fiction")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item("Books")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item("Books")).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{End}");
    expect(item("Garden")).toHaveFocus();
    // No wrapping at the end
    await user.keyboard("{ArrowDown}");
    expect(item("Garden")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Electronics")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item("Electronics")).toHaveFocus();

    // The focused item is the tab stop
    await user.keyboard("{ArrowDown}");
    expect(item("Books")).toHaveAttribute("tabindex", "0");
    expect(item("Electronics")).toHaveAttribute("tabindex", "-1");
  });

  it("expands with Left and collapses with Right in a right-to-left page", async () => {
    const user = userEvent.setup();
    mockRightToLeft();
    renderTree();

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowLeft}");
    expect(item("Laptops")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Electronics")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "false");
  });

  it("expands all siblings with *", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.tab();
    await user.keyboard("*");

    expect(item("Electronics")).toHaveAttribute("aria-expanded", "true");
    expect(item("Books")).toHaveAttribute("aria-expanded", "true");
    expect(item("Electronics")).toHaveFocus();
    // Not the children
    expect(item("Laptops")).toHaveAttribute("aria-expanded", "false");
  });

  it("moves to the next item starting with typed letters", async () => {
    const user = userEvent.setup();
    renderTree({ defaultExpanded: ["electronics", "laptops"] });

    await user.tab();
    await user.keyboard("g");
    expect(item("Gaming laptops")).toHaveFocus();
    // The same letter again - the next one
    await user.keyboard("g");
    expect(item("Garden")).toHaveFocus();

    // Letters typed quickly are one search
    await user.keyboard("{Home}");
    await user.keyboard("ca");
    expect(item("Cameras")).toHaveFocus();
  });

  it("continues a typeahead search with Space", async () => {
    const user = userEvent.setup();
    render(
      <TreeView
        aria-label="Cities"
        items={[
          { id: 1, label: "New Jersey" },
          { id: 2, label: "New York" },
          { id: 3, label: "Newark" },
        ]}
        selectionMode="multiple"
      />,
    );

    await user.tab();
    await user.keyboard("new y");
    expect(item("New York")).toHaveFocus();
    // Nothing got selected by the space
    expect(item("New York")).toHaveAttribute("aria-selected", "false");
  });

  it("toggles a parent on click where nothing is selected", async () => {
    const user = userEvent.setup();
    renderTree({ selectionMode: "none" });

    await user.click(item("Books"));
    expect(item("Books")).toHaveAttribute("aria-expanded", "true");
    expect(item("Books")).not.toHaveAttribute("aria-selected");

    await user.keyboard("{Enter}");
    expect(item("Books")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("TreeView expansion", () => {
  it("works controlled", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();

    function Controlled() {
      const [expanded, setExpanded] = useState<string[]>(["books"]);
      return (
        <TreeView
          aria-label="Categories"
          expanded={expanded}
          items={categories}
          onExpandedChange={(next) => {
            onExpandedChange(next);
            setExpanded(next);
          }}
        />
      );
    }

    render(<Controlled />);
    expect(item("Fiction")).toBeInTheDocument();

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onExpandedChange).toHaveBeenLastCalledWith(["books", "electronics"]);
    expect(item("Laptops")).toBeInTheDocument();
  });

  it("does not expand when the parent ignores the change", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderTree({ expanded: [] });

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "false");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`expanded`"));
  });

  it("toggles a parent on double click where a click selects", async () => {
    const user = userEvent.setup();
    renderTree();

    await user.dblClick(item("Books"));
    expect(item("Books")).toHaveAttribute("aria-expanded", "true");
    expect(item("Books")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the focus in the tree when the focused item is collapsed away", async () => {
    const user = userEvent.setup();

    function Collapsing() {
      const [expanded, setExpanded] = useState<string[]>(["books"]);
      return (
        <>
          <TreeView
            aria-label="Categories"
            expanded={expanded}
            items={categories}
            onExpandedChange={setExpanded}
            onKeyDown={(event) => {
              if (event.key === "x") setExpanded([]);
            }}
          />
        </>
      );
    }

    render(<Collapsing />);
    await user.click(item("Science"));
    expect(item("Science")).toHaveFocus();

    await user.keyboard("x");
    expect(queryItem("Science")).not.toBeInTheDocument();
    expect(item("Books")).toHaveFocus();
  });
});

describe("TreeView selection", () => {
  it("selects one item with a click, Enter or Space", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    const onItemClick = vi.fn();
    renderTree({ onItemClick, onSelectedChange });

    const tree = screen.getByRole("tree");
    expect(tree).not.toHaveAttribute("aria-multiselectable");

    await user.click(item("Books"));
    expect(onSelectedChange).toHaveBeenLastCalledWith(["books"]);
    expect(onItemClick).toHaveBeenLastCalledWith(categories[1]);
    expect(item("Books")).toHaveAttribute("aria-selected", "true");
    // Only the selected item has the state in a single-select tree
    expect(item("Garden")).not.toHaveAttribute("aria-selected");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(item("Garden")).toHaveAttribute("aria-selected", "true");
    expect(item("Books")).not.toHaveAttribute("aria-selected");

    await user.keyboard("{ArrowUp}[Space]");
    expect(onSelectedChange).toHaveBeenLastCalledWith(["books"]);
    // Selecting the selected item again changes nothing
    onSelectedChange.mockClear();
    await user.click(item("Books"));
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it("works controlled", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [selected, setSelected] = useState<string[]>(["garden"]);
      return (
        <>
          <TreeView
            aria-label="Categories"
            items={categories}
            onSelectedChange={setSelected}
            selected={selected}
          />
          <output>{selected.join(",")}</output>
          <button onClick={() => setSelected([])} type="button">
            Clear
          </button>
        </>
      );
    }

    render(<Controlled />);
    expect(item("Garden")).toHaveAttribute("aria-selected", "true");

    await user.click(item("Books"));
    expect(screen.getByRole("status")).toHaveTextContent("books");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(item("Books")).not.toHaveAttribute("aria-selected");
  });

  it("toggles items in a multiple selection and selects ranges", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    renderTree({
      defaultExpanded: ["books"],
      onSelectedChange,
      selectionMode: "multiple",
    });

    expect(screen.getByRole("tree")).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
    // Every selectable item says whether it is selected
    expect(item("Garden")).toHaveAttribute("aria-selected", "false");

    await user.click(item("Electronics"));
    await user.click(item("Fiction"));
    expect(onSelectedChange).toHaveBeenLastCalledWith([
      "electronics",
      "fiction",
    ]);

    await user.click(item("Electronics"));
    expect(onSelectedChange).toHaveBeenLastCalledWith(["fiction"]);

    // Shift + click adds the range from the last toggled item
    await user.click(item("Books"));
    await user.keyboard("{Shift>}");
    await user.click(item("Garden"));
    await user.keyboard("{/Shift}");
    expect(onSelectedChange).toHaveBeenLastCalledWith([
      "fiction",
      "books",
      "science",
      "garden",
    ]);
  });

  it("selects with the keys of a multi-select tree", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    renderTree({ onSelectedChange, selectionMode: "multiple" });

    await user.tab();
    await user.keyboard("[Space]");
    expect(onSelectedChange).toHaveBeenLastCalledWith(["electronics"]);

    // Shift + Down moves and toggles
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(item("Books")).toHaveFocus();
    expect(onSelectedChange).toHaveBeenLastCalledWith(["electronics", "books"]);

    // Ctrl + A selects all, again none
    await user.keyboard("{Control>}a{/Control}");
    expect(onSelectedChange).toHaveBeenLastCalledWith([
      "electronics",
      "books",
      "garden",
    ]);
    await user.keyboard("{Control>}a{/Control}");
    expect(onSelectedChange).toHaveBeenLastCalledWith([]);

    // Ctrl + Shift + End selects to the last item
    await user.keyboard("{Control>}{Shift>}{End}{/Shift}{/Control}");
    expect(item("Garden")).toHaveFocus();
    expect(onSelectedChange).toHaveBeenLastCalledWith(["books", "garden"]);
  });

  it("does not select, check or follow disabled items - but expands them", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    const onItemClick = vi.fn();
    render(
      <TreeView
        aria-label="Categories"
        items={[
          {
            children: [{ id: "old-child", label: "Old child" }],
            disabled: true,
            id: "old",
            label: "Old",
          },
        ]}
        onItemClick={onItemClick}
        onSelectedChange={onSelectedChange}
      />,
    );

    expect(item("Old")).toHaveAttribute("aria-disabled", "true");
    await user.click(item("Old"));
    expect(onSelectedChange).not.toHaveBeenCalled();
    expect(onItemClick).not.toHaveBeenCalled();

    await user.keyboard("{ArrowRight}");
    expect(item("Old child")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{ArrowDown}[Space]");
    expect(onSelectedChange).not.toHaveBeenCalled();
  });
});

describe("TreeView checkboxes", () => {
  const permissions: TreeItem<string>[] = [
    {
      children: [
        { id: "orders.read", label: "Read" },
        { id: "orders.write", label: "Write" },
      ],
      id: "orders",
      label: "Orders",
    },
    {
      children: [
        { id: "users.invite", label: "Invite" },
        { disabled: true, id: "users.delete", label: "Delete" },
      ],
      id: "users",
      label: "Users",
    },
  ];

  it("checks the descendants and shows a partly checked parent as mixed", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <TreeView
        aria-label="Permissions"
        checkable
        defaultExpanded={["orders", "users"]}
        items={permissions}
        onCheckedChange={onCheckedChange}
      />,
    );

    // Nothing selects in a checkbox tree by default
    expect(item("Orders")).not.toHaveAttribute("aria-selected");
    expect(item("Orders")).toHaveAttribute("aria-checked", "false");

    await user.click(item("Orders"));
    expect(onCheckedChange).toHaveBeenLastCalledWith([
      "orders",
      "orders.read",
      "orders.write",
    ]);
    expect(item("Read")).toHaveAttribute("aria-checked", "true");

    await user.click(item("Write"));
    expect(item("Orders")).toHaveAttribute("aria-checked", "mixed");
    const checkbox = item("Orders").querySelector("input");
    expect(checkbox).toHaveProperty("indeterminate", true);
    expect(checkbox).toHaveAttribute("aria-hidden", "true");

    // Space toggles the focused item
    await user.keyboard("{ArrowUp}[Space]");
    expect(item("Read")).toHaveAttribute("aria-checked", "false");
    expect(item("Orders")).toHaveAttribute("aria-checked", "false");
  });

  it("leaves disabled descendants as they are", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <TreeView
        aria-label="Permissions"
        checkable
        defaultExpanded={["users"]}
        items={permissions}
        onCheckedChange={onCheckedChange}
      />,
    );

    await user.click(item("Users"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(["users.invite"]);
    expect(item("Users")).toHaveAttribute("aria-checked", "mixed");

    // All that can be checked are - the next click unchecks them
    await user.click(item("Users"));
    expect(onCheckedChange).toHaveBeenLastCalledWith([]);

    await user.click(item("Delete"));
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it("works controlled - a parent id checks all its children", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [checked, setChecked] = useState<string[]>(["orders"]);
      return (
        <>
          <TreeView
            aria-label="Permissions"
            checkable
            checked={checked}
            defaultExpanded={["orders"]}
            items={permissions}
            onCheckedChange={setChecked}
          />
          <output>{checked.join(",")}</output>
        </>
      );
    }

    render(<Controlled />);
    expect(item("Read")).toHaveAttribute("aria-checked", "true");
    expect(item("Write")).toHaveAttribute("aria-checked", "true");

    await user.click(item("Read"));
    expect(screen.getByRole("status")).toHaveTextContent("orders.write");
    expect(item("Orders")).toHaveAttribute("aria-checked", "mixed");
  });

  it("keeps the checkbox pictures in step after a form reset", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [checked, setChecked] = useState<string[]>([]);
      return (
        <TreeView
          aria-label="Controlled"
          checkable
          checked={checked}
          defaultExpanded={["orders"]}
          items={permissions}
          onCheckedChange={setChecked}
        />
      );
    }

    render(
      <form data-testid="form">
        <Controlled />
        <TreeView
          aria-label="Uncontrolled"
          checkable
          defaultExpanded={["orders"]}
          items={permissions}
        />
        <TreeView
          aria-label="Named"
          checkable
          defaultChecked={["orders.write"]}
          defaultExpanded={["orders"]}
          items={permissions}
          name="permissions"
        />
      </form>,
    );

    const trees = screen.getAllByRole("tree");
    for (const tree of trees) {
      await user.click(within(tree).getByRole("treeitem", { name: "Read" }));
    }
    act(() => (screen.getByTestId("form") as HTMLFormElement).reset());

    // What each item says is what its picture shows
    for (const row of screen.getAllByRole("treeitem")) {
      const picture = row.querySelector("input");
      const state = row.getAttribute("aria-checked");
      expect(picture?.checked).toBe(state === "true");
      expect(picture?.indeterminate).toBe(state === "mixed");
    }
    // The controlled and the unnamed tree keep their state, the named one
    // is back at its default
    expect(
      within(trees[0]).getByRole("treeitem", { name: "Read" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(trees[1]).getByRole("treeitem", { name: "Read" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(trees[2]).getByRole("treeitem", { name: "Read" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("checks with a click on the checkbox where a click selects", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(
      <TreeView
        aria-label="Permissions"
        checkable
        defaultExpanded={["orders", "users"]}
        items={permissions}
        onSelectedChange={onSelectedChange}
        selectionMode="multiple"
      />,
    );
    const checkbox = (name: string) =>
      item(name).querySelector("[data-tree-checkbox]") as HTMLElement;

    await user.click(checkbox("Read"));
    expect(item("Read")).toHaveAttribute("aria-checked", "true");
    expect(item("Orders")).toHaveAttribute("aria-checked", "mixed");
    // The click checked - it did not select
    expect(item("Read")).toHaveAttribute("aria-selected", "false");
    expect(onSelectedChange).not.toHaveBeenCalled();

    // Both clicks of a double click toggle the checkbox (all, then none) -
    // the children stay shown
    await user.dblClick(checkbox("Orders"));
    expect(item("Orders")).toHaveAttribute("aria-expanded", "true");
    expect(item("Orders")).toHaveAttribute("aria-checked", "false");

    // A disabled item keeps its state
    await user.click(checkbox("Users"));
    expect(item("Invite")).toHaveAttribute("aria-checked", "true");
    await user.click(checkbox("Delete"));
    expect(item("Delete")).toHaveAttribute("aria-checked", "false");
  });

  it("selects and checks separately when both are on", async () => {
    const user = userEvent.setup();
    render(
      <TreeView
        aria-label="Permissions"
        checkable
        items={permissions}
        selectionMode="single"
      />,
    );

    await user.click(item("Orders"));
    expect(item("Orders")).toHaveAttribute("aria-selected", "true");
    expect(item("Orders")).toHaveAttribute("aria-checked", "false");

    await user.keyboard("[Space]");
    expect(item("Orders")).toHaveAttribute("aria-checked", "true");
  });
});

describe("TreeView lazy loading", () => {
  function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, reject, resolve };
  }

  const folders: TreeItem<string>[] = [
    { hasChildren: true, id: "docs", label: "Documents" },
    { id: "notes", label: "notes.txt" },
  ];

  it("shows a loading row, then the loaded children", async () => {
    const user = userEvent.setup();
    const load = deferred<TreeItem<string>[]>();
    const loadChildren = vi.fn(() => load.promise);
    render(
      <TreeView
        aria-label="Files"
        items={folders}
        loadChildren={loadChildren}
      />,
    );

    expect(item("Documents")).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(loadChildren).toHaveBeenCalledWith(folders[0], {
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(item("Documents")).toHaveAttribute("aria-busy", "true");

    await act(async () => load.resolve([{ id: "cv", label: "cv.pdf" }]));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(item("cv.pdf")).toHaveAttribute("aria-level", "2");
    expect(item("Documents")).not.toHaveAttribute("aria-busy");

    // Loaded once - collapsing and expanding keeps the children
    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(loadChildren).toHaveBeenCalledTimes(1);
  });

  it("offers to try again after a failed load", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const loadChildren = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce([{ id: "cv", label: "cv.pdf" }]);
    render(
      <TreeView
        aria-label="Files"
        defaultExpanded={["docs"]}
        items={folders}
        loadChildren={loadChildren}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The items could not be loaded.",
    );
    expect(error).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("treeitem", { name: "cv.pdf" }),
    ).toBeVisible();
    expect(loadChildren).toHaveBeenCalledTimes(2);
    // The focus went to the item, not to the page
    expect(item("Documents")).toHaveFocus();
  });

  it("tries again after the failed item is collapsed and expanded", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loadChildren = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce([{ id: "cv", label: "cv.pdf" }]);
    render(
      <TreeView
        aria-label="Files"
        items={folders}
        loadChildren={loadChildren}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    await screen.findByRole("alert");

    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(
      await screen.findByRole("treeitem", { name: "cv.pdf" }),
    ).toBeVisible();
  });

  it("tries again when the item was collapsed while the load failed", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = deferred<TreeItem<string>[]>();
    const loadChildren = vi
      .fn()
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce([{ id: "cv", label: "cv.pdf" }]);
    render(
      <TreeView
        aria-label="Files"
        items={folders}
        loadChildren={loadChildren}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    await act(async () => failed.reject(new Error("Offline")));

    // The failure nobody saw is not shown - the item loads again
    await user.keyboard("{ArrowRight}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("treeitem", { name: "cv.pdf" }),
    ).toBeVisible();
    expect(loadChildren).toHaveBeenCalledTimes(2);
  });

  it("aborts a load when the tree unmounts", async () => {
    let signal: AbortSignal | undefined;
    const { unmount } = render(
      <TreeView
        aria-label="Files"
        defaultExpanded={["docs"]}
        items={folders}
        loadChildren={(_, options) => {
          signal = options.signal;
          return new Promise(() => {});
        }}
      />,
    );

    await screen.findByRole("status");
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

describe("TreeView filter", () => {
  it("shows the matches with their ancestors, highlighted", () => {
    renderTree({ filter: "LAP" });

    expect(itemNames()).toEqual(["Electronics", "Laptops", "Gaming laptops"]);
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "true");
    // Laptops matches itself - its non-matching children are left out
    expect(queryItem("Ultrabooks")).not.toBeInTheDocument();
    expect(item("Laptops").querySelector("mark")).toHaveTextContent("Lap");
    expect(item("Gaming laptops").querySelector("mark")).toHaveTextContent(
      "lap",
    );
    // The name stays the whole label
    expect(item("Laptops")).toHaveAttribute("aria-setsize", "1");
  });

  it("ignores diacritics and says when nothing matches", () => {
    const { rerender } = render(
      <TreeView
        aria-label="Cities"
        items={[{ id: 1, label: "Plzeň" }]}
        filter="plzen"
      />,
    );
    expect(item("Plzeň")).toBeInTheDocument();

    rerender(
      <TreeView
        aria-label="Cities"
        filter="brno"
        items={[{ id: 1, label: "Plzeň" }]}
      />,
    );
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No matching items");
  });

  it("can be collapsed while filtering and brings back the expansion after", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <TreeView
        aria-label="Categories"
        defaultExpanded={["books"]}
        filter="o"
        items={categories}
        onExpandedChange={onExpandedChange}
      />,
    );

    await user.tab();
    expect(item("Electronics")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item("Electronics")).toHaveAttribute("aria-expanded", "false");
    // The filter's own state - not the expanded items
    expect(onExpandedChange).not.toHaveBeenCalled();

    rerender(
      <TreeView
        aria-label="Categories"
        defaultExpanded={["books"]}
        items={categories}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(itemNames()).toEqual([
      "Electronics",
      "Books",
      "Fiction",
      "Science",
      "Garden",
    ]);
  });
});

describe("TreeView links", () => {
  const navigation: TreeItem<string>[] = [
    { href: "/dashboard", id: "dashboard", label: "Dashboard" },
    {
      children: [
        { href: "/reports/sales", id: "sales", label: "Sales" },
        { href: "/reports/stock", id: "stock", label: "Stock" },
      ],
      href: "/reports",
      id: "reports",
      label: "Reports",
    },
  ];

  function renderAt(pathname: string, navigate = vi.fn()) {
    // A router link: navigates without a page load
    function Link({ href, onClick, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            onClick?.(event);
            event.preventDefault();
            navigate(href);
          }}
        />
      );
    }

    render(
      <UIProvider router={{ Link, navigate, pathname, search: "" }}>
        <TreeView
          aria-label="Navigation"
          items={navigation}
          selectionMode="none"
        />
      </UIProvider>,
    );
    return navigate;
  }

  it("renders router links and marks the current page, expanded to it", () => {
    renderAt("/reports/stock");

    expect(item("Stock")).toHaveAttribute("aria-current", "page");
    expect(item("Reports")).not.toHaveAttribute("aria-current");
    expect(item("Reports")).toHaveAttribute("aria-expanded", "true");
    // The current page is the tab stop
    expect(item("Stock")).toHaveAttribute("tabindex", "0");

    const link = within(item("Sales")).getByRole("link", { name: "Sales" });
    expect(link).toHaveAttribute("href", "/reports/sales");
    // The item takes the focus, not its link
    expect(link).toHaveAttribute("tabindex", "-1");
  });

  it("follows a link with Enter or a click - a parent also expands", async () => {
    const user = userEvent.setup();
    const navigate = renderAt("/dashboard");

    await user.tab();
    expect(item("Dashboard")).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(navigate).toHaveBeenLastCalledWith("/reports");
    expect(item("Reports")).toHaveAttribute("aria-expanded", "true");

    await user.click(item("Sales"));
    expect(navigate).toHaveBeenLastCalledWith("/reports/sales");
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it("marks only the current page of a tree of links by default", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    function Link({ href, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            event.preventDefault();
            navigate(href);
          }}
        />
      );
    }
    const tree = (pathname: string) => (
      <UIProvider router={{ Link, navigate, pathname, search: "" }}>
        <TreeView aria-label="Navigation" items={navigation} />
      </UIProvider>
    );
    const { rerender } = render(tree("/dashboard"));

    // A click follows the link - it selects nothing
    await user.click(item("Reports"));
    expect(navigate).toHaveBeenLastCalledWith("/reports");
    expect(item("Reports")).not.toHaveAttribute("aria-selected");
    // Space follows it too
    await user.keyboard("{ArrowDown} ");
    expect(navigate).toHaveBeenLastCalledWith("/reports/sales");

    // Back on the dashboard (the back button of the browser), the items
    // clicked before do not look current
    rerender(tree("/dashboard"));
    const marked = screen
      .getAllByRole("treeitem")
      .filter((row) => row.classList.contains("bg-primary-50"));
    expect(marked).toEqual([item("Dashboard")]);
  });

  it("selects the links of a tree given a selection", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    function Link({ href, ...props }: LinkComponentProps) {
      return (
        <a {...props} href={href} onClick={(event) => event.preventDefault()} />
      );
    }
    render(
      <UIProvider router={{ Link, pathname: "/dashboard", search: "" }}>
        <TreeView
          aria-label="Navigation"
          items={navigation}
          onSelectedChange={onSelectedChange}
        />
      </UIProvider>,
    );

    await user.click(item("Reports"));
    expect(onSelectedChange).toHaveBeenLastCalledWith(["reports"]);
    expect(item("Reports")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps selecting when links load later into a tree without any", async () => {
    const user = userEvent.setup();
    let resolve: (children: TreeItem<string>[]) => void = () => {};
    const folders: TreeItem<string>[] = [
      { hasChildren: true, id: "sales", label: "Sales" },
      { hasChildren: true, id: "stock", label: "Stock" },
    ];
    render(
      <UIProvider router={{ pathname: "/home", search: "" }}>
        <TreeView
          aria-label="Sections"
          items={folders}
          loadChildren={() =>
            new Promise<TreeItem<string>[]>((done) => {
              resolve = done;
            })
          }
        />
      </UIProvider>,
    );

    // No links at first - a click selects
    await user.click(item("Stock"));
    expect(item("Stock")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}{ArrowRight}");
    await act(async () => {
      resolve([{ href: "/sales/invoices", id: "invoices", label: "Invoices" }]);
    });
    expect(item("Invoices")).toBeInTheDocument();

    // The links change nothing - the selection can still be moved
    expect(item("Stock")).toHaveAttribute("aria-selected", "true");
    await user.click(item("Sales"));
    expect(item("Sales")).toHaveAttribute("aria-selected", "true");
    expect(item("Stock")).not.toHaveAttribute("aria-selected");
    expect(item("Stock")).not.toHaveClass("bg-primary-50");
  });

  it("is a navigation once its items get links - the menu filled in later", () => {
    const navigate = vi.fn();
    function Link({ href, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            event.preventDefault();
            navigate(href);
          }}
        />
      );
    }
    const tree = (items: TreeItem<string>[], pathname: string) => (
      <UIProvider router={{ Link, navigate, pathname, search: "" }}>
        <TreeView
          aria-label="Navigation"
          defaultExpanded={["reports"]}
          items={items}
        />
      </UIProvider>
    );
    // The sections at once, their pages once the menu has loaded
    const { rerender } = render(
      tree([{ children: [], id: "reports", label: "Reports" }], "/"),
    );
    rerender(tree(navigation, "/"));

    fireEvent.click(item("Sales"));
    rerender(tree(navigation, "/reports/sales"));
    // The back button, a link elsewhere
    rerender(tree(navigation, "/reports/stock"));

    // Only the current page is marked
    expect(item("Stock")).toHaveAttribute("aria-current", "page");
    expect(item("Sales")).not.toHaveAttribute("aria-selected");
    expect(item("Sales")).not.toHaveClass("bg-primary-50");
  });

  it("is a navigation when its first items are links, also ones that come later", () => {
    const navigate = vi.fn();
    function Link({ href, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            event.preventDefault();
            navigate(href);
          }}
        />
      );
    }
    const tree = (items: TreeItem<string>[]) => (
      <UIProvider router={{ Link, navigate, pathname: "/", search: "" }}>
        <TreeView aria-label="Navigation" items={items} />
      </UIProvider>
    );
    // Its items still loading
    const { rerender } = render(tree([]));
    rerender(tree(navigation));

    // Space follows the link - it selects nothing
    fireEvent.keyDown(item("Dashboard"), { key: " " });
    expect(navigate).toHaveBeenLastCalledWith("/dashboard");
    expect(item("Dashboard")).not.toHaveAttribute("aria-selected");
  });

  it("shows no selection where nothing is selected", () => {
    render(
      <TreeView
        aria-label="Categories"
        items={categories}
        selected={["garden"]}
        selectionMode="none"
      />,
    );
    expect(item("Garden")).not.toHaveAttribute("aria-selected");
    expect(item("Garden")).not.toHaveClass("bg-primary-50");
    // The tab stop is the first item, not the selected one
    expect(item("Electronics")).toHaveAttribute("tabindex", "0");
  });

  it("expands to the page it moves to", () => {
    const navigate = vi.fn();
    const tree = (pathname: string) => (
      <UIProvider router={{ navigate, pathname, search: "" }}>
        <TreeView aria-label="Navigation" items={navigation} />
      </UIProvider>
    );
    const { rerender } = render(tree("/dashboard"));
    expect(queryItem("Sales")).not.toBeInTheDocument();

    rerender(tree("/reports/sales"));
    expect(item("Sales")).toHaveAttribute("aria-current", "page");
  });

  it("marks the item whose query the page has, of items of one path", () => {
    render(
      <UIProvider router={{ pathname: "/tasks", search: "?filter=mine" }}>
        <TreeView
          aria-label="Tasks"
          items={[
            { href: "/tasks?filter=all", id: "all", label: "All tasks" },
            { href: "/tasks?filter=mine", id: "mine", label: "My tasks" },
          ]}
          selectionMode="none"
        />
      </UIProvider>,
    );

    expect(item("My tasks")).toHaveAttribute("aria-current", "page");
    expect(item("All tasks")).not.toHaveAttribute("aria-current");
  });

  it("marks the item of a path the URL escapes", () => {
    render(
      <UIProvider router={{ pathname: "/files/My%20Documents", search: "" }}>
        <TreeView
          aria-label="Files"
          items={[
            { href: "/files/My Documents", id: "docs", label: "My Documents" },
          ]}
        />
      </UIProvider>,
    );

    expect(item("My Documents")).toHaveAttribute("aria-current", "page");
  });

  it("renders a disabled item without a link", () => {
    render(
      <TreeView
        aria-label="Navigation"
        items={[{ disabled: true, href: "/old", id: "old", label: "Old" }]}
      />,
    );
    expect(within(item("Old")).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("TreeView custom content", () => {
  it("renders labels with the highlighted match and state", () => {
    const renderLabel = vi.fn(
      (_: TreeItem<string>, state: { label: React.ReactNode }) => (
        <>
          {state.label} <span>(4)</span>
        </>
      ),
    );
    renderTree({ filter: "gard", renderLabel });

    // The count is part of the name - it is what the label shows
    expect(item("Garden (4)").querySelector("mark")).toHaveTextContent("Gard");
    expect(renderLabel).toHaveBeenCalledWith(
      categories[2],
      expect.objectContaining({
        disabled: false,
        expanded: false,
        level: 1,
        selected: false,
      }),
    );
  });

  it("shows the actions of the hovered and the focused item", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onSelectedChange = vi.fn();
    renderTree({
      onSelectedChange,
      renderActions: (entry) => (
        <button onClick={() => onDelete(entry.id)} type="button">
          Delete {entry.label}
        </button>
      ),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    await user.hover(item("Books"));
    const button = screen.getByRole("button", { name: "Delete Books" });
    await user.click(button);
    expect(onDelete).toHaveBeenCalledWith("books");
    // The click was the button's - it did not select the item
    expect(onSelectedChange).not.toHaveBeenCalled();
    // The name of the item leaves the actions out
    expect(item("Books")).toBeInTheDocument();

    // Shift + Tab goes back from the actions to their item
    await user.unhover(item("Books"));
    await user.tab({ shift: true });
    expect(item("Books")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Electronics")).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Delete Books" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Electronics" }),
    ).toBeVisible();

    // Tab moves into the actions of the focused item; their keys are theirs
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Delete Electronics" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("button", { name: "Delete Electronics" }),
    ).toHaveFocus();
  });
});

describe("TreeView when items are removed", () => {
  const things: TreeItem<string>[] = [
    { id: "alpha", label: "Alpha" },
    {
      children: [
        { id: "gamma-1", label: "Gamma 1" },
        { id: "gamma-2", label: "Gamma 2" },
        { id: "gamma-3", label: "Gamma 3" },
      ],
      id: "gamma",
      label: "Gamma",
    },
    { id: "omega", label: "Omega" },
  ];

  /** `items` without the item `id`. */
  const without = (list: TreeItem<string>[], id: string): TreeItem<string>[] =>
    list
      .filter((entry) => entry.id !== id)
      .map((entry) =>
        entry.children
          ? { ...entry, children: without(entry.children, id) }
          : entry,
      );

  function Deletable() {
    const [items, setItems] = useState(things);
    return (
      <TreeView
        aria-label="Things"
        defaultExpanded={["gamma"]}
        defaultSelected={["alpha"]}
        items={items}
        renderActions={(entry) => (
          <button
            onClick={() => setItems((current) => without(current, entry.id))}
            type="button"
          >
            Delete {entry.label}
          </button>
        )}
      />
    );
  }

  it("moves the focus to the item that takes the place of the removed one", async () => {
    const user = userEvent.setup();
    render(<Deletable />);

    // To Gamma 2 and into its actions - Enter deletes it
    await user.tab();
    expect(item("Alpha")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(item("Gamma 2")).toHaveFocus();
    await user.tab();
    await user.keyboard("{Enter}");

    // The next sibling - not the selected item at the top
    expect(queryItem("Gamma 2")).not.toBeInTheDocument();
    expect(item("Gamma 3")).toHaveFocus();
    expect(item("Gamma 3")).toHaveAttribute("tabindex", "0");

    // The last child - the one before it
    await user.tab();
    await user.keyboard("{Enter}");
    expect(item("Gamma 1")).toHaveFocus();

    // The only child - its parent
    await user.tab();
    await user.keyboard("{Enter}");
    expect(item("Gamma")).toHaveFocus();
  });

  it("moves the tab stop from a removed item without the focus", async () => {
    const { rerender } = render(
      <TreeView
        aria-label="Things"
        defaultExpanded={["gamma"]}
        items={things}
      />,
    );
    act(() => item("Omega").focus());
    act(() => item("Omega").blur());

    rerender(
      <TreeView
        aria-label="Things"
        defaultExpanded={["gamma"]}
        items={without(things, "omega")}
      />,
    );
    // Omega was the last item - the one before it
    expect(item("Gamma 3")).toHaveAttribute("tabindex", "0");
  });
});

describe("TreeView in a form", () => {
  it("submits the checked items and brings back the default on reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Role" data-testid="form">
        <TreeView
          aria-label="Permissions"
          checkable
          defaultChecked={["books"]}
          items={categories}
          name="categories"
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;

    expect(new FormData(form).getAll("categories")).toEqual([
      "books",
      "fiction",
      "science",
    ]);

    await user.click(item("Garden"));
    expect(new FormData(form).getAll("categories")).toContain("garden");

    act(() => form.reset());
    expect(new FormData(form).getAll("categories")).toEqual([
      "books",
      "fiction",
      "science",
    ]);
    expect(item("Garden")).toHaveAttribute("aria-checked", "false");
  });

  it("submits the selected items of a tree without checkboxes", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TreeView aria-label="Categories" items={categories} name="category" />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).getAll("category")).toEqual([]);

    await user.click(item("Books"));
    expect(new FormData(form).getAll("category")).toEqual(["books"]);
  });

  it("submits nothing while disabled", () => {
    render(
      <form data-testid="form">
        <TreeView
          aria-label="Categories"
          defaultSelected={["books"]}
          disabled
          items={categories}
          name="category"
        />
      </form>,
    );

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).getAll("category")).toEqual([]);
    expect(item("Books")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("TreeView with many items", () => {
  // 10 regions × 10 cities × 10 stores
  const large: TreeItem<string>[] = Array.from({ length: 10 }, (_, r) => ({
    children: Array.from({ length: 10 }, (_, c) => ({
      children: Array.from({ length: 10 }, (_, s) => ({
        id: `store-${r}-${c}-${s}`,
        label: `Store ${r}-${c}-${s}`,
      })),
      id: `city-${r}-${c}`,
      label: `City ${r}-${c}`,
    })),
    id: `region-${r}`,
    label: `Region ${r}`,
  }));
  const allParents = large.flatMap((region) => [
    region.id,
    ...(region.children ?? []).map((city) => city.id),
  ]);

  it("renders a thousand expanded items and moves through them", async () => {
    const user = userEvent.setup();
    render(
      <TreeView
        aria-label="Stores"
        defaultExpanded={allParents}
        items={large}
      />,
    );

    expect(screen.getAllByRole("treeitem")).toHaveLength(1110);

    await user.tab();
    await user.keyboard("{End}");
    expect(item("Store 9-9-9")).toHaveFocus();
    expect(item("Store 9-9-9")).toHaveAttribute("aria-level", "3");
    expect(item("Store 9-9-9")).toHaveAttribute("aria-posinset", "10");
  });

  it("filters a thousand items", () => {
    render(<TreeView aria-label="Stores" filter="store 5-5-" items={large} />);
    expect(screen.getAllByRole("treeitem")).toHaveLength(12);
  });
});

describe("TreeView edge cases", () => {
  it("shows a message without items", () => {
    render(
      <TreeView
        aria-label="Empty"
        emptyMessage="No categories yet"
        items={[]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No categories yet");
  });

  it("keeps its props and ref while it shows the message", () => {
    const ref = { current: null as HTMLUListElement | null };
    render(
      <TreeView
        aria-label="Files"
        className="max-h-80"
        data-testid="files"
        filter="report"
        items={[{ id: "cv", label: "cv.pdf" }]}
        ref={ref}
      />,
    );

    const message = screen.getByRole("status", { name: "Files" });
    expect(message).toHaveTextContent("No matching items");
    expect(message).toBe(screen.getByTestId("files"));
    expect(message).toHaveClass("max-h-80");
    expect(ref.current).toBe(message);
  });

  it("warns about duplicate ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <TreeView
        aria-label="Twice"
        items={[
          { id: 1, label: "One" },
          { id: 1, label: "Again" },
        ]}
      />,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("the id 1"));
  });

  it("keeps the focus on the item when its link is clicked", () => {
    render(
      <TreeView
        aria-label="Navigation"
        items={[{ href: "/a", id: "a", label: "A" }]}
      />,
    );
    const link = within(item("A")).getByRole("link");

    act(() => link.focus());
    fireEvent.focus(link);
    expect(item("A")).toHaveFocus();
  });
});
