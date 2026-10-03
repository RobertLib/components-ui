import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Autocomplete from "./autocomplete";
import Checkbox from "./checkbox";
import CheckboxGroup from "./checkbox-group";
import ColorInput from "./color-input";
import DateCalendar from "./date-calendar";
import DateRangePicker from "./date-range-picker";
import DateTimePicker from "./datetime-picker";
import Field from "./field";
import FileUpload from "./file-upload";
import Input from "./input";
import NumberInput from "./number-input";
import PinInput from "./pin-input";
import RadioGroup from "./radio-group";
import RangeCalendar from "./range-calendar";
import Rating from "./rating";
import RichTextEditor from "./rich-text-editor";
import SegmentedControl from "./segmented-control";
import Select from "./select";
import Slider from "./slider";
import Switch from "./switch";
import TagsInput from "./tags-input";
import Textarea from "./textarea";
import TreeSelect from "./tree-select";

// The conventions the fields of the library share: where `ref` and the
// native attributes go, the heights of the sizes, the state attributes for
// styling, and a focus and states that stay in forced colors (Windows High
// Contrast).

const options = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
];
const treeItems = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

type Dim = "xs" | "sm" | "md" | "lg";
const DIMS: Dim[] = ["xs", "sm", "md", "lg"];

/** What a field passes on besides its own props. */
const nativeProps = (ref: React.Ref<never>) => ({
  "data-testid": "field",
  ref,
  style: { color: "red" },
});

