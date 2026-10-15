import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Autocomplete from "./autocomplete";
import Checkbox from "./checkbox";
import CommentThread from "./comment-thread";
import CheckboxGroup from "./checkbox-group";
import ColorInput from "./color-input";
import DateCalendar from "./date-calendar";
import DateRangePicker from "./date-range-picker";
import DataTable from "./data-table";
import DateTimePicker from "./datetime-picker";
import Dialog from "./dialog";
import DurationInput from "./duration-input";
import Field from "./field";
import FileUpload from "./file-upload";
import FormGrid from "./form-grid";
import FormSection from "./form-section";
import Input from "./input";
import MentionInput from "./mention-input";
import NumberInput from "./number-input";
import PhoneInput from "./phone-input";
import PinInput from "./pin-input";
import Popover from "./popover";
import RadioGroup from "./radio-group";
import RangeCalendar from "./range-calendar";
import Rating from "./rating";
import RepeatableField from "./repeatable-field";
import RichTextEditor from "./rich-text-editor";
import SegmentedControl from "./segmented-control";
import Select from "./select";
import Slider from "./slider";
import Switch from "./switch";
import TagsInput from "./tags-input";
import Textarea from "./textarea";
import TransferList from "./transfer-list";
import TreeSelect from "./tree-select";

const cities = [
  { label: "Praha", value: "praha" },
  { label: "Brno", value: "brno" },
];

/** A record of a company - every field of the library, all named. */
function CompanyFields() {
  return (
    <>
      <Input defaultValue="Acme s.r.o." label="Company" name="company" />
      <Textarea defaultValue="Key account" label="Note" name="note" />
      <Select defaultValue="brno" label="City" name="city" options={cities} />
      <NumberInput defaultValue={1250} label="Price" name="price" />
      <Autocomplete
        defaultValue="praha"
        label="Branch"
        name="branch"
        options={cities}
      />
      <DateTimePicker defaultValue="2026-10-15" label="Signed" name="signed" />
      <DateTimePicker
        defaultValue="2026-11-15"
        label="Due"
        mode="native"
        name="due"
      />
      <DateRangePicker
        defaultValue={{ end: "2026-12-31", start: "2026-10-01" }}
        label="Period"
        name="period"
      />
      <DateTimePicker
        defaultValue="2026-Q4"
        label="Quarter"
        name="quarter"
        type="quarter"
      />
      <DurationInput defaultValue={90} label="Duration" name="duration" />
      <NumberInput
        defaultValue="1234.50"
        formatOptions={{ minimumFractionDigits: 2 }}
        label="Amount"
        name="amount"
        stringMode
      />
      <TagsInput defaultValue={["vip", "b2b"]} label="Tags" name="tags" />
      <MentionInput
        defaultValue="@[Jana Nováková](user:42) checks it"
        label="Remark"
        name="remark"
      />
      <TreeSelect
        defaultValue="2"
        items={[
          { children: [{ id: "2", label: "Retail" }], id: "1", label: "Trade" },
        ]}
        label="Segment"
        name="segment"
      />
      <PhoneInput
        defaultCountry="CZ"
        defaultValue="+420777123456"
        label="Phone"
        name="phone"
      />
      <ColorInput defaultValue="#1e90ff" label="Color" name="color" />
      <Field label="Company ID">
        {(controlProps) => (
          <input {...controlProps} defaultValue="27082440" name="companyId" />
        )}
      </Field>
      <CheckboxGroup
        defaultValue={["brno"]}
        label="Offices"
        name="offices"
        options={cities}
      />
      <RadioGroup
        defaultValue="praha"
        label="Seat"
        name="seat"
        options={cities}
      />
      <SegmentedControl
        defaultValue="brno"
        label="Region"
        name="region"
        options={cities}
      />
      <Slider defaultValue={30} label="Discount" name="discount" />
      <Rating defaultValue={4} label="Rating" name="rating" />
      <FileUpload
        label="Contracts"
        name="contracts"
        upload={async (file) => ({ name: file.name, value: file.name })}
      />
      <RichTextEditor
        defaultValue="<p>Pays on time</p>"
        label="Notes"
        name="notes"
      />
      <PinInput defaultValue="1234" label="PIN" length={4} name="pin" />
      <TransferList
        defaultValue={["brno"]}
        label="Branches"
        name="branches"
        options={cities}
      />
      <Switch defaultChecked label="Active" name="active" />
      <Checkbox defaultChecked label="VIP" name="vip" />
      <DateCalendar defaultValue="2026-10-20" label="Visit" name="visit" />
      <RangeCalendar
        defaultValue={{ end: "2026-10-23", start: "2026-10-21" }}
        label="Stay"
        name="stay"
      />
      <RepeatableField
        createItem={() => ""}
        defaultValue={[{ id: "jana", value: "Jana" }]}
        label="Contacts"
        name="contacts"
        renderItem={(item) => (
          <Input
            defaultValue={item.value}
            label="Contact"
            name={`${item.name}.name`}
          />
        )}
      />
    </>
  );
}

