import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Heart } from "lucide-react";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Rating, { type RatingColor } from "./rating";
import { colorOf, contrast, pageBackgrounds } from "../../test/contrast";
import { cs } from "../../i18n/ui/cs";
import UIProvider from "../../providers/ui-provider";

const getForm = () => screen.getByRole<HTMLFormElement>("form");
const slider = () => screen.getByRole("slider");

/** The icons of the rating, laid out 20px wide each from x = 0. */
function layOutIcons(rating = slider()) {
  const icons = [
    ...rating.querySelectorAll<HTMLElement>(":scope > [data-index]"),
  ];
  icons.forEach((icon, index) => {
    vi.spyOn(icon, "getBoundingClientRect").mockReturnValue({
      bottom: 20,
      height: 20,
      left: index * 24,
      right: index * 24 + 20,
      top: 0,
      width: 20,
    } as DOMRect);
  });
  return icons;
}

/** How much of each icon is filled, in percent. */
const fills = () =>
  [...slider().querySelectorAll<HTMLElement>(":scope > [data-index]")].map(
    (icon) => icon.querySelector<HTMLElement>("[style]")?.style.width ?? "0%",
  );

describe("Rating", () => {
  it("is a slider named by its label, read as the value of the maximum", () => {
    render(<Rating defaultValue={3} label="Quality" />);

    const rating = screen.getByRole("slider", { name: "Quality:" });
    expect(rating).toHaveAttribute("aria-valuenow", "3");
    expect(rating).toHaveAttribute("aria-valuemin", "0");
    expect(rating).toHaveAttribute("aria-valuemax", "5");
    expect(rating).toHaveAttribute("aria-valuetext", "3 of 5 stars");
    expect(rating).toHaveAttribute("tabindex", "0");
    expect(fills()).toEqual(["100%", "100%", "100%", "0%", "0%"]);
  });

  it("says the value in the language of the locale - or as formatValueText says", () => {
    render(
      <UIProvider locale={cs}>
        <Rating aria-label="Kvalita" allowHalf defaultValue={3.5} />
        <Rating aria-label="Jedna" defaultValue={1} max={1} />
        <Rating aria-label="Nic" />
        <Rating
          aria-label="Srdce"
          defaultValue={2}
          formatValueText={(value, max) => `${value}/${max} srdce`}
          icon={<Heart />}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("slider", { name: "Kvalita" })).toHaveAttribute(
      "aria-valuetext",
      "3,5 z 5 hvězd",
    );
    expect(screen.getByRole("slider", { name: "Jedna" })).toHaveAttribute(
      "aria-valuetext",
      "1 z 1 hvězdy",
    );
    expect(screen.getByRole("slider", { name: "Nic" })).toHaveAttribute(
      "aria-valuetext",
      "Bez hodnocení",
    );
    expect(screen.getByRole("slider", { name: "Srdce" })).toHaveAttribute(
      "aria-valuetext",
      "2/5 srdce",
    );
  });

  it("changes with the keyboard as a slider", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating aria-label="Quality" onChange={onChange} />);

    await user.tab();
    expect(slider()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(slider()).toHaveAttribute("aria-valuenow", "3");
    await user.keyboard("{ArrowDown}");
    expect(slider()).toHaveAttribute("aria-valuenow", "2");
    await user.keyboard("{End}");
    expect(slider()).toHaveAttribute("aria-valuenow", "5");
    await user.keyboard("{PageDown}");
    expect(slider()).toHaveAttribute("aria-valuenow", "4");
    await user.keyboard("{Home}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");

    // Not clearable - it stays at the lowest rating
    onChange.mockClear();
    await user.keyboard("{ArrowLeft}{Backspace}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("goes down to none and clears with Backspace when clearable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Rating
        aria-label="Quality"
        clearable
        defaultValue={2}
        onChange={onChange}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "0");
    expect(slider()).toHaveAttribute("aria-valuetext", "No rating");
    await user.keyboard("{End}{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith(0);
    await user.keyboard("{PageUp}{Delete}");
    expect(slider()).toHaveAttribute("aria-valuenow", "0");
  });

  it("moves by halves with allowHalf, onto the halves from any value", async () => {
    const user = userEvent.setup();
    render(<Rating allowHalf aria-label="Quality" defaultValue={4.3} />);

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "4.5");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "3.5");
    await user.keyboard("{PageUp}");
    expect(slider()).toHaveAttribute("aria-valuenow", "4.5");
    await user.keyboard("{Home}");
    expect(slider()).toHaveAttribute("aria-valuenow", "0.5");
  });

  it("swaps Left and Right in a right-to-left page", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl" style={{ direction: "rtl" }}>
        <Rating aria-label="Quality" defaultValue={3} />
      </div>,
    );

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "4");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "2");
  });

  it("picks the icon clicked - a half on its start half with allowHalf", async () => {
    const onChange = vi.fn();
    render(<Rating allowHalf aria-label="Quality" onChange={onChange} />);
    const icons = layOutIcons();

    fireEvent.click(icons[3], { clientX: 3 * 24 + 15 });
    expect(onChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(icons[1], { clientX: 24 + 5 });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
    expect(fills()).toEqual(["100%", "50%", "0%", "0%", "0%"]);
  });

  it("previews the value under the pointer until it leaves", () => {
    render(<Rating aria-label="Quality" defaultValue={1} />);
    const icons = layOutIcons();

    fireEvent.pointerMove(icons[3], { clientX: 80, pointerType: "mouse" });
    expect(fills()).toEqual(["100%", "100%", "100%", "100%", "0%"]);
    // Only a preview - the value is still 1
    expect(slider()).toHaveAttribute("aria-valuenow", "1");

    fireEvent.pointerLeave(slider());
    expect(fills()).toEqual(["100%", "0%", "0%", "0%", "0%"]);
  });

  it("clears on a click on the value only when clearable", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Rating aria-label="Quality" defaultValue={3} onChange={onChange} />,
    );

    fireEvent.click(layOutIcons()[2]);
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <Rating
        aria-label="Quality"
        clearable
        defaultValue={3}
        onChange={onChange}
      />,
    );
    fireEvent.click(layOutIcons()[2]);
    expect(onChange).toHaveBeenCalledWith(0);
    expect(slider()).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows the value of a controlled rating only", () => {
    const onChange = vi.fn();
    render(<Rating aria-label="Quality" onChange={onChange} value={2} />);

    fireEvent.click(layOutIcons()[4]);
    expect(onChange).toHaveBeenCalledWith(5);
    expect(slider()).toHaveAttribute("aria-valuenow", "2");
  });

  it("fills a part of an icon for a value in between - an average", () => {
    render(<Rating aria-label="Average" readOnly value={4.3} />);

    const [, , , , fifth] = fills();
    expect(Number.parseFloat(fifth)).toBeCloseTo(30);
  });

  describe("read-only", () => {
    it("changes neither by a click nor by a key, but is focusable and submitted", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Review">
          <Rating
            aria-label="Quality"
            defaultValue={3}
            name="quality"
            onChange={onChange}
            readOnly
          />
        </form>,
      );
      const icons = layOutIcons();

      fireEvent.pointerMove(icons[4], { clientX: 100, pointerType: "mouse" });
      expect(fills()).toEqual(["100%", "100%", "100%", "0%", "0%"]);
      fireEvent.click(icons[4]);
      await user.tab();
      expect(slider()).toHaveFocus();
      await user.keyboard("{ArrowRight}{End}");

      expect(onChange).not.toHaveBeenCalled();
      expect(slider()).toHaveAttribute("aria-valuenow", "3");
      expect(slider()).toHaveAttribute("aria-readonly", "true");
      expect(new FormData(getForm()).get("quality")).toBe("3");
    });
  });

  it("is neither focusable nor submitted while disabled - also by a fieldset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Review">
        <Rating
          aria-label="Quality"
          defaultValue={3}
          disabled
          name="quality"
          onChange={onChange}
        />
        <fieldset disabled>
          <Rating aria-label="Service" name="service" />
        </fieldset>
      </form>,
    );

    const quality = screen.getByRole("slider", { name: "Quality" });
    expect(quality).toHaveAttribute("aria-disabled", "true");
    expect(quality).not.toHaveAttribute("tabindex");
    fireEvent.click(layOutIcons(quality)[4]);
    fireEvent.keyDown(quality, { key: "ArrowRight" });
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(quality).not.toHaveFocus();
    expect(screen.getByRole("slider", { name: "Service" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect([...new FormData(getForm()).keys()]).toEqual([]);
  });

  it.each(["insert", "reorder"])(
    "follows the first legend when legends %s without remounting the field",
    async (change) => {
      const onChange = vi.fn();
      const view = (otherFirst: boolean) => (
        <form aria-label="Review">
          <fieldset disabled>
            {otherFirst && <legend key="other">Other legend</legend>}
            <legend key="rating">
              <input aria-label="Native" />
              <Rating
                aria-label="Quality"
                defaultValue={2}
                name="quality"
                onChange={onChange}
              />
            </legend>
            {!otherFirst && change === "reorder" && (
              <legend key="other">Other legend</legend>
            )}
          </fieldset>
        </form>
      );
      const { rerender } = render(view(false));
      const rating = slider();
      expect(rating).not.toHaveAttribute("aria-disabled");
      expect(screen.getByRole("textbox")).not.toBeDisabled();
      expect(new FormData(getForm()).get("quality")).toBe("2");

      await act(async () => rerender(view(true)));
      expect(slider()).toBe(rating);
      expect(screen.getByRole("textbox")).toBeDisabled();
      expect(rating).toHaveAttribute("aria-disabled", "true");
      expect(rating).not.toHaveAttribute("tabindex");
      fireEvent.keyDown(rating, { key: "ArrowRight" });
      fireEvent.click(layOutIcons(rating)[4]);
      expect(onChange).not.toHaveBeenCalled();
      expect(rating).toHaveAttribute("aria-valuenow", "2");
      expect(new FormData(getForm()).has("quality")).toBe(false);

      await act(async () => rerender(view(false)));
      expect(slider()).toBe(rating);
      expect(rating).not.toHaveAttribute("aria-disabled");
      expect(screen.getByRole("textbox")).not.toBeDisabled();
      fireEvent.keyDown(rating, { key: "ArrowRight" });
      expect(onChange).toHaveBeenLastCalledWith(3);
      expect(new FormData(getForm()).get("quality")).toBe("3");
    },
  );

  it("submits its value - nothing picked as an empty one - and brings back the default on a reset", async () => {
    const user = userEvent.setup();
    render(
      <>
        <form aria-label="Review" id="review" />
        <Rating aria-label="Quality" form="review" name="quality" />
        <Rating
          aria-label="Service"
          defaultValue={4}
          form="review"
          name="service"
        />
      </>,
    );

    expect(new FormData(getForm()).get("quality")).toBe("");
    screen.getByRole("slider", { name: "Service" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(new FormData(getForm()).get("service")).toBe("3");

    act(() => getForm().reset());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(new FormData(getForm()).get("service")).toBe("4");
  });

  it("keeps the form from being submitted without a rating when required", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Review">
        <Rating label="Quality" required />
      </form>,
    );

    // A slider has no required state for assistive technology - the
    // browser says what is missing
    expect(slider()).not.toHaveAttribute("aria-required");
    expect(getForm().checkValidity()).toBe(false);

    slider().focus();
    await user.keyboard("{ArrowRight}");
    expect(getForm().checkValidity()).toBe(true);
  });

  it("is described by its error first, then its description", () => {
    render(
      <Rating
        aria-label="Quality"
        description="How did you like it?"
        error="Rate the product"
        id="quality"
      />,
    );

    expect(slider()).toHaveAccessibleDescription(
      "Rate the product How did you like it?",
    );
    expect(slider()).toHaveAttribute("aria-invalid", "true");
    expect(slider()).toHaveAttribute("id", "quality");
  });

  it("sizes the icons by dim and takes an icon of its own", () => {
    render(
      <>
        <Rating aria-label="Small" dim="sm" />
        <Rating
          aria-label="Hearts"
          dim="lg"
          icon={<Heart data-testid="heart" />}
          max={3}
        />
      </>,
    );

    expect(
      screen
        .getByRole("slider", { name: "Small" })
        .querySelector("[data-index]"),
    ).toHaveClass("size-5");
    const hearts = screen.getByRole("slider", { name: "Hearts" });
    expect(hearts.querySelector("[data-index]")).toHaveClass("size-8");
    expect(hearts.querySelectorAll("[data-index]")).toHaveLength(3);
    expect(screen.getAllByTestId("heart")).toHaveLength(3);
  });

  it("focuses the slider by a click on its label, and points its ref at it", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();

    function Review() {
      const [value, setValue] = useState(0);
      return (
        <Rating label="Quality" onChange={setValue} ref={ref} value={value} />
      );
    }

    render(<Review />);
    await user.click(screen.getByText(/Quality/));
    expect(slider()).toHaveFocus();
    expect(ref.current).toBe(slider());
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "1");
  });

  it("draws the picked and the empty icons at 3:1 on the page", () => {
    const colors: RatingColor[] = ["warning", "primary", "success", "danger"];
    const low: string[] = [];

    for (const color of colors) {
      const { unmount } = render(
        <Rating aria-label={color} color={color} defaultValue={1} max={2} />,
      );
      const [filled, empty] = [
        slider().querySelector<HTMLElement>("[style]")!,
        slider().querySelector<HTMLElement>("[data-index] > span")!,
      ];

      for (const dark of [false, true]) {
        for (const [part, element] of [
          ["filled", filled],
          ["empty", empty],
        ] as const) {
          const stroke = colorOf(element.className, "[&_svg]:stroke", { dark });
          expect(stroke, `${color} ${part}`).toBeDefined();
          for (const background of pageBackgrounds(dark)) {
            const ratio = contrast(stroke!, background);
            if (ratio < 3) {
              low.push(`${color} ${part} ${dark ? "dark" : "light"}: ${ratio}`);
            }
          }
        }
      }
      unmount();
    }

    expect(low).toEqual([]);
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const rating = (
      <Rating allowHalf defaultValue={2.5} label="Quality" name="quality" />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(rating);
    document.body.append(container);

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, rating, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(slider()).toHaveAttribute("aria-valuenow", "2.5");

    act(() => root.unmount());
    container.remove();
  });
});