describe("The ref and the native attributes", () => {
  // The element the ref points at, and the one the other attributes go to
  const cases: [
    string,
    (props: ReturnType<typeof nativeProps>) => React.ReactNode,
    () => HTMLElement,
    () => HTMLElement,
  ][] = [
    [
      "Input",
      (props) => <Input label="Name" {...props} />,
      () => screen.getByRole("textbox"),
      () => screen.getByRole("textbox"),
    ],
    [
      "Textarea",
      (props) => <Textarea label="Note" {...props} />,
      () => screen.getByRole("textbox"),
      () => screen.getByRole("textbox"),
    ],
    [
      "Select",
      (props) => <Select label="Period" options={options} {...props} />,
      () => screen.getByRole("combobox"),
      () => screen.getByRole("combobox"),
    ],
    [
      "NumberInput",
      (props) => <NumberInput label="Count" {...props} />,
      () => screen.getByRole("spinbutton"),
      () => screen.getByRole("spinbutton"),
    ],
    [
      "Checkbox",
      (props) => <Checkbox label="Agree" {...props} />,
      () => screen.getByRole("checkbox"),
      () => screen.getByRole("checkbox"),
    ],
    [
      "Switch",
      (props) => <Switch label="Notify" {...props} />,
      () => screen.getByRole("switch"),
      () => screen.getByRole("switch"),
    ],
    [
      "ColorInput",
      (props) => <ColorInput label="Color" {...props} />,
      () => screen.getByRole("textbox"),
      () => screen.getByRole("textbox"),
    ],
    [
      "TagsInput",
      (props) => <TagsInput label="Tags" {...props} />,
      () => screen.getByRole("textbox"),
      () => screen.getByRole("textbox"),
    ],
    [
      "DateTimePicker",
      (props) => <DateTimePicker label="Day" {...props} />,
      () => screen.getByRole("combobox"),
      () => screen.getByRole("combobox"),
    ],
    [
      "DateTimePicker native",
      (props) => <DateTimePicker label="Day" mode="native" {...props} />,
      () => screen.getByLabelText(/Day/),
      () => screen.getByLabelText(/Day/),
    ],
    [
      "DateRangePicker",
      (props) => <DateRangePicker label="Stay" {...props} />,
      () => screen.getByRole("combobox"),
      () => screen.getByRole("combobox"),
    ],
    [
      // The combobox takes the focus - the wrapper the attributes of a div
      "Autocomplete",
      (props) => <Autocomplete label="City" options={options} {...props} />,
      () => screen.getByRole("combobox"),
      () => screen.getByText(/City/).parentElement!,
    ],
    [
      "Autocomplete asSelect",
      (props) => (
        <Autocomplete asSelect label="City" options={options} {...props} />
      ),
      () => screen.getByRole("combobox"),
      () => screen.getByText(/City/).parentElement!,
    ],
    [
      "TreeSelect",
      (props) => <TreeSelect items={treeItems} label="Item" {...props} />,
      () => screen.getByRole("combobox"),
      () => screen.getByText(/Item/).parentElement!,
    ],
    [
      "RadioGroup",
      (props) => <RadioGroup label="Period" options={options} {...props} />,
      () => screen.getByRole("radiogroup"),
      () => screen.getByRole("radiogroup"),
    ],
    [
      "CheckboxGroup",
      (props) => <CheckboxGroup label="Period" options={options} {...props} />,
      () => screen.getByRole("group"),
      () => screen.getByRole("group"),
    ],
    [
      "SegmentedControl",
      (props) => (
        <SegmentedControl label="Period" options={options} {...props} />
      ),
      () => screen.getByRole("radiogroup"),
      () => screen.getByRole("radiogroup"),
    ],
    [
      // The first thumb - the attributes go around the thumbs
      "Slider",
      (props) => <Slider defaultValue={[20, 80]} label="Price" {...props} />,
      () => screen.getAllByRole("slider")[0],
      () => screen.getAllByRole("slider")[0].parentElement!.parentElement!,
    ],
    [
      "Rating",
      (props) => <Rating label="Stars" {...props} />,
      () => screen.getByRole("slider"),
      () => screen.getByRole("slider"),
    ],
    [
      // The first cell - the attributes go to the row of cells
      "PinInput",
      (props) => <PinInput label="Code" length={4} {...props} />,
      () => screen.getAllByRole("textbox")[0],
      () => screen.getByRole("group"),
    ],
    [
      "RichTextEditor",
      (props) => <RichTextEditor label="Text" {...props} />,
      () => screen.getByRole("textbox"),
      () => screen.getByRole("textbox"),
    ],
    [
      "FileUpload",
      (props) => <FileUpload label="Files" {...props} />,
      () => screen.getByRole("group"),
      () => screen.getByRole("group"),
    ],
    [
      "DateCalendar",
      (props) => <DateCalendar label="Day" {...props} />,
      () => screen.getAllByRole("group")[0],
      () => screen.getAllByRole("group")[0],
    ],
    [
      "RangeCalendar",
      (props) => <RangeCalendar label="Stay" {...props} />,
      () => screen.getAllByRole("group")[0],
      () => screen.getAllByRole("group")[0],
    ],
    [
      "Field",
      (props) => (
        <Field label="Own" {...props}>
          <input />
        </Field>
      ),
      () => screen.getByText(/Own/).parentElement!,
      () => screen.getByText(/Own/).parentElement!,
    ],
  ];

  it.each(cases)("%s", (_, renderField, refTarget, attributeTarget) => {
    const ref = createRef<HTMLElement>();
    render(renderField(nativeProps(ref as React.Ref<never>)));

    expect(ref.current).toBe(refTarget());
    expect(screen.getByTestId("field")).toBe(attributeTarget());
    expect(screen.getByTestId("field")).toHaveStyle({
      color: "rgb(255, 0, 0)",
    });
  });

  it("keeps a callback ref and the ref of a form library apart", () => {
    const refs: (HTMLElement | null)[] = [];
    const { unmount } = render(
      <FileUpload label="Files" ref={(element) => void refs.push(element)} />,
    );

    expect(refs).toEqual([screen.getByRole("group")]);
    unmount();
    expect(refs.at(-1)).toBeNull();
  });

  it("passes the event handlers of a closed field on beside its own", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onChange = vi.fn();
    render(<Rating label="Stars" onChange={onChange} onKeyDown={onKeyDown} />);

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onKeyDown).toHaveBeenCalledOnce();
    // The rating still handles the key
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("hears the events of all the cells of a PinInput", () => {
    const onClick = vi.fn();
    render(<PinInput label="Code" onClick={onClick} />);

    fireEvent.click(screen.getAllByRole("textbox")[1]);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("lets a handler of the page prevent what the field does with a key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Rating
        label="Stars"
        onChange={onChange}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("The sizes", () => {
  // The height of a field of the classes of a size: the line of the text,
  // the padding and the border
  const LINE_HEIGHTS: Record<string, number> = {
    "text-base": 24,
    "text-lg": 28,
    "text-sm": 20,
  };
  const SPACING: Record<string, number> = { "0": 0, "0.5": 2, "1": 4, "2": 8 };
  const EXPECTED_HEIGHTS: Record<Dim, number> = {
    lg: 46,
    md: 34,
    sm: 26,
    xs: 22,
  };

  const heightOf = (element: HTMLElement) => {
    const classes = Array.from(element.classList);
    const line = classes
      .map((name) => LINE_HEIGHTS[name])
      .find((height) => height !== undefined);
    const padding = classes
      .map((name) => /^py-(.+)$/.exec(name)?.[1])
      .map((step) => (step === undefined ? undefined : SPACING[step]))
      .find((height) => height !== undefined);
    expect(line, `the text size of ${element.className}`).toBeDefined();
    expect(padding, `the padding of ${element.className}`).toBeDefined();
    return (line ?? 0) + 2 * (padding ?? 0) + 2;
  };

  // The element that has the height of the field
  const fields: [string, (dim: Dim) => React.ReactNode, () => HTMLElement][] = [
    [
      "Input",
      (dim) => <Input aria-label="Field" dim={dim} />,
      () => screen.getByRole("textbox"),
    ],
    [
      "Input with a prefix",
      (dim) => <Input aria-label="Field" dim={dim} prefix="$" />,
      () => screen.getByRole("textbox"),
    ],
    [
      "Textarea",
      (dim) => <Textarea aria-label="Field" dim={dim} />,
      () => screen.getByRole("textbox"),
    ],
    [
      "Select",
      (dim) => <Select aria-label="Field" dim={dim} options={options} />,
      () => screen.getByRole("combobox"),
    ],
    [
      "NumberInput",
      (dim) => <NumberInput aria-label="Field" dim={dim} />,
      () => screen.getByRole("spinbutton"),
    ],
    [
      "ColorInput",
      (dim) => <ColorInput aria-label="Field" dim={dim} />,
      () => screen.getByRole("textbox"),
    ],
    [
      "DateTimePicker",
      (dim) => <DateTimePicker aria-label="Field" dim={dim} />,
      () => screen.getByRole("combobox"),
    ],
    [
      "DateTimePicker native",
      (dim) => <DateTimePicker aria-label="Field" dim={dim} mode="native" />,
      () => screen.getByLabelText("Field"),
    ],
    [
      "DateRangePicker",
      (dim) => <DateRangePicker aria-label="Field" dim={dim} />,
      () => screen.getByRole("combobox"),
    ],
    [
      "Autocomplete",
      (dim) => <Autocomplete aria-label="Field" dim={dim} options={options} />,
      () => screen.getByRole("combobox").parentElement!,
    ],
    [
      "TagsInput",
      (dim) => <TagsInput aria-label="Field" dim={dim} />,
      () => screen.getByRole("textbox").parentElement!,
    ],
    [
      "TreeSelect",
      (dim) => <TreeSelect aria-label="Field" dim={dim} items={treeItems} />,
      () => screen.getByRole("combobox").parentElement!,
    ],
    [
      "FileUpload button",
      (dim) => <FileUpload dim={dim} variant="button" />,
      () => screen.getByRole("button", { name: "Upload" }),
    ],
  ];

  describe.each(fields)("%s", (_, renderField, element) => {
    it.each(DIMS)("is as high as an Input of dim %s", (dim) => {
      render(renderField(dim));
      expect(heightOf(element())).toBe(EXPECTED_HEIGHTS[dim]);
    });
  });

  it.each(DIMS)("of a SegmentedControl match an Input of dim %s", (dim) => {
    render(
      <SegmentedControl aria-label="Period" dim={dim} options={options} />,
    );

    const option = screen.getByRole("radio", { name: "Day" }).closest("label")!;
    const bar = option.parentElement!;
    const height = Number(
      /^h-(.+)$/.exec(
        Array.from(option.classList).find((name) => name.startsWith("h-"))!,
      )![1],
    );
    const padding = Number(
      /^p-(.+)$/.exec(
        Array.from(bar.classList).find((name) => /^p-/.test(name))!,
      )![1],
    );
    // Tailwind's spacing is a quarter of a rem - 4 px
    expect((height + 2 * padding) * 4).toBe(EXPECTED_HEIGHTS[dim]);
  });

  it("grow with the dim for the boxes, tracks, cells and icons", () => {
    // The first number of a size class - `size-3.5`, `h-4`
    const sizeOf = (element: Element, prefix: string) =>
      Number(
        new RegExp(`(?:^|\\s)${prefix}-([\\d.]+)(?:\\s|$)`).exec(
          element.getAttribute("class") ?? "",
        )?.[1],
      );

    const measure = (dim: Dim) => {
      const { unmount } = render(
        <>
          <Checkbox dim={dim} label="Box" />
          <RadioGroup aria-label="Radios" dim={dim} options={options} />
          <Switch dim={dim} label="Track" />
          <Rating aria-label="Stars" dim={dim} />
          <PinInput aria-label="Code" dim={dim} length={1} />
          <Slider aria-label="Slider" dim={dim} />
        </>,
      );
      const sizes = [
        sizeOf(screen.getByRole("checkbox"), "size"),
        sizeOf(screen.getAllByRole("radio")[0], "size"),
        sizeOf(screen.getByRole("switch").nextElementSibling!, "h"),
        sizeOf(
          screen.getByRole("slider", { name: "Stars" }).firstElementChild!,
          "size",
        ),
        sizeOf(screen.getByRole("textbox"), "h"),
        sizeOf(screen.getByRole("slider", { name: "Slider" }), "size"),
      ];
      unmount();
      return sizes;
    };

    const byDim = DIMS.map(measure);
    for (const sizes of byDim) {
      expect(sizes.every(Number.isFinite)).toBe(true);
    }
    for (let index = 1; index < byDim.length; index++) {
      byDim[index].forEach((size, part) =>
        expect(size).toBeGreaterThanOrEqual(byDim[index - 1][part]),
      );
    }
  });
});

describe("The state attributes", () => {
  it("tell what an uncontrolled checkbox shows - also after a reset or a script", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Checkbox label="Agree" />
      </form>,
    );

    const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("data-state", "checked");

    vi.useFakeTimers();
    try {
      act(() => screen.getByRole<HTMLFormElement>("form").reset());
      act(() => vi.runAllTimers());
    } finally {
      vi.useRealTimers();
    }
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("data-state", "unchecked");

    // React Hook Form sets `checked` itself
    act(() => {
      checkbox.checked = true;
    });
    expect(checkbox).toHaveAttribute("data-state", "checked");

    act(() => {
      checkbox.indeterminate = true;
    });
    expect(checkbox).toHaveAttribute("data-state", "indeterminate");
  });

  it("follow a controlled checkbox and switch", () => {
    const { rerender } = render(
      <>
        <Checkbox checked indeterminate label="All" onChange={() => {}} />
        <Switch checked={false} label="Notify" onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "indeterminate",
    );
    expect(screen.getByRole("switch")).toHaveAttribute(
      "data-state",
      "unchecked",
    );

    rerender(
      <>
        <Checkbox checked label="All" onChange={() => {}} />
        <Switch checked label="Notify" onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });

  it("mark the options of the groups, their cards and segments", () => {
    render(
      <>
        <RadioGroup
          aria-label="Plan"
          defaultValue="week"
          options={options}
          orientation="horizontal"
          variant="card"
        />
        <CheckboxGroup
          aria-label="Days"
          defaultValue={["day"]}
          options={options}
          selectAll
          variant="card"
        />
        <SegmentedControl
          aria-label="Period"
          defaultValue="day"
          disabled
          options={options}
        />
      </>,
    );

    const plan = screen.getByRole("radiogroup", { name: "Plan" });
    expect(plan).toHaveAttribute("data-orientation", "horizontal");
    const week = within(plan).getByRole("radio", { name: "Week" });
    expect(week).toHaveAttribute("data-state", "checked");
    expect(week.closest("label")).toHaveAttribute("data-selected", "");
    const day = within(plan).getByRole("radio", { name: "Day" });
    expect(day).toHaveAttribute("data-state", "unchecked");
    expect(day.closest("label")).not.toHaveAttribute("data-selected");

    const days = screen.getByRole("group", { name: "Days" });
    expect(days).toHaveAttribute("data-orientation", "vertical");
    expect(
      within(days).getByRole("checkbox", { name: "Select all" }),
    ).toHaveAttribute("data-state", "indeterminate");
    const picked = within(days).getByRole("checkbox", { name: "Day" });
    expect(picked).toHaveAttribute("data-state", "checked");
    expect(picked.closest("label")).toHaveAttribute("data-selected", "");

    const period = screen.getByRole("radiogroup", { name: "Period" });
    expect(period).toHaveAttribute("data-disabled", "");
    const segment = within(period).getByRole("radio", { name: "Day" });
    expect(segment).toHaveAttribute("data-state", "checked");
    expect(segment).toHaveAttribute("data-disabled", "");
    expect(segment.closest("label")).toHaveAttribute("data-selected", "");
  });

  it("tell whether the popup of a field is open, and its highlighted option", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete defaultValue="week" label="Period" options={options} />,
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveAttribute("data-state", "closed");

    await user.click(combobox);
    expect(combobox).toHaveAttribute("data-state", "open");
    await user.keyboard("{ArrowDown}");

    const week = screen.getByRole("option", { name: "Week" });
    expect(week).toHaveAttribute("data-selected", "");
    const highlighted = screen
      .getAllByRole("option")
      .filter((option) => option.hasAttribute("data-highlighted"));
    expect(highlighted).toHaveLength(1);
    expect(combobox).toHaveAttribute(
      "aria-activedescendant",
      highlighted[0].id,
    );
  });

  it("tell whether the popups of the pickers and the tree select are open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DateTimePicker label="Day" />
        <TreeSelect items={treeItems} label="Item" />
        <ColorInput label="Color" />
      </>,
    );

    const day = screen.getByRole("combobox", { name: /Day/ });
    const item = screen.getByRole("combobox", { name: /Item/ });
    const swatch = screen.getByRole("button", { name: "Choose a color" });
    for (const trigger of [day, item, swatch]) {
      expect(trigger).toHaveAttribute("data-state", "closed");
    }

    await user.click(day);
    expect(day).toHaveAttribute("data-state", "open");
    await user.keyboard("{Escape}");

    await user.click(item);
    expect(item).toHaveAttribute("data-state", "open");
    await user.keyboard("{Escape}");

    await user.click(swatch);
    expect(swatch).toHaveAttribute("data-state", "open");
  });

  it("mark the selected, highlighted and disabled days", () => {
    render(
      <DateCalendar
        defaultValue="2026-09-24"
        label="Day"
        max="2026-09-25"
        min="2026-09-02"
      />,
    );

    const cell = (name: RegExp) =>
      screen.getByRole("button", { name }).closest("[role='gridcell']");
    expect(cell(/24/)).toHaveAttribute("data-selected", "");
    // The day the keys start from
    expect(cell(/24/)).toHaveAttribute("data-highlighted", "");
    expect(cell(/23/)).not.toHaveAttribute("data-selected");
    expect(cell(/28/)).toHaveAttribute("data-disabled", "");
  });

  it("mark invalid, disabled and read-only fields", () => {
    render(
      <>
        <Input error="Required" label="Name" />
        <Input disabled label="Code" />
        <Textarea label="Note" readOnly />
        <Select aria-invalid="true" label="Period" options={options} />
        <Slider disabled error="Too low" label="Price" orientation="vertical" />
      </>,
    );

    const name = screen.getByRole("textbox", { name: /Name/ });
    expect(name).toHaveAttribute("data-invalid", "");
    expect(name).not.toHaveAttribute("data-disabled");
    expect(screen.getByRole("textbox", { name: /Code/ })).toHaveAttribute(
      "data-disabled",
      "",
    );
    expect(screen.getByRole("textbox", { name: /Note/ })).toHaveAttribute(
      "data-readonly",
      "",
    );
    expect(screen.getByRole("combobox", { name: /Period/ })).toHaveAttribute(
      "data-invalid",
      "",
    );

    const thumb = screen.getByRole("slider");
    expect(thumb).toHaveAttribute("data-orientation", "vertical");
    expect(thumb).toHaveAttribute("data-invalid", "");
    expect(thumb).toHaveAttribute("data-disabled", "");
  });

  it("marks a picked value the field refuses as invalid", () => {
    render(
      <DateTimePicker defaultValue="2026-09-24" label="Day" max="2026-09-01" />,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute("data-invalid", "");
  });

  it("are present and empty or absent - never `false`", () => {
    const { container } = render(
      <>
        <Input label="Name" />
        <Checkbox label="Agree" />
        <RadioGroup aria-label="Plan" options={options} />
        <CheckboxGroup aria-label="Days" options={options} />
        <SegmentedControl aria-label="Period" options={options} />
        <Autocomplete label="City" options={options} />
        <DateCalendar label="Day" />
        <Slider label="Price" />
        <Rating label="Stars" />
        <PinInput label="Code" />
        <FileUpload label="Files" />
        <RichTextEditor label="Text" />
      </>,
    );

    const flags = container.querySelectorAll(
      "[data-selected], [data-highlighted], [data-disabled], [data-invalid], [data-readonly]",
    );
    for (const element of flags) {
      for (const flag of [
        "data-selected",
        "data-highlighted",
        "data-disabled",
        "data-invalid",
        "data-readonly",
      ]) {
        if (element.hasAttribute(flag)) {
          expect(element.getAttribute(flag)).toBe("");
        }
      }
    }
  });
});

describe("Forced colors (Windows High Contrast)", () => {
  const stylesheet = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../styles.css"),
    "utf8",
  );

  it("keep the focus of the fields visible - an outline, not only a ring", () => {
    const formControl = /@utility form-control \{[^}]*\}/.exec(stylesheet)?.[0];
    expect(formControl).toContain("focus:outline-hidden");
    expect(formControl).not.toContain("outline-none");

    const { container } = render(
      <>
        <Input clearable defaultValue="a" label="Name" prefix="$" />
        <PinInput label="Code" />
        <Slider label="Price" />
        <ColorInput label="Color" />
        <Autocomplete label="City" options={options} />
        <TagsInput defaultValue={["a"]} label="Tags" />
        <TreeSelect defaultValue="a" items={treeItems} label="Item" />
        <DateCalendar label="Day" />
        <RichTextEditor label="Text" />
        <CheckboxGroup aria-label="Days" options={options} variant="card" />
      </>,
    );
    // The fields' own elements - the wrapper of a Popover is its own
    const hiddenOutlines = Array.from(
      container.querySelectorAll("[class*='outline-none']"),
    ).filter((element) => !element.classList.contains("popover"));
    expect(hiddenOutlines).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Digit 1 of 6" })).toHaveClass(
      "focus:outline-hidden",
    );
    expect(screen.getByRole("slider")).toHaveClass("focus:outline-hidden");
  });

  it("show the on state of a switch and the picked segment", () => {
    render(
      <>
        <Switch label="Notify" />
        <SegmentedControl
          aria-label="Period"
          defaultValue="day"
          options={options}
        />
      </>,
    );

    const track = screen.getByRole("switch").nextElementSibling;
    expect(track).toHaveClass(
      "forced-colors:peer-checked:bg-[Highlight]",
      "forced-colors:outline-1",
    );

    const segment = screen.getByRole("radio", { name: "Day" }).closest("label");
    expect(segment).toHaveClass(
      "forced-colors:text-[HighlightText]",
      "has-focus-visible:outline-hidden",
    );
    // The indicator, or the background of the picked option before it is
    // measured
    const indicator = segment?.parentElement?.querySelector(
      "[aria-hidden='true'].absolute",
    );
    expect(indicator ?? segment).toHaveClass("forced-colors:bg-[Highlight]");
  });

  it("show the picked cards, the range of a slider and the picked stars", () => {
    render(
      <>
        <RadioGroup
          aria-label="Plan"
          defaultValue="day"
          options={options}
          variant="card"
        />
        <Slider aria-label="Price" defaultValue={[20, 80]} />
        <Rating aria-label="Stars" defaultValue={2} />
      </>,
    );

    expect(
      screen.getByRole("radio", { name: "Day" }).closest("label"),
    ).toHaveClass("forced-colors:has-checked:border-[Highlight]");

    const rail = screen.getAllByRole("slider", { name: /Price/ })[0]
      .parentElement!;
    expect(rail).toHaveClass("forced-colors:outline-1");
    expect(rail.firstElementChild).toHaveClass("forced-colors:bg-[Highlight]");

    const firstStar = screen.getByRole("slider", {
      name: "Stars",
    }).firstElementChild!;
    expect(firstStar.lastElementChild).toHaveClass(
      "forced-colors:[&_svg]:fill-[Highlight]",
    );
  });

  it("show the selected days and the highlighted option", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DateCalendar defaultValue="2026-09-24" label="Day" />
        <Autocomplete label="City" options={options} />
      </>,
    );

    expect(screen.getByRole("button", { name: /24/ })).toHaveClass(
      "forced-colors:bg-[Highlight]",
      "forced-colors:text-[HighlightText]",
    );

    await user.click(screen.getByRole("combobox", { name: /City/ }));
    await user.keyboard("{ArrowDown}");
    const highlighted = screen
      .getAllByRole("option")
      .find((option) => option.hasAttribute("data-highlighted"));
    expect(highlighted).toHaveClass("forced-colors:bg-[Highlight]");
  });

  it("keep the colors of a color swatch, and thicken the border of an invalid field", () => {
    render(
      <>
        <ColorInput defaultValue="#ff0000" label="Color" />
        <Input error="Required" label="Name" />
        <Select error="Required" label="Period" options={options} />
      </>,
    );

    const swatch = screen
      .getByRole("button", { name: "Choose a color" })
      .querySelector("[aria-hidden='true']");
    expect(swatch).toHaveClass("forced-color-adjust-none");
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveClass(
      "forced-colors:outline-1",
    );
    expect(screen.getByRole("combobox", { name: /Period/ })).toHaveClass(
      "forced-colors:outline-1",
    );
  });
});

describe("Right to left", () => {
  it("opens the color picker under the start of the field", async () => {
    const user = userEvent.setup();
    render(<ColorInput label="Color" />);

    await user.click(screen.getByRole("button", { name: "Choose a color" }));
    const panel = screen.getByRole("dialog").closest(".inset-s-0");
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveClass("left-0");
  });
});
