import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFormControl, useFormReset } from "./use-form-control";

function Field({ defaultValue }: { defaultValue?: string }) {
  const { fieldRef, handleChange, value } = useFormControl<HTMLInputElement>({
    defaultValue,
  });
  return (
    <input
      aria-label="Name"
      onChange={handleChange}
      ref={fieldRef}
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
