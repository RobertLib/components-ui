import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TransferList, { type TransferListValue } from "./transfer-list";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Béta" },
  { value: "c", label: "Locked", disabled: true },
];
const selectedList = () => screen.getByRole("list", { name: "Selected" });
const availableList = () => screen.getByRole("list", { name: "Available" });

describe("TransferList", () => {
  it("updates native constraints while Activity hides the field", async () => {
    const { rerender } = render(
      <form aria-label="Assignment">
        <Activity mode="visible">
          <TransferList
            min={1}
            name="members"
            options={options}
            value={["a"]}
          />
        </Activity>
      </form>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
    rerender(
      <form aria-label="Assignment">
        <Activity mode="hidden">
          <TransferList
            min={2}
            name="members"
            options={options}
            value={["a"]}
          />
        </Activity>
      </form>,
    );
    await waitFor(() => expect(form.checkValidity()).toBe(false));
    rerender(
      <form aria-label="Assignment">
        <Activity mode="hidden">
          <TransferList
            min={2}
            name="members"
            options={options}
            value={["a", "b"]}
          />
        </Activity>
      </form>,
    );
    await waitFor(() => expect(form.checkValidity()).toBe(true));
  });

  it("transfers marked choices and leaves disabled choices in place", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TransferList label="Members" onChange={onChange} options={options} />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Add checked items" }));
    expect(within(selectedList()).getByText("Alpha")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(
      within(availableList()).getByRole("checkbox", { name: "Locked" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Remove all visible items" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("searches with folded accents and transfers only visible choices", async () => {
    const user = userEvent.setup();
    render(<TransferList options={options} />);
    await user.type(
      screen.getByRole("searchbox", { name: "Search available items" }),
      "beta",
    );
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    expect(within(selectedList()).getByText("Béta")).toBeInTheDocument();
    await user.clear(
      screen.getByRole("searchbox", { name: "Search available items" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Search selected items" }),
      "beta",
    );
    await user.click(
      screen.getByRole("button", { name: "Remove all visible items" }),
    );
    await user.clear(
      screen.getByRole("searchbox", { name: "Search selected items" }),
    );
    expect(within(selectedList()).getByText("Alpha")).toBeInTheDocument();
  });

  it("honors controlled state, numeric/string identities and a maximum", async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState<TransferListValue[]>([]);
      return (
        <TransferList
          max={1}
          onChange={setValue}
          options={[
            { value: 1, label: "Number" },
            { value: "1", label: "String" },
          ]}
          value={value}
        />
      );
    }
    render(<Field />);
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    expect(within(selectedList()).getByText("Number")).toBeInTheDocument();
    expect(within(availableList()).getByText("String")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add all visible items" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    expect(within(availableList()).getByText("String")).toBeInTheDocument();
  });

  it("keeps the focus on a button that has nothing left to transfer", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TransferList label="Members" onChange={onChange} options={options} />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Alpha" }));
    const add = screen.getByRole("button", { name: "Add checked items" });
    act(() => add.focus());
    await user.keyboard("{Enter}");
    expect(within(selectedList()).getByText("Alpha")).toBeInTheDocument();
    // A native `disabled` would drop the focus to the page
    expect(add).not.toBeDisabled();
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("submits no form with Enter in a search, which ignores the spaces around the term", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TransferList name="members" options={options} />
        <button type="submit">Save</button>
      </form>,
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Search available items" }),
      " alpha {Enter}",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(within(availableList()).getByText("Alpha")).toBeInTheDocument();
    expect(within(availableList()).queryByText("Béta")).toBeNull();
  });

  it("does not apply a controlled change without a parent update", async () => {
    const onChange = vi.fn();
    render(<TransferList onChange={onChange} options={options} value={[]} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Add all visible items" }));
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
    expect(within(availableList()).getByText("Alpha")).toBeInTheDocument();
    expect(within(selectedList()).getByText("No items")).toBeInTheDocument();
  });

  it("submits values and restores defaults on an external form reset", async () => {
    const user = userEvent.setup();
    render(
      <>
        <form id="assign" aria-label="Assignment" />
        <TransferList
          defaultValue={["a"]}
          form="assign"
          name="members"
          options={options}
        />
      </>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    expect(new FormData(form).getAll("members")).toEqual(["a", "b"]);
    await act(async () => form.reset());
    await waitFor(() =>
      expect(new FormData(form).getAll("members")).toEqual(["a"]),
    );
    expect(within(availableList()).getByText("Béta")).toBeInTheDocument();
  });

  it("holds the values in the form before onChange, which may submit it", async () => {
    const user = userEvent.setup();
    const submitted: [FormDataEntryValue[], boolean][] = [];
    render(
      <form aria-label="Assignment">
        <TransferList
          name="members"
          onChange={() => {
            const form = screen.getByRole("form") as HTMLFormElement;
            submitted.push([
              new FormData(form).getAll("members"),
              form.checkValidity(),
            ]);
          }}
          options={options}
          required
        />
      </form>,
    );
    await user.click(
      screen.getByRole("button", { name: "Add all visible items" }),
    );
    expect(submitted).toEqual([[["a", "b"], true]]);
  });

  it("validates the minimum visibly and clears the error when satisfied", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Assignment">
        <TransferList
          label="Members"
          name="members"
          options={options}
          required
        />
        <button>Submit</button>
      </form>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    const validation = form.querySelector<HTMLInputElement>("input[required]")!;
    expect(validation).toHaveAttribute("inert");
    // A submit: the browser focuses the invalid input - Safari by its
    // styles laid out anew - and the field takes the focus over
    const layout = vi.spyOn(validation, "getBoundingClientRect");
    expect(form.checkValidity()).toBe(false);
    expect(validation).not.toHaveAttribute("inert");
    expect(layout).toHaveBeenCalled();
    act(() => validation.focus());
    // Once the browser is done - Firefox focuses it again at the next submit
    expect(validation).toHaveFocus();
    expect(
      await screen.findByText("Select at least 1 item."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search available items" }),
    ).toHaveFocus();
    expect(screen.getByRole("group", { name: "Members" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await waitFor(() => expect(validation).toHaveAttribute("inert"));
    await user.click(screen.getByRole("checkbox", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Add checked items" }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.queryByText("Select at least 1 item.")).toBeNull();
  });

  it("neither takes the focus nor shows its error on a checkValidity() of the page", () => {
    render(
      <form aria-label="Assignment">
        <input aria-label="Project" />
        <TransferList
          label="Members"
          name="members"
          options={options}
          required
        />
      </form>,
    );
    const project = screen.getByRole("textbox", { name: "Project" });
    act(() => project.focus());
    const form = screen.getByRole("form") as HTMLFormElement;
    // E.g. a Save button enabled while the form is valid
    act(() => {
      expect(form.checkValidity()).toBe(false);
    });
    expect(project).toHaveFocus();
    expect(screen.queryByText("Select at least 1 item.")).toBeNull();
  });

  it("excludes disabled fieldsets from submission and keeps read-only values", () => {
    const { rerender } = render(
      <form aria-label="Assignment">
        <fieldset disabled>
          <TransferList
            defaultValue={["a"]}
            name="members"
            options={options}
            required
          />
        </fieldset>
      </form>,
    );
    let form = screen.getByRole("form") as HTMLFormElement;
    expect(new FormData(form).getAll("members")).toEqual([]);
    expect(form.checkValidity()).toBe(true);
    expect(
      screen.getByRole("button", { name: "Remove all visible items" }),
    ).toBeDisabled();
    rerender(
      <form aria-label="Assignment">
        <TransferList
          defaultValue={["a"]}
          min={2}
          name="members"
          options={options}
          readOnly
        />
      </form>,
    );
    form = screen.getByRole("form") as HTMLFormElement;
    expect(new FormData(form).getAll("members")).toEqual(["a"]);
    expect(form.checkValidity()).toBe(true);
  });

  it("keeps unknown selected values removable and visible", async () => {
    render(<TransferList defaultValue={["missing"]} options={options} />);
    expect(within(selectedList()).getByText("missing")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove all visible items" }));
    expect(within(selectedList()).queryByText("missing")).toBeNull();
  });
});
