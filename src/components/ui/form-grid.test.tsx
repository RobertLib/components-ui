import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import Autocomplete from "./autocomplete";
import Checkbox from "./checkbox";
import CheckboxGroup from "./checkbox-group";
import ColorInput from "./color-input";
import DateCalendar from "./date-calendar";
import DateRangePicker from "./date-range-picker";
import DateTimePicker from "./datetime-picker";
import Field from "./field";
import FileUpload from "./file-upload";
import FormGrid, { FormGridItem } from "./form-grid";
import Input from "./input";
import NumberInput from "./number-input";
import PhoneInput from "./phone-input";
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
import TransferList from "./transfer-list";
import TreeSelect from "./tree-select";

const options = [{ label: "Praha", value: "praha" }];

/** The element of the grid itself - inside the container. */
const gridOf = (root: HTMLElement) => root.firstElementChild as HTMLElement;

describe("FormGrid", () => {
  it("lays the fields out in a container of its own", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FormGrid className="mt-4" data-testid="grid" ref={ref}>
        <Input label="Name" />
      </FormGrid>,
    );

    const root = screen.getByTestId("grid");
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("@container/cui-form", "mt-4");
    expect(gridOf(root)).toHaveClass("grid", "grid-cols-1");
    // The labels above by default - the fields take the nearest position
    expect(root).not.toHaveAttribute("data-label-position");
    expect(root).not.toHaveAttribute("data-readonly");
  });

  it.each([
    [2, "top", ["@xl/cui-form:grid-cols-2"]],
    [3, "top", ["@3xl/cui-form:grid-cols-3"]],
    [4, "top", ["@xl/cui-form:grid-cols-2", "@4xl/cui-form:grid-cols-4"]],
    [2, "start", ["@3xl/cui-form:grid-cols-2"]],
    [3, "start", ["@5xl/cui-form:grid-cols-3"]],
    [4, "start", ["@3xl/cui-form:grid-cols-2", "@6xl/cui-form:grid-cols-4"]],
  ] as const)(
    "has %i columns with the labels at the %s where it is wide enough",
    (columns, labelPosition, classes) => {
      render(
        <FormGrid
          columns={columns}
          data-testid="grid"
          labelPosition={labelPosition}
        />,
      );

      expect(gridOf(screen.getByTestId("grid"))).toHaveClass(
        "grid-cols-1",
        ...classes,
      );
    },
  );

  it("puts the labels beside the fields in a column of labelWidth", () => {
    render(
      <FormGrid
        data-testid="grid"
        labelPosition="start"
        labelWidth="12rem"
        style={{ marginTop: 4 }}
      />,
    );

    const root = screen.getByTestId("grid");
    expect(root).toHaveAttribute("data-label-position", "start");
    expect(root.style.getPropertyValue("--cui-label-width")).toBe("12rem");
    expect(root).toHaveStyle({ marginTop: "4px" });
  });

  it("takes the label position of a grid around", () => {
    render(
      <FormGrid labelPosition="start">
        <FormGrid columns={2} data-testid="inner" />
        <FormGrid columns={2} data-testid="top" labelPosition="top" />
      </FormGrid>,
    );

    const inner = screen.getByTestId("inner");
    expect(inner).not.toHaveAttribute("data-label-position");
    expect(gridOf(inner)).toHaveClass("@3xl/cui-form:grid-cols-2");
    expect(screen.getByTestId("top")).toHaveAttribute(
      "data-label-position",
      "top",
    );
    expect(gridOf(screen.getByTestId("top"))).toHaveClass(
      "@xl/cui-form:grid-cols-2",
    );
  });

  it("marks a read-only grid", () => {
    render(<FormGrid data-testid="grid" readOnly />);

    expect(screen.getByTestId("grid")).toHaveAttribute("data-readonly", "");
  });
});

describe("FormGridItem", () => {
  it.each([
    [2, 2, "top", ["@xl/cui-form:col-span-2"]],
    [2, 4, "top", ["@xl/cui-form:col-span-2"]],
    [3, 2, "top", ["@3xl/cui-form:col-span-2"]],
    [4, 3, "top", ["@xl/cui-form:col-span-2", "@4xl/cui-form:col-span-3"]],
    [4, 4, "start", ["@3xl/cui-form:col-span-2", "@6xl/cui-form:col-span-4"]],
    [3, "full", "top", ["col-span-full"]],
  ] as const)(
    "spans at most the columns a grid of %i has - %s, labels %s",
    (columns, span, labelPosition, classes) => {
      render(
        <FormGrid columns={columns} labelPosition={labelPosition}>
          <FormGridItem data-testid="item" span={span}>
            <Textarea label="Note" />
          </FormGridItem>
        </FormGrid>,
      );

      expect(screen.getByTestId("item")).toHaveClass("min-w-0", ...classes);
    },
  );

  it("spans one column in a grid of one, or none", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <>
        <FormGrid>
          <FormGridItem data-testid="one" span={3} />
        </FormGrid>
        <FormGridItem className="mt-2" data-testid="alone" ref={ref} span={2} />
      </>,
    );

    expect(screen.getByTestId("one")).toHaveAttribute("class", "min-w-0");
    expect(screen.getByTestId("alone")).toHaveAttribute(
      "class",
      "min-w-0 mt-2",
    );
    expect(ref.current).toBe(screen.getByTestId("alone"));
  });
});

