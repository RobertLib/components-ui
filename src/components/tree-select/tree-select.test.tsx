import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import TreeSelect from ".";
import type { TreeItem } from "../tree-view";
import UIProvider from "../../providers/ui-provider";
import { getActiveElement } from "../overlay-stack";

// Electronics
//   Computers
//     Laptops
//     Desktops
//   Phones
//   Cameras (disabled)
// Garden
const categories: TreeItem<string>[] = [
  {
    children: [
      {
        children: [
          { id: "laptops", label: "Laptops" },
          { id: "desktops", label: "Desktops" },
        ],
        id: "computers",
        label: "Computers",
      },
      { id: "phones", label: "Phones" },
      { disabled: true, id: "cameras", label: "Cameras" },
    ],
    id: "electronics",
    label: "Electronics",
  },
  { id: "garden", label: "Garden" },
];

const combobox = () => screen.getByRole("combobox");
const item = (name: string) => screen.getByRole("treeitem", { name });
const queryTree = () => screen.queryByRole("tree");
const search = () => screen.getByRole("searchbox", { name: "Search" });
const formValues = (form: HTMLFormElement, name: string) =>
  new FormData(form).getAll(name);

describe("TreeSelect", () => {
  it("navigates its tree in a shadow root and returns the focus after picking or clearing", () => {
    const host = document.createElement("div");
    document.body.append(host);
    onTestFinished(() => host.remove());
    const shadow = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    const portalRoot = document.createElement("div");
    shadow.append(container, portalRoot);
    const onChange = vi.fn();
    render(
      <UIProvider portalContainer={portalRoot}>
        <TreeSelect items={categories} label="Category" onChange={onChange} />
      </UIProvider>,
      { container },
    );
    const app = within(container);
    const popup = within(portalRoot);
    const field = app.getByRole("combobox");
    act(() => field.focus());
    fireEvent.keyDown(field, { composed: true, key: "ArrowDown" });
    const searchField = popup.getByRole("searchbox");
    expect(getActiveElement(shadow)).toBe(searchField);
    fireEvent.keyDown(searchField, { composed: true, key: "ArrowDown" });

    const electronics = popup.getByRole("treeitem", { name: "Electronics" });
    expect(getActiveElement(shadow)).toBe(electronics);
    fireEvent.keyDown(electronics, { composed: true, key: "ArrowRight" });
    fireEvent.keyDown(electronics, { composed: true, key: "ArrowDown" });
    const computers = popup.getByRole("treeitem", { name: "Computers" });
    expect(getActiveElement(shadow)).toBe(computers);
    fireEvent.keyDown(computers, { composed: true, key: "ArrowRight" });
    fireEvent.keyDown(computers, { composed: true, key: "ArrowDown" });
    const laptops = popup.getByRole("treeitem", { name: "Laptops" });
    expect(getActiveElement(shadow)).toBe(laptops);
    fireEvent.keyDown(laptops, { composed: true, key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith("laptops", expect.any(Object));
    expect(popup.queryByRole("tree")).toBeNull();
    expect(getActiveElement(shadow)).toBe(field);
    expect(field).toHaveTextContent("Laptops");

    const clear = app.getByRole("button", { name: "Clear" });
    act(() => clear.focus());
    fireEvent.click(clear);
    expect(onChange).toHaveBeenLastCalledWith(null, null);
    expect(getActiveElement(shadow)).toBe(field);
  });

  it("is a combobox named by its label that opens a tree", async () => {
    const user = userEvent.setup();
    render(
      <TreeSelect items={categories} label="Category" placeholder="Pick one" />,
    );

    expect(combobox()).toHaveAccessibleName("Category:");
    expect(combobox()).toHaveAttribute("aria-haspopup", "tree");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).not.toHaveAttribute("aria-controls");
    expect(combobox()).toHaveTextContent("Pick one");

    await user.click(combobox());
    const tree = screen.getByRole("tree", { name: "Category:" });
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(combobox()).toHaveAttribute("aria-controls", tree.id);
    // A click puts the focus into the search field
    expect(search()).toHaveFocus();
  });

  it("opens with the keys, moves into the tree and picks with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect items={categories} label="Category" onChange={onChange} />,
    );

    await user.tab();
    expect(combobox()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(search()).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(item("Electronics")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowRight}{ArrowDown}");
    expect(item("Laptops")).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("laptops", {
      id: "laptops",
      label: "Laptops",
    });
    // Closed, the focus back on the field, which shows the pick
    expect(queryTree()).not.toBeInTheDocument();
    expect(combobox()).toHaveFocus();
    expect(combobox()).toHaveTextContent("Laptops");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on the selection - expanded to it, the focus on it", async () => {
    const user = userEvent.setup();
    render(
      <TreeSelect
        defaultValue="desktops"
        items={categories}
        label="Category"
        searchable={false}
      />,
    );

    await user.tab();
    await user.keyboard("{Enter}");
    expect(item("Desktops")).toHaveFocus();
    expect(item("Desktops")).toHaveAttribute("aria-selected", "true");
    expect(item("Computers")).toHaveAttribute("aria-expanded", "true");

    // Space picks too
    await user.keyboard("{ArrowUp}[Space]");
    expect(combobox()).toHaveTextContent("Laptops");
    expect(combobox()).toHaveFocus();
  });

  it("closes with Space on the item picked already - a Space typed in a typeahead search goes on with it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        defaultValue="new-york"
        items={[
          { id: "boston", label: "Boston" },
          { id: "new-york", label: "New York" },
        ]}
        label="City"
        onChange={onChange}
        searchable={false}
      />,
    );

    await user.tab();
    await user.keyboard("{Enter}");
    expect(item("New York")).toHaveFocus();
    await user.keyboard("[Space]");
    expect(queryTree()).not.toBeInTheDocument();
    expect(combobox()).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    // "New Y…" typed in the tree - the Space is part of it
    await user.keyboard("{Enter}");
    await user.keyboard("new ");
    expect(item("New York")).toHaveFocus();
    expect(queryTree()).toBeInTheDocument();
  });

  it("closes with Escape and gives the focus back - an Escape in the search empties it first", async () => {
    const user = userEvent.setup();
    render(<TreeSelect items={categories} label="Category" />);

    await user.tab();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("gar");
    expect(search()).toHaveValue("gar");

    await user.keyboard("{Escape}");
    expect(search()).toHaveValue("");
    expect(search()).toHaveFocus();

    await user.keyboard("{ArrowDown}{Escape}");
    expect(queryTree()).not.toBeInTheDocument();
    expect(combobox()).toHaveFocus();
  });

  it("filters the tree by the search - a letter typed on the field starts it", async () => {
    const user = userEvent.setup();
    render(<TreeSelect items={categories} label="Category" />);

    await user.tab();
    await user.keyboard("l");
    expect(search()).toHaveFocus();
    expect(search()).toHaveValue("l");
    await user.keyboard("ap");

    expect(
      screen.getAllByRole("treeitem").map((row) => row.textContent),
    ).toEqual(["Electronics", "Computers", "Laptops"]);

    // Down into the matches, up from the first back to the search
    await user.keyboard("{ArrowDown}");
    expect(item("Electronics")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(search()).toHaveFocus();

    await user.clear(search());
    await user.type(search(), "xyz");
    expect(screen.getByRole("status")).toHaveTextContent("No matching items");
  });

  it("closes as Tab moves on - out of the tree to the next field, back to the field", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TreeSelect items={categories} label="Category" />
        <button type="button">Next</button>
      </>,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");
    // Search, tree - then out
    await user.tab();
    expect(item("Electronics")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(queryTree()).not.toBeInTheDocument();

    await user.tab({ shift: true });
    await user.keyboard("{ArrowDown}");
    await user.tab({ shift: true });
    expect(combobox()).toHaveFocus();
    expect(queryTree()).not.toBeInTheDocument();
  });

  it("picks with a click and closes - also on the item picked already", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        defaultValue="garden"
        items={categories}
        label="Category"
        onChange={onChange}
      />,
    );

    await user.click(combobox());
    await user.click(item("Garden"));
    expect(queryTree()).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(combobox());
    await user.click(item("Electronics"));
    expect(onChange).toHaveBeenLastCalledWith("electronics", categories[0]);
    expect(combobox()).toHaveTextContent("Electronics");
  });

  it("does not pick a disabled item", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        items={categories}
        label="Category"
        onChange={onChange}
        searchable={false}
      />,
    );

    await user.click(combobox());
    await user.click(
      item("Electronics").querySelector("[data-tree-toggle]") as Element,
    );
    await user.click(item("Cameras"));
    expect(onChange).not.toHaveBeenCalled();
    expect(queryTree()).toBeInTheDocument();
  });

  it("shows the path of the item with showPath", () => {
    render(
      <TreeSelect
        defaultValue="laptops"
        items={categories}
        label="Category"
        showPath
      />,
    );
    expect(combobox()).toHaveTextContent("Electronics / Computers / Laptops");
  });

  it("clears with its button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        defaultValue="garden"
        items={categories}
        label="Category"
        onChange={onChange}
        placeholder="None"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(null, null);
    expect(combobox()).toHaveTextContent("None");
    expect(queryTree()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("works controlled", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = useState<string | null>("phones");
      return (
        <>
          <TreeSelect
            items={categories}
            label="Category"
            onChange={setValue}
            value={value}
          />
          <button onClick={() => setValue("garden")} type="button">
            Garden
          </button>
        </>
      );
    }

    render(<Controlled />);
    expect(combobox()).toHaveTextContent("Phones");
    await user.click(screen.getByRole("button", { name: "Garden" }));
    expect(combobox()).toHaveTextContent("Garden");
  });

  it("reports a blur only when the focus leaves the whole field", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <TreeSelect
          items={categories}
          label="Category"
          onBlur={onBlur}
          onFocus={onFocus}
        />
        <button type="button">Next</button>
      </>,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(item("Electronics")).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();

    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("TreeSelect multiple", () => {
  it("checks items - a fully checked parent is one chip", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        items={categories}
        label="Categories"
        multiple
        onChange={onChange}
        searchable={false}
      />,
    );

    await user.click(combobox());
    const tree = screen.getByRole("tree");
    expect(tree).not.toHaveAttribute("aria-multiselectable");

    await user.click(
      item("Electronics").querySelector("[data-tree-toggle]") as Element,
    );
    await user.click(item("Computers"));
    expect(onChange).toHaveBeenLastCalledWith(
      ["computers", "laptops", "desktops"],
      [
        categories[0].children?.[0],
        { id: "laptops", label: "Laptops" },
        { id: "desktops", label: "Desktops" },
      ],
    );
    // The popup stays open for more
    expect(item("Computers")).toHaveAttribute("aria-checked", "true");
    await user.click(item("Garden"));

    // Computers stands for its children
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Remove Computers" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Garden" })).toBeVisible();
    expect(combobox()).toHaveTextContent("Computers and Garden");
  });

  it("removes a chip - unchecking the item and what it stands for", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        defaultValue={["computers", "phones"]}
        items={categories}
        label="Categories"
        multiple
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove Computers" }));
    expect(onChange).toHaveBeenLastCalledWith(
      ["phones"],
      [{ id: "phones", label: "Phones" }],
    );
    expect(queryTree()).not.toBeInTheDocument();

    // Backspace on the field removes the last chip
    act(() => combobox().focus());
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith([], []);
  });

  it("shows up to maxChips chips and the rest as one", () => {
    render(
      <TreeSelect
        defaultValue={["laptops", "desktops", "phones", "garden"]}
        items={categories}
        label="Categories"
        maxChips={2}
        multiple
      />,
    );

    // Laptops and Desktops are Computers - Computers, Phones, Garden
    expect(screen.getByText("Computers")).toBeVisible();
    expect(screen.getByText("Phones")).toBeVisible();
    expect(screen.queryByText("Garden")).not.toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeVisible();
    expect(combobox()).toHaveTextContent("Computers, Phones, and +1 more");
  });

  it("checks independently with checkMode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        checkMode="independent"
        items={categories}
        label="Categories"
        multiple
        onChange={onChange}
        searchable={false}
      />,
    );

    await user.click(combobox());
    await user.click(item("Electronics"));
    expect(onChange).toHaveBeenLastCalledWith(["electronics"], [categories[0]]);
    await user.click(
      item("Electronics").querySelector("[data-tree-toggle]") as Element,
    );
    expect(item("Phones")).toHaveAttribute("aria-checked", "false");
    await user.click(item("Phones"));
    expect(onChange).toHaveBeenLastCalledWith(
      ["electronics", "phones"],
      [categories[0], { id: "phones", label: "Phones" }],
    );
    // A chip for each - the parent does not stand for the child
    expect(
      screen.getByRole("button", { name: "Remove Electronics" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Phones" })).toBeVisible();
  });

  it("keeps a disabled item checked and without a remove button", () => {
    render(
      <TreeSelect
        defaultValue={["cameras", "garden"]}
        items={categories}
        label="Categories"
        multiple
      />,
    );

    expect(combobox()).toHaveTextContent("Cameras and Garden");
    expect(
      screen.queryByRole("button", { name: "Remove Cameras" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(combobox()).toHaveTextContent("Cameras");
    expect(combobox()).not.toHaveTextContent("Garden");
  });

  it("keeps disabled descendants selected through a parent when clearing", () => {
    const onChange = vi.fn();
    render(
      <form aria-label="form">
        <TreeSelect
          defaultValue={["electronics"]}
          items={categories}
          label="Categories"
          multiple
          name="categories"
          onChange={onChange}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(formValues(form, "categories")).toContain("cameras");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith(
      ["cameras"],
      [{ disabled: true, id: "cameras", label: "Cameras" }],
    );
    expect(formValues(form, "categories")).toEqual(["cameras"]);
    expect(combobox()).toHaveTextContent("Cameras");
    expect(
      screen.queryByRole("button", { name: "Remove Cameras" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("keeps a checked parent with only disabled descendants when its chip is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const items = [
      {
        children: [{ disabled: true, id: "child", label: "Child" }],
        id: "parent",
        label: "Parent",
      },
    ];
    render(
      <form aria-label="form">
        <TreeSelect
          defaultValue={["parent"]}
          items={items}
          label="Categories"
          multiple
          name="categories"
          onChange={onChange}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(formValues(form, "categories")).toEqual(["parent", "child"]);

    await user.click(screen.getByRole("button", { name: "Remove Parent" }));
    act(() => combobox().focus());
    await user.keyboard("{Backspace}{Delete}");

    expect(onChange).not.toHaveBeenCalled();
    expect(formValues(form, "categories")).toEqual(["parent", "child"]);
    expect(combobox()).toHaveTextContent("Parent");
  });

  it("removes a chip whose item is not in the tree", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TreeSelect
        defaultValue={["missing", "garden"]}
        items={categories}
        label="Categories"
        multiple
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove missing" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      ["garden"],
      [{ id: "garden", label: "Garden" }],
    );
    expect(combobox()).toHaveTextContent("Garden");
    expect(combobox()).not.toHaveTextContent("missing");
  });
});

describe("TreeSelect in a form", () => {
  it("submits the value - an empty one without - and resets to the default", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TreeSelect
          defaultValue="phones"
          items={categories}
          label="Category"
          name="category"
        />
        <TreeSelect items={categories} label="Other" name="other" />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(formValues(form, "category")).toEqual(["phones"]);
    expect(formValues(form, "other")).toEqual([""]);

    const [field] = screen.getAllByRole("combobox");
    await user.click(field);
    await user.click(item("Garden"));
    expect(formValues(form, "category")).toEqual(["garden"]);

    act(() => form.reset());
    await waitFor(() =>
      expect(formValues(form, "category")).toEqual(["phones"]),
    );
    expect(field).toHaveTextContent("Phones");
  });

  it("shows a defaultValue arriving later until the user picks - and again after a reset", async () => {
    const user = userEvent.setup();
    const field = (defaultValue?: string) => (
      <form data-testid="form">
        <TreeSelect
          defaultValue={defaultValue}
          items={categories}
          label="Category"
          name="category"
        />
      </form>
    );
    const { rerender } = render(field());
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(formValues(form, "category")).toEqual([""]);

    // The data of an edit form - and changed again
    rerender(field("phones"));
    expect(formValues(form, "category")).toEqual(["phones"]);
    rerender(field("garden"));
    expect(formValues(form, "category")).toEqual(["garden"]);
    expect(combobox()).toHaveTextContent("Garden");

    // A pick of the user stays
    await user.click(combobox());
    await user.click(item("Electronics"));
    rerender(field("laptops"));
    expect(formValues(form, "category")).toEqual(["electronics"]);

    act(() => form.reset());
    await waitFor(() =>
      expect(formValues(form, "category")).toEqual(["laptops"]),
    );
    expect(combobox()).toHaveTextContent("Laptops");
  });

  it("submits the checked items of a multiple field - parents of checked children too", () => {
    render(
      <form data-testid="form">
        <TreeSelect
          defaultValue={["laptops", "desktops", "garden"]}
          items={categories}
          label="Categories"
          multiple
          name="categories"
        />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(formValues(form, "categories")).toEqual([
      "computers",
      "laptops",
      "desktops",
      "garden",
    ]);
  });

  it.each(["cascade", "independent"] as const)(
    "removes chips and submitted values with mixed numeric and string ids (%s)",
    (checkMode) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const items: TreeItem[] = [
        { id: 1, label: "Numeric id" },
        { id: "1", label: "String id" },
        { id: 2, label: "Other id" },
      ];
      const field = (value: TreeItem["id"][]) => (
        <form data-testid="form">
          <TreeSelect
            checkMode={checkMode}
            items={items}
            multiple
            name="categories"
            value={value}
          />
        </form>
      );
      const { rerender } = render(field([1, "1", 2]));
      const form = screen.getByTestId("form") as HTMLFormElement;
      expect(formValues(form, "categories")).toEqual(["1", "1", "2"]);
      expect(screen.getByText("Numeric id")).toBeVisible();
      expect(screen.getByText("String id")).toBeVisible();

      rerender(field([2]));
      expect(formValues(form, "categories")).toEqual(["2"]);
      expect(screen.queryByText("Numeric id")).toBeNull();
      expect(screen.queryByText("String id")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Remove Other id" }),
      ).toBeVisible();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("belongs to the form of its form attribute", () => {
    render(
      <>
        <form data-testid="form" id="elsewhere" />
        <TreeSelect
          defaultValue="garden"
          form="elsewhere"
          items={categories}
          label="Category"
          name="category"
        />
      </>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(formValues(form, "category")).toEqual(["garden"]);
  });

  it("is required - the browser validates it", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TreeSelect items={categories} label="Category" required />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;

    expect(combobox()).toHaveAttribute("aria-required", "true");
    expect(form.checkValidity()).toBe(false);

    await user.click(combobox());
    await user.click(item("Garden"));
    expect(form.checkValidity()).toBe(true);
  });

  it("is read-only: focusable and submitted, but it opens nothing and removes nothing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form data-testid="form">
        <TreeSelect
          defaultValue={["phones", "garden"]}
          items={categories}
          label="Categories"
          multiple
          name="categories"
          onChange={onChange}
          readOnly
          required
        />
      </form>,
    );

    await user.tab();
    expect(combobox()).toHaveFocus();
    expect(combobox()).toHaveAttribute("aria-readonly", "true");
    expect(combobox()).toHaveAttribute("data-readonly");

    await user.keyboard("{ArrowDown}{Enter}{Backspace}");
    await user.click(combobox());
    expect(queryTree()).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(formValues(form, "categories")).toEqual(["phones", "garden"]);
  });

  it("is disabled: not focusable, neither submitted nor validated", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TreeSelect
          defaultValue="garden"
          disabled
          items={categories}
          label="Category"
          name="category"
          required
        />
      </form>,
    );

    expect(combobox()).toHaveAttribute("aria-disabled", "true");
    expect(combobox()).not.toHaveAttribute("tabindex");
    await user.tab();
    expect(combobox()).not.toHaveFocus();
    fireEvent.click(combobox());
    expect(queryTree()).not.toBeInTheDocument();

    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
    expect(formValues(form, "category")).toEqual([]);
  });

  it("is disabled by a disabled fieldset around it", () => {
    render(
      <fieldset disabled>
        <TreeSelect
          defaultValue={["garden"]}
          items={categories}
          label="Categories"
          multiple
        />
      </fieldset>,
    );

    expect(combobox()).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(combobox(), { key: "ArrowDown" });
    expect(queryTree()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Garden" }),
    ).not.toBeInTheDocument();
  });
});

describe("TreeSelect loading children", () => {
  it.each([true, false])(
    "ignores an aborted load when it finishes before the new one: %s",
    async (oldFirst) => {
      const user = userEvent.setup();
      const requests: {
        resolve: (children: TreeItem<string>[]) => void;
        signal: AbortSignal;
      }[] = [];
      const items: TreeItem<string>[] = [
        { hasChildren: true, id: "folder", label: "Folder" },
      ];
      render(
        <TreeSelect
          items={items}
          label="Category"
          loadChildren={(_item, { signal }) =>
            new Promise<TreeItem<string>[]>((resolve) =>
              requests.push({ resolve, signal }),
            )
          }
        />,
      );

      await user.click(combobox());
      await user.click(
        item("Folder").querySelector("[data-tree-toggle]") as Element,
      );
      expect(requests).toHaveLength(1);
      await user.keyboard("{Escape}");
      expect(requests[0].signal.aborted).toBe(true);
      await user.click(combobox());
      expect(requests).toHaveLength(2);

      const finishOld = () =>
        act(async () => requests[0].resolve([{ id: "stale", label: "Stale" }]));
      if (oldFirst) {
        await finishOld();
        expect(screen.queryByRole("treeitem", { name: "Stale" })).toBeNull();
      }

      await act(async () =>
        requests[1].resolve([{ id: "fresh", label: "Fresh" }]),
      );
      expect(item("Fresh")).toBeInTheDocument();
      if (!oldFirst) await finishOld();

      expect(item("Fresh")).toBeInTheDocument();
      expect(screen.queryByRole("treeitem", { name: "Stale" })).toBeNull();
      await user.click(item("Fresh"));
      expect(combobox()).toHaveTextContent("Fresh");
    },
  );

  it("keeps the children loaded while the popup is closed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const loadChildren = vi.fn(async (folder: TreeItem<string>) => [
      { id: `${folder.id}/2026`, label: "2026" },
    ]);
    render(
      <TreeSelect
        items={[{ hasChildren: true, id: "invoices", label: "Invoices" }]}
        label="Folder"
        loadChildren={loadChildren}
        onChange={onChange}
        searchable={false}
      />,
    );

    await user.click(combobox());
    await user.click(
      item("Invoices").querySelector("[data-tree-toggle]") as Element,
    );
    await user.click(await screen.findByRole("treeitem", { name: "2026" }));
    expect(onChange).toHaveBeenCalledWith("invoices/2026", {
      id: "invoices/2026",
      label: "2026",
    });
    // The loaded item's label
    expect(combobox()).toHaveTextContent("2026");

    // Open again - expanded to it, nothing loaded again
    await user.click(combobox());
    expect(item("2026")).toHaveAttribute("aria-selected", "true");
    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(loadChildren).toHaveBeenCalledWith(
      { hasChildren: true, id: "invoices", label: "Invoices" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("renders the labels its own way, with the original items", async () => {
    const user = userEvent.setup();
    render(
      <TreeSelect
        items={categories}
        label="Category"
        renderLabel={(entry, { label }) => (
          <>
            {label} ({entry.children?.length ?? 0})
          </>
        )}
        searchable={false}
      />,
    );

    await user.click(combobox());
    expect(item("Electronics (3)")).toBeInTheDocument();
    expect(item("Garden (0)")).toBeInTheDocument();
    // The field shows the label
    await user.click(item("Garden (0)"));
    expect(combobox()).toHaveTextContent(/^Garden$/);
  });
});
