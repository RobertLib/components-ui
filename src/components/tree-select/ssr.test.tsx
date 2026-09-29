import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TreeSelect from ".";
import type { TreeItem } from "../tree-view";

const items: TreeItem<string>[] = [
  {
    children: [
      { id: "laptops", label: "Laptops" },
      { id: "phones", label: "Phones" },
    ],
    id: "electronics",
    label: "Electronics",
  },
  { hasChildren: true, id: "garden", label: "Garden" },
];

describe("TreeSelect on the server", () => {
  it("renders the value, the chips and the hidden inputs, then hydrates", async () => {
    const field = (
      <form>
        <TreeSelect
          defaultValue={["laptops", "phones"]}
          items={items}
          label="Categories"
          loadChildren={() => new Promise<TreeItem<string>[]>(() => {})}
          multiple
          name="categories"
          required
        />
        <TreeSelect
          defaultValue="phones"
          items={items}
          label="Category"
          name="category"
          showPath
        />
      </form>
    );

    const html = renderToString(field);
    // A fully checked parent is one chip
    expect(html).toContain("Electronics");
    expect(html).toContain('name="categories" value="electronics"');
    expect(html).toContain('name="category" value="phones"');
    expect(html).toContain('aria-haspopup="tree"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
