import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Autocomplete, { type AutocompleteValue } from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

const cities = [
  { label: "Praha", value: "praha" },
  { label: "Plzeň", value: "plzen" },
  { label: "Zürich", value: "zurich" },
];

const combobox = () => screen.getByRole("combobox");

const optionNames = () =>
  screen.getAllByRole("option").map((option) => option.textContent);

const status = () => screen.getByRole("status");

const formValues = (name: string) =>
  new FormData(screen.getByRole<HTMLFormElement>("form")).getAll(name);

describe("Autocomplete onCreate", () => {
  it("offers to add a term no option is named by", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        label="City"
        onCreate={(text) => ({ label: text, value: text.toLowerCase() })}
        options={cities}
      />,
    );

    await user.type(combobox(), "Pra");
    expect(optionNames()).toEqual(["Praha", "Add “Pra”"]);

    // Named exactly - ignoring case and diacritics
    await user.clear(combobox());
    await user.type(combobox(), "plzen");
    expect(optionNames()).toEqual(["Plzeň"]);

    await user.clear(combobox());
    await user.type(combobox(), "Oslo");
    expect(optionNames()).toEqual(["Add “Oslo”"]);
    // No "No results" beside it - the list offers something
    expect(screen.queryByText("No results")).toBeNull();
    await waitFor(() =>
      expect(status()).toHaveTextContent("No results, or add “Oslo”"),
    );
  });

  it("selects and announces the option onCreate returns", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCreate = vi.fn((text: string) => ({
      label: text,
      value: text.toLowerCase(),
    }));
    render(
      <form aria-label="form">
        <Autocomplete
          label="City"
          name="city"
          onChange={onChange}
          onCreate={onCreate}
          options={cities}
        />
      </form>,
    );

    await user.type(combobox(), " Oslo ");
    await user.keyboard("{ArrowDown}");
    expect(combobox()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Add “Oslo”" }).id,
    );
    await user.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Oslo");
    await waitFor(() => expect(combobox()).toHaveValue("Oslo"));
    expect(onChange).toHaveBeenCalledWith("oslo", null);
    expect(formValues("city")).toEqual(["oslo"]);
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(status()).toHaveTextContent("Added “Oslo”.");
  });

  it("reads an item onCreate resolves with like the loaded ones", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let resolve: (item: { id: number; name: string }) => void = () => {};
    const onCreate = vi.fn(
      () =>
        new Promise<{ id: number; name: string }>((done) => {
          resolve = done;
        }),
    );
    render(
      <Autocomplete
        label="Person"
        loadOptions={async () => [{ id: 1, name: "Anna" }]}
        onChange={onChange}
        onCreate={onCreate}
      />,
    );

    await user.type(combobox(), "Bob");
    const add = await screen.findByRole("option", { name: "Add “Bob”" });
    await user.click(add);

    // Adding - the option says so and cannot be picked again
    const adding = screen.getByRole("option", { name: "Adding “Bob”…" });
    expect(adding).toHaveAttribute("aria-disabled", "true");
    expect(status()).toHaveTextContent("Adding “Bob”…");
    await user.click(adding);
    expect(onCreate).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ id: 7, name: "Bob" }));
    expect(onChange).toHaveBeenCalledWith(7, { id: 7, name: "Bob" });
    expect(combobox()).toHaveValue("Bob");
  });

  it("shows why adding failed and lets the user try again", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error("The name is taken."))
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ label: "Oslo", value: "oslo" });
    render(<Autocomplete label="City" onCreate={onCreate} options={cities} />);

    await user.type(combobox(), "Oslo");
    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The name is taken.",
    );

    // Without a message of its own - one of the locale
    const add = screen.getByRole("option", { name: "Add “Oslo”" });
    expect(add).not.toHaveAttribute("aria-disabled");
    await user.click(add);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "“Oslo” could not be added.",
      ),
    );

    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
    await waitFor(() => expect(combobox()).toHaveValue("Oslo"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("adds a chip in multiple mode, keeping the list open", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        defaultValue={["praha"]}
        label="Cities"
        multiple
        onChange={onChange}
        onCreate={(text) => ({ label: text, value: text.toLowerCase() })}
        options={cities}
      />,
    );

    await user.type(combobox(), "Oslo{ArrowDown}{Enter}");

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(["praha", "oslo"], [null, null]),
    );
    expect(
      screen.getByRole("button", { name: "Clear Oslo" }),
    ).toBeInTheDocument();
    expect(combobox()).toHaveValue("");
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    // The added option is named by the term now - it is not offered again
    await user.type(combobox(), "oslo");
    expect(screen.queryByRole("option", { name: /Add/ })).toBeNull();
  });

  it("speaks the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <Autocomplete
          label="Město"
          onCreate={(text) => ({ label: text, value: text })}
          options={cities}
        />
      </UIProvider>,
    );

    await user.type(combobox(), "Ostrava");
    expect(optionNames()).toEqual(["Přidat „Ostrava“"]);
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Žádné výsledky, nebo přidejte „Ostrava“",
      ),
    );
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() =>
      expect(status()).toHaveTextContent("Přidáno: „Ostrava“."),
    );
  });

  it("offers nothing to add in a select", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        asSelect
        label="City"
        onCreate={(text) => ({ label: text, value: text })}
        options={cities}
      />,
    );

    await user.click(combobox());
    await user.keyboard("o");
    expect(screen.queryByRole("option", { name: /Add/ })).toBeNull();
  });
});

