import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TreeView, { type TreeItem } from ".";
import TreeSelect from "../tree-select";

const items: TreeItem[] = [
  { id: "folder", label: "Folder", hasChildren: true },
];
const deferred = () => {
  let resolve!: (children: TreeItem[]) => void;
  const promise = new Promise<TreeItem[]>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};

describe("Lazy tree cache invalidation", () => {
  it("reloads expanded items on a new cache key", async () => {
    const loadChildren = vi
      .fn()
      .mockResolvedValueOnce([{ id: "old", label: "Old child" }])
      .mockResolvedValueOnce([{ id: "new", label: "New child" }]);
    const props = { items, loadChildren, defaultExpanded: ["folder"] };
    const { rerender } = render(<TreeView {...props} loadChildrenKey={1} />);
    expect(
      await screen.findByRole("treeitem", { name: "Old child" }),
    ).toBeInTheDocument();
    rerender(<TreeView {...props} loadChildrenKey={2} />);
    expect(
      await screen.findByRole("treeitem", { name: "New child" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "Old child" })).toBeNull();
    expect(loadChildren).toHaveBeenCalledTimes(2);
  });

  it("aborts and ignores the response belonging to the previous key", async () => {
    const first = deferred();
    const second = deferred();
    const signals: AbortSignal[] = [];
    const loadChildren = vi.fn(
      (_item: TreeItem, { signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return signals.length === 1 ? first.promise : second.promise;
      },
    );
    const props = { items, loadChildren, defaultExpanded: ["folder"] };
    const { rerender } = render(<TreeView {...props} loadChildrenKey="old" />);
    rerender(<TreeView {...props} loadChildrenKey="new" />);
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    await act(async () =>
      first.resolve([{ id: "stale", label: "Stale child" }]),
    );
    expect(screen.queryByRole("treeitem", { name: "Stale child" })).toBeNull();
    await act(async () =>
      second.resolve([{ id: "fresh", label: "Fresh child" }]),
    );
    expect(
      screen.getByRole("treeitem", { name: "Fresh child" }),
    ).toBeInTheDocument();
  });

  it("reports the failed item and error to the application", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Offline");
    const onLoadError = vi.fn();
    render(
      <TreeView
        defaultExpanded={["folder"]}
        items={items}
        loadChildren={() => Promise.reject(error)}
        onLoadError={onLoadError}
      />,
    );
    await waitFor(() =>
      expect(onLoadError).toHaveBeenCalledWith(error, items[0]),
    );
  });

  it("invalidates TreeSelect's selected labels and popup children together", async () => {
    const loadChildren = vi
      .fn()
      .mockResolvedValueOnce([{ id: "child", label: "Old name" }])
      .mockResolvedValueOnce([{ id: "child", label: "New name" }]);
    const props = {
      items,
      label: "Folder choice",
      loadChildren,
      value: "child",
    };
    const { rerender } = render(<TreeSelect {...props} loadChildrenKey={1} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    screen.getByRole("treeitem", { name: "Folder" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(
      await screen.findByRole("treeitem", { name: "Old name" }),
    ).toBeInTheDocument();
    rerender(<TreeSelect {...props} loadChildrenKey={2} />);
    expect(
      await screen.findByRole("treeitem", { name: "New name" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "Old name" })).toBeNull();
    expect(screen.getByRole("combobox")).toHaveTextContent("New name");
  });
});
