import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TreeView, { type TreeItem, type TreeMove, type TreeViewProps } from ".";
import UIProvider from "../../providers/ui-provider";

// Documents
//   Invoices
//     2025
//     2026
//   Contracts
// Photos
// Notes (a leaf)
const files: TreeItem<string>[] = [
  {
    children: [
      {
        children: [
          { id: "2025", label: "2025" },
          { id: "2026", label: "2026" },
        ],
        id: "invoices",
        label: "Invoices",
      },
      { id: "contracts", label: "Contracts" },
    ],
    id: "documents",
    label: "Documents",
  },
  {
    children: [{ id: "beach", label: "Beach" }],
    id: "photos",
    label: "Photos",
  },
  { id: "notes", label: "Notes" },
];

const blockedMoveSources: [string, Partial<TreeViewProps<TreeItem<string>>>][] =
  [
    [
      "a moved item becomes disabled",
      {
        items: files.map((entry) =>
          entry.id === "photos"
            ? {
                ...entry,
                children: [{ disabled: true, id: "beach", label: "Beach" }],
              }
            : entry,
        ),
      },
    ],
    [
      "a moved item's ancestor becomes disabled",
      {
        items: files.map((entry) =>
          entry.id === "photos" ? { ...entry, disabled: true } : entry,
        ),
      },
    ],
    [
      "canDrag rejects a moved item",
      { canDrag: (entry) => entry.id !== "beach" },
    ],
  ];

/** `items` with the move applied - what an app does in `onMove`. */
function applyMove<T extends TreeItem<string>>(
  items: T[],
  { itemIds, position, targetId }: TreeMove<string>,
): T[] {
  const moved: T[] = [];
  const take = (list: T[]): T[] =>
    list.flatMap((entry) => {
      if (itemIds.includes(entry.id)) {
        moved.push(entry);
        return [];
      }
      return entry.children
        ? [{ ...entry, children: take(entry.children as T[]) }]
        : [entry];
    });
  const put = (list: T[]): T[] =>
    list.flatMap((entry) => {
      if (entry.id === targetId) {
        if (position === "before") return [...moved, entry];
        if (position === "after") return [entry, ...moved];
        return [{ ...entry, children: [...(entry.children ?? []), ...moved] }];
      }
      return entry.children
        ? [{ ...entry, children: put(entry.children as T[]) }]
        : [entry];
    });

  const rest = take(items);
  moved.sort((a, b) => itemIds.indexOf(a.id) - itemIds.indexOf(b.id));
  return put(rest);
}

const item = (name: string) => screen.getByRole("treeitem", { name });
const itemNames = () =>
  screen.getAllByRole("treeitem").map((element) => element.textContent);
/** What the live region of the moves says - without the space that tells a repeated text apart. */
const announced = () =>
  screen.getAllByRole("status").at(-1)?.textContent?.replace(/ $/, "");

function Movable({
  items: initialItems = files,
  onMove,
  ...props
}: Partial<TreeViewProps<TreeItem<string>>>) {
  const [items, setItems] = useState(initialItems);
  return (
    <TreeView
      aria-label="Files"
      defaultExpanded={["documents", "invoices"]}
      {...props}
      items={items}
      onMove={(move) => {
        onMove?.(move);
        setItems((current) => applyMove(current, move));
      }}
    />
  );
}

