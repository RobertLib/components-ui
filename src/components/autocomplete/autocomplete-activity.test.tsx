import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import Autocomplete from ".";
import type { LoadOptionsParams, LoadOptionsResult } from "./load-options";

const oslo = { label: "Oslo", value: "oslo" };
const bergen = { label: "Bergen", value: "bergen" };
const people = [
  { id: 1, name: "Anna" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Clara" },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function scrollListToEnd() {
  const scroller = screen.getByRole("listbox").parentElement!;
  Object.defineProperties(scroller, {
    clientHeight: { configurable: true, value: 240 },
    scrollHeight: { configurable: true, value: 500 },
    scrollTop: { configurable: true, value: 260 },
  });
  fireEvent.scroll(scroller);
}

describe("Autocomplete Activity lifecycle", () => {
  it.each([false, true])(
    "finishes creation across hiding and allows another creation (finish hidden: %s)",
    async (finishHidden) => {
      const user = userEvent.setup();
      const pending = deferred<typeof oslo>();
      const onCreate = vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue(bergen);
      const onChange = vi.fn();
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <Activity mode={mode}>
            <Autocomplete
              label="City"
              onChange={onChange}
              onCreate={onCreate}
              options={[]}
            />
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      await user.type(screen.getByRole("combobox"), "Oslo");
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));

      rerender(view("hidden"));
      if (!finishHidden) rerender(view("visible"));
      await act(async () => pending.resolve(oslo));
      if (finishHidden) rerender(view("visible"));

      expect(onChange).toHaveBeenCalledExactlyOnceWith("oslo", null);
      expect(screen.getByRole("combobox")).toHaveValue("Oslo");
      expect(screen.getByRole("status")).toHaveTextContent("Added “Oslo”.");
      await user.clear(screen.getByRole("combobox"));
      await user.type(screen.getByRole("combobox"), "Bergen");
      await user.click(screen.getByRole("option", { name: "Add “Bergen”" }));
      expect(onCreate).toHaveBeenCalledTimes(2);
      await waitFor(() =>
        expect(screen.getByRole("combobox")).toHaveValue("Bergen"),
      );
      expect(onChange).toHaveBeenLastCalledWith("bergen", null);
    },
  );

  it("shows a creation failure received while hidden and allows retrying", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const pending = deferred<typeof oslo>();
    const onCreate = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(oslo);
    const onChange = vi.fn();
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <Activity mode={mode}>
          <Autocomplete
            label="City"
            onChange={onChange}
            onCreate={onCreate}
            options={[]}
          />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible"));
    await user.type(screen.getByRole("combobox"), "Oslo");
    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));

    rerender(view("hidden"));
    await act(async () => pending.reject(new Error("Creation failed")));
    rerender(view("visible"));

    expect(screen.getByRole("alert")).toHaveTextContent("Creation failed");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith("oslo", null),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([false, true])(
    "ignores creation after a hidden field unmounts (rejects: %s)",
    async (rejects) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const user = userEvent.setup();
      const pending = deferred<typeof oslo>();
      const onChange = vi.fn();
      const view = (mode: "hidden" | "visible") => (
        <StrictMode>
          <Activity mode={mode}>
            <Autocomplete
              label="City"
              onChange={onChange}
              onCreate={() => pending.promise}
              options={[]}
            />
          </Activity>
        </StrictMode>
      );
      const { rerender, unmount } = render(view("visible"));
      await user.type(screen.getByRole("combobox"), "Oslo");
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
      rerender(view("hidden"));
      unmount();

      await act(async () => {
        if (rejects) pending.reject(new Error("Unmounted creation"));
        else pending.resolve(oslo);
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "preserves a controlled selection changed while hidden (rejects: %s)",
    async (rejects) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();
      const pending = deferred<typeof oslo>();
      const onChange = vi.fn();
      const view = (mode: "hidden" | "visible", value: string | null) => (
        <StrictMode>
          <Activity mode={mode}>
            <Autocomplete
              label="City"
              onChange={onChange}
              onCreate={() => pending.promise}
              options={[bergen]}
              value={value}
            />
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(view("visible", null));
      await user.type(screen.getByRole("combobox"), "Oslo");
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
      rerender(view("hidden", "bergen"));
      await act(async () => {
        if (rejects) pending.reject(new Error("Obsolete creation"));
        else pending.resolve(oslo);
      });
      rerender(view("visible", "bergen"));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")?.textContent ?? "").not.toContain(
        "Oslo",
      );
      await user.keyboard("{Escape}");
      expect(screen.getByRole("combobox")).toHaveValue("Bergen");
    },
  );

  it.each([undefined, 1])(
    "uses the latest multiple selection, callback and limit while hidden (limit: %s)",
    async (limit) => {
      const user = userEvent.setup();
      const pending = deferred<typeof oslo>();
      const initialChange = vi.fn();
      const updatedChange = vi.fn();
      const view = (mode: "hidden" | "visible", updated: boolean) => (
        <StrictMode>
          <Activity mode={mode}>
            <Autocomplete
              label="Cities"
              maxSelections={updated ? limit : undefined}
              multiple
              onChange={updated ? updatedChange : initialChange}
              onCreate={() => pending.promise}
              options={[bergen]}
              value={updated ? ["bergen"] : []}
            />
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(view("visible", false));
      await user.type(screen.getByRole("combobox"), "Oslo");
      await user.click(screen.getByRole("option", { name: "Add “Oslo”" }));
      rerender(view("hidden", true));
      await act(async () => pending.resolve(oslo));
      rerender(view("visible", true));

      expect(initialChange).not.toHaveBeenCalled();
      if (limit === undefined) {
        expect(updatedChange).toHaveBeenCalledExactlyOnceWith(
          ["bergen", "oslo"],
          [null, null],
        );
      } else {
        expect(updatedChange).not.toHaveBeenCalled();
      }
      expect(
        screen.queryByRole("option", { name: "Adding “Oslo”…" }),
      ).toBeNull();
    },
  );

  it("restarts an interrupted first page after reveal and ignores its late response", async () => {
    const user = userEvent.setup();
    const interrupted = deferred<typeof people>();
    const restarted = deferred<typeof people>();
    const onChange = vi.fn();
    const loadOptions = vi
      .fn<(params: LoadOptionsParams) => Promise<typeof people>>()
      .mockReturnValueOnce(interrupted.promise)
      .mockReturnValueOnce(restarted.promise);
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <Activity mode={mode}>
          <Autocomplete
            label="Person"
            loadOptions={loadOptions}
            onChange={onChange}
          />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible"));
    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));

    rerender(view("hidden"));
    expect(loadOptions.mock.calls[0][0].signal.aborted).toBe(true);
    // Even if the canceled loader settles while hidden, the list needs retrying.
    await act(async () => interrupted.resolve([people[1]]));
    rerender(view("visible"));
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));
    expect(loadOptions.mock.calls[1][0]).toEqual(
      expect.objectContaining({ offset: 0, page: 1, search: "" }),
    );

    await act(async () => restarted.resolve([people[0]]));
    expect(screen.queryByRole("option", { name: "Bob" })).toBeNull();
    await user.click(await screen.findByRole("option", { name: "Anna" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1, people[0]);
  });

  it("recovers interrupted pagination and can load another page", async () => {
    const user = userEvent.setup();
    const interrupted = deferred<LoadOptionsResult<(typeof people)[number]>>();
    const firstPage = { items: people.slice(0, 2), nextCursor: "2" };
    const loadOptions = vi
      .fn<
        (
          params: LoadOptionsParams,
        ) => Promise<LoadOptionsResult<(typeof people)[number]>>
      >()
      .mockResolvedValueOnce(firstPage)
      .mockReturnValueOnce(interrupted.promise)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValue({ items: people.slice(2), nextCursor: null });
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <Activity mode={mode}>
          <Autocomplete label="Person" loadOptions={loadOptions} pageSize={2} />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible"));
    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    scrollListToEnd();
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));

    rerender(view("hidden"));
    expect(loadOptions.mock.calls[1][0].signal.aborted).toBe(true);
    await act(async () =>
      interrupted.resolve({ items: people.slice(2), nextCursor: null }),
    );
    rerender(view("visible"));
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(3));
    expect(loadOptions.mock.calls[2][0]).toEqual(
      expect.objectContaining({ cursor: null, offset: 0, page: 1 }),
    );
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    scrollListToEnd();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(loadOptions).toHaveBeenCalledTimes(4);
    expect(loadOptions.mock.calls[3][0]).toEqual(
      expect.objectContaining({ cursor: "2", offset: 2, page: 2 }),
    );
  });

  it("keeps a completed list across hiding without another request", async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(async () => people);
    const view = (mode: "hidden" | "visible") => (
      <StrictMode>
        <Activity mode={mode}>
          <Autocomplete label="Person" loadOptions={loadOptions} />
        </Activity>
      </StrictMode>
    );
    const { rerender } = render(view("visible"));
    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "Anna" });
    rerender(view("hidden"));
    rerender(view("visible"));

    expect(await screen.findAllByRole("option")).toHaveLength(3);
    expect(loadOptions).toHaveBeenCalledTimes(1);
  });
});
