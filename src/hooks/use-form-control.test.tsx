import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode, useState } from "react";
import { flushSync } from "react-dom";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { useFormControl, useFormReset } from "./use-form-control";

function Field({
  defaultValue,
  followScriptWrites,
  hint,
}: {
  defaultValue?: string;
  followScriptWrites?: boolean;
  hint?: string;
}) {
  const { fieldRef, handleChange, value } = useFormControl<HTMLInputElement>({
    defaultValue,
    followScriptWrites,
  });
  return (
    <input
      aria-label="Name"
      onChange={handleChange}
      ref={fieldRef}
      title={hint}
      value={value}
    />
  );
}

describe("useFormControl", () => {
  it.each(["document", "window", "shadow root"])(
    "keeps edits when a later listener on %s cancels the reset",
    (target) => {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const host = document.createElement("div");
      document.body.append(host);
      onTestFinished(() => host.remove());
      const root =
        target === "shadow root" ? host.attachShadow({ mode: "open" }) : host;
      const container = document.createElement("div");
      root.append(container);
      const onReset = vi.fn();
      function Tracker() {
        const resetRef = useFormReset(onReset);
        return <div ref={resetRef} />;
      }
      render(
        <form aria-label="Profile">
          <Field defaultValue="Ada" />
          <input aria-label="Native" defaultValue="Ada" />
          <Tracker />
        </form>,
        { container },
      );
      const input = within(container).getByRole("textbox", { name: "Name" });
      const native = within(container).getByRole("textbox", { name: "Native" });
      const form = within(container).getByRole<HTMLFormElement>("form");
      fireEvent.change(input, { target: { value: "Grace" } });
      fireEvent.change(native, { target: { value: "Grace" } });

      // Registered after the fields' listeners, so even a listener on the
      // same root gets a chance to cancel the reset.
      const listenerTarget =
        target === "document" ? document : target === "window" ? window : root;
      const cancel = (event: Event) => event.preventDefault();
      listenerTarget.addEventListener("reset", cancel);
      onTestFinished(() => listenerTarget.removeEventListener("reset", cancel));
      act(() => {
        form.reset();
        vi.runAllTimers();
      });
      expect(input).toHaveValue("Grace");
      expect(native).toHaveValue("Grace");
      expect(onReset).not.toHaveBeenCalled();

      listenerTarget.removeEventListener("reset", cancel);
      act(() => {
        form.reset();
        vi.runAllTimers();
      });
      expect(input).toHaveValue("Ada");
      expect(native).toHaveValue("Ada");
      expect(onReset).toHaveBeenCalledTimes(1);
    },
  );

  it("brings back the defaultValue when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Field defaultValue="Ada" />
        <button type="reset">Reset</button>
      </form>,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    await user.clear(input);
    await user.type(input, "Grace");
    expect(input).toHaveValue("Grace");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("Ada");
  });
});

describe("useFormControl followScriptWrites", () => {
  it.each([
    { after: false, cancel: false },
    { after: false, cancel: true },
    { after: true, cancel: false },
    { after: true, cancel: true },
  ])(
    "keeps a script write after a reset or during a canceled one (after: $after, cancel: $cancel)",
    ({ after, cancel }) => {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      render(
        <form aria-label="Profile">
          <Field defaultValue="Ada" followScriptWrites />
        </form>,
      );
      const input = screen.getByRole<HTMLInputElement>("textbox");
      const form = screen.getByRole<HTMLFormElement>("form");
      const write = () => {
        input.value = "Grace";
      };
      form.addEventListener("reset", (event) => {
        if (!after) write();
        if (cancel) event.preventDefault();
      });
      act(() => {
        form.reset();
        if (after) write();
      });
      act(() => vi.runAllTimers());
      expect(input).toHaveValue(after || cancel ? "Grace" : "Ada");
    },
  );

  it("takes a value a script writes as the value of the field", () => {
    const { rerender } = render(<Field followScriptWrites />);

    const input = screen.getByRole<HTMLInputElement>("textbox");
    input.value = "Ada";
    rerender(<Field followScriptWrites hint="A render" />);
    expect(input).toHaveValue("Ada");
  });

  it("is off by default - a render shows the field's own value", () => {
    const { rerender } = render(<Field />);

    const input = screen.getByRole<HTMLInputElement>("textbox");
    input.value = "Ada";
    rerender(<Field hint="A render" />);
    expect(input).toHaveValue("");
  });

  it("gives the element its own value property back when it lets go", () => {
    const { rerender } = render(<Field followScriptWrites />);

    const input = screen.getByRole<HTMLInputElement>("textbox");
    const watched = Object.getOwnPropertyDescriptor(input, "value");
    rerender(<Field />);
    expect(Object.getOwnPropertyDescriptor(input, "value")).not.toEqual(
      watched,
    );
    // React's own tracking of the value still sees a change
    fireEvent.change(input, { target: { value: "Grace" } });
    expect(input).toHaveValue("Grace");
  });
});

