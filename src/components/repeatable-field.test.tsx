import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
