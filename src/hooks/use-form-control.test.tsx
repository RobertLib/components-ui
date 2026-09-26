import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
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
