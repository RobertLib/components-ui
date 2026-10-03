import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DataTable from "./data-table";
import TreeView from "./tree-view";

describe.each(["DataTable", "TreeView"])("%s search highlight", (component) => {
  it.each([
    ["Pr\u030ci\u0301lis\u030c", "ri", "r\u030ci\u0301"],
    ["a\u0301b\u0301한", "b", "b\u0301"],
    ["😀a\u0301", "a", "a\u0301"],
  ])("keeps the original characters of %s highlighted", (text, term, match) => {
    const { container } = render(
      component === "DataTable" ? (
        <DataTable
          clientSide
          enableGlobalSearch
          columns={[{ key: "name", label: "Name" }]}
          data={[{ id: 1, name: text }]}
          defaultQuery={{ search: term }}
        />
      ) : (
        <TreeView filter={term} items={[{ id: 1, label: text }]} />
      ),
    );

    const highlights = container.querySelectorAll(
      component === "DataTable" ? "td b" : "mark",
    );
    expect(highlights).toHaveLength(1);
    expect(highlights[0].textContent).toBe(match);
    const label = highlights[0].parentElement;
    expect(label?.textContent).toBe(text);
  });
});
