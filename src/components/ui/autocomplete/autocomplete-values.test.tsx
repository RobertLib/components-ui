import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Autocomplete, { type AutocompleteValue } from ".";
import { cs } from "../../../i18n/cs";
import UIProvider from "../../../providers/ui-provider";
import type { LoadOptionsParams } from "./load-options";

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

  it.each([
    { id: 0, name: "Bob" },
    { id: 7, title: "Bob" },
    { id: 8, label: "Bob" },
  ])("reads a created static item's default fields: %j", async (person) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="form">
        <Autocomplete
          label="Person"
          name="person"
          onChange={onChange}
          onCreate={() => person}
          options={[{ id: 1, name: "Anna" }]}
        />
      </form>,
    );

    await user.type(combobox(), "Bob");
    await user.click(screen.getByRole("option", { name: "Add “Bob”" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(person.id, person),
    );
    expect(onChange.mock.calls[0][1]).toBe(person);
    expect(combobox()).toHaveValue("Bob");
    expect(formValues("person")).toEqual([String(person.id)]);
    expect(status()).toHaveTextContent("Added “Bob”.");
  });

  it("adds an asynchronously created static item to the existing selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const anna = { id: 1, name: "Anna" };
    const bob = { id: 2, name: "Bob" };
    render(
      <form aria-label="form">
        <Autocomplete
          defaultValue={[anna.id]}
          label="People"
          multiple
          name="people"
          onChange={onChange}
          onCreate={async () => bob}
          options={[anna]}
        />
      </form>,
    );

    await user.type(combobox(), "Bob");
    await user.click(screen.getByRole("option", { name: "Add “Bob”" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([1, 2], [anna, bob]),
    );
    expect(formValues("people")).toEqual(["1", "2"]);
    expect(combobox()).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Clear Bob" }),
    ).toBeInTheDocument();
    expect(status()).toHaveTextContent("Added “Bob”.");
  });

  it("preserves the data payload of a created ready-made static option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const person = { id: 2, name: "Bob" };
    render(
      <Autocomplete
        label="Person"
        onChange={onChange}
        onCreate={() => ({
          label: person.name,
          value: person.id,
          data: person,
        })}
        options={[{ id: 1, name: "Anna" }]}
      />,
    );

    await user.type(combobox(), "Bob");
    await user.click(screen.getByRole("option", { name: "Add “Bob”" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(2, person));
    expect(onChange.mock.calls[0][1]).toBe(person);
    expect(combobox()).toHaveValue("Bob");
  });

  it("applies static getters to created items even if they have label and value fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const person = { id: 2, name: "Bob", label: "Other label", value: "other" };
    render(
      <Autocomplete
        getOptionLabel={(item) => item.name}
        getOptionValue={(item) => item.id}
        label="Person"
        onChange={onChange}
        onCreate={() => person}
        options={[{ id: 1, name: "Anna", label: "Anna", value: "anna" }]}
      />,
    );

    await user.type(combobox(), "Bob");
    await user.click(screen.getByRole("option", { name: "Add “Bob”" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(2, person));
    expect(combobox()).toHaveValue("Bob");
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

  it.each([
    { controlled: false, clear: false },
    { controlled: false, clear: true },
    { controlled: true, clear: false },
    { controlled: true, clear: true },
  ])(
    "keeps a newer single selection when creation finishes (controlled: $controlled, clear: $clear)",
    async ({ controlled, clear }) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      let resolve: (option: (typeof cities)[number]) => void = () => {};
      const onCreate = () =>
        new Promise<(typeof cities)[number]>((done) => {
          resolve = done;
        });
      function Form() {
        const [value, setValue] = useState<AutocompleteValue | null>("plzen");
        return (
          <form aria-label="form">
            <Autocomplete
              defaultValue="plzen"
              label="City"
              name="city"
              onChange={(next) => {
                setValue(next);
                onChange(next);
              }}
              onCreate={onCreate}
              options={cities}
              value={controlled ? value : undefined}
            />
          </form>
        );
      }
      render(<Form />);
      await user.type(combobox(), "Oslo", {
        initialSelectionStart: 0,
        initialSelectionEnd: 5,
      });
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));

      if (clear) {
        await user.click(screen.getByRole("button", { name: "Clear" }));
      } else {
        await user.type(combobox(), "Pra", {
          initialSelectionStart: 0,
          initialSelectionEnd: 4,
        });
        await user.click(screen.getByRole("option", { name: "Praha" }));
      }
      await act(async () => resolve({ label: "Oslo", value: "oslo" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith(clear ? null : "praha");
      expect(combobox()).toHaveValue(clear ? "" : "Praha");
      expect(formValues("city")).toEqual([clear ? "" : "praha"]);
      expect(screen.queryByRole("status")?.textContent ?? "").not.toContain(
        "Oslo",
      );
    },
  );

  it.each([false, true])(
    "ignores a creation after reselecting the current option while a new creation runs (rejects: %s)",
    async (rejects) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const pending: {
        reject: (reason: Error) => void;
        resolve: (option: (typeof cities)[number]) => void;
      }[] = [];
      render(
        <form aria-label="form">
          <Autocomplete
            defaultValue="praha"
            label="City"
            name="city"
            onChange={onChange}
            onCreate={() =>
              new Promise<(typeof cities)[number]>((resolve, reject) => {
                pending.push({ reject, resolve });
              })
            }
            options={cities}
          />
        </form>,
      );
      await user.type(combobox(), "Oslo", {
        initialSelectionStart: 0,
        initialSelectionEnd: 5,
      });
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
      await user.type(combobox(), "Pra", {
        initialSelectionStart: 0,
        initialSelectionEnd: 4,
      });
      await user.click(screen.getByRole("option", { name: "Praha" }));
      await user.type(combobox(), "Bergen", {
        initialSelectionStart: 0,
        initialSelectionEnd: 5,
      });
      await user.click(screen.getByRole("option", { name: "Add “Bergen”" }));
      expect(pending).toHaveLength(2);

      await act(async () => {
        if (rejects) pending[0].reject(new Error("Obsolete failure"));
        else pending[0].resolve({ label: "Oslo", value: "oslo" });
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(formValues("city")).toEqual(["praha"]);
      expect(combobox()).toHaveValue("Bergen");
      expect(status()).toHaveTextContent("Adding “Bergen”…");
      expect(screen.queryByRole("alert")).toBeNull();

      await act(async () =>
        pending[1].resolve({ label: "Bergen", value: "bergen" }),
      );
      expect(onChange).toHaveBeenCalledExactlyOnceWith("bergen", null);
      expect(combobox()).toHaveValue("Bergen");
      expect(formValues("city")).toEqual(["bergen"]);
      expect(status()).toHaveTextContent("Added “Bergen”.");
    },
  );

  it("keeps a controlled value changed outside the field while creation is pending", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let resolve: (option: (typeof cities)[number]) => void = () => {};
    const onCreate = () =>
      new Promise<(typeof cities)[number]>((done) => {
        resolve = done;
      });
    const field = (value: string | null) => (
      <form aria-label="form">
        <Autocomplete
          label="City"
          name="city"
          onChange={onChange}
          onCreate={onCreate}
          options={cities}
          value={value}
        />
      </form>
    );
    const { rerender } = render(field(null));
    await user.type(combobox(), "Oslo");
    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
    rerender(field("praha"));
    await user.keyboard("{Escape}");
    await act(async () => resolve({ label: "Oslo", value: "oslo" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(combobox()).toHaveValue("Praha");
    expect(formValues("city")).toEqual(["praha"]);
  });

  it.each([
    { controlled: false, rejects: false },
    { controlled: false, rejects: true },
    { controlled: true, rejects: false },
    { controlled: true, rejects: true },
  ])(
    "ignores creation before a reset while a new one runs (controlled: $controlled, rejects: $rejects)",
    async ({ controlled, rejects }) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const pending: {
        reject: (reason: Error) => void;
        resolve: (option: (typeof cities)[number]) => void;
      }[] = [];
      const onCreate = () =>
        new Promise<(typeof cities)[number]>((resolve, reject) => {
          pending.push({ reject, resolve });
        });
      function Form() {
        const [value, setValue] = useState<AutocompleteValue | null>(null);
        return (
          <form aria-label="form">
            <Autocomplete
              label="City"
              name="city"
              onChange={(next) => {
                setValue(next);
                onChange(next);
              }}
              onCreate={onCreate}
              options={cities}
              value={controlled ? value : undefined}
            />
          </form>
        );
      }
      render(<Form />);
      const form = screen.getByRole<HTMLFormElement>("form");
      const create = async () => {
        await user.clear(combobox());
        await user.type(combobox(), "Oslo");
        await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
      };
      await create();
      await act(async () => form.reset());
      await waitFor(() => expect(combobox()).toHaveValue(""));
      expect(formValues("city")).toEqual([""]);
      expect(status()).not.toHaveTextContent("Adding");

      await create();
      expect(pending).toHaveLength(2);
      await act(async () => {
        if (rejects) pending[0].reject(new Error("Obsolete failure"));
        else pending[0].resolve({ label: "Old Oslo", value: "old-oslo" });
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(formValues("city")).toEqual([""]);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(status()).toHaveTextContent("Adding “Oslo”…");
      expect(
        screen.getByRole("option", { name: "Adding “Oslo”…" }),
      ).toHaveAttribute("aria-disabled", "true");

      await act(async () =>
        pending[1].resolve({ label: "Oslo", value: "oslo" }),
      );
      expect(onChange).toHaveBeenCalledExactlyOnceWith("oslo");
      expect(combobox()).toHaveValue("Oslo");
      expect(status()).toHaveTextContent("Added “Oslo”.");

      await act(async () => form.reset());
      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    },
  );

  it("clears creation errors on reset and preserves a creation if reset is canceled", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve: (option: (typeof cities)[number]) => void = () => {};
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error("The name is taken."))
      .mockImplementationOnce(
        () => new Promise<(typeof cities)[number]>((done) => (resolve = done)),
      );
    const onChange = vi.fn();
    render(
      <form aria-label="form">
        <Autocomplete
          label="City"
          onChange={onChange}
          onCreate={onCreate}
          options={cities}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    await user.type(combobox(), "Oslo");
    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    await act(async () => form.reset());
    await waitFor(() => expect(combobox()).toHaveValue(""));
    await user.type(combobox(), "Oslo");
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
    form.addEventListener("reset", (event) => event.preventDefault(), {
      once: true,
    });
    await act(async () => form.reset());
    expect(status()).toHaveTextContent("Adding “Oslo”…");
    await act(async () => resolve({ label: "Oslo", value: "oslo" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("oslo", null);
    expect(combobox()).toHaveValue("Oslo");
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

  it("does not create an option when maxSelections is zero", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((text: string) => ({ label: text, value: text }));
    const onChange = vi.fn();
    render(
      <Autocomplete
        label="Cities"
        maxSelections={0}
        multiple
        onChange={onChange}
        onCreate={onCreate}
        options={cities}
      />,
    );

    await user.type(combobox(), "Oslo");
    const add = screen.getByRole("option", { name: "Add “Oslo”" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    await user.click(add);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onCreate).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    { initialLimit: 1, nextLimit: 1, selectsCreated: false },
    { initialLimit: 2, nextLimit: 0, selectsCreated: false },
    { initialLimit: 2, nextLimit: 1, selectsCreated: false },
    { initialLimit: 1, nextLimit: 2, selectsCreated: true },
  ])(
    "respects the current selection and limit when creation finishes ($initialLimit → $nextLimit)",
    async ({ initialLimit, nextLimit, selectsCreated }) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      let resolve: (option: (typeof cities)[number]) => void = () => {};
      const onCreate = () =>
        new Promise<(typeof cities)[number]>((done) => {
          resolve = done;
        });
      const field = (maxSelections: number) => (
        <form aria-label="form">
          <Autocomplete
            label="Cities"
            maxSelections={maxSelections}
            multiple
            name="cities"
            onChange={onChange}
            onCreate={onCreate}
            options={cities}
          />
        </form>
      );
      const { rerender } = render(field(initialLimit));

      await user.type(combobox(), "Oslo");
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
      // A user can pick an existing option while the new one is being made.
      await user.clear(combobox());
      await user.click(screen.getByRole("option", { name: "Praha" }));
      expect(formValues("cities")).toEqual(["praha"]);

      rerender(field(nextLimit));
      await act(async () => resolve({ label: "Oslo", value: "oslo" }));

      const expected = selectsCreated ? ["praha", "oslo"] : ["praha"];
      expect(formValues("cities")).toEqual(expected);
      expect(onChange).toHaveBeenCalledTimes(selectsCreated ? 2 : 1);
      expect(onChange).toHaveBeenLastCalledWith(
        expected,
        expected.map(() => null),
      );
      expect(
        screen.getByRole("button", { name: "Clear Praha" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Clear Oslo" }) !== null,
      ).toBe(selectsCreated);
    },
  );

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

  it("picks a loaded option the text names before its own search loads", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const places = [
      { id: 42, name: "Prague" },
      { id: 7, name: "Oslo" },
    ];
    // The search for the typed text never answers
    const loadOptions = vi.fn(({ search }: LoadOptionsParams) =>
      search ? new Promise<typeof places>(() => {}) : Promise.resolve(places),
    );
    render(
      <form aria-label="form">
        <Autocomplete
          allowCustomValue
          label="City"
          loadOptions={loadOptions}
          name="city"
          onChange={onChange}
        />
        <button type="button">Next</button>
      </form>,
    );

    await user.click(combobox());
    await screen.findByRole("option", { name: "Prague" });
    await user.type(combobox(), "prague");
    // While the search waits for its debounce, then for its answer
    expect(formValues("city")).toEqual(["42"]);
    await waitFor(() =>
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "prague" }),
      ),
    );
    expect(formValues("city")).toEqual(["42"]);

    await user.tab();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(42, {
      id: 42,
      name: "Prague",
    });
    expect(combobox()).toHaveValue("Prague");
  });

  it("keeps the selected option the text names again before the list loads", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        allowCustomValue
        defaultValue={42}
        label="City"
        loadOptions={() =>
          new Promise<{ id: number; name: string }[]>(() => {})
        }
        loadSelectedOptions={async () => [{ id: 42, name: "Prague" }]}
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(combobox()).toHaveValue("Prague"));
    await user.type(combobox(), "{Backspace}e");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(combobox()).toHaveValue("Prague");
  });

  it("does not take an option loaded for other loadOptionsDeps", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // Only the sales list loads - the support one is still on its way
    const field = (department: string) => (
      <form aria-label="form">
        <Autocomplete
          allowCustomValue
          label="Person"
          loadOptions={({ search }) =>
            department === "sales" && !search
              ? Promise.resolve([{ id: 1, name: "Anna" }])
              : new Promise<{ id: number; name: string }[]>(() => {})
          }
          loadOptionsDeps={[department]}
          name="person"
          onChange={onChange}
        />
        <button type="button">Next</button>
      </form>
    );
    const { rerender } = render(field("sales"));

    await user.click(combobox());
    await user.click(await screen.findByRole("option", { name: "Anna" }));
    expect(onChange).toHaveBeenLastCalledWith(1, { id: 1, name: "Anna" });
    await user.clear(combobox());
    expect(onChange).toHaveBeenLastCalledWith(null, null);
    await user.tab();

    // Another Anna, maybe - or none
    rerender(field("support"));
    await user.type(combobox(), "Anna");
    expect(formValues("person")).toEqual(["Anna"]);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("Anna", null);
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
  it.each([
    { asSelect: false, multiple: false },
    { asSelect: false, multiple: true },
    { asSelect: true, multiple: false },
    { asSelect: true, multiple: true },
  ])(
    "submits required read-only values without validation (asSelect=$asSelect, multiple=$multiple)",
    async ({ asSelect, multiple }) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const field = (readOnly: boolean, populated: boolean) => (
        <form aria-label="form" onSubmit={onSubmit}>
          <Autocomplete
            asSelect={asSelect}
            label="Cities"
            name="cities"
            options={cities}
            readOnly={readOnly}
            required
            {...(multiple
              ? {
                  multiple: true as const,
                  value: populated ? ["praha", "plzen"] : null,
                }
              : {
                  multiple: false as const,
                  value: populated ? "praha" : null,
                })}
          />
          <button type="submit">Save</button>
        </form>
      );
      const { rerender } = render(field(true, true));
      const form = screen.getByRole<HTMLFormElement>("form");

      expect(form.checkValidity()).toBe(true);
      expect(formValues("cities")).toEqual(
        multiple ? ["praha", "plzen"] : ["praha"],
      );

      rerender(field(true, false));
      expect(combobox()).toHaveAttribute("aria-required", "true");
      expect(form.checkValidity()).toBe(true);
      expect(formValues("cities")).toEqual(multiple ? [] : [""]);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);

      // Making it editable restores the requirement the user can now meet.
      rerender(field(false, false));
      expect(form.checkValidity()).toBe(false);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);

      rerender(field(true, false));
      expect(form.checkValidity()).toBe(true);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).toHaveBeenCalledTimes(2);
    },
  );

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