describe("Autocomplete allowCustomValue", () => {
  it("takes the typed text as the value as the focus leaves", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="form">
        <Autocomplete
          allowCustomValue
          label="City"
          name="city"
          onChange={onChange}
          options={cities}
        />
        <button type="button">Next</button>
      </form>,
    );

    await user.type(combobox(), " Oslo ");
    // The form gets what the input shows - before it is taken
    expect(formValues("city")).toEqual(["Oslo"]);
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(combobox()).toHaveValue(" Oslo ");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith("Oslo", null);
    expect(combobox()).toHaveValue("Oslo");
    expect(formValues("city")).toEqual(["Oslo"]);
  });

  it("takes the text on Enter, which submits the form", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return new FormData(event.currentTarget).get("city");
    });
    render(
      <form aria-label="form" onSubmit={onSubmit}>
        <Autocomplete
          allowCustomValue
          label="City"
          name="city"
          onChange={onChange}
          options={cities}
        />
        <button type="submit">Save</button>
      </form>,
    );

    await user.type(combobox(), "Oslo{Enter}");
    expect(onChange).toHaveBeenCalledWith("Oslo", null);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveReturnedWith("Oslo");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
  });

  it("picks the option the text is the label of", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="form">
        <Autocomplete
          allowCustomValue
          label="City"
          name="city"
          onChange={onChange}
          options={cities}
        />
      </form>,
    );

    await user.type(combobox(), "zurich");
    expect(formValues("city")).toEqual(["zurich"]);
    await user.tab();
    expect(onChange).toHaveBeenCalledWith("zurich", null);
    expect(combobox()).toHaveValue("Zürich");
  });

  it("still picks the highlighted option on Enter, and clears on erasing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        allowCustomValue
        defaultValue="praha"
        label="City"
        onChange={onChange}
        options={cities}
      />,
    );

    await user.clear(combobox());
    expect(onChange).toHaveBeenLastCalledWith(null, null);

    await user.type(combobox(), "Pl{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("plzen", null);
    expect(combobox()).toHaveValue("Plzeň");

    // The same text again changes nothing
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("shows a custom value of a controlled field as it is", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = useState<AutocompleteValue | null>("Somewhere");
      return (
        <>
          <Autocomplete
            allowCustomValue
            label="City"
            onChange={setValue}
            options={cities}
            value={value}
          />
          <output>{String(value)}</output>
        </>
      );
    }

    render(<Controlled />);
    expect(combobox()).toHaveValue("Somewhere");

    await user.clear(combobox());
    await user.type(combobox(), "Elsewhere");
    await user.tab();
    expect(screen.getByText("Elsewhere", { selector: "output" })).toBeVisible();
    expect(combobox()).toHaveValue("Elsewhere");
  });
});

describe("Autocomplete selectAll", () => {
  const channels = [
    { label: "Email", value: "email" },
    { label: "SMS", value: "sms" },
    { disabled: true, label: "Push", value: "push" },
    { label: "Slack", value: "slack" },
  ];

  it("selects the options it shows, and deselects them once all are", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        label="Channels"
        multiple
        onChange={onChange}
        options={channels}
        selectAll
      />,
    );

    await user.click(combobox());
    const selectAll = screen.getByRole("option", { name: "Select all" });
    expect(optionNames()[0]).toBe("Select all");
    expect(selectAll).toHaveAttribute("aria-selected", "false");

    await user.click(selectAll);
    // Not the disabled one
    expect(onChange).toHaveBeenLastCalledWith(
      ["email", "sms", "slack"],
      [null, null, null],
    );
    expect(selectAll).toHaveAttribute("aria-selected", "true");

    // From the keyboard - "Select all" is the first option
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(combobox()).toHaveAttribute("aria-activedescendant", selectAll.id);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith([], []);
  });

  it("selects only what the typed term found", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        defaultValue={["email"]}
        label="Channels"
        multiple
        onChange={onChange}
        options={channels}
        selectAll="All channels"
      />,
    );

    await user.type(combobox(), "s");
    await user.click(screen.getByRole("option", { name: "All channels" }));
    expect(onChange).toHaveBeenLastCalledWith(
      ["email", "sms", "slack"],
      [null, null, null],
    );
  });

  it("is left out where maxSelections would not let all be selected", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        label="Channels"
        maxSelections={2}
        multiple
        options={channels}
        selectAll
      />,
    );

    await user.click(combobox());
    expect(screen.queryByRole("option", { name: "Select all" })).toBeNull();
    await user.type(combobox(), "sl");
    expect(
      screen.getByRole("option", { name: "Select all" }),
    ).toBeInTheDocument();
  });
});