describe("useFormReset", () => {
  it.each([false, true])(
    "releases a field removed during hiding without unmounting its hook (keep node: %s)",
    async (keepNode) => {
      const added = vi.spyOn(document, "addEventListener");
      const removed = vi.spyOn(document, "removeEventListener");
      const onReset = vi.fn();
      function Tracker({ attached }: { attached: boolean }) {
        const resetRef = useFormReset(onReset);
        return attached || keepNode ? (
          <input form="profile" ref={attached ? resetRef : undefined} />
        ) : null;
      }
      const view = (mode: "hidden" | "visible", attached: boolean) => (
        <StrictMode>
          <form aria-label="Profile" id="profile" />
          <Activity mode={mode}>
            <Tracker attached={attached} />
          </Activity>
        </StrictMode>
      );
      const countResetListeners = (calls: readonly unknown[][]) =>
        calls.filter(([type]) => type === "reset").length;
      const { rerender } = render(view("visible", true));
      const form = screen.getByRole<HTMLFormElement>("form");
      const registrations = countResetListeners(added.mock.calls);
      const removalsBeforeHiding = countResetListeners(removed.mock.calls);
      expect(registrations).toBeGreaterThan(removalsBeforeHiding);

      rerender(view("hidden", true));
      await act(async () => {});
      expect(countResetListeners(removed.mock.calls)).toBe(
        removalsBeforeHiding,
      );

      rerender(view("hidden", false));
      await act(async () => {});
      if (!keepNode) {
        expect(countResetListeners(removed.mock.calls)).toBe(registrations);
      }
      rerender(view("visible", false));
      await act(async () => {
        form.reset();
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(onReset).not.toHaveBeenCalled();
      expect(countResetListeners(removed.mock.calls)).toBe(registrations);
    },
  );

  it("releases a visibly detached ref even when its node remains in the form", async () => {
    const onReset = vi.fn();
    function Tracker({ attached }: { attached: boolean }) {
      const resetRef = useFormReset(onReset);
      return <div ref={attached ? resetRef : undefined} />;
    }
    const view = (attached: boolean) => (
      <form aria-label="Profile">
        <Tracker attached={attached} />
      </form>
    );
    const { rerender } = render(view(true));
    const form = screen.getByRole<HTMLFormElement>("form");
    rerender(view(false));
    await act(async () => {
      form.reset();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(onReset).not.toHaveBeenCalled();
  });

  it("uses the latest callback and form association while hidden, then releases it on unmount", async () => {
    const first = vi.fn();
    const latest = vi.fn();
    function Tracker({ form, onReset }: { form: string; onReset: () => void }) {
      const resetRef = useFormReset(onReset, form);
      return <div ref={resetRef} />;
    }
    const view = (
      mode: "hidden" | "visible",
      form: string,
      onReset: () => void,
    ) => (
      <StrictMode>
        <form aria-label="First" id="first" />
        <form aria-label="Second" id="second" />
        <Activity mode={mode}>
          <Tracker form={form} onReset={onReset} />
        </Activity>
      </StrictMode>
    );
    const { rerender, unmount } = render(view("visible", "first", first));
    const firstForm = screen.getByRole<HTMLFormElement>("form", {
      name: "First",
    });
    const secondForm = screen.getByRole<HTMLFormElement>("form", {
      name: "Second",
    });
    rerender(view("hidden", "second", latest));
    await act(async () => {
      firstForm.reset();
      secondForm.reset();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);

    unmount();
    // Reuse its former form elsewhere after the hidden field goes away.
    document.body.append(secondForm);
    onTestFinished(() => secondForm.remove());
    await act(async () => {
      secondForm.reset();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("settles once when its callback synchronously reattaches the watcher", () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const onReset = vi.fn();
    function Tracker() {
      const [resets, setResets] = useState(0);
      const resetRef = useFormReset(() => {
        onReset();
        // Stop a regression from looping forever while still detecting
        // whether the newly attached watcher gets the same reset again.
        if (resets === 0) flushSync(() => setResets(1));
      });
      return <div ref={(element) => resetRef(element)} />;
    }
    render(
      <form aria-label="Profile">
        <Tracker />
      </form>,
    );
    act(() => {
      screen.getByRole<HTMLFormElement>("form").reset();
      vi.runAllTimers();
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it.each(["", "missing"])(
    "does not fall back to an ancestor for a native field with form=%j",
    (form) => {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const onReset = vi.fn();
      function Tracker() {
        const resetRef = useFormReset(onReset);
        return <input form={form} ref={resetRef} />;
      }
      render(
        <form aria-label="Outer">
          <Tracker />
        </form>,
      );
      screen.getByRole<HTMLFormElement>("form").reset();
      vi.runAllTimers();
      expect(onReset).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "follows late forms without a render and settles stopped resets (shadow root: %s)",
    (inShadow) => {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const host = document.createElement("div");
      document.body.append(host);
      onTestFinished(() => host.remove());
      const container = document.createElement("div");
      (inShadow ? host.attachShadow({ mode: "open" }) : host).append(container);

      const onReset = vi.fn();
      function Tracker() {
        const resetRef = useFormReset(onReset);
        return <input form="later" ref={resetRef} />;
      }
      const { unmount } = render(<Tracker />, { container });
      const form = document.createElement("form");
      form.id = "later";
      container.append(form);
      let cancel = true;
      form.addEventListener("reset", (event) => {
        event.stopPropagation();
        if (cancel) event.preventDefault();
      });

      form.reset();
      vi.runAllTimers();
      expect(onReset).not.toHaveBeenCalled();
      cancel = false;
      form.reset();
      expect(onReset).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(onReset).toHaveBeenCalledTimes(1);

      form.id = "previous";
      form.reset();
      vi.runAllTimers();
      expect(onReset).toHaveBeenCalledTimes(1);
      const replacement = document.createElement("form");
      replacement.id = "later";
      container.append(replacement);
      replacement.reset();
      vi.runAllTimers();
      expect(onReset).toHaveBeenCalledTimes(2);

      unmount();
      replacement.reset();
      vi.runAllTimers();
      expect(onReset).toHaveBeenCalledTimes(2);
    },
  );

  it("calls the latest callback on a reset of the form around", async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const latest = vi.fn();

    function Tracker({ onReset }: { onReset: () => void }) {
      const resetRef = useFormReset(onReset);
      return <div ref={resetRef} />;
    }

    const { rerender } = render(
      <form>
        <Tracker onReset={first} />
        <button type="reset">Reset</button>
      </form>,
    );
    rerender(
      <form>
        <Tracker onReset={latest} />
        <button type="reset">Reset</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("calls no callback for a reset a listener cancels", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    function Tracker() {
      const resetRef = useFormReset(onReset);
      return <div ref={resetRef} />;
    }

    const { rerender } = render(
      // A React `onReset` runs at the root - after the form's own listeners
      <form onReset={(event) => event.preventDefault()}>
        <Tracker />
        <button type="reset">Reset</button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).not.toHaveBeenCalled();

    rerender(
      <form onReset={() => {}}>
        <Tracker />
        <button type="reset">Reset</button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("calls the callback a task later when a listener stops the reset event", async () => {
    vi.useFakeTimers();
    const onReset = vi.fn();

    function Tracker() {
      const resetRef = useFormReset(onReset);
      return <div ref={resetRef} />;
    }

    render(
      <form aria-label="Order" onReset={(event) => event.stopPropagation()}>
        <Tracker />
      </form>,
    );
    screen.getByRole<HTMLFormElement>("form").reset();
    expect(onReset).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(onReset).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("follows the form attribute of a field and stops after unmount", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    function Detached() {
      const resetRef = useFormReset(onReset);
      return <input aria-label="Detached" form="order" ref={resetRef} />;
    }

    function Page() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <form id="order">
            <button type="reset">Reset</button>
          </form>
          {shown && <Detached />}
          <button onClick={() => setShown(false)} type="button">
            Hide
          </button>
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Hide" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