describe("The fields beside their labels", () => {
  // What the stylesheet lays out with `labelPosition="start"`: the root of
  // a field and its label as a child of it - or the legend of its fieldset
  it.each([
    ["Input", <Input key="field" label="Name" />],
    ["NumberInput", <NumberInput key="field" label="Name" />],
    ["Textarea", <Textarea key="field" label="Name" />],
    ["Select", <Select key="field" label="Name" options={options} />],
    [
      "Autocomplete",
      <Autocomplete key="field" label="Name" options={options} />,
    ],
    ["DateTimePicker", <DateTimePicker key="field" label="Name" />],
    [
      "DateTimePicker native",
      <DateTimePicker key="field" label="Name" mode="native" />,
    ],
    ["DateRangePicker", <DateRangePicker key="field" label="Name" />],
    ["TagsInput", <TagsInput key="field" label="Name" />],
    [
      "TreeSelect",
      <TreeSelect items={[{ id: "1", label: "A" }]} key="field" label="Name" />,
    ],
    ["ColorInput", <ColorInput key="field" label="Name" />],
    [
      "Field",
      <Field key="field" label="Name">
        {(props) => <input {...props} />}
      </Field>,
    ],
    [
      "CheckboxGroup",
      <CheckboxGroup key="field" label="Name" options={options} />,
    ],
    ["RadioGroup", <RadioGroup key="field" label="Name" options={options} />],
    [
      "SegmentedControl",
      <SegmentedControl key="field" label="Name" options={options} />,
    ],
    ["Slider", <Slider key="field" label="Name" />],
    ["Rating", <Rating key="field" label="Name" />],
    [
      "FileUpload",
      <FileUpload
        key="field"
        label="Name"
        upload={async (file) => ({ name: file.name, value: file.name })}
      />,
    ],
    ["RichTextEditor", <RichTextEditor key="field" label="Name" />],
    ["PinInput", <PinInput key="field" label="Name" length={4} />],
    [
      "TransferList",
      <TransferList key="field" label="Name" options={options} />,
    ],
    ["DateCalendar", <DateCalendar key="field" label="Name" />],
    ["RangeCalendar", <RangeCalendar key="field" label="Name" />],
  ])("%s marks its root and its label", (_, field) => {
    const { container } = render(field);

    const label = screen
      .getAllByText("Name", { exact: false })[0]
      .closest(".cui-field-label")!;
    expect(label).not.toBeNull();
    const root = container.querySelector(".cui-field")!;
    expect(
      label.parentElement === root ||
        (label.tagName === "LEGEND" &&
          label.parentElement?.parentElement === root),
    ).toBe(true);
  });

  it("leaves the label of a floating field in the field", () => {
    const { container } = render(<Input floating label="Name" />);

    expect(container.querySelector(".cui-field-label")).toBeNull();
  });

  it("lines up checkboxes and switches with the controls", () => {
    const { container } = render(
      <>
        <Checkbox label="VIP" />
        <Switch label="Active" />
      </>,
    );

    expect(
      container.querySelectorAll(".cui-field.cui-field-check"),
    ).toHaveLength(2);
  });

  it("puts the country and the number of PhoneInput beside its label", () => {
    const { container } = render(
      <PhoneInput defaultCountry="CZ" label="Phone" />,
    );

    const root = container.querySelector(".cui-field-phone")!;
    expect(root).toHaveClass("cui-field");
    // The country first, the number - with the label of the field - next
    expect(root.children[1]).toHaveTextContent("Phone");
  });

  it("offsets the label by the size of the field", () => {
    render(
      <>
        <Input dim="sm" label="Small" />
        <Input dim="lg" label="Large" />
      </>,
    );

    expect(screen.getByText("Small", { exact: false })).toHaveClass(
      "[--cui-label-offset:--spacing(0.75)]",
    );
    expect(screen.getByText("Large", { exact: false })).toHaveClass(
      "[--cui-label-offset:--spacing(3.25)]",
    );
  });
});