describe("TreeView moving with the keys", () => {
  it("picks up an item with Ctrl + X and announces how to move it", async () => {
    const user = userEvent.setup();
    render(<Movable />);

    await user.click(item("Contracts"));
    await user.keyboard("{Control>}x{/Control}");

    expect(announced()).toBe(
      "Moving “Contracts”. Choose the place with the up and down arrows, then press Enter to move there or Escape to cancel.",
    );
    // Dimmed, and described as being moved
    expect(item("Contracts")).toHaveClass("opacity-50");
    expect(item("Contracts")).toHaveAccessibleDescription("Being moved");
    expect(item("Contracts")).toHaveFocus();
  });

  it("goes through the places, drops with Enter and keeps the focus on the item", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Movable onMove={onMove} />);

    await user.click(item("Contracts"));
    await user.keyboard("{Control>}x{/Control}");

    // Up from its place: after 2026 (the end of Invoices), inside 2026, …
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("After 2026, in Invoices");
    expect(item("2026")).toHaveAttribute("data-drop-edge", "bottom");

    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Inside 2026");
    expect(item("2026")).toHaveAttribute("data-drop-edge", "inside");

    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Before 2026");
    expect(item("2026")).toHaveAttribute("data-drop-edge", "top");
    expect(item("2026").querySelectorAll("[data-drop-edge]")).toHaveLength(0);

    await user.keyboard("{Enter}");
    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["contracts"],
      position: "before",
      targetId: "2026",
    });
    expect(announced()).toBe("Moved “Contracts”.");

    // The app moved it - the focus is on it at its new place
    expect(itemNames()).toEqual([
      "Documents",
      "Invoices",
      "2025",
      "Contracts",
      "2026",
      "Photos",
      "Notes",
    ]);
    expect(item("Contracts")).toHaveFocus();
    expect(item("Contracts")).toHaveAttribute("aria-level", "3");
    expect(item("Contracts")).not.toHaveClass("opacity-50");
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
  });

  it("skips the places in and around the moved item", async () => {
    const user = userEvent.setup();
    render(<Movable />);

    await user.click(item("Invoices"));
    await user.keyboard("{Control>}x{/Control}");

    // Not into Invoices, 2025 or 2026, nor before Contracts, where it is
    await user.keyboard("{ArrowDown}");
    expect(announced()).toBe("Inside Contracts");
    await user.keyboard("{ArrowDown}");
    // After Contracts - the end of Documents
    expect(announced()).toBe("After Contracts, in Documents");
    await user.keyboard("{ArrowDown}");
    expect(announced()).toBe("Before Photos");

    // Back up past its place - to the end of Documents, then before it
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(announced()).toBe("Inside Documents");
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Before Documents");
  });

  it("goes to the first and the last place with Home and End", async () => {
    const user = userEvent.setup();
    render(<Movable />);

    await user.click(item("2025"));
    await user.keyboard("{Control>}x{/Control}{End}");
    // After Notes - at the end of the tree
    expect(announced()).toBe("After Notes");
    await user.keyboard("{Home}");
    expect(announced()).toBe("Before Documents");
    // Nowhere before the first - it stays there
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Before Documents");
  });

  it("drops with Ctrl + V - inside, expanding the target", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Movable onMove={onMove} />);

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}");
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Inside Photos");
    await user.keyboard("{Control>}v{/Control}");

    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["notes"],
      position: "inside",
      targetId: "photos",
    });
    // Photos expanded - the moved item is in view, with the focus
    expect(item("Photos")).toHaveAttribute("aria-expanded", "true");
    expect(item("Notes")).toHaveAttribute("aria-level", "2");
    expect(item("Notes")).toHaveFocus();
  });

  it("cancels with Escape - the Escape is not for a dialog around", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const onDocumentEscape = vi.fn();
    document.addEventListener("keydown", onDocumentEscape);
    render(<Movable onMove={onMove} />);

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}{ArrowUp}{Escape}");

    expect(announced()).toBe("Moving cancelled.");
    expect(onMove).not.toHaveBeenCalled();
    expect(item("Notes")).toHaveFocus();
    expect(item("Notes")).not.toHaveClass("opacity-50");
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    expect(onDocumentEscape).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: "Escape" }),
    );
    document.removeEventListener("keydown", onDocumentEscape);

    // The keys are the tree's again
    await user.keyboard("{ArrowUp}");
    expect(item("Photos")).toHaveFocus();
  });

  it("cancels when the focus leaves the tree", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Movable />
        <button type="button">After</button>
      </>,
    );

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}{ArrowUp}");
    await user.tab();

    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expect(announced()).toBe("Moving cancelled.");
    expect(item("Notes")).not.toHaveClass("opacity-50");
  });

  it("expands and collapses the item of the place with the arrows", async () => {
    const user = userEvent.setup();
    render(<Movable defaultExpanded={[]} />);

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}{ArrowUp}");
    expect(announced()).toBe("Inside Photos");

    await user.keyboard("{ArrowRight}");
    expect(item("Photos")).toHaveAttribute("aria-expanded", "true");
    // The children are places now
    await user.keyboard("{ArrowDown}");
    expect(announced()).toBe("Before Beach");

    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(item("Photos")).toHaveAttribute("aria-expanded", "false");
  });

  it("goes on from the moved item once children load above it", async () => {
    const user = userEvent.setup();
    let resolve!: (children: TreeItem<string>[]) => void;
    const loadChildren = vi.fn(
      () =>
        new Promise<TreeItem<string>[]>((done) => {
          resolve = done;
        }),
    );
    render(
      <TreeView
        aria-label="Files"
        defaultExpanded={["archive"]}
        items={[
          { hasChildren: true, id: "archive", label: "Archive" },
          { id: "notes", label: "Notes" },
          { id: "photos", label: "Photos" },
        ]}
        loadChildren={loadChildren}
        onMove={() => {}}
      />,
    );

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}");
    await act(async () =>
      resolve([
        { id: "2025", label: "2025" },
        { id: "2026", label: "2026" },
      ]),
    );
    expect(itemNames()).toEqual(["Archive", "2025", "2026", "Notes", "Photos"]);

    // Down from Notes - not from where it was before the rows above came
    await user.keyboard("{ArrowDown}");
    expect(announced()).toBe("Inside Photos");
  });

  it("goes on from where the chosen place was once the rows change from outside", async () => {
    const user = userEvent.setup();
    const props = {
      "aria-label": "Files",
      onExpandedChange: () => {},
      onMove: () => {},
    };
    const { rerender } = render(
      <TreeView {...props} expanded={[]} items={files} />,
    );

    await user.click(item("Photos"));
    await user.keyboard("{Control>}x{/Control}{End}");
    expect(announced()).toBe("After Notes");

    // Documents expands, and an item comes after Notes - which no longer
    // ends the tree
    rerender(
      <TreeView
        {...props}
        expanded={["documents"]}
        items={[...files, { id: "videos", label: "Videos" }]}
      />,
    );
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Inside Notes");
  });

  it("offers only the places canDrop allows, and moves only what canDrag allows", async () => {
    const user = userEvent.setup();
    render(
      <Movable
        canDrag={(entry) => entry.id !== "photos"}
        // Only into folders - items with children
        canDrop={({ position, target }) =>
          position !== "inside" || !!target.children
        }
      />,
    );

    await user.click(item("Contracts"));
    await user.keyboard("{Control>}x{/Control}{ArrowUp}");
    // Not inside 2026 - a leaf
    expect(announced()).toBe("After 2026, in Invoices");
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Before 2026");
    await user.keyboard("{Escape}");

    await user.click(item("Photos"));
    await user.keyboard("{Control>}x{/Control}");
    expect(announced()).toBe("“Photos” cannot be moved.");
    // Not in move mode - the arrows move the focus
    await user.keyboard("{ArrowDown}");
    expect(item("Notes")).toHaveFocus();
  });

  it("moves all selected items of a multiple selection together", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(
      <Movable
        defaultSelected={["notes", "2025"]}
        onMove={onMove}
        selectionMode="multiple"
      />,
    );

    await user.click(item("Contracts"));
    await user.click(item("Contracts"));
    // Contracts is not selected - it moves alone
    await user.keyboard("{Control>}x{/Control}");
    expect(announced()).toMatch(/^Moving “Contracts”\./);
    await user.keyboard("{Escape}");

    await user.click(item("Notes"));
    await user.click(item("Notes"));
    expect(item("Notes")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Control>}x{/Control}");
    expect(announced()).toMatch(/^Moving 2 items\./);
    expect(item("2025")).toHaveClass("opacity-50");

    await user.keyboard("{Home}{Enter}");
    // In tree order
    expect(onMove).toHaveBeenLastCalledWith({
      itemIds: ["2025", "notes"],
      position: "before",
      targetId: "documents",
    });
    expect(announced()).toBe("Moved 2 items.");
    expect(itemNames().slice(0, 3)).toEqual(["2025", "Notes", "Documents"]);
  });

  it.each(blockedMoveSources)(
    "does not commit a keyboard move when %s after choosing a place",
    async (_reason, changedProps) => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      const props = {
        defaultExpanded: ["photos"],
        defaultSelected: ["beach", "notes"],
        items: files,
        onMove,
        selectionMode: "multiple" as const,
      };
      const { rerender } = render(<TreeView {...props} />);

      await user.tab();
      await user.keyboard("{End}{Control>}x{/Control}");
      expect(announced()).toMatch(/^Moving 2 items\./);
      await user.keyboard("{Home}");
      expect(item("Documents")).toHaveAttribute("data-drop-edge", "top");

      // Notes remains draggable, but every item in the move must be allowed.
      rerender(<TreeView {...props} {...changedProps} />);
      await user.keyboard("{Enter}");
      expect(onMove).not.toHaveBeenCalled();
    },
  );

  it("does nothing on Ctrl + X without onMove", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={files} />);

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}{ArrowUp}");
    expect(item("Photos")).toHaveFocus();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("drops inside a collapsed parent whose children are still to load", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const loadChildren = vi.fn(() => new Promise<TreeItem<string>[]>(() => {}));
    render(
      <TreeView
        aria-label="Files"
        items={[
          { hasChildren: true, id: "archive", label: "Archive" },
          { id: "notes", label: "Notes" },
        ]}
        loadChildren={loadChildren}
        onMove={onMove}
      />,
    );

    await user.click(item("Notes"));
    await user.keyboard("{Control>}x{/Control}{ArrowUp}");
    expect(announced()).toBe("Inside Archive");
    await user.keyboard("{Enter}");

    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["notes"],
      position: "inside",
      targetId: "archive",
    });
    // The app puts it there - the children are not loaded meanwhile
    expect(loadChildren).not.toHaveBeenCalled();
    expect(item("Archive")).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["loading", false],
    ["loading", true],
    ["error", false],
    ["error", true],
  ] as const)(
    "draws the line after an item below its %s row (virtualized: %s)",
    async (status, virtualized) => {
      const user = userEvent.setup();
      vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <TreeView
          aria-label="Files"
          defaultExpanded={["archive"]}
          items={[
            { id: "notes", label: "Notes" },
            { hasChildren: true, id: "archive", label: "Archive" },
          ]}
          loadChildren={() =>
            status === "loading"
              ? new Promise<TreeItem<string>[]>(() => {})
              : Promise.reject(new Error("Offline"))
          }
          onMove={() => {}}
          virtualized={virtualized}
        />,
      );
      const statusRow =
        status === "loading"
          ? screen.getByText("Loading…").parentElement
          : (await screen.findByRole("alert")).parentElement;

      await user.click(item("Notes"));
      await user.keyboard("{Control>}x{/Control}{End}");
      expect(announced()).toBe("After Archive");
      // Where Notes lands - not above the row, where a first child would
      expect(item("Archive")).not.toHaveAttribute("data-drop-edge");
      expect(statusRow).toHaveAttribute("data-drop-edge", "bottom");
      expect(statusRow?.querySelector(".bg-primary-500")).not.toBeNull();
    },
  );
});

