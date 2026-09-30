import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, createRef, StrictMode, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Slider from "./slider";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const press = { button: 0, isPrimary: true, pointerId: 1 };

/** Lays the track of the slider out 200px wide from x = 0. */
function layOutTrack(thumb: HTMLElement) {
  const rail = thumb.parentElement!;
  vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
    bottom: 6,
    height: 6,
    left: 0,
    right: 200,
    top: 0,
    width: 200,
  } as DOMRect);
  return rail;
}

const getForm = () => screen.getByRole<HTMLFormElement>("form");

describe("Slider", () => {
  it("is a slider named by its label, with its value and bounds", () => {
    render(<Slider defaultValue={1500} label="Budget" max={5000} min={0} />);

    const slider = screen.getByRole("slider", { name: "Budget:" });
    expect(slider).toHaveAttribute("aria-valuenow", "1500");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "5000");
    expect(slider).toHaveAttribute("aria-valuetext", "1,500");
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
    expect(slider).toHaveAttribute("tabindex", "0");
  });

  it("is named by aria-label alone, without a reference to a missing element", () => {
    render(<Slider aria-label="Volume" defaultValue={50} />);

    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("aria-label", "Volume");
    expect(slider).not.toHaveAttribute("aria-labelledby");
  });

  it("writes the value as the locale does, or as formatValue says", () => {
    render(
      <UIProvider locale={cs}>
        <Slider aria-label="Rozpočet" defaultValue={1500} max={5000} />
        <Slider
          aria-label="Sleva"
          defaultValue={15}
          formatValue={(value) => `${value} %`}
          showValue
        />
      </UIProvider>,
    );

    expect(screen.getByRole("slider", { name: "Rozpočet" })).toHaveAttribute(
      "aria-valuetext",
      "1 500",
    );
    expect(screen.getByRole("slider", { name: "Sleva" })).toHaveAttribute(
      "aria-valuetext",
      "15 %",
    );
  });

  it("moves with the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(
      <Slider
        aria-label="Volume"
        defaultValue={50}
        onChange={onChange}
        onChangeEnd={onChangeEnd}
        step={5}
      />,
    );
    const slider = screen.getByRole("slider");

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuenow", "55");
    expect(onChange).toHaveBeenLastCalledWith(55);
    expect(onChangeEnd).toHaveBeenLastCalledWith(55);

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(slider).toHaveAttribute("aria-valuenow", "45");

    await user.keyboard("{PageUp}");
    expect(slider).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{PageDown}{PageDown}");
    expect(slider).toHaveAttribute("aria-valuenow", "35");

    await user.keyboard("{End}");
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    // Nothing past the end - and no change reported
    onChange.mockClear();
    await user.keyboard("{ArrowUp}");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
  });

  it("moves back with the right arrow in a right-to-left page", async () => {
    const user = userEvent.setup();
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element, pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return new Proxy(style, {
          get: (target, property) => {
            if (property === "direction") return "rtl";
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    );
    render(<Slider aria-label="Volume" defaultValue={50} />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "49");
  });

  it("snaps to steps with decimals, without floating point noise", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Slider
        aria-label="Weight"
        defaultValue={0.1}
        max={1}
        onChange={onChange}
        step={0.1}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(onChange).toHaveBeenLastCalledWith(0.3);
  });

  it("steps onto zero, not onto -0, from below it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Camera">
        <Slider
          aria-label="Tilt"
          defaultValue={-0.3}
          max={0.9}
          min={-0.9}
          name="tilt"
          onChange={onChange}
          showValue
          step={0.3}
        />
      </form>,
    );

    // -0.9 + 3 × 0.3 is a little below zero
    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(Object.is(onChange.mock.lastCall?.[0], 0)).toBe(true);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "0");
    expect(new FormData(getForm()).get("tilt")).toBe("0");
  });

  it("shows and submits a -0 of the parent as 0", () => {
    render(
      <form aria-label="Camera">
        <Slider
          aria-label="Tilt"
          max={1}
          min={-1}
          name="tilt"
          onChange={() => {}}
          showValue
          step={0.5}
          value={-0}
        />
      </form>,
    );

    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "0");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");
    expect(new FormData(getForm()).get("tilt")).toBe("0");
  });

  it("moves a value off the steps onto them", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Slider aria-label="Volume" onChange={onChange} step={10} value={33} />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(40);

    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith(20);
  });

  it("goes up to the last step within a max off the steps", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Slider
        aria-label="Volume"
        defaultValue={6}
        max={10}
        onChange={onChange}
        step={3}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "9");
    // End stays there - it does not move the thumb back
    await user.keyboard("{End}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "9");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("keeps a value of the parent past the last step going up", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Slider
        aria-label="Volume"
        max={10}
        onChange={onChange}
        step={3}
        value={10}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}{End}");
    expect(onChange).not.toHaveBeenCalled();
  });

  describe("range", () => {
    it("names the two thumbs and bounds them by each other", () => {
      render(<Slider defaultValue={[20, 80]} label="Price" minDistance={10} />);

      const start = screen.getByRole("slider", { name: "Price: minimum" });
      const end = screen.getByRole("slider", { name: "Price: maximum" });
      expect(start).toHaveAttribute("aria-valuenow", "20");
      expect(start).toHaveAttribute("aria-valuemax", "70");
      expect(end).toHaveAttribute("aria-valuemin", "30");
      expect(end).toHaveAttribute("aria-valuemax", "100");
    });

    it("names the thumbs in the language of the locale, also with aria-label", () => {
      render(
        <UIProvider locale={cs}>
          <Slider aria-label="Cena" defaultValue={[20, 80]} />
        </UIProvider>,
      );

      expect(
        screen.getByRole("slider", { name: "Cena od" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("slider", { name: "Cena do" }),
      ).toBeInTheDocument();
    });

    it("keeps the thumbs from crossing", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Slider
          aria-label="Price"
          defaultValue={[40, 60]}
          minDistance={10}
          onChange={onChange}
          step={5}
        />,
      );

      screen.getByRole("slider", { name: "Price minimum" }).focus();
      await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
      expect(onChange).toHaveBeenLastCalledWith([50, 60]);

      await user.keyboard("{End}");
      expect(onChange).toHaveBeenLastCalledWith([50, 60]);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("keeps the thumbs apart at zero, not at -0", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Slider
          aria-label="Tilt"
          defaultValue={[-0.3, 0.3]}
          max={0.9}
          min={-0.9}
          minDistance={0.3}
          onChange={onChange}
          step={0.3}
        />,
      );

      // The lowest the end may go, -0.3 + 0.3, is a step a little below zero
      screen.getByRole("slider", { name: "Tilt maximum" }).focus();
      await user.keyboard("{Home}");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(Object.is(onChange.mock.lastCall?.[0][1], 0)).toBe(true);
    });

    it.each([
      {
        values: [0, 9],
        min: 0,
        max: 12,
        step: 3,
        distance: 2,
        index: 0,
        key: "End",
        expected: [6, 9],
      },
      {
        values: [3, 12],
        min: 0,
        max: 12,
        step: 3,
        distance: 2,
        index: 1,
        key: "Home",
        expected: [3, 6],
      },
      {
        values: [0.1, 0.7],
        min: 0.1,
        max: 0.9,
        step: 0.2,
        distance: 0.3,
        index: 0,
        key: "End",
        expected: [0.3, 0.7],
      },
      {
        values: [0.1, 0.7],
        min: 0.1,
        max: 0.9,
        step: 0.2,
        distance: 0.3,
        index: 1,
        key: "Home",
        expected: [0.1, 0.5],
      },
      {
        values: [0.1, 0.3],
        min: 0,
        max: 1,
        step: 0.1,
        distance: 0.1,
        index: 0,
        key: "End",
        expected: [0.2, 0.3],
      },
    ])(
      "keeps thumb $index on steps of $step at the distance bound",
      ({ values, min, max, step, distance, index, key, expected }) => {
        const onChange = vi.fn();
        render(
          <form aria-label="Filter">
            <Slider
              aria-label="Price"
              defaultValue={values as [number, number]}
              min={min}
              max={max}
              step={step}
              minDistance={distance}
              name="price"
              onChange={onChange}
            />
          </form>,
        );
        fireEvent.keyDown(screen.getAllByRole("slider")[index], { key });
        expect(onChange).toHaveBeenLastCalledWith(expected);
        expect(new FormData(getForm()).getAll("price")).toEqual(
          expected.map(String),
        );
      },
    );

    it("never moves a thumb closer than minDistance the wrong way", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Slider
          aria-label="Price"
          // Closer than minDistance already - e.g. saved before it was set
          defaultValue={[50, 52]}
          minDistance={5}
          onChange={onChange}
        />,
      );

      const start = screen.getByRole("slider", { name: "Price minimum" });
      const end = screen.getByRole("slider", { name: "Price maximum" });
      expect(start).toHaveAttribute("aria-valuemax", "50");
      expect(end).toHaveAttribute("aria-valuemin", "52");

      start.focus();
      await user.keyboard("{ArrowRight}");
      expect(onChange).not.toHaveBeenCalled();
      await user.keyboard("{ArrowLeft}");
      expect(onChange).toHaveBeenLastCalledWith([49, 52]);

      end.focus();
      await user.keyboard("{ArrowLeft}");
      expect(onChange).toHaveBeenCalledTimes(1);
      await user.keyboard("{ArrowRight}");
      expect(onChange).toHaveBeenLastCalledWith([49, 53]);
    });

    it("submits the start and the end under its name", () => {
      render(
        <form aria-label="Filter">
          <Slider aria-label="Price" defaultValue={[20, 80]} name="price" />
        </form>,
      );

      expect(new FormData(getForm()).getAll("price")).toEqual(["20", "80"]);
    });

    it("moves the nearest thumb to a press on the track", () => {
      const onChange = vi.fn();
      render(
        <Slider
          aria-label="Price"
          defaultValue={[20, 80]}
          onChange={onChange}
        />,
      );
      const rail = layOutTrack(
        screen.getByRole("slider", { name: "Price minimum" }),
      );

      // 140px of 200px - 70, nearer to 80
      fireEvent.pointerDown(rail, { ...press, clientX: 140 });
      fireEvent.pointerUp(document, { ...press, clientX: 140 });

      expect(onChange).toHaveBeenCalledWith([20, 70]);
      expect(
        screen.getByRole("slider", { name: "Price maximum" }),
      ).toHaveFocus();
    });

    it("drags the thumb the first move points to when both are on one spot", () => {
      const onChange = vi.fn();
      render(
        <Slider
          aria-label="Price"
          defaultValue={[100, 100]}
          onChange={onChange}
        />,
      );
      const start = screen.getByRole("slider", { name: "Price minimum" });
      layOutTrack(start);

      fireEvent.pointerDown(
        screen.getByRole("slider", { name: "Price maximum" }),
        { ...press, clientX: 200 },
      );
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 150 });
      fireEvent.pointerUp(document, { ...press, clientX: 150 });

      expect(onChange).toHaveBeenLastCalledWith([75, 100]);
      expect(start).toHaveFocus();
    });
  });

  describe("pointer", () => {
    it("drags a thumb and reports the end of the drag once", () => {
      const onChange = vi.fn();
      const onChangeEnd = vi.fn();
      render(
        <Slider
          aria-label="Volume"
          defaultValue={50}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
        />,
      );
      const thumb = screen.getByRole("slider");
      layOutTrack(thumb);

      fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
      expect(thumb).toHaveFocus();
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 120 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 150 });
      expect(thumb).toHaveAttribute("aria-valuenow", "75");
      expect(onChangeEnd).not.toHaveBeenCalled();

      // Past the end of the track - the end
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 400 });
      fireEvent.pointerUp(document, { ...press, clientX: 400 });

      expect(onChange).toHaveBeenLastCalledWith(100);
      expect(onChangeEnd).toHaveBeenCalledTimes(1);
      expect(onChangeEnd).toHaveBeenCalledWith(100);

      // The drag is over
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 0 });
      expect(thumb).toHaveAttribute("aria-valuenow", "100");
    });

    it("shows the value above the thumb while it is dragged", () => {
      render(<Slider aria-label="Volume" defaultValue={50} />);
      const thumb = screen.getByRole("slider");
      layOutTrack(thumb);
      const bubble = thumb.querySelector("span")!;

      expect(bubble).toHaveClass("opacity-0");
      fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
      expect(bubble).toHaveClass("opacity-100");
      fireEvent.pointerUp(document, { ...press, clientX: 100 });
      expect(bubble).not.toHaveClass("opacity-100");
    });

    it("goes back to where the drag started on Escape", () => {
      const onChange = vi.fn();
      const onDialogKeyDown = vi.fn();
      document.addEventListener("keydown", onDialogKeyDown);
      render(
        <Slider aria-label="Volume" defaultValue={50} onChange={onChange} />,
      );
      const thumb = screen.getByRole("slider");
      layOutTrack(thumb);

      fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 20 });
      expect(thumb).toHaveAttribute("aria-valuenow", "10");
      fireEvent.keyDown(thumb, { key: "Escape" });

      expect(thumb).toHaveAttribute("aria-valuenow", "50");
      expect(onChange).toHaveBeenLastCalledWith(50);
      // A Dialog around stays open
      expect(onDialogKeyDown).not.toHaveBeenCalled();
      document.removeEventListener("keydown", onDialogKeyDown);
    });

    it.each([
      ["minimum", { min: 80 }, 80, 90],
      ["maximum", { max: 20 }, 20, 10],
      ["larger maximum", { max: 200 }, 75, 100],
    ] as const)(
      "cancels a drag when its %s changes, then uses the new bounds",
      (_, bounds, shown, next) => {
        const onChange = vi.fn();
        const onChangeEnd = vi.fn();
        const view = (changed: boolean) => (
          <Slider
            aria-label="Volume"
            defaultValue={50}
            onChange={onChange}
            onChangeEnd={onChangeEnd}
            {...(changed ? bounds : {})}
          />
        );
        const { rerender } = render(view(false));
        const thumb = screen.getByRole("slider");
        layOutTrack(thumb);

        fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
        fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 150 });
        expect(onChange).toHaveBeenLastCalledWith(75);

        rerender(view(true));
        expect(thumb).toHaveAttribute("aria-valuenow", String(shown));
        fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 160 });
        fireEvent.pointerUp(document, { ...press, clientX: 160 });
        expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(true);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChangeEnd).not.toHaveBeenCalled();
        expect(thumb.querySelector("span")).toHaveClass("opacity-0");

        // A new gesture uses the updated scale.
        fireEvent.pointerDown(thumb, { ...press, clientX: 150 });
        fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 100 });
        fireEvent.pointerUp(document, { ...press, clientX: 100 });
        expect(onChange).toHaveBeenLastCalledWith(next);
        expect(onChangeEnd).toHaveBeenCalledExactlyOnceWith(next);
      },
    );

    it.each([
      ["step", { step: 10 }],
      ["orientation", { orientation: "vertical" }],
      ["minimum distance", { minDistance: 50 }],
    ] as const)("cancels a range drag when its %s changes", (_, changed) => {
      const onChange = vi.fn();
      const onChangeEnd = vi.fn();
      const view = (updated: boolean) => (
        <Slider
          aria-label="Price"
          defaultValue={[20, 80]}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          {...(updated ? changed : {})}
        />
      );
      const { rerender } = render(view(false));
      const thumb = screen.getByRole("slider", { name: "Price minimum" });
      layOutTrack(thumb);

      fireEvent.pointerDown(thumb, { ...press, clientX: 40 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 60 });
      expect(onChange).toHaveBeenLastCalledWith([30, 80]);
      rerender(view(true));
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 100 });
      fireEvent.pointerUp(document, { ...press, clientX: 100 });
      expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(true);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChangeEnd).not.toHaveBeenCalled();
      expect(thumb).toHaveAttribute("aria-valuenow", "30");
      expect(thumb.querySelector("span")).toHaveClass("opacity-0");
    });

    it.each(["disabled", "readOnly", "fieldset"] as const)(
      "ends a drag without changing the value when %s locks the slider",
      async (lock) => {
        const onChange = vi.fn();
        const onChangeEnd = vi.fn();
        const view = (locked: boolean) => (
          <fieldset disabled={locked && lock === "fieldset"}>
            <Slider
              aria-label="Volume"
              defaultValue={50}
              disabled={locked && lock === "disabled"}
              onChange={onChange}
              onChangeEnd={onChangeEnd}
              readOnly={locked && lock === "readOnly"}
            />
          </fieldset>
        );
        const { rerender } = render(view(false));
        const thumb = screen.getByRole("slider");
        layOutTrack(thumb);

        fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
        fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 20 });
        expect(onChange).toHaveBeenLastCalledWith(10);
        await act(async () => rerender(view(true)));
        expect(thumb.querySelector("span")).toHaveClass("opacity-0");

        expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(true);
        fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 180 });
        fireEvent.pointerUp(document, { ...press, clientX: 180 });
        expect(onChange).toHaveBeenCalledExactlyOnceWith(10);
        expect(onChangeEnd).not.toHaveBeenCalled();
        expect(thumb).toHaveAttribute("aria-valuenow", "10");

        await act(async () => rerender(view(false)));
        fireEvent.pointerDown(thumb, { ...press, clientX: 20 });
        fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 120 });
        fireEvent.pointerUp(document, { ...press, clientX: 120 });
        expect(onChange).toHaveBeenLastCalledWith(60);
        expect(onChangeEnd).toHaveBeenCalledExactlyOnceWith(60);
      },
    );

    it("clears a drag across Activity hiding and permits a new gesture", () => {
      const onChange = vi.fn();
      const onChangeEnd = vi.fn();
      const view = (mode: "visible" | "hidden") => (
        <StrictMode>
          <Activity mode={mode}>
            <Slider
              aria-label="Volume"
              defaultValue={50}
              onChange={onChange}
              onChangeEnd={onChangeEnd}
            />
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(view("visible"));
      const thumb = screen.getByRole("slider");
      layOutTrack(thumb);
      const bubble = thumb.querySelector("span")!;

      fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 150 });
      expect(bubble).toHaveClass("opacity-100");
      rerender(view("hidden"));
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 180 });
      fireEvent.pointerUp(document, { ...press, clientX: 180 });
      rerender(view("visible"));

      expect(bubble).toHaveClass("opacity-0");
      expect(thumb).toHaveAttribute("aria-valuenow", "75");
      expect(onChange).toHaveBeenCalledExactlyOnceWith(75);
      expect(onChangeEnd).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(true);

      fireEvent.pointerDown(thumb, { ...press, clientX: 150 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 120 });
      fireEvent.pointerUp(document, { ...press, clientX: 120 });
      expect(onChange).toHaveBeenLastCalledWith(60);
      expect(onChangeEnd).toHaveBeenCalledExactlyOnceWith(60);
      expect(bubble).toHaveClass("opacity-0");
    });

    it("waits for a finger on the track to tap or move sideways", () => {
      const onChange = vi.fn();
      render(
        <Slider aria-label="Volume" defaultValue={50} onChange={onChange} />,
      );
      const rail = layOutTrack(screen.getByRole("slider"));
      const finger = { ...press, pointerType: "touch" };

      // The page scrolled - the browser took the finger over
      fireEvent.pointerDown(rail, { ...finger, clientX: 20 });
      fireEvent.pointerCancel(document, finger);
      expect(onChange).not.toHaveBeenCalled();

      // The first moves of a scroll come before the browser takes it over
      fireEvent.pointerDown(rail, { ...finger, clientX: 20, clientY: 3 });
      fireEvent.pointerMove(document, {
        ...finger,
        buttons: 1,
        clientX: 24,
        clientY: 40,
      });
      fireEvent.pointerMove(document, {
        ...finger,
        buttons: 1,
        clientX: 60,
        clientY: 45,
      });
      fireEvent.pointerUp(document, { ...finger, clientX: 60, clientY: 45 });
      expect(onChange).not.toHaveBeenCalled();

      // A tap - a finger never lies quite still
      fireEvent.pointerDown(rail, { ...finger, clientX: 20, clientY: 3 });
      fireEvent.pointerMove(document, {
        ...finger,
        buttons: 1,
        clientX: 22,
        clientY: 5,
      });
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.pointerUp(document, { ...finger, clientX: 22, clientY: 5 });
      expect(onChange).toHaveBeenLastCalledWith(11);

      // A move along the track drags the nearest thumb
      fireEvent.pointerDown(rail, { ...finger, clientX: 20, clientY: 3 });
      fireEvent.pointerMove(document, {
        ...finger,
        buttons: 1,
        clientX: 100,
        clientY: 8,
      });
      expect(onChange).toHaveBeenLastCalledWith(50);
      fireEvent.pointerUp(document, { ...finger, clientX: 100, clientY: 8 });
    });

    it("ignores a right click, and ends a drag whose release got lost", () => {
      const onChange = vi.fn();
      render(
        <Slider aria-label="Volume" defaultValue={50} onChange={onChange} />,
      );
      const thumb = screen.getByRole("slider");
      const rail = layOutTrack(thumb);

      fireEvent.pointerDown(rail, { ...press, button: 2, clientX: 20 });
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.pointerDown(thumb, { ...press, clientX: 100 });
      fireEvent.pointerMove(document, { ...press, buttons: 0, clientX: 150 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 150 });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does nothing while disabled", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Filter">
          <Slider
            aria-label="Volume"
            defaultValue={50}
            disabled
            name="volume"
            onChange={onChange}
          />
        </form>,
      );
      const thumb = screen.getByRole("slider");
      const rail = layOutTrack(thumb);

      expect(thumb).toHaveAttribute("aria-disabled", "true");
      expect(thumb).not.toHaveAttribute("tabindex");
      fireEvent.pointerDown(rail, { ...press, clientX: 20 });
      fireEvent.keyDown(thumb, { key: "ArrowRight" });
      await user.tab();

      expect(onChange).not.toHaveBeenCalled();
      expect(thumb).not.toHaveFocus();
      expect(new FormData(getForm()).has("volume")).toBe(false);
    });

    it("moves neither by a drag nor by a key while read-only - but is focusable and submitted", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Filter">
          <Slider
            aria-label="Volume"
            defaultValue={50}
            name="volume"
            onChange={onChange}
            readOnly
          />
        </form>,
      );
      const thumb = screen.getByRole("slider");
      const rail = layOutTrack(thumb);

      expect(thumb).toHaveAttribute("aria-readonly", "true");
      expect(thumb).not.toHaveAttribute("aria-disabled");
      fireEvent.pointerDown(rail, { ...press, clientX: 20 });
      fireEvent.pointerMove(document, { ...press, buttons: 1, clientX: 180 });
      fireEvent.pointerUp(document, { ...press, clientX: 180 });

      await user.tab();
      expect(thumb).toHaveFocus();
      const keyDown = fireEvent.keyDown(thumb, { key: "ArrowRight" });
      // The key moves nothing - neither the thumb nor the page
      expect(keyDown).toBe(false);
      await user.keyboard("{End}");

      expect(onChange).not.toHaveBeenCalled();
      expect(thumb).toHaveAttribute("aria-valuenow", "50");
      expect(new FormData(getForm()).get("volume")).toBe("50");
    });

    // user-event takes everything in a disabled fieldset for disabled - the
    // browser leaves an element with a role there alone
    it("is disabled by a disabled fieldset around it, as it changes", async () => {
      const onChange = vi.fn();
      function Filter() {
        const [locked, setLocked] = useState(true);
        return (
          <form aria-label="Filter">
            <fieldset disabled={locked}>
              <Slider
                aria-label="Volume"
                defaultValue={50}
                name="volume"
                onChange={onChange}
              />
            </fieldset>
            <button onClick={() => setLocked(false)} type="button">
              Unlock
            </button>
          </form>
        );
      }
      render(<Filter />);
      const thumb = screen.getByRole("slider");
      const rail = layOutTrack(thumb);

      expect(thumb).toHaveAttribute("aria-disabled", "true");
      expect(thumb).not.toHaveAttribute("tabindex");
      fireEvent.pointerDown(rail, { ...press, clientX: 20 });
      fireEvent.keyDown(thumb, { key: "ArrowRight" });
      expect(onChange).not.toHaveBeenCalled();

      // The fieldset is watched - no render of the slider tells it
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
      });
      expect(thumb).toHaveAttribute("tabindex", "0");
      fireEvent.keyDown(thumb, { key: "ArrowRight" });
      expect(onChange).toHaveBeenLastCalledWith(51);
      expect(new FormData(getForm()).get("volume")).toBe("51");
    });
  });

  it("shows the value of a controlled slider only", async () => {
    const user = userEvent.setup();

    function Filter() {
      const [price, setPrice] = useState<[number, number]>([20, 80]);
      return (
        <>
          <Slider
            aria-label="Price"
            onChange={(next) => setPrice([next[0], Math.min(next[1], 90)])}
            step={10}
            value={price}
          />
          <output>{price.join("-")}</output>
        </>
      );
    }

    render(<Filter />);
    screen.getByRole("slider", { name: "Price maximum" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(document.querySelector("output")).toHaveTextContent("20-90");
    expect(
      screen.getByRole("slider", { name: "Price maximum" }),
    ).toHaveAttribute("aria-valuenow", "90");
  });

  it("submits its value and brings back the default on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings">
        <Slider aria-label="Volume" defaultValue={30} name="volume" />
      </form>,
    );

    screen.getByRole("slider").focus();
    await user.keyboard("{ArrowUp}");
    expect(new FormData(getForm()).get("volume")).toBe("31");

    act(() => getForm().reset());
    await waitFor(() =>
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "30"),
    );
    expect(new FormData(getForm()).get("volume")).toBe("30");
  });

  it("keeps its value when a listener cancels the form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings" onReset={(event) => event.preventDefault()}>
        <Slider aria-label="Volume" defaultValue={30} name="volume" />
      </form>,
    );

    screen.getByRole("slider").focus();
    await user.keyboard("{ArrowUp}");

    act(() => getForm().reset());
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "31");
    expect(new FormData(getForm()).get("volume")).toBe("31");
  });

  it("writes the values of a fine step with all their digits", () => {
    render(
      <form aria-label="Filter">
        <Slider
          aria-label="Tolerance"
          defaultValue={0.0000001}
          max={0.000001}
          name="tolerance"
          showValue
          step={0.0000001}
        />
      </form>,
    );

    expect(new FormData(getForm()).get("tolerance")).toBe("0.0000001");
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "0.0000001",
    );
  });

  it("shows the value next to the label, a range too", () => {
    render(
      <Slider
        defaultValue={[1000, 4000]}
        formatValue={(value) => `$${value}`}
        label="Price"
        max={5000}
        showValue
      />,
    );

    expect(screen.getByText("$1000 – $4000")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("puts the labels of its marks under the track", () => {
    render(
      <Slider
        aria-label="Priority"
        defaultValue={2}
        marks={[
          { label: "Low", value: 1 },
          { value: 2 },
          { label: "High", value: 3 },
        ]}
        max={3}
        min={1}
      />,
    );

    expect(screen.getByText("Low")).toHaveStyle({ insetInlineStart: "0%" });
    expect(screen.getByText("High")).toHaveStyle({
      insetInlineStart: "100%",
    });
  });

  it("is described by its error first, then its description", () => {
    render(
      <Slider
        defaultValue={[20, 80]}
        description="Prices include VAT."
        error="Too wide a range"
        id="price"
        label="Price"
      />,
    );

    for (const thumb of screen.getAllByRole("slider")) {
      expect(thumb).toHaveAccessibleDescription(
        "Too wide a range Prices include VAT.",
      );
      expect(thumb).toHaveAttribute("aria-invalid", "true");
    }
  });

  it("points its label and its ref at the first thumb, and reports focus once", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <Slider
          defaultValue={[20, 80]}
          label="Price"
          onBlur={onBlur}
          onFocus={onFocus}
          ref={ref}
        />
        <button type="button">After</button>
      </>,
    );

    expect(ref.current).toBe(screen.getAllByRole("slider")[0]);
    await user.click(screen.getByText("Price:"));
    expect(ref.current).toHaveFocus();

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("sizes the track and the thumbs by dim - size still works", () => {
    render(
      <>
        <Slider aria-label="Extra small" dim="xs" />
        <Slider aria-label="Medium" />
        <Slider aria-label="Large" dim="lg" />
        <Slider aria-label="Old small" size="sm" />
      </>,
    );

    const thumb = (name: string) => screen.getByRole("slider", { name });
    expect(thumb("Extra small")).toHaveClass("size-3");
    expect(thumb("Extra small").parentElement).toHaveClass("h-0.5", "mx-1.5");
    expect(thumb("Medium")).toHaveClass("size-4.5");
    expect(thumb("Large")).toHaveClass("size-5.5");
    expect(thumb("Old small")).toHaveClass("size-3.5");
  });

  it("takes any content as its label", () => {
    render(
      <Slider
        label={
          <>
            Volume <small>(dB)</small>
          </>
        }
      />,
    );

    expect(screen.getByRole("slider")).toHaveAccessibleName("Volume (dB):");
  });

  it("is vertical on request", () => {
    render(<Slider aria-label="Level" orientation="vertical" />);

    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const slider = (
      <Slider
        defaultValue={[20, 80]}
        label="Price"
        marks={[{ label: "0", value: 0 }]}
        name="price"
        showValue
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(slider);
    document.body.append(container);

    expect(container.querySelectorAll("[role='slider']")).toHaveLength(2);
    expect(container.querySelectorAll("input[name='price']")).toHaveLength(2);

    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, slider, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(
      screen.getByRole("slider", { name: "Price: maximum" }),
    ).toHaveAttribute("aria-valuenow", "80");

    act(() => root.unmount());
    container.remove();
  });
});
