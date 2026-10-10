import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import RepeatableField, {
  type RepeatableFieldItemProps,
} from "./repeatable-field";
import Input from "./input";
const initial = [
  { id: "a", value: "Adam" },
  { id: "b", value: "Eva" },
];
const renderItem = (item: RepeatableFieldItemProps<string>) => (
  <Input
    dim={item.dim}
    disabled={item.disabled}
    label={`Contact ${item.index + 1}`}
    name={`${item.name}.name`}
    onChange={(e) => item.onChange(e.target.value)}
    readOnly={item.readOnly}
    value={item.value}
  />
);

describe("RepeatableField", () => {
  it("adds, edits, reorders and removes stable keyed groups with form paths", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const { container } = render(
      <form>
        <RepeatableField
          createItem={() => "New"}
          defaultValue={initial}
          label="Contacts"
          name="contacts"
          onChange={change}
          renderItem={renderItem}
        />
      </form>,
    );
    const adam = screen.getByLabelText(/^Contact 1/);
    await user.click(screen.getByRole("button", { name: /Move item 1 down/ }));
    expect(screen.getByLabelText(/^Contact 2/)).toBe(adam);
    expect(adam).toHaveFocus();
    fireEvent.change(adam, { target: { value: "Robin" } });
    expect(change.mock.lastCall?.[0][1]).toEqual({ id: "a", value: "Robin" });
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByLabelText(/^Contact 3/)).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Remove item 1/ }));
    expect(
      new FormData(container.querySelector("form")!).get("contacts.0.name"),
    ).toBe("Robin");
    expect(
      new FormData(container.querySelector("form")!).get("contacts.1.name"),
    ).toBe("New");
  });
  it("holds the groups of an uncontrolled field in the form by onChange", async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    const { container } = render(
      <form>
        <RepeatableField
          createItem={() => "New"}
          defaultValue={initial}
          label="Contacts"
          name="contacts"
          onChange={() =>
            seen.push([
              ...new FormData(container.querySelector("form")!).values(),
            ])
          }
          renderItem={renderItem}
        />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: /Move item 1 down/ }));
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.click(screen.getByRole("button", { name: /Remove item 1/ }));
    expect(seen).toEqual([
      ["Eva", "Adam"],
      ["Eva", "Adam", "New"],
      ["Adam", "New"],
    ]);
  });
  it("checks min/max counts, caps additions and restores defaults on reset", async () => {
    const { container } = render(
      <form>
        <RepeatableField
          createItem={() => ""}
          max={1}
          min={1}
          renderItem={renderItem}
        />
      </form>,
    );
    const form = container.querySelector("form")!;
    expect(form.checkValidity()).toBe(false);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Add item" }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.getByRole("button", { name: "Add item" })).toBeDisabled();
    act(() => form.reset());
    await waitFor(() =>
      expect(screen.queryByLabelText(/^Contact 1/)).toBeNull(),
    );
    expect(form.checkValidity()).toBe(false);
  });
  it("focuses Add after removing the only row at max", async () => {
    const user = userEvent.setup();
    render(
      <RepeatableField
        createItem={() => ""}
        defaultValue={[initial[0]]}
        max={1}
        renderItem={renderItem}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Remove item 1/ }));
    // Disabled while the row was being removed - not left to the page
    expect(screen.getByRole("button", { name: "Add item" })).toHaveFocus();
  });
  it("is announced invalid only once its message shows", () => {
    render(
      <RepeatableField
        createItem={() => ""}
        label="Contacts"
        renderItem={renderItem}
        required
      />,
    );
    const group = screen.getByRole("group", { name: "Contacts" });
    // The count is refused - for styles - but no message says so yet
    expect(group).toHaveAttribute("data-invalid", "");
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows the count message at a submit, not at checkValidity()", async () => {
    const { container } = render(
      <form>
        <RepeatableField
          createItem={() => ""}
          label="Contacts"
          min={1}
          renderItem={renderItem}
        />
        <button type="button">Other</button>
      </form>,
    );
    const form = container.querySelector("form")!;
    const group = screen.getByRole("group", { name: "Contacts" });
    const validation = container.querySelector("input")!;
    const other = screen.getByRole("button", { name: "Other" });
    act(() => other.focus());

    // `checkValidity()` fires `invalid` too - it shows nothing
    const layout = vi.spyOn(validation, "getBoundingClientRect");
    let valid = true;
    act(() => {
      valid = form.checkValidity();
    });
    expect(valid).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(other).toHaveFocus();
    // Focusable at once - Safari focuses it by its styles laid out anew
    expect(validation).not.toHaveAttribute("inert");
    expect(layout).toHaveBeenCalled();

    // A submit: the browser focuses the first invalid field, which its
    // `invalid` lets take the focus - the group takes it once the browser
    // is done (Firefox focuses the input again at the next submit then)
    act(() => validation.focus());
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least 1 item.");
    expect(validation).toHaveFocus();
    await act(async () => {});
    expect(group).toHaveFocus();
    expect(group).toHaveAttribute("aria-invalid", "true");

    // Not when the focus has moved on meanwhile
    fireEvent.invalid(validation);
    act(() => {
      validation.focus();
      other.focus();
    });
    await act(async () => {});
    expect(other).toHaveFocus();
    // Kept from the focus and assistive technology again
    await waitFor(() => expect(validation).toHaveAttribute("inert"));
  });
  it("applies row changes to the latest rows - two at once, or one after an await", () => {
    const rows: RepeatableFieldItemProps<string>[] = [];
    const { container } = render(
      <form>
        <RepeatableField
          createItem={() => ""}
          defaultValue={initial}
          name="contacts"
          renderItem={(item) => {
            rows[item.index] = item;
            return renderItem(item);
          }}
        />
      </form>,
    );
    const names = () => {
      const data = new FormData(container.querySelector("form")!);
      return [data.get("contacts.0.name"), data.get("contacts.1.name")];
    };
    act(() => {
      rows[0].onChange("Adam 2");
      rows[1].onChange("Eva 2");
    });
    expect(names()).toEqual(["Adam 2", "Eva 2"]);

    // An upload finishing in row 1 keeps what was typed in row 2 meanwhile
    const lateChange = rows[0].onChange;
    fireEvent.change(screen.getByLabelText(/^Contact 2/), {
      target: { value: "Eve" },
    });
    act(() => lateChange("Adam 3"));
    expect(names()).toEqual(["Adam 3", "Eve"]);
  });

  // Removals need a confirmation, which the user cancels
  function ConfirmedContacts({
    onChange,
    rows = [],
  }: {
    onChange?: (items: { id: string; value: string }[]) => void;
    rows?: RepeatableFieldItemProps<string>[];
  }) {
    const [items, setItems] = useState(initial);
    return (
      <RepeatableField
        createItem={() => ""}
        onChange={(next) => {
          onChange?.(next);
          if (next.length === items.length) setItems(next);
        }}
        renderItem={(item) => {
          rows[item.index] = item;
          return renderItem(item);
        }}
        value={items}
      />
    );
  }
  it("reports the latest rows to a controlled parent, and not a change it declined", async () => {
    const change = vi.fn();
    const rows: RepeatableFieldItemProps<string>[] = [];
    render(<ConfirmedContacts onChange={change} rows={rows} />);
    act(() => {
      rows[0].onChange("Adam 2");
      rows[1].onChange("Eva 2");
    });
    expect(change).toHaveBeenLastCalledWith([
      { id: "a", value: "Adam 2" },
      { id: "b", value: "Eva 2" },
    ]);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Remove item 1/ }));
    expect(change).toHaveBeenLastCalledWith([{ id: "b", value: "Eva 2" }]);
    // The declined removal does not come back with the next change
    act(() => rows[1].onChange("Eva 3"));
    expect(change).toHaveBeenLastCalledWith([
      { id: "a", value: "Adam 2" },
      { id: "b", value: "Eva 3" },
    ]);
  });
  it("keeps the focus where it is when a controlled parent declines a removal", async () => {
    const user = userEvent.setup();
    render(<ConfirmedContacts />);
    await user.click(screen.getByRole("button", { name: /Remove item 1/ }));
    const adam = screen.getByLabelText(/^Contact 1/);
    await user.click(adam);
    // A later render does not move the focus to the row after the removed one
    await user.keyboard("xy");
    expect(adam).toHaveValue("Adamxy");
    expect(adam).toHaveFocus();
    expect(screen.getByLabelText(/^Contact 2/)).toHaveValue("Eva");
  });
  it("keeps controlled rows until their parent accepts a change", async () => {
    const change = vi.fn();
    render(
      <RepeatableField
        createItem={() => ""}
        onChange={change}
        renderItem={renderItem}
        value={initial}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Remove item 1/ }));
    expect(change).toHaveBeenCalledWith([{ id: "b", value: "Eva" }]);
    expect(screen.getByLabelText(/^Contact 1/)).toHaveValue("Adam");
  });
  it("removes actions in read-only mode and disables nested fields in a fieldset", () => {
    const { rerender } = render(
      <RepeatableField
        createItem={() => ""}
        defaultValue={initial}
        readOnly
        renderItem={renderItem}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByLabelText(/^Contact 1/)).toHaveAttribute("readonly");
    rerender(
      <fieldset disabled>
        <RepeatableField
          createItem={() => ""}
          defaultValue={initial}
          renderItem={renderItem}
        />
      </fieldset>,
    );
    expect(screen.getByLabelText(/^Contact 1/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add item" })).toBeDisabled();
  });
});
