import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ColorInput from ".";
import { normalizeColor, parseColor } from "./color";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

const field = () => screen.getByRole<HTMLInputElement>("textbox");
const swatchButton = () =>
  screen.getByRole("button", { name: "Choose a color" });
const getForm = () => screen.getByRole<HTMLFormElement>("form");
const area = () =>
  screen.getByRole("slider", { name: "Saturation and brightness" });

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(swatchButton());
  return screen.getByRole("dialog", { name: "Color picker" });
}

describe("ColorInput", () => {
  it("is a text field with a swatch that opens the picker", () => {
    render(<ColorInput defaultValue="#1e90ff" label="Brand color" />);

    expect(screen.getByRole("textbox", { name: "Brand color:" })).toHaveValue(
      "#1e90ff",
    );
    expect(swatchButton()).toHaveAttribute("aria-haspopup", "dialog");
    expect(swatchButton()).toHaveAttribute("aria-expanded", "false");
  });

  it.each(
    (["value", "defaultValue"] as const).flatMap((prop) =>
      ["not-a-color", "hsl(1e308turn 100% 50%)", "   "].map(
        (value) => [prop, value] as const,
      ),
    ),
  )("blocks native submission for invalid incoming %s=%j", (prop, value) => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onChange = vi.fn();
    render(
      <form aria-label="Theme" onSubmit={onSubmit}>
        <ColorInput
          {...{ [prop]: value }}
          label="Color"
          name="color"
          onChange={onChange}
          required
        />
      </form>,
    );
    act(() => getForm().requestSubmit());
    expect(field()).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(new FormData(getForm()).get("color")).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["value", "defaultValue"] as const)(
    "submits a paintable HSL color for an incoming %s near white",
    (prop) => {
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      render(
        <form aria-label="Theme" onSubmit={onSubmit}>
          <ColorInput
            {...{ [prop]: "rgb(255 255 254.99999999999997)" }}
            format="hsl"
            label="Color"
            name="color"
            required
          />
        </form>,
      );
      act(() => getForm().requestSubmit());
      expect(onSubmit).toHaveBeenCalledOnce();
      const submitted = new FormData(getForm()).get("color") as string;
      expect(field()).toHaveValue(submitted);
      expect(parseColor(submitted)).not.toBeNull();
      expect(normalizeColor(submitted, "hex", false)).toBe("#ffffff");
    },
  );

  it.each(["value", "defaultValue"] as const)(
    "normalizes incoming %s for display and submission as format and alpha change",
    (prop) => {
      const onChange = vi.fn();
      const content = (format: "rgb" | "hsl", alpha = false) => (
        <form aria-label="Theme">
          <ColorInput
            {...{ [prop]: "#ff000080" }}
            alpha={alpha}
            format={format}
            label="Color"
            name="color"
            onChange={onChange}
          />
        </form>
      );
      const { rerender } = render(content("rgb"));
      expect(field()).toHaveValue("rgb(255, 0, 0)");
      expect(new FormData(getForm()).get("color")).toBe("rgb(255, 0, 0)");
      rerender(content("rgb", true));
      expect(field()).toHaveValue("rgba(255, 0, 0, 0.5)");
      expect(new FormData(getForm()).get("color")).toBe("rgba(255, 0, 0, 0.5)");
      rerender(content("hsl", true));
      expect(field()).toHaveValue("hsla(0, 100%, 50%, 0.5)");
      expect(new FormData(getForm()).get("color")).toBe(
        "hsla(0, 100%, 50%, 0.5)",
      );
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("validates external controlled updates and allows optional whitespace as empty", () => {
    const content = (value: string) => (
      <form aria-label="Theme">
        <ColorInput label="Color" name="color" value={value} />
      </form>
    );
    const { rerender } = render(content("#fff"));
    expect(field()).toHaveValue("#ffffff");
    expect(getForm().checkValidity()).toBe(true);
    rerender(content("not-a-color"));
    expect(field()).toHaveValue("not-a-color");
    expect(getForm().checkValidity()).toBe(false);
    rerender(content("   "));
    expect(field()).toHaveValue("");
    expect(new FormData(getForm()).get("color")).toBe("");
    expect(getForm().checkValidity()).toBe(true);
  });

  it("replaces a pending draft when a controlled value changes to an equivalent color", () => {
    const content = (value: string) => (
      <form aria-label="Theme">
        <ColorInput label="Color" name="color" value={value} />
      </form>
    );
    const { rerender } = render(content("#ff0000"));
    fireEvent.change(field(), { target: { value: "#00f" } });
    expect(new FormData(getForm()).get("color")).toBe("#0000ff");
    rerender(content("#f00"));
    expect(field()).toHaveValue("#ff0000");
    expect(new FormData(getForm()).get("color")).toBe("#ff0000");
  });

  it("restores validation of an invalid default after editing and resetting", async () => {
    render(
      <form aria-label="Theme">
        <ColorInput defaultValue="not-a-color" label="Color" name="color" />
      </form>,
    );
    expect(getForm().checkValidity()).toBe(false);
    fireEvent.change(field(), { target: { value: "#fff" } });
    fireEvent.blur(field());
    expect(field()).toHaveValue("#ffffff");
    expect(getForm().checkValidity()).toBe(true);
    act(() => getForm().reset());
    await waitFor(() => expect(field()).toHaveValue("not-a-color"));
    expect(getForm().checkValidity()).toBe(false);
    expect(new FormData(getForm()).get("color")).toBe("");
  });

  it("writes a typed color in its format once it is taken - on leaving or Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form aria-label="Theme" onSubmit={onSubmit}>
        <ColorInput label="Color" onChange={onChange} />
        <button type="submit">Save</button>
      </form>,
    );

    await user.type(field(), "rgb(30 144 255)");
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("#1e90ff");
    expect(field()).toHaveValue("#1e90ff");

    await user.clear(field());
    await user.type(field(), "hsl(0, 100%, 50%){Enter}");
    expect(onChange).toHaveBeenLastCalledWith("#ff0000");
    // Enter took the text - it submitted nothing
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(field());
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("writes the value in rgb or hsl with format, the alpha with alpha", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ColorInput aria-label="Rgb" format="rgb" />
        <ColorInput alpha aria-label="Hsl" format="hsl" />
      </>,
    );

    const rgb = screen.getByRole("textbox", { name: "Rgb" });
    await user.type(rgb, "#1e90ff80");
    await user.tab();
    expect(rgb).toHaveValue("rgb(30, 144, 255)");

    const hsl = screen.getByRole("textbox", { name: "Hsl" });
    await user.type(hsl, "#1e90ff80");
    await user.tab();
    expect(hsl).toHaveValue("hsla(210, 100%, 56%, 0.5)");
  });

  it("drops a text that is no color and says why", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ColorInput defaultValue="#ff0000" label="Color" onChange={onChange} />,
    );

    await user.clear(field());
    await user.type(field(), "reddish");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue("#ff0000");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "“reddish” is not a color. Enter one like #1e90ff.",
    );
    expect(field()).toHaveAccessibleDescription(
      "“reddish” is not a color. Enter one like #1e90ff.",
    );

    // Typing again takes the message back
    await user.type(field(), "0");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks overflowing color drafts on submit and preserves the previous color on blur", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form aria-label="Theme" onSubmit={onSubmit}>
        <ColorInput
          defaultValue="#ff0000"
          label="Color"
          name="color"
          onChange={onChange}
        />
      </form>,
    );
    fireEvent.change(field(), {
      target: { value: "hsl(1e308turn 100% 50%)" },
    });
    act(() => getForm().requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field()).toBeInvalid();
    fireEvent.blur(field());
    expect(field()).toHaveValue("#ff0000");
    expect(new FormData(getForm()).get("color")).toBe("#ff0000");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("is not a color");
  });

  it("drops the typed text on Escape", async () => {
    const user = userEvent.setup();
    render(<ColorInput defaultValue="#ff0000" label="Color" />);

    await user.type(field(), "123");
    await user.keyboard("{Escape}");
    expect(field()).toHaveValue("#ff0000");
  });

  describe("picker", () => {
    it("opens as a dialog whose area takes the focus, and closes on Escape", async () => {
      const user = userEvent.setup();
      render(<ColorInput defaultValue="#1e90ff" label="Color" />);

      const dialog = await openPicker(user);
      expect(swatchButton()).toHaveAttribute("aria-expanded", "true");
      expect(area()).toHaveFocus();
      expect(area()).toHaveAttribute("aria-roledescription", "2D slider");
      expect(area()).toHaveAttribute(
        "aria-valuetext",
        "Saturation 88%, brightness 100%",
      );
      expect(
        within(dialog).getByRole("slider", { name: "Hue" }),
      ).toHaveAttribute("aria-valuetext", "210°");

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(swatchButton()).toHaveFocus();
    });

    it("changes the saturation and the brightness with the arrow keys - Shift by ten", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <ColorInput defaultValue="#808080" label="Color" onChange={onChange} />,
      );

      await openPicker(user);
      // A gray - no saturation, half the brightness
      expect(area()).toHaveAttribute("aria-valuenow", "0");
      await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
      expect(area()).toHaveAttribute("aria-valuenow", "10");
      await user.keyboard("{ArrowUp}{ArrowUp}");
      expect(area()).toHaveAttribute(
        "aria-valuetext",
        "Saturation 10%, brightness 52%",
      );
      expect(onChange).toHaveBeenLastCalledWith("#857777");
      await user.keyboard("{End}{PageDown}");
      expect(area()).toHaveAttribute(
        "aria-valuetext",
        "Saturation 100%, brightness 42%",
      );
    });

    it("keeps the hue of a gray while it is picked", async () => {
      const user = userEvent.setup();
      render(<ColorInput defaultValue="#1e90ff" label="Color" />);

      await openPicker(user);
      await user.keyboard("{Home}");
      expect(field()).toHaveValue("#ffffff");
      // Back to a color of the same hue, not to red
      await user.keyboard("{End}");
      expect(field()).toHaveValue("#0081ff");
    });

    it("changes the hue with its slider", async () => {
      const user = userEvent.setup();
      render(<ColorInput defaultValue="#ff0000" label="Color" />);

      const dialog = await openPicker(user);
      const hue = within(dialog).getByRole("slider", { name: "Hue" });
      act(() => hue.focus());
      await user.keyboard("{PageUp}{PageUp}{ArrowRight}{ArrowLeft}");
      expect(hue).toHaveAttribute("aria-valuenow", "20");
      expect(field()).toHaveValue("#ff5500");
      await user.keyboard("{End}");
      expect(hue).toHaveAttribute("aria-valuenow", "360");
    });

    it("has an alpha slider with alpha", async () => {
      const user = userEvent.setup();
      render(<ColorInput alpha defaultValue="#ff0000" label="Color" />);

      const dialog = await openPicker(user);
      const alpha = within(dialog).getByRole("slider", { name: "Opacity" });
      expect(alpha).toHaveAttribute("aria-valuetext", "100%");
      act(() => alpha.focus());
      await user.keyboard(
        "{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}",
      );
      expect(alpha).toHaveAttribute("aria-valuetext", "50%");
      expect(field()).toHaveValue("#ff000080");
    });

    it("has no alpha slider without alpha", async () => {
      const user = userEvent.setup();
      render(<ColorInput label="Color" />);

      const dialog = await openPicker(user);
      expect(
        within(dialog).queryByRole("slider", { name: "Opacity" }),
      ).toBeNull();
    });

    it("picks the point of the area pressed and dragged", async () => {
      const user = userEvent.setup();
      render(<ColorInput defaultValue="#ff0000" label="Color" />);

      await openPicker(user);
      const surface = area().parentElement!;
      vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
        bottom: 100,
        height: 100,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
      } as DOMRect);

      const press = { button: 0, isPrimary: true, pointerId: 1 };
      fireEvent.pointerDown(surface, { ...press, clientX: 100, clientY: 50 });
      expect(area()).toHaveAttribute(
        "aria-valuetext",
        "Saturation 50%, brightness 50%",
      );
      fireEvent.pointerMove(surface, { ...press, clientX: 200, clientY: 0 });
      fireEvent.pointerUp(surface, press);
      expect(field()).toHaveValue("#ff0000");
      // The drag is over
      fireEvent.pointerMove(surface, { ...press, clientX: 0, clientY: 100 });
      expect(field()).toHaveValue("#ff0000");
    });

    it("picks a swatch - a radio group, the arrow keys moving and picking", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <ColorInput
          defaultValue="#00ff00"
          label="Color"
          onChange={onChange}
          swatches={[
            { label: "Red", value: "#ff0000" },
            "rgb(0, 255, 0)",
            { label: "Blue", value: "hsl(240, 100%, 50%)" },
            "not a color",
          ]}
        />,
      );

      const dialog = await openPicker(user);
      const swatches = within(dialog).getByRole("radiogroup", {
        name: "Preset colors",
      });
      const options = within(swatches).getAllByRole("radio");
      expect(options).toHaveLength(3);
      // A swatch without a label is named by its color, in the format
      expect(options[1]).toHaveAccessibleName("#00ff00");
      expect(options[1]).toHaveAttribute("aria-checked", "true");
      expect(options[1]).toHaveAttribute("tabindex", "0");
      expect(options[0]).toHaveAttribute("tabindex", "-1");

      await user.click(within(swatches).getByRole("radio", { name: "Blue" }));
      expect(onChange).toHaveBeenLastCalledWith("#0000ff");
      await user.keyboard("{ArrowRight}");
      expect(
        within(swatches).getByRole("radio", { name: "Red" }),
      ).toHaveFocus();
      expect(onChange).toHaveBeenLastCalledWith("#ff0000");
      expect(field()).toHaveValue("#ff0000");
    });

    it("takes a color from the screen where the browser can", async () => {
      const user = userEvent.setup();
      const open = vi.fn().mockResolvedValue({ sRGBHex: "#123456" });
      vi.stubGlobal(
        "EyeDropper",
        class {
          open = open;
        },
      );
      render(<ColorInput format="rgb" label="Color" />);

      const dialog = await openPicker(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: "Pick a color from the screen",
        }),
      );
      expect(open).toHaveBeenCalled();
      expect(field()).toHaveValue("rgb(18, 52, 86)");
    });

    it("has no eye dropper where the browser has none, or when turned off", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("EyeDropper", class {});
      const { rerender } = render(<ColorInput label="Color" />);

      let dialog = await openPicker(user);
      expect(within(dialog).getByRole("button", { name: /from the screen/ }));

      rerender(<ColorInput eyeDropper={false} label="Color" />);
      dialog = screen.getByRole("dialog");
      expect(
        within(dialog).queryByRole("button", { name: /from the screen/ }),
      ).toBeNull();
    });

    it("names its parts in the language of the locale", async () => {
      const user = userEvent.setup();
      render(
        <UIProvider locale={cs}>
          <ColorInput alpha defaultValue="#1e90ff" label="Barva" />
        </UIProvider>,
      );

      await user.click(screen.getByRole("button", { name: "Vybrat barvu" }));
      const dialog = screen.getByRole("dialog", { name: "Výběr barvy" });
      expect(
        within(dialog).getByRole("slider", { name: "Sytost a jas" }),
      ).toHaveAttribute("aria-valuetext", "Sytost 88\u00a0%, jas 100\u00a0%");
      expect(within(dialog).getByRole("slider", { name: "Odstín" }));
      expect(within(dialog).getByRole("slider", { name: "Krytí" }));
    });
  });

  it("opens no picker while read-only or disabled - a read-only one is submitted", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Theme">
        <ColorInput defaultValue="#ff0000" label="Read" name="read" readOnly />
        <ColorInput
          defaultValue="#00ff00"
          disabled
          label="Disabled"
          name="disabled"
        />
      </form>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    const read = screen.getByRole("textbox", { name: "Read:" });
    expect(read).toHaveAttribute("readonly");
    expect(read).toHaveAttribute("data-readonly");
    await user.type(read, "00");
    expect(read).toHaveValue("#ff0000");

    expect(screen.getByRole("textbox", { name: "Disabled:" })).toBeDisabled();
    expect([...new FormData(getForm())]).toEqual([["read", "#ff0000"]]);
  });

  it.each(["fieldset", "disabled", "readOnly"] as const)(
    "closes an open picker on %s and keeps it closed when enabled again",
    async (mode) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const content = (blocked: boolean) => (
        <fieldset>
          <ColorInput
            defaultValue="#ff0000"
            disabled={mode === "disabled" && blocked}
            label="Color"
            onChange={onChange}
            readOnly={mode === "readOnly" && blocked}
            swatches={[{ label: "Blue", value: "#0000ff" }]}
          />
        </fieldset>
      );
      const { container, rerender } = render(content(false));
      await openPicker(user);

      const setBlocked = async (blocked: boolean) => {
        if (mode === "fieldset") {
          await act(async () => {
            container.querySelector("fieldset")!.disabled = blocked;
          });
        } else {
          rerender(content(blocked));
        }
      };
      await setBlocked(true);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Choose a color" }),
      ).toBeNull();
      expect(onChange).not.toHaveBeenCalled();

      await setBlocked(false);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(field()).toHaveValue("#ff0000");
      const dialog = await openPicker(user);
      await user.click(within(dialog).getByRole("radio", { name: "Blue" }));
      expect(onChange).toHaveBeenCalledExactlyOnceWith("#0000ff");
    },
  );

  it("leaves only the first legend's color field enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <fieldset disabled>
        <legend>
          <ColorInput
            defaultValue="#ff0000"
            label="Color"
            onChange={onChange}
            swatches={[{ label: "Blue", value: "#0000ff" }]}
          />
        </legend>
        <legend>
          <ColorInput label="Blocked" />
        </legend>
      </fieldset>,
    );

    expect(screen.getByRole("textbox", { name: "Color:" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Blocked:" })).toBeDisabled();
    const dialog = await openPicker(user);
    await user.click(within(dialog).getByRole("radio", { name: "Blue" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("#0000ff");
  });

  it("ignores a screen color returned after its fieldset was disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let finish!: (color: { sRGBHex: string }) => void;
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = () =>
          new Promise<{ sRGBHex: string }>((resolve) => {
            finish = resolve;
          });
      },
    );
    const { container } = render(
      <fieldset>
        <ColorInput defaultValue="#ff0000" label="Color" onChange={onChange} />
      </fieldset>,
    );
    const dialog = await openPicker(user);
    await user.click(
      within(dialog).getByRole("button", {
        name: "Pick a color from the screen",
      }),
    );
    await act(async () => {
      container.querySelector("fieldset")!.disabled = true;
    });
    await act(async () => finish({ sRGBHex: "#0000ff" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue("#ff0000");
  });

  it("submits its color and brings back the default on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Theme">
        <ColorInput defaultValue="#ff0000" label="Color" name="color" />
      </form>,
    );

    await user.clear(field());
    await user.type(field(), "#00f");
    await user.tab();
    expect(new FormData(getForm()).get("color")).toBe("#0000ff");

    act(() => getForm().reset());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(field()).toHaveValue("#ff0000");
    expect(new FormData(getForm()).get("color")).toBe("#ff0000");
  });

  it("requires a color when required", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Theme">
        <ColorInput label="Color" name="color" required />
      </form>,
    );

    expect(getForm().checkValidity()).toBe(false);
    await user.type(field(), "#fff");
    await user.tab();
    expect(getForm().checkValidity()).toBe(true);
  });

  it("shows the value of a controlled field only", async () => {
    const user = userEvent.setup();

    function Theme() {
      const [color, setColor] = useState("#ff0000");
      return (
        <>
          <ColorInput label="Color" onChange={setColor} value={color} />
          <ColorInput label="Fixed" value="#00ff00" />
          <output>{color}</output>
        </>
      );
    }

    render(<Theme />);
    const fixed = screen.getByRole("textbox", { name: "Fixed:" });
    await user.clear(fixed);
    await user.type(fixed, "#000");
    await user.tab();
    expect(fixed).toHaveValue("#00ff00");

    const color = screen.getByRole("textbox", { name: "Color:" });
    await user.clear(color);
    await user.type(color, "#000");
    await user.tab();
    expect(screen.getByRole("status")).toHaveTextContent("#000000");
  });

  it("is sized as an Input of its dim, and describes the field", () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <>
        <ColorInput aria-label="Small" dim="sm" />
        <ColorInput
          description="Used for the buttons"
          dim="lg"
          error="Pick a darker color"
          label="Large"
          ref={ref}
        />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Small" })).toHaveClass(
      "px-1",
      "py-0.5",
      "text-sm",
    );
    const large = screen.getByRole("textbox", { name: "Large:" });
    expect(large).toHaveClass("px-3", "py-2", "text-lg");
    expect(large).toHaveAccessibleDescription(
      "Pick a darker color Used for the buttons",
    );
    expect(large).toHaveAttribute("aria-invalid", "true");
    expect(ref.current).toBe(large);
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const colorInput = (
      <ColorInput alpha defaultValue="#1e90ff80" label="Color" name="color" />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(colorInput);
    document.body.append(container);

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, colorInput, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(field()).toHaveValue("#1e90ff80");

    act(() => root.unmount());
    container.remove();
  });
});
