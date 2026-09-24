import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TreeView, { type TreeItem } from ".";
import UIProvider from "../../providers/ui-provider";

const items: TreeItem<string>[] = [
  {
    children: [
      { href: "/orders/open", id: "open", label: "Open orders" },
      { href: "/orders/closed", id: "closed", label: "Closed orders" },
    ],
    href: "/orders",
    id: "orders",
    label: "Orders",
  },
  { hasChildren: true, id: "archive", label: "Archive" },
];

describe("TreeView on the server", () => {
  it("renders the expanded, checked and current items, then hydrates", async () => {
    const tree = (
      <UIProvider router={{ pathname: "/orders/open", search: "" }}>
        <TreeView
          aria-label="Orders"
          checkable
          defaultChecked={["open"]}
          filter=""
          items={items}
          loadChildren={() => new Promise<TreeItem<string>[]>(() => {})}
          name="orders"
        />
      </UIProvider>
    );

    const html = renderToString(tree);
    // Expanded to the current page, which is marked
    expect(html).toContain("Open orders");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-checked="mixed"');
    expect(html).toContain('name="orders" value="open"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, tree, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    // The partly checked parent - a DOM property the server cannot write
    const parent = container.querySelector("[aria-checked='mixed'] input");
    expect(parent).toHaveProperty("indeterminate", true);

    act(() => root.unmount());
    container.remove();
  });

  it("renders a filtered tree with the matches marked", () => {
    const html = renderToString(
      <TreeView aria-label="Orders" filter="closed" items={items} />,
    );

    expect(html).toContain("<mark");
    expect(html).not.toContain("Open orders");
  });
});