const labelled = (name: string) => screen.getByLabelText(`${name}:`);

describe("A read-only FormSection", () => {
  it("makes every field read-only, as its own readOnly does", () => {
    render(
      <form>
        <FormSection readOnly title="Company">
          <CompanyFields />
        </FormSection>
      </form>,
    );

    // The native fields - read-only inputs
    for (const name of [
      "Company",
      "Note",
      "Price",
      "Signed",
      "Due",
      "Remark",
      "Period",
      "Quarter",
      "Duration",
      "Amount",
      "Phone",
      "Color",
      "Company ID",
    ]) {
      expect(labelled(name), name).toHaveAttribute("readonly");
    }
    // The fields with a role - `aria-readonly`
    for (const element of [
      screen.getByRole("combobox", { name: "City:" }),
      screen.getByRole("combobox", { name: "Branch:" }),
      screen.getByRole("combobox", { name: "Segment:" }),
      labelled("Tags"),
      screen.getByRole("radiogroup", { name: "Seat:" }),
      screen.getByRole("radiogroup", { name: "Region:" }),
      screen.getByRole("slider", { name: "Rating:" }),
      screen.getByRole("switch", { name: "Active" }),
      screen.getByRole("checkbox", { name: "VIP" }),
      screen.getByRole("textbox", { name: "Notes:" }),
    ]) {
      expect(element).toHaveAttribute("aria-readonly", "true");
    }
    // And the groups that tell it by `data-readonly`
    for (const element of [
      screen.getByRole("group", { name: "Offices:" }),
      screen.getByRole("group", { name: "Contracts:" }),
      screen.getByRole("group", { name: "Branches" }),
      screen.getByRole("slider", { name: "Discount:" }),
      screen.getByRole("group", { name: "PIN:" }),
    ]) {
      expect(element).toHaveAttribute("data-readonly");
    }
    for (const label of ["Visit:", "Stay:"]) {
      expect(
        screen
          .getByText(label)
          .closest(".cui-field")!
          .querySelector("[data-readonly]"),
        label,
      ).not.toBeNull();
    }
    // Nothing to add or remove with
    expect(
      screen.queryByRole("button", { name: "Add item" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove item 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add checked items" }),
    ).toBeDisabled();
    // The fields inside the groups of a RepeatableField too
    expect(labelled("Contact")).toHaveAttribute("readonly");
  });

  it("submits the values", () => {
    render(
      <form data-testid="form">
        <FormSection readOnly title="Company">
          <CompanyFields />
        </FormSection>
      </form>,
    );

    const data = new FormData(screen.getByTestId<HTMLFormElement>("form"));
    expect(Object.fromEntries(data)).toMatchObject({
      active: "on",
      branch: "praha",
      city: "brno",
      color: "#1e90ff",
      companyId: "27082440",
      company: "Acme s.r.o.",
      amount: "1234.50",
      discount: "30",
      due: "2026-11-15",
      duration: "90",
      note: "Key account",
      notes: "<p>Pays on time</p>",
      phone: "+420777123456",
      pin: "1234",
      price: "1250",
      quarter: "2026-Q4",
      rating: "4",
      region: "brno",
      remark: "@[Jana Nováková](user:42) checks it",
      seat: "praha",
      segment: "2",
      signed: "2026-10-15",
      visit: "2026-10-20",
      vip: "on",
    });
    expect(data.getAll("tags")).toEqual(["vip", "b2b"]);
    expect(data.getAll("offices")).toEqual(["brno"]);
    expect(data.getAll("branches")).toEqual(["brno"]);
  });

  it("takes no changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FormSection readOnly title="Company">
        <Input defaultValue="Acme" label="Company" onChange={onChange} />
        <Checkbox defaultChecked label="VIP" onChange={onChange} />
      </FormSection>,
    );

    await user.type(labelled("Company"), " a.s.");
    await user.click(screen.getByRole("checkbox", { name: "VIP" }));

    expect(labelled("Company")).toHaveValue("Acme");
    expect(screen.getByRole("checkbox", { name: "VIP" })).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves a field with readOnly={false} editable", () => {
    render(
      <FormSection readOnly title="Order">
        <Input label="Number" name="number" />
        <Input label="Comment" name="comment" readOnly={false} />
        <FormGrid readOnly={false}>
          <Select label="State" name="state" options={cities} />
        </FormGrid>
      </FormSection>,
    );

    expect(labelled("Number")).toHaveAttribute("readonly");
    expect(labelled("Comment")).not.toHaveAttribute("readonly");
    expect(
      screen.getByRole("combobox", { name: "State:" }),
    ).not.toHaveAttribute("aria-readonly");
  });

  it("is editable again when the section is", () => {
    const { rerender } = render(
      <FormSection readOnly title="Order">
        <Input defaultValue="Acme" label="Company" />
      </FormSection>,
    );
    const input = labelled("Company");
    rerender(
      <FormSection readOnly={false} title="Order">
        <Input defaultValue="Acme" label="Company" />
      </FormSection>,
    );

    // The same field - no remount
    expect(labelled("Company")).toBe(input);
    expect(input).not.toHaveAttribute("readonly");
  });

  it("leaves the fields of dialogs and popovers opened inside alone", () => {
    render(
      <FormSection readOnly title="Order">
        <Dialog onClose={() => {}} open title="Note">
          <Input label="Dialog note" />
        </Dialog>
        <Popover open trigger={<span>Filter</span>}>
          <Input label="Popover note" />
        </Popover>
      </FormSection>,
    );

    expect(labelled("Dialog note")).not.toHaveAttribute("readonly");
    expect(labelled("Popover note")).not.toHaveAttribute("readonly");
  });

  it("leaves the filters of a DataTable inside editable", () => {
    render(
      <FormSection readOnly title="Orders">
        <DataTable
          clientSide
          columns={[
            { filter: "input", key: "name", label: "Name" },
            { filter: "boolean", key: "paid", label: "Paid" },
          ]}
          data={[{ id: 1, name: "Acme", paid: true }]}
          enableGlobalSearch
        />
      </FormSection>,
    );

    for (const name of ["Name", "Paid"]) {
      const field = screen
        .getAllByLabelText(new RegExp(name))
        .find((element) => element.matches("input, select"))!;
      expect(field, name).not.toHaveAttribute("readonly");
      expect(field, name).not.toHaveAttribute("aria-readonly", "true");
    }
  });

  it("leaves the composer of a CommentThread inside editable", () => {
    render(
      <FormSection readOnly title="Invoice">
        <CommentThread
          comments={[]}
          currentUser={{ id: "jana", name: "Jana" }}
          onSubmit={async () => {}}
        />
      </FormSection>,
    );

    expect(
      screen.getByRole("textbox", { name: "New comment" }),
    ).not.toHaveAttribute("readonly");
  });

  it("leaves the actions of the section usable", () => {
    render(
      <FormSection
        actions={<Input aria-label="Search" />}
        readOnly
        title="Order"
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).not.toHaveAttribute(
      "readonly",
    );
  });

  it("renders read-only on the server", () => {
    const html = renderToString(
      <FormSection readOnly title="Order">
        <Input defaultValue="Acme" label="Company" name="company" />
        <Checkbox label="VIP" name="vip" />
      </FormSection>,
    );

    expect(html).toMatch(/<input(?=[^>]*name="company")[^>]*readOnly=""/);
    expect(html).toMatch(/<input(?=[^>]*name="vip")[^>]*aria-readonly="true"/);
  });

  it("is read by a FormGrid too", () => {
    render(
      <FormGrid readOnly>
        <Input label="Company" />
      </FormGrid>,
    );

    expect(within(document.body).getByLabelText("Company:")).toHaveAttribute(
      "readonly",
    );
  });
});