/** The rows of the tree, 32px high one below the other from 100px down. */
const ROW_HEIGHT = 32;
const TOP = 100;
const rowElements = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[role='treeitem']"));
/** The pointer at the middle of the row `name`, `ratio` of its height down. */
const pointAt = (name: string, ratio = 0.5, x = 10) => {
  const rowIndex = rowElements().indexOf(item(name));
  return { clientX: x, clientY: TOP + (rowIndex + ratio) * ROW_HEIGHT };
};

describe("TreeView dragging with the pointer", () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const rowIndex = rowElements().indexOf(this as HTMLElement);
        const top = rowIndex === -1 ? 0 : TOP + rowIndex * ROW_HEIGHT;
        const height = rowIndex === -1 ? 1000 : ROW_HEIGHT;
        return {
          bottom: top + height,
          height,
          left: 0,
          right: 400,
          toJSON: () => ({}),
          top,
          width: 400,
          x: 0,
          y: top,
        };
      },
    );
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: (_x: number, y: number) =>
        rowElements()[Math.floor((y - TOP) / ROW_HEIGHT)] ?? document.body,
    });
  });

  afterEach(() => {
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    vi.useRealTimers();
  });

  const press = (name: string, pointerType = "mouse") =>
    fireEvent.pointerDown(item(name), {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType,
      ...pointAt(name),
    });
  const moveTo = (point: { clientX: number; clientY: number }) =>
    fireEvent.pointerMove(document, { pointerId: 1, ...point });
  const release = () => fireEvent.pointerUp(document, { pointerId: 1 });

  it("puts the badge of a drag into the portal container of UIProvider", () => {
    const container = document.createElement("div");
    document.body.append(container);
    try {
      render(
        <UIProvider portalContainer={container}>
          <Movable />
        </UIProvider>,
      );

      press("Notes");
      moveTo(pointAt("Contracts", 0.1));
      expect(container).toHaveTextContent("Notes");
      // The line where it would land stays visible in forced colors
      expect(
        item("Contracts").querySelector(".forced-colors\\:bg-\\[Highlight\\]"),
      ).not.toBeNull();

      moveTo(pointAt("Contracts", 0.5));
      expect(item("Contracts")).toHaveClass(
        "forced-colors:outline-[Highlight]",
      );
      release();
    } finally {
      container.remove();
    }
  });

  it("drags an item past a few pixels and drops it where the line shows", () => {
    const onMove = vi.fn();
    const onSelectedChange = vi.fn();
    render(<Movable onMove={onMove} onSelectedChange={onSelectedChange} />);

    press("Notes");
    // Jitter within 5px is no drag
    moveTo({ clientX: 12, clientY: pointAt("Notes").clientY + 3 });
    expect(item("Notes")).not.toHaveClass("opacity-50");

    // The upper quarter of Contracts - before it
    moveTo(pointAt("Contracts", 0.1));
    expect(item("Notes")).toHaveClass("opacity-50");
    expect(item("Contracts")).toHaveAttribute("data-drop-edge", "top");
    // The badge beside the pointer names the item
    expect(document.body.lastElementChild).toHaveTextContent("Notes");

    // The middle - inside it
    moveTo(pointAt("Contracts", 0.5));
    expect(item("Contracts")).toHaveAttribute("data-drop-edge", "inside");
    expect(item("Contracts")).toHaveClass("ring-2");

    release();
    // The click that ends the drag selects nothing
    fireEvent.click(item("Contracts"));

    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["notes"],
      position: "inside",
      targetId: "contracts",
    });
    expect(onSelectedChange).not.toHaveBeenCalled();
    expect(announced()).toBe("Moved “Notes”.");
    expect(item("Contracts")).toHaveAttribute("aria-expanded", "true");
    expect(item("Notes")).toHaveAttribute("aria-level", "3");
  });

  it("chooses the level after the last row of a group by the pointer", () => {
    const onMove = vi.fn();
    render(<Movable onMove={onMove} />);

    press("Notes");
    // The lower quarter of 2026, which ends Invoices: at its level after it
    moveTo(pointAt("2026", 0.9, 60));
    expect(item("2026")).toHaveAttribute("data-drop-edge", "bottom");
    // Out at the level of Invoices - before Contracts, which follows it
    moveTo(pointAt("2026", 0.9, 30));
    expect(item("2026")).not.toHaveAttribute("data-drop-edge");
    expect(item("Contracts")).toHaveAttribute("data-drop-edge", "top");
    // Contracts ends Documents - at the top level, before Photos
    moveTo(pointAt("Contracts", 0.9, 10));
    expect(item("Photos")).toHaveAttribute("data-drop-edge", "top");
    release();

    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["notes"],
      position: "before",
      targetId: "photos",
    });
  });

  it("draws the line after an item below its loading row", () => {
    const onMove = vi.fn();
    render(
      <TreeView
        aria-label="Files"
        defaultExpanded={["archive"]}
        items={[
          { id: "notes", label: "Notes" },
          { hasChildren: true, id: "archive", label: "Archive" },
        ]}
        loadChildren={() => new Promise<TreeItem<string>[]>(() => {})}
        onMove={onMove}
      />,
    );

    press("Notes");
    moveTo(pointAt("Archive", 0.9));
    expect(item("Archive")).not.toHaveAttribute("data-drop-edge");
    expect(screen.getByText("Loading…").parentElement).toHaveAttribute(
      "data-drop-edge",
      "bottom",
    );
    release();

    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["notes"],
      position: "after",
      targetId: "archive",
    });
  });

  it("drops nothing over the dragged item itself, or where the item is", () => {
    const onMove = vi.fn();
    render(<Movable onMove={onMove} />);

    press("Invoices");
    moveTo(pointAt("Invoices", 0.1));
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    // Over its children
    moveTo(pointAt("2026", 0.9, 10));
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    // Before Contracts - where Invoices is already
    moveTo(pointAt("Contracts", 0.1));
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    release();

    expect(onMove).not.toHaveBeenCalled();
  });

  it("cancels with Escape - the release drops nothing, its click selects nothing", () => {
    const onMove = vi.fn();
    const onSelectedChange = vi.fn();
    render(<Movable onMove={onMove} onSelectedChange={onSelectedChange} />);

    press("Notes");
    moveTo(pointAt("Photos"));
    expect(item("Photos")).toHaveAttribute("data-drop-edge", "inside");

    const escape = fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(escape).toBe(false);
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    expect(item("Notes")).not.toHaveClass("opacity-50");

    moveTo(pointAt("Contracts"));
    release();
    fireEvent.click(item("Contracts"));
    expect(onMove).not.toHaveBeenCalled();
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it.each([
    ["disabled", { disabled: true }],
    ["its dragged item is removed", { items: files.slice(0, -1) }],
    ["onMove is removed", { onMove: undefined }],
  ] as const)("cancels a drag when %s", (_reason, changedProps) => {
    const onMove = vi.fn();
    const { rerender } = render(<TreeView items={files} onMove={onMove} />);

    press("Notes");
    moveTo(pointAt("Documents", 0.1));
    expect(item("Documents")).toHaveAttribute("data-drop-edge", "top");

    rerender(<TreeView items={files} onMove={onMove} {...changedProps} />);
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    // The document listeners of the ended drag no longer block interaction.
    expect(fireEvent.touchMove(document)).toBe(true);
    expect(
      fireEvent(document, new Event("selectstart", { cancelable: true })),
    ).toBe(true);

    // Re-enabling the tree cannot revive the old press.
    rerender(<TreeView items={files} onMove={onMove} />);
    moveTo(pointAt("Documents", 0.1));
    release();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("cancels the whole drag when one of its selected items is removed", () => {
    const onMove = vi.fn();
    const props = {
      defaultSelected: ["photos", "notes"],
      onMove,
      selectionMode: "multiple" as const,
    };
    const { rerender } = render(<TreeView items={files} {...props} />);

    press("Notes");
    moveTo(pointAt("Documents", 0.1));
    expect(item("Photos")).toHaveClass("opacity-50");

    rerender(<TreeView items={files.slice(0, -1)} {...props} />);
    expect(item("Photos")).not.toHaveClass("opacity-50");
    expect(document.querySelectorAll("[data-drop-edge]")).toHaveLength(0);
    release();
    expect(onMove).not.toHaveBeenCalled();
  });

  it.each(blockedMoveSources)(
    "does not commit a pointer drag when %s after choosing a place",
    (_reason, changedProps) => {
      const onMove = vi.fn();
      const props = {
        defaultExpanded: ["photos"],
        defaultSelected: ["beach", "notes"],
        items: files,
        onMove,
        selectionMode: "multiple" as const,
      };
      const { rerender } = render(<TreeView {...props} />);

      press("Notes");
      moveTo(pointAt("Documents", 0.1));
      expect(item("Beach")).toHaveClass("opacity-50");
      expect(item("Documents")).toHaveAttribute("data-drop-edge", "top");

      rerender(<TreeView {...props} {...changedProps} />);
      release();
      expect(onMove).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["disabled", { disabled: true }],
    ["its pressed item is removed", { items: files.slice(0, -1) }],
  ] as const)(
    "cancels a pending long press when %s",
    (_reason, changedProps) => {
      vi.useFakeTimers();
      const onMove = vi.fn();
      const { rerender } = render(<TreeView items={files} onMove={onMove} />);

      press("Notes", "touch");
      rerender(<TreeView items={files} onMove={onMove} {...changedProps} />);
      expect(fireEvent.contextMenu(document)).toBe(true);
      act(() => vi.advanceTimersByTime(500));
      expect(fireEvent.touchMove(document)).toBe(true);

      rerender(<TreeView items={files} onMove={onMove} />);
      moveTo(pointAt("Documents", 0.1));
      release();
      expect(onMove).not.toHaveBeenCalled();
      vi.useRealTimers();
    },
  );

  it("cancels pending hover expansion when a dragged item is removed", () => {
    vi.useFakeTimers();
    const onMove = vi.fn();
    const { rerender } = render(<TreeView items={files} onMove={onMove} />);

    press("Notes");
    moveTo(pointAt("Photos"));
    expect(item("Photos")).toHaveAttribute("data-drop-edge", "inside");
    rerender(<TreeView items={files.slice(0, -1)} onMove={onMove} />);
    act(() => vi.advanceTimersByTime(700));

    expect(item("Photos")).toHaveAttribute("aria-expanded", "false");
    release();
    expect(onMove).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("selects on a click without a drag", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(<Movable onSelectedChange={onSelectedChange} />);

    await user.click(item("Notes"));
    expect(onSelectedChange).toHaveBeenCalledWith(["notes"]);
  });

  it("expands a collapsed item hovered for a moment", () => {
    vi.useFakeTimers();
    render(<Movable defaultExpanded={[]} />);

    press("Notes");
    moveTo(pointAt("Photos"));
    act(() => vi.advanceTimersByTime(600));
    expect(item("Photos")).toHaveAttribute("aria-expanded", "false");
    act(() => vi.advanceTimersByTime(200));
    expect(item("Photos")).toHaveAttribute("aria-expanded", "true");
    release();
    vi.useRealTimers();
  });

  it("picks an item up after a finger rests on it, not when it moves first", () => {
    vi.useFakeTimers();
    const onMove = vi.fn();
    render(<Movable onMove={onMove} />);

    // A finger moving right away scrolls - no drag
    press("Notes", "touch");
    moveTo(pointAt("Photos"));
    act(() => vi.advanceTimersByTime(600));
    expect(item("Notes")).not.toHaveClass("opacity-50");
    release();

    // Resting on it picks it up; the page does not scroll with the finger
    press("Notes", "touch");
    act(() => vi.advanceTimersByTime(500));
    expect(item("Notes")).toHaveClass("opacity-50");
    expect(fireEvent.touchMove(document)).toBe(false);
    moveTo(pointAt("Documents", 0.1));
    release();

    expect(onMove).toHaveBeenCalledWith({
      itemIds: ["notes"],
      position: "before",
      targetId: "documents",
    });
    vi.useRealTimers();
  });

  it("scrolls its container while the pointer is near the edge", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback),
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(<Movable style={{ overflowY: "auto" }} />);
    const container = screen.getByRole("tree");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 1000 },
      scrollHeight: { configurable: true, value: 3000 },
    });

    press("Notes");
    moveTo(pointAt("Photos"));
    expect(frames).toHaveLength(0);

    // 10px from the bottom edge of the container (1000px high)
    moveTo({ clientX: 10, clientY: 990 });
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(container.scrollTop).toBe(12);
    // It goes on in the next frame
    expect(frames).toHaveLength(2);
    release();
  });

  it("stops auto-scrolling when the tree is disabled during a drag", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback),
    );
    const cancelFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    const onMove = vi.fn();
    const props = {
      items: files,
      onMove,
      style: { overflowY: "auto" as const },
    };
    const { rerender } = render(<TreeView {...props} />);
    const container = screen.getByRole("tree");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 1000 },
      scrollHeight: { configurable: true, value: 3000 },
    });

    press("Notes");
    moveTo({ clientX: 10, clientY: 990 });
    expect(frames).toHaveLength(1);
    rerender(<TreeView {...props} disabled />);
    expect(cancelFrame).toHaveBeenCalledWith(1);

    act(() => frames[0](0));
    expect(container.scrollTop).toBe(0);
    expect(frames).toHaveLength(1);
    release();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not drag a disabled item, nor from a control in the row", () => {
    render(
      <Movable
        items={[
          { disabled: true, id: "old", label: "Old" },
          { id: "notes", label: "Notes" },
        ]}
        renderActions={() => <button type="button">Edit</button>}
      />,
    );

    press("Old");
    moveTo(pointAt("Notes"));
    expect(item("Old")).not.toHaveClass("opacity-50");
    release();

    fireEvent.pointerOver(item("Notes"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Edit" }), {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      ...pointAt("Notes"),
    });
    moveTo(pointAt("Old"));
    expect(item("Notes")).not.toHaveClass("opacity-50");
    release();
  });
});