describe("Autocomplete maxVisibleChips", () => {
  it("sums up the chips past the limit while the focus is elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Autocomplete
          defaultValue={["praha", "plzen", "zurich"]}
          label="Cities"
          maxVisibleChips={1}
          multiple
          options={cities}
        />
        <button type="button">Elsewhere</button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Clear Praha" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Clear Plzeň" })).toBeNull();
    const more = screen.getByText("+2 more");
    expect(more).toHaveAttribute("title", "Plzeň, Zürich");

    await user.click(combobox());
    expect(screen.getByRole("button", { name: "Clear Zürich" })).toBeVisible();
    expect(screen.queryByText("+2 more")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("speaks the language of the locale", () => {
    render(
      <UIProvider locale={cs}>
        <Autocomplete
          defaultValue={["praha", "plzen", "zurich"]}
          label="Města"
          maxVisibleChips={0}
          multiple
          options={cities}
        />
      </UIProvider>,
    );
    expect(screen.getByText("+3 další")).toBeInTheDocument();
  });
});

describe("Autocomplete readOnly", () => {
  it("shows and submits its value but takes no changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="form">
        <Autocomplete
          defaultValue={["praha", "plzen"]}
          label="Cities"
          multiple
          name="cities"
          onChange={onChange}
          options={cities}
          readOnly
        />
      </form>,
    );
    const input = combobox();

    expect(input).toHaveAttribute("aria-readonly", "true");
    expect(input).toHaveAttribute("data-readonly");
    expect(input).toHaveAttribute("readonly");
    // The chips are no buttons, there is no × on them
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Praha")).toBeInTheDocument();

    await user.click(input);
    expect(input).toHaveFocus();
    await user.keyboard("{ArrowDown}{Backspace}p");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
    expect(formValues("cities")).toEqual(["praha", "plzen"]);
  });

  it("has no clear button, and Enter submits the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Autocomplete
          defaultValue="praha"
          label="City"
          options={cities}
          readOnly
        />
        <button type="submit">Save</button>
      </form>,
    );

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    act(() => combobox().focus());
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps a select closed", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        asSelect
        defaultValue="praha"
        label="City"
        options={cities}
        readOnly
      />,
    );

    await user.click(combobox());
    expect(combobox()).toHaveFocus();
    await user.keyboard("{Enter}{ArrowDown} p");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).toHaveAttribute("aria-readonly", "true");
    expect(combobox()).toHaveTextContent("Praha");
  });
});

describe("Autocomplete dim and label", () => {
  it("takes the sizes of Input", () => {
    render(
      <>
        <Autocomplete dim="xs" label="Extra small" options={cities} />
        <Autocomplete dim="sm" label="Small" options={cities} />
        <Autocomplete label="Medium" options={cities} />
        <Autocomplete dim="lg" label="Large" options={cities} />
      </>,
    );
    const field = (name: string) =>
      screen.getByRole("combobox", { name }).parentElement!;

    expect(field("Extra small:")).toHaveClass("px-1", "py-0", "text-sm");
    expect(field("Small:")).toHaveClass("px-1", "py-0.5", "text-sm");
    expect(field("Medium:")).toHaveClass("px-2", "py-1", "text-base");
    expect(field("Large:")).toHaveClass("px-3", "py-2", "text-lg");
  });

  it("fits its chips to the small sizes", () => {
    render(
      <Autocomplete
        defaultValue={["praha"]}
        dim="sm"
        label="Cities"
        multiple
        options={cities}
      />,
    );
    expect(screen.getByRole("button", { name: "Clear Praha" })).toHaveClass(
      "text-xs",
    );
  });

  it("is named by a label with markup - the listbox too", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Autocomplete
          label={
            <>
              City <em>of delivery</em>
            </>
          }
          options={cities}
        />
        <Autocomplete
          asSelect
          label={<strong>Country</strong>}
          options={cities}
        />
      </>,
    );

    const city = screen.getByRole("combobox", { name: "City of delivery:" });
    await user.click(city);
    expect(
      screen.getByRole("listbox", { name: "City of delivery:" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const country = screen.getByRole("combobox", { name: "Country:" });
    await user.click(country);
    expect(
      screen.getByRole("listbox", { name: "Country:" }),
    ).toBeInTheDocument();
  });

  it("names the listbox after a label of text as before", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="City" options={cities} />);
    await user.click(combobox());
    expect(
      screen.getByRole("listbox", { name: "Options for City" }),
    ).toBeInTheDocument();
  });
});

describe("Autocomplete on the server", () => {
  it("renders collapsed chips and a read-only field, and hydrates", async () => {
    const field = (
      <Autocomplete
        defaultValue={["praha", "plzen", "zurich"]}
        dim="lg"
        label={<em>Cities</em>}
        maxVisibleChips={2}
        multiple
        name="cities"
        options={cities.map((city) => ({ ...city, group: "Europe" }))}
        readOnly
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(field);
    document.body.append(container);

    expect(container.textContent).toContain("+1 more");
    expect(
      container.querySelectorAll<HTMLInputElement>("input[name='cities']"),
    ).toHaveLength(3);

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
