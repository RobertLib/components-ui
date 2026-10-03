import { useState } from "react";
import {
  Button,
  Chart,
  ColorInput,
  DataTable,
  Input,
  Menubar,
  PhoneInput,
  RepeatableField,
  RichTextEditor,
  Stepper,
  FileUpload,
} from "../../src";

export function InputValidationFixture() {
  const [phone, setPhone] = useState("+420777123456");
  const [saved, setSaved] = useState("");
  return (
    <form
      aria-label="Input validation"
      className="mx-auto max-w-xl space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(
          JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
        );
      }}
    >
      <PhoneInput
        countries={[
          { code: "CZ", callingCode: "420" },
          { code: "SK", callingCode: "421" },
        ]}
        label="Controlled phone"
        name="phone"
        value={phone}
      />
      <Button
        onClick={() =>
          setPhone((current) =>
            current.startsWith("+420") ? "+421905123456" : "+420777123456",
          )
        }
      >
        Replace phone
      </Button>
      <ColorInput defaultValue="#ff0000" label="Color" name="color" />
      <Button type="submit">Save values</Button>
      <output aria-label="Saved values">{saved}</output>
    </form>
  );
}

export function PrefilledInputsFixture({
  controlled,
}: {
  controlled: boolean;
}) {
  const [color, setColor] = useState("#ff000080");
  const [alpha, setAlpha] = useState(false);
  const [saved, setSaved] = useState("");
  const [submissions, setSubmissions] = useState(0);
  const valueProp = controlled ? "value" : "defaultValue";
  return (
    <form
      aria-label="Prefilled inputs"
      className="mx-auto max-w-xl space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(
          JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
        );
        setSubmissions((count) => count + 1);
      }}
    >
      <PhoneInput
        {...{ [valueProp]: "00 (421) 905 123 456" }}
        countries={[
          { code: "CZ", callingCode: "420" },
          { code: "SK", callingCode: "421" },
        ]}
        defaultCountry="CZ"
        label="Phone"
        name="phone"
      />
      <ColorInput
        {...{ [valueProp]: color }}
        alpha={alpha}
        format="rgb"
        label="Color"
        name="color"
        required
      />
      <Button onClick={() => setColor("hsl(1e308turn 100% 50%)")}>
        Load invalid color
      </Button>
      <Button onClick={() => setColor("   ")}>Load empty color</Button>
      <Button onClick={() => setColor("#ff000080")}>Load valid color</Button>
      <Button onClick={() => setAlpha((current) => !current)}>
        Toggle alpha
      </Button>
      <Button type="submit">Save values</Button>
      <output aria-label="Saved values">{saved}</output>
      <output aria-label="Submissions">{submissions}</output>
    </form>
  );
}

const people = Array.from({ length: 300 }, (_, id) => ({
  id,
  name: `Person ${id}`,
  team: `Team ${Math.floor(id / 30)}`,
  city: id % 2 ? "Prague" : "Brno",
  amount: 10,
}));
export default function FeatureExpansion() {
  const [step, setStep] = useState<string | number>("details");
  const [saved, setSaved] = useState("");
  const [command, setCommand] = useState("");
  const [paths, setPaths] = useState("");
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <Menubar
        aria-label="App commands"
        menus={[
          {
            id: "file",
            label: "File",
            items: [
              { label: "New", onClick: () => setCommand("new") },
              {
                label: "Export",
                items: [{ label: "PDF", onClick: () => setCommand("pdf") }],
              },
            ],
          },
          {
            id: "edit",
            label: "Edit",
            items: [{ label: "Copy", onClick: () => setCommand("copy") }],
          },
        ]}
      />
      <output aria-label="Command">{command}</output>
      <form
        aria-label="Profile"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(
            JSON.stringify(
              Object.fromEntries(new FormData(event.currentTarget)),
            ),
          );
        }}
      >
        <PhoneInput
          defaultCountry="CZ"
          defaultValue="+420777123456"
          label="Phone"
          name="phone"
          required
          countries={[
            { code: "CZ", callingCode: "420" },
            { code: "SK", callingCode: "421" },
          ]}
        />
        <RepeatableField
          createItem={() => ""}
          defaultValue={[{ id: "first", value: "Eva" }]}
          label="Contacts"
          name="contacts"
          max={3}
          min={1}
          renderItem={(item) => (
            <Input
              label={`Contact ${item.index + 1}`}
              name={`${item.name}.name`}
              value={item.value}
              onChange={(event) => item.onChange(event.target.value)}
              disabled={item.disabled}
              readOnly={item.readOnly}
            />
          )}
        />
        <Stepper
          keepMounted
          orientation="responsive"
          currentStepId={step}
          onStepClick={setStep}
          steps={[
            {
              id: "details",
              title: "Details",
              content: (
                <Input label="Name" name="name" defaultValue="Adam" required />
              ),
            },
            {
              id: "file",
              title: "Documents",
              content: <Input label="Document" name="document" type="file" />,
            },
            {
              id: "review",
              title: "Review",
              content: <p>Check the values.</p>,
            },
          ]}
        />
        <div className="flex gap-2">
          <Button type="submit">Save profile</Button>
          <Button type="reset" variant="outline">
            Reset profile
          </Button>
        </div>
      </form>
      <output aria-label="Saved profile">{saved}</output>
      <RichTextEditor
        label="Message"
        name="message"
        toolbar={["bold", "undo", "redo"]}
        additionalFormats={["italic"]}
        defaultValue="<p>Hello</p>"
        customTools={[
          {
            id: "signature",
            label: "Insert signature",
            onClick: (context) =>
              context.insertHtml(
                "<p><em>Support</em><script>bad()</script></p>",
              ),
          },
          {
            id: "text",
            label: "Insert text",
            shortcut: "Ctrl+Shift+S",
            onClick: (context) => context.insertText("!"),
          },
        ]}
        maxLength={50}
      />
      <DataTable
        aria-label="Grouped people"
        data={people}
        columns={[
          { key: "name", label: "Person" },
          { key: "team", label: "Team" },
          { key: "city", label: "City" },
          { key: "amount", label: "Amount", summary: "sum" },
        ]}
        groupBy={["team", "city"]}
        virtualized
        maxHeight="250px"
        pagination={false}
      />
      <Chart
        title="Market share"
        type="donut"
        data={[
          { label: "Small", count: 10 },
          { label: "Large", count: 20 },
        ]}
        series={[{ key: "count", label: "Count" }]}
      />
      <form
        aria-label="Folder upload"
        onSubmit={(event) => {
          event.preventDefault();
          setPaths(
            new FormData(event.currentTarget)
              .getAll("files")
              .map((file) =>
                typeof file === "string"
                  ? file
                  : file.webkitRelativePath || file.name,
              )
              .join(","),
          );
        }}
      >
        <FileUpload directory multiple label="Folder" name="files" />
        <Button type="submit">Save folder</Button>
        <Button type="reset">Reset folder</Button>
      </form>
      <output aria-label="Folder paths">{paths}</output>
    </div>
  );
}
