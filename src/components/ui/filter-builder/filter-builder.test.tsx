import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FilterBuilder from ".";
import FormSection from "../form-section";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import type { FilterField, FilterGroup } from "./types";

const fields: FilterField[] = [
  { key: "customer", label: "Customer", type: "text" },
  { key: "total", label: "Total", type: "number" },
  { key: "dueDate", label: "Due date", type: "date" },
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Paid", value: "paid" },
      { label: "Overdue", value: "overdue" },
      { label: "Draft", value: 3 },
    ],
    type: "select",
  },
  { key: "paid", label: "Paid", type: "boolean" },
  { key: "note", label: "Note", type: "text" },
];

const condition = (name: string) => screen.getByRole("group", { name });
const fieldSelect = (name: string) =>
  within(condition(name)).getByRole("combobox", { name: "Field" });
const operatorSelect = (name: string) =>
  within(condition(name)).getByRole("combobox", { name: "Operator" });

/** The last value given to `onChange`. */
const lastValue = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.lastCall?.[0] as FilterGroup;

/** A filter without the ids the builder gives. */
const withoutIds = (group: FilterGroup): unknown =>
  JSON.parse(JSON.stringify(group), (key, value: unknown) =>
    key === "id" ? undefined : value,
  );

describe("FilterBuilder", () => {
  it("is a fieldset named by its label, empty at first", () => {
    const ref = createRef<HTMLFieldSetElement>();
    render(<FilterBuilder fields={fields} ref={ref} />);

    const root = screen.getByRole("group", { name: "Filter" });
    expect(root.tagName).toBe("FIELDSET");
    expect(ref.current).toBe(root);
    expect(
      screen.getByText("No conditions - every record matches."),
    ).toBeInTheDocument();
  });

  it("adds a condition of the first field and focuses it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder fields={fields} label="Invoices" onChange={onChange} />,
    );

    expect(screen.getByRole("group", { name: "Invoices" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add condition" }));

    expect(fieldSelect("Condition 1")).toHaveFocus();
    expect(fieldSelect("Condition 1")).toHaveValue("customer");
    expect(operatorSelect("Condition 1")).toHaveValue("contains");
    const value = lastValue(onChange);
    expect(withoutIds(value)).toEqual({
      combinator: "and",
      conditions: [{ field: "customer", operator: "contains" }],
    });
    // Each node has an id for the app to keep
    expect(value.id).toEqual(expect.any(String));
    expect(value.conditions[0].id).toEqual(expect.any(String));

    await user.type(
      within(condition("Condition 1")).getByRole("textbox", { name: "Value" }),
      "Škoda",
    );
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "and",
      conditions: [{ field: "customer", operator: "contains", value: "Škoda" }],
    });
  });

  it("offers the operators of the field - and resets them for another type", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [
            { field: "customer", operator: "equals", value: "Alza" },
          ],
        }}
        fields={fields}
        onChange={onChange}
      />,
    );

    expect(
      within(operatorSelect("Condition 1"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "contains",
      "does not contain",
      "is",
      "is not",
      "starts with",
      "ends with",
      "is empty",
      "is not empty",
    ]);

    // Another text field keeps the operator and the value
    await user.selectOptions(fieldSelect("Condition 1"), "note");
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "and",
      conditions: [{ field: "note", operator: "equals", value: "Alza" }],
    });

    // A number field starts over
    await user.selectOptions(fieldSelect("Condition 1"), "total");
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "and",
      conditions: [{ field: "total", operator: "equals" }],
    });
    expect(operatorSelect("Condition 1")).toHaveValue("equals");
    expect(
      within(condition("Condition 1")).getByRole("spinbutton", {
        name: "Value",
      }),
    ).toHaveValue("");
  });

  it("carries the value over to another operator", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "total", operator: "equals", value: 500 }],
        }}
        fields={fields}
        onChange={onChange}
      />,
    );

    await user.selectOptions(operatorSelect("Condition 1"), "between");
    const row = condition("Condition 1");
    expect(within(row).getByRole("spinbutton", { name: "From" })).toHaveValue(
      "500",
    );
    expect(within(row).getByRole("spinbutton", { name: "To" })).toHaveValue("");
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "and",
      conditions: [
        { field: "total", operator: "between", value: { from: 500 } },
      ],
    });

    await user.type(within(row).getByRole("spinbutton", { name: "To" }), "900");
    await user.tab();
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "and",
      conditions: [
        {
          field: "total",
          operator: "between",
          value: { from: 500, to: 900 },
        },
      ],
    });

    // No value for "is empty"
    await user.selectOptions(operatorSelect("Condition 1"), "isEmpty");
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "and",
      conditions: [{ field: "total", operator: "isEmpty" }],
    });
    expect(within(row).queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("enters values in the fields of their type", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [
            { field: "status", operator: "equals" },
            { field: "paid", operator: "equals" },
            { field: "dueDate", operator: "before" },
          ],
        }}
        fields={fields}
        onChange={onChange}
      />,
    );

    // A select of the options - a number stays a number
    const status = within(condition("Condition 1")).getByRole("combobox", {
      name: "Value",
    });
    await user.selectOptions(status, "3");
    expect(lastValue(onChange).conditions[0]).toMatchObject({ value: 3 });

    // Yes / No
    await user.click(
      within(condition("Condition 2")).getByRole("radio", { name: "No" }),
    );
    expect(lastValue(onChange).conditions[1]).toMatchObject({ value: false });

    // A day
    await user.type(
      within(condition("Condition 3")).getByRole("combobox", { name: "Value" }),
      "10/15/2026{Enter}",
    );
    expect(lastValue(onChange).conditions[2]).toMatchObject({
      value: "2026-10-15",
    });
  });

  it("picks several options for “is any of”", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "status", operator: "in", value: ["paid"] }],
        }}
        fields={fields}
        onChange={onChange}
      />,
    );

    const input = within(condition("Condition 1")).getByRole("combobox", {
      name: "Value",
    });
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Overdue" }));
    expect(lastValue(onChange).conditions[0]).toMatchObject({
      value: ["paid", "overdue"],
    });
  });

  it("takes typed values for “is any of” of a text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "total", operator: "equals", value: 5 }],
        }}
        fields={[
          {
            key: "total",
            label: "Total",
            operators: ["equals", "in"],
            type: "number",
          },
        ]}
        onChange={onChange}
      />,
    );

    await user.selectOptions(operatorSelect("Condition 1"), "in");
    expect(lastValue(onChange).conditions[0]).toMatchObject({ value: [5] });
    await user.type(
      within(condition("Condition 1")).getByRole("textbox", { name: "Value" }),
      "7.5{Enter}",
    );
    expect(lastValue(onChange).conditions[0]).toMatchObject({
      value: [5, 7.5],
    });
  });

  it("removes a condition and moves the focus on", async () => {
    const user = userEvent.setup();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [
            { field: "customer", id: "a", operator: "contains", value: "A" },
            { field: "customer", id: "b", operator: "contains", value: "B" },
          ],
        }}
        fields={fields}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remove condition 1" }),
    );
    // The next one is the first now
    expect(fieldSelect("Condition 1")).toHaveFocus();
    expect(
      within(condition("Condition 1")).getByRole("textbox", { name: "Value" }),
    ).toHaveValue("B");

    await user.click(
      screen.getByRole("button", { name: "Remove condition 1" }),
    );
    expect(screen.getByRole("button", { name: "Add condition" })).toHaveFocus();
  });

  it("nests groups, each with its combinator, up to `maxDepth`", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterBuilder fields={fields} maxDepth={2} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add condition" }));
    // One condition joins nothing
    expect(
      screen.queryByRole("radiogroup", { name: "Join conditions with" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add group" }));
    const group = screen.getByRole("group", { name: "Group 2" });
    expect(group.tagName).toBe("FIELDSET");
    expect(
      within(group).getByRole("combobox", { name: "Field" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("group", { name: "Condition 2.1" }),
    ).toBeInTheDocument();
    // No deeper groups
    expect(
      within(group).queryByRole("button", { name: "Add group" }),
    ).not.toBeInTheDocument();

    const [rootSwitch] = screen.getAllByRole("radiogroup", {
      name: "Join conditions with",
    });
    await user.click(within(rootSwitch).getByRole("radio", { name: "Or" }));
    await user.click(
      within(group).getByRole("button", { name: "Add condition" }),
    );
    await user.click(
      within(
        within(group).getByRole("radiogroup", { name: "Join conditions with" }),
      ).getByRole("radio", { name: "Or" }),
    );
    expect(withoutIds(lastValue(onChange))).toEqual({
      combinator: "or",
      conditions: [
        { field: "customer", operator: "contains" },
        {
          combinator: "or",
          conditions: [
            { field: "customer", operator: "contains" },
            { field: "customer", operator: "contains" },
          ],
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Remove group 2" }));
    expect(
      screen.queryByRole("group", { name: "Group 2" }),
    ).not.toBeInTheDocument();
    expect(fieldSelect("Condition 1")).toHaveFocus();
  });

  it("offers no groups with a `maxDepth` of 1", () => {
    render(<FilterBuilder fields={fields} maxDepth={1} />);
    expect(
      screen.queryByRole("button", { name: "Add group" }),
    ).not.toBeInTheDocument();
  });

  it("lists the fields under the headings of their group", () => {
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "city", operator: "contains" }],
        }}
        fields={[
          { key: "number", label: "Number", type: "text" },
          { group: "Customer", key: "name", label: "Name", type: "text" },
          { group: "Customer", key: "city", label: "City", type: "text" },
        ]}
      />,
    );

    const select = fieldSelect("Condition 1");
    const heading = within(select).getByRole("group", { name: "Customer" });
    expect(
      within(heading)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Name", "City"]);
  });

  it("shows a condition of a field it does not know by its key", () => {
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "legacy", operator: "equals", value: "x" }],
        }}
        fields={fields}
      />,
    );
    expect(fieldSelect("Condition 1")).toHaveValue("legacy");
    expect(
      within(condition("Condition 1")).getByRole("textbox", { name: "Value" }),
    ).toHaveValue("x");
  });

  it("renders the value field of a custom field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "rating", operator: "equals" }],
        }}
        fields={[
          {
            key: "rating",
            label: "Rating",
            render: ({ "aria-label": label, onChange, value }) => (
              <button
                aria-label={label}
                onClick={() => onChange(Number(value ?? 0) + 1)}
                type="button"
              >
                {String(value ?? 0)} stars
              </button>
            ),
            type: "custom",
          },
        ]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Value" }));
    await user.click(screen.getByRole("button", { name: "Value" }));
    expect(screen.getByText("2 stars")).toBeInTheDocument();
    expect(lastValue(onChange).conditions[0]).toMatchObject({ value: 2 });
  });

  it("loads the options of a field from an API", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const loadOptions = vi.fn(async ({ search }: { search: string }) =>
      [
        { label: "Jana Nováková", value: 7 },
        { label: "Petr Svoboda", value: 8 },
      ].filter((user) =>
        user.label.toLowerCase().includes(search.toLowerCase()),
      ),
    );
    render(
      <FilterBuilder
        defaultValue={{
          combinator: "and",
          conditions: [{ field: "owner", operator: "equals" }],
        }}
        fields={[{ key: "owner", label: "Owner", loadOptions, type: "select" }]}
        onChange={onChange}
      />,
    );

    await user.type(
      within(condition("Condition 1")).getByRole("combobox", { name: "Value" }),
      "petr",
    );
    await user.click(
      await screen.findByRole("option", { name: "Petr Svoboda" }),
    );
    expect(loadOptions).toHaveBeenCalled();
    expect(lastValue(onChange).conditions[0]).toMatchObject({ value: 8 });
  });

  it("works controlled", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<FilterGroup>({
        combinator: "and",
        conditions: [{ field: "customer", operator: "contains", value: "A" }],
      });
      return (
        <>
          <FilterBuilder fields={fields} onChange={setValue} value={value} />
          <output>{value.conditions.length}</output>
          <button
            onClick={() => setValue({ combinator: "and", conditions: [] })}
            type="button"
          >
            Clear
          </button>
        </>
      );
    }
    render(<Controlled />);

    await user.click(screen.getByRole("button", { name: "Add condition" }));
    expect(screen.getByRole("status")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.queryByRole("group", { name: "Condition 1" }),
    ).not.toBeInTheDocument();
  });

  it("shows only its value when controlled without `onChange` taking it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBuilder
        fields={fields}
        onChange={onChange}
        value={{ combinator: "and", conditions: [] }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add condition" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("group", { name: "Condition 1" }),
    ).not.toBeInTheDocument();
  });

  it("submits the complete conditions as JSON - and resets with its form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return new FormData(event.currentTarget).get("filter");
    });
    render(
      <form aria-label="Search" onSubmit={onSubmit}>
        <FilterBuilder
          defaultValue={{
            combinator: "and",
            conditions: [
              { field: "status", operator: "equals", value: "paid" },
              { field: "customer", operator: "contains" },
            ],
          }}
          fields={fields}
          name="filter"
        />
        <button type="submit">Search</button>
        <button type="reset">Reset</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(JSON.parse(String(onSubmit.mock.results[0].value))).toEqual({
      combinator: "and",
      conditions: [{ field: "status", operator: "equals", value: "paid" }],
    });

    // Typing into the value field submits nothing of its own
    await user.type(
      within(condition("Condition 2")).getByRole("textbox", { name: "Value" }),
      "Acme",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    // jsdom builds a FormData without firing the event browsers fire
    const form = screen.getByRole("form") as HTMLFormElement;
    const formData = new FormData(form);
    form.dispatchEvent(Object.assign(new Event("formdata"), { formData }));
    expect([...formData.keys()]).toEqual(["filter"]);
    expect(JSON.parse(String(onSubmit.mock.results[1].value))).toEqual({
      combinator: "and",
      conditions: [
        { field: "status", operator: "equals", value: "paid" },
        { field: "customer", operator: "contains", value: "Acme" },
      ],
    });

    await user.click(
      screen.getByRole("button", { name: "Remove condition 1" }),
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(screen.getAllByRole("group", { name: /^Condition/ })).toHaveLength(
      2,
    );
    expect(
      within(condition("Condition 2")).getByRole("textbox", { name: "Value" }),
    ).toHaveValue("");
  });

  it("disables all its fields and submits nothing when disabled", () => {
    render(
      <form aria-label="Search">
        <FilterBuilder
          defaultValue={{
            combinator: "and",
            conditions: [
              { field: "status", operator: "equals", value: "paid" },
            ],
          }}
          disabled
          fields={fields}
          name="filter"
        />
      </form>,
    );

    expect(fieldSelect("Condition 1")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add condition" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove condition 1" }),
    ).toBeDisabled();
    const form = new FormData(screen.getByRole("form") as HTMLFormElement);
    expect(form.has("filter")).toBe(false);
  });

  it("shows the filter read-only - nothing to add or remove - and submits it", () => {
    const filter: FilterGroup = {
      combinator: "or",
      conditions: [
        { field: "status", operator: "equals", value: "paid" },
        { field: "customer", operator: "contains", value: "Acme" },
      ],
    };
    const { rerender } = render(
      <form aria-label="Search">
        <FilterBuilder
          defaultValue={filter}
          fields={fields}
          name="filter"
          readOnly
        />
      </form>,
    );

    expect(fieldSelect("Condition 1")).toHaveAttribute("aria-readonly", "true");
    expect(operatorSelect("Condition 1")).toHaveAttribute(
      "aria-readonly",
      "true",
    );
    expect(
      within(condition("Condition 2")).getByRole("textbox", { name: "Value" }),
    ).toHaveAttribute("readonly");
    for (const name of [
      "Add condition",
      "Add group",
      "Remove condition 1",
      "Remove condition 2",
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    const form = new FormData(screen.getByRole("form") as HTMLFormElement);
    expect(JSON.parse(form.get("filter") as string)).toEqual(
      withoutIds(filter),
    );

    // Read-only by a read-only section around - unless it says otherwise
    rerender(
      <form aria-label="Search">
        <FormSection readOnly title="Report">
          <FilterBuilder defaultValue={filter} fields={fields} />
        </FormSection>
      </form>,
    );
    expect(
      screen.queryByRole("button", { name: "Add condition" }),
    ).not.toBeInTheDocument();
    rerender(
      <form aria-label="Search">
        <FormSection readOnly title="Report">
          <FilterBuilder
            defaultValue={filter}
            fields={fields}
            readOnly={false}
          />
        </FormSection>
      </form>,
    );
    expect(
      screen.getByRole("button", { name: "Add condition" }),
    ).toBeInTheDocument();
    expect(fieldSelect("Condition 1")).not.toHaveAttribute(
      "aria-readonly",
      "true",
    );
  });

  it("is named by `aria-label` without a label", () => {
    render(<FilterBuilder aria-label="Order search" fields={fields} />);
    expect(
      screen.getByRole("group", { name: "Order search" }),
    ).toBeInTheDocument();
  });

  it("belongs to the form of `form` outside it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <form aria-label="Search" id="search" />
        <FilterBuilder
          defaultValue={{
            combinator: "and",
            conditions: [{ field: "total", operator: "isEmpty" }],
          }}
          fields={fields}
          form="search"
          name="filter"
        />
      </>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(JSON.parse(String(new FormData(form).get("filter")))).toEqual({
      combinator: "and",
      conditions: [{ field: "total", operator: "isEmpty" }],
    });

    await user.click(
      screen.getByRole("button", { name: "Remove condition 1" }),
    );
    expect(
      screen.queryByRole("group", { name: "Condition 1" }),
    ).not.toBeInTheDocument();
    act(() => form.reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(
      screen.getByRole("group", { name: "Condition 1" }),
    ).toBeInTheDocument();
  });

  it("hydrates without a mismatch", async () => {
    const page = (
      <UIProvider locale={cs}>
        <FilterBuilder
          defaultValue={{
            combinator: "or",
            conditions: [
              { field: "status", operator: "in", value: ["paid"] },
              {
                combinator: "and",
                conditions: [
                  { field: "paid", operator: "equals", value: true },
                  { field: "dueDate", operator: "before", value: "2026-10-01" },
                  { field: "total", operator: "between", value: { to: 5 } },
                ],
              },
            ],
          }}
          fields={fields}
          name="filter"
        />
      </UIProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(
      within(container).getByRole("group", { name: "Podmínka 2.3" }),
    ).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });

  it("speaks Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <FilterBuilder
          defaultValue={{
            combinator: "and",
            conditions: [
              { field: "total", operator: "between", value: { from: 1 } },
            ],
          }}
          fields={fields}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("group", { name: "Filtr" })).toBeInTheDocument();
    const row = screen.getByRole("group", { name: "Podmínka 1" });
    expect(
      within(row).getByRole("combobox", { name: "Pole" }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("combobox", { name: "Operátor" }),
    ).toHaveDisplayValue("mezi");
    expect(
      within(row).getByRole("spinbutton", { name: "Od" }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("spinbutton", { name: "Do" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Přidat skupinu" }));
    expect(
      screen.getByRole("group", { name: "Skupina 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("radiogroup", { name: "Spojení podmínek" })[0],
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Odebrat podmínku 2.1" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Odebrat skupinu 2" }));
    expect(
      screen.getByRole("button", { name: "Přidat podmínku" }),
    ).toBeInTheDocument();
  });
});
