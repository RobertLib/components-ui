import { Activity, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import shadowStyles from "./fixture.css?inline";
import {
  Button,
  Calendar,
  Checkbox,
  CheckboxGroup,
  CommandPalette,
  ConfirmDialog,
  ContextMenu,
  DataTable,
  DateTimePicker,
  Dialog,
  Drawer,
  DrawerProvider,
  Dropdown,
  FileUpload,
  Input,
  NumberInput,
  Pagination,
  PinInput,
  Popover,
  RichTextEditor,
  RadioGroup,
  SegmentedControl,
  Select,
  Slider,
  Splitter,
  Switch,
  TagsInput,
  TreeView,
  UIProvider,
  createDataTableQuery,
  useDataTableQuery,
  useDrawer,
  useHotkeys,
  type Column,
  type DropdownEntry,
  type CalendarEvent,
  type DateTimePickerType,
  type UploadedFile,
} from "../../src";

const loadedPickerValues = {
  date: ["2026-02-31", "2026-09-24"],
  "datetime-local": ["2026-09-24T25:99", "2026-09-24T09:30"],
  month: ["2026-13", "2026-09"],
  time: ["25:99", "09:30"],
  week: ["2026-W54", "2026-W39"],
} satisfies Record<DateTimePickerType, [string, string]>;

export function LoadedPickerValueFixture({
  type,
}: {
  type: DateTimePickerType;
}) {
  const [invalid, valid] = loadedPickerValues[type];
  const [value, setValue] = useState(invalid);
  const [submitted, setSubmitted] = useState<string>("");

  return (
    <>
      <Button onClick={() => setValue(valid)}>Load valid value</Button>
      <Button onClick={() => setValue(invalid)}>Load invalid value</Button>
      <form
        aria-label="Loaded picker form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(JSON.stringify([...new FormData(event.currentTarget)]));
        }}
      >
        <DateTimePicker
          label="Required value"
          name="required"
          onChange={(event) => setValue(event.target.value)}
          required
          type={type}
          value={value}
        />
        <DateTimePicker
          label="Optional value"
          name="optional"
          onChange={(event) => setValue(event.target.value)}
          type={type}
          value={value}
        />
        <Button type="submit">Submit loaded values</Button>
      </form>
      <output aria-label="Submitted picker values">{submitted}</output>
    </>
  );
}

function DrawerToggle() {
  const { toggleOpen } = useDrawer();
  return <Button onClick={toggleOpen}>Open drawer</Button>;
}

export function DrawerMenuFixture() {
  return (
    <DrawerProvider storageKey={null}>
      <DrawerToggle />
      <Drawer
        header={
          <Dropdown
            items={[{ label: "Edit" }]}
            trigger={<span>Drawer actions</span>}
          />
        }
        items={[{ href: "/", label: "Home" }]}
      />
    </DrawerProvider>
  );
}

export function ShadowPopoverFixture() {
  const [open, setOpen] = useState(false);
  useHotkeys([["f2", () => setOpen(false), { allowInFields: true }]]);

  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
      trigger={<span>Open shadow panel</span>}
      triggerType="click"
    >
      <div
        ref={(host) => {
          if (!host || host.shadowRoot) return;
          const field = document.createElement("input");
          field.setAttribute("aria-label", "Shadow field");
          host.attachShadow({ mode: "open" }).append(field);
        }}
      />
    </Popover>
  );
}

export function ShadowKeyboardFixture() {
  const [roots, setRoots] = useState<{
    app: HTMLDivElement;
    portal: HTMLDivElement;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const attachShadow = useCallback((host: HTMLDivElement | null) => {
    if (!host || host.shadowRoot) return;
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = shadowStyles;
    const app = document.createElement("div");
    const portal = document.createElement("div");
    shadow.append(style, app, portal);
    setRoots({ app, portal });
  }, []);

  return (
    <>
      <div ref={attachShadow} />
      {roots &&
        createPortal(
          <UIProvider portalContainer={roots.portal}>
            <div className="space-y-4">
              <TreeView
                aria-label="Shadow tree"
                items={[
                  { id: "one", label: "One" },
                  { id: "two", label: "Two" },
                  { id: "three", label: "Three" },
                ]}
              />
              <RichTextEditor
                label="Shadow editor"
                toolbar={["bold", "italic", "underline"]}
              />
              <TagsInput defaultValue={["alpha", "beta"]} label="Shadow tags" />
              <FileUpload
                defaultAttachments={[
                  { id: "a", filename: "a.pdf" },
                  { id: "b", filename: "b.pdf" },
                ]}
                label="Shadow attachments"
                multiple
              />
              <Button onClick={() => setOpen(true)}>
                Open shadow commands
              </Button>
              <CommandPalette
                items={Array.from({ length: 80 }, (_, index) => ({
                  group: "Commands",
                  id: index,
                  label: `Command ${index}`,
                }))}
                onOpenChange={setOpen}
                open={open}
                shortcut={null}
              />
            </div>
          </UIProvider>,
          roots.app,
        )}
    </>
  );
}

export function CalendarKeyboardFixture({ timeline }: { timeline: boolean }) {
  const [date, setDate] = useState(calendarDate(24));
  const [resources, setResources] = useState([
    { id: "a", title: "Room A" },
    { id: "b", title: "Room B" },
  ]);
  const [ranges, setRanges] = useState<string[]>([]);
  useHotkeys([
    ["f2", () => setResources((current) => [...current].reverse())],
    ["f3", () => setDate(calendarDate(25))],
  ]);

  return (
    <>
      <Calendar
        className="h-136"
        currentDate={date}
        dayEndHour={12}
        dayStartHour={9}
        initialView={timeline ? "timelineDay" : "day"}
        nowIndicator={false}
        onSlotDragEnd={(range) =>
          setRanges((current) => [...current, JSON.stringify(range)])
        }
        resources={resources}
        setCurrentDate={setDate}
      />
      <output aria-label="Keyboard slot ranges">{ranges.length}</output>
    </>
  );
}

export function PinCompositionFixture({ controlled }: { controlled: boolean }) {
  const [value, setValue] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);

  return (
    <>
      <form aria-label="Code form">
        <PinInput
          label="Code"
          length={4}
          name="code"
          onChange={(next) => {
            setValue(next);
            setChanges((current) => [...current, next]);
          }}
          onComplete={(next) => setCompleted((current) => [...current, next])}
          value={controlled ? value : undefined}
        />
      </form>
      <output aria-label="Code changes">{JSON.stringify(changes)}</output>
      <output aria-label="Completed codes">{JSON.stringify(completed)}</output>
    </>
  );
}

export function ConfirmCompositionFixture() {
  const [confirmations, setConfirmations] = useState(0);

  return (
    <>
      <ConfirmDialog
        confirmationText="DELETE"
        onClose={() => {}}
        onConfirm={() => setConfirmations((current) => current + 1)}
        open
        title="Delete record?"
      />
      <output aria-label="Confirmed actions">{confirmations}</output>
    </>
  );
}

// The link in the editor's text is no Tab stop of the browser, so the
// dialog's focus trap must not move the focus to it.
export function EditorDialogFixture() {
  return (
    <Dialog onClose={() => {}} open title="Edit note">
      <div className="flex flex-col gap-4">
        <Button>Before editor</Button>
        <RichTextEditor
          defaultValue='<p>See <a href="https://example.com/">the guide</a> first</p>'
          label="Note"
        />
        <Button>After editor</Button>
      </div>
    </Dialog>
  );
}

export function EmptyCheckboxGroupFixture({
  allDisabled,
}: {
  allDisabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [reportedValidity, setReportedValidity] = useState<boolean | null>(
    null,
  );
  const [submissions, setSubmissions] = useState<string[][]>([]);
  const options =
    enabled || allDisabled
      ? [{ label: "Email", value: "email", disabled: !enabled }]
      : [];

  return (
    <>
      <Button
        onClick={() =>
          setReportedValidity(formRef.current?.reportValidity() ?? false)
        }
      >
        Report validity
      </Button>
      <Button onClick={() => formRef.current?.requestSubmit()}>
        Request submit
      </Button>
      <Button onClick={() => setEnabled(true)}>Enable choices</Button>
      <form
        aria-label="Required checkbox group form"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget)
            .getAll("channels")
            .map(String);
          setSubmissions((current) => [...current, values]);
        }}
        ref={formRef}
      >
        <CheckboxGroup
          label="Channels"
          name="channels"
          options={options}
          required
        />
        <Button type="submit">Native submit</Button>
      </form>
      <output aria-label="Reported validity">
        {reportedValidity === null ? "" : String(reportedValidity)}
      </output>
      <output aria-label="Submissions">{JSON.stringify(submissions)}</output>
    </>
  );
}

export function LargePercentNumberFixture() {
  const [changes, setChanges] = useState<(number | null)[]>([]);

  return (
    <>
      <form aria-label="Large percentage form">
        <NumberInput
          defaultValue={1e307}
          formatOptions={{ style: "percent" }}
          label="Percentage"
          name="percentage"
          onChange={(value) => setChanges((current) => [...current, value])}
        />
      </form>
      <Button>Move focus</Button>
      <output aria-label="Percentage changes">{JSON.stringify(changes)}</output>
    </>
  );
}

export function FormValidityActivityFixture({ kind }: { kind: string | null }) {
  const [visible, setVisible] = useState(true);
  const [valid, setValid] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <Button onClick={() => setVisible((current) => !current)}>
        Toggle validated fields
      </Button>
      <Button onClick={() => setValid(true)}>Make hidden field valid</Button>
      <form
        aria-label="Validated activity form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <Activity mode={visible ? "visible" : "hidden"}>
          {kind === "tags" ? (
            <TagsInput
              label="Tags"
              name="tags"
              onChange={() => {}}
              required
              value={valid ? ["Ready"] : []}
            />
          ) : (
            <NumberInput
              label="Amount"
              max={10}
              name="amount"
              onChange={() => {}}
              value={valid ? 10 : 11}
            />
          )}
        </Activity>
        <Button type="submit">Submit validated fields</Button>
      </form>
      <output aria-label="Validated field visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Validated form submitted">{String(submitted)}</output>
    </>
  );
}

export function ChoiceResetActivityFixture({
  controlled,
}: {
  controlled: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [value, setValue] = useState("a");
  const [checked, setChecked] = useState(false);
  const [groupEmpty, setGroupEmpty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const options = [
    { label: "First", value: "a" },
    { label: "Second", value: "b" },
  ];
  const choices = controlled
    ? { value, onChange: () => {} }
    : { defaultValue: value };
  const checks = controlled
    ? { checked, onChange: () => {} }
    : { defaultChecked: checked };
  const groupValue = groupEmpty ? [] : [value];

  return (
    <>
      <Button onClick={() => setVisible((current) => !current)}>
        Toggle choice fields
      </Button>
      <Button
        onClick={() => {
          setValue("b");
          setChecked(true);
          setGroupEmpty(false);
        }}
      >
        Update hidden choices
      </Button>
      <Button onClick={() => setGroupEmpty(true)}>
        Clear hidden checkbox group
      </Button>
      <form
        aria-label="Choice activity form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <Activity mode={visible ? "visible" : "hidden"}>
          <Select label="Select" name="select" options={options} {...choices} />
          <Select
            label="Multiple select"
            multiple
            name="multiple"
            options={options}
            {...(controlled
              ? { value: [value], onChange: () => {} }
              : { defaultValue: [value] })}
          />
          <RadioGroup
            label="Radios"
            name="radios"
            options={options}
            {...choices}
          />
          <SegmentedControl
            label="Segments"
            name="segments"
            options={options}
            {...choices}
          />
          <Checkbox label="Checkbox" name="checkbox" value="yes" {...checks} />
          <Switch label="Switch" name="switch" value="yes" {...checks} />
          <CheckboxGroup
            label="Checkbox choices"
            name="checks"
            options={options}
            required
            {...(controlled
              ? { value: groupValue, onChange: () => {} }
              : { defaultValue: groupValue })}
          />
        </Activity>
        <Button type="reset">Reset hidden choices</Button>
        <Button type="submit">Submit hidden choices</Button>
      </form>
      <output aria-label="Choice field visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Choice form submitted">{String(submitted)}</output>
    </>
  );
}

export function EditorResetActivityFixture({
  controlled = false,
}: {
  controlled?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [value, setValue] = useState("<p>Shot</p>");
  const [aborted, setAborted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const finishUpload = useRef<(() => void) | null>(null);

  return (
    <>
      <Button onClick={() => setVisible((current) => !current)}>
        Toggle editor
      </Button>
      <Button onClick={() => setValue("<p>Replacement</p>")}>
        Replace hidden editor
      </Button>
      <form
        aria-label="Editor activity form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <Activity mode={visible ? "visible" : "hidden"}>
          <RichTextEditor
            defaultValue="<p>Shot</p>"
            label="Note"
            name="note"
            onChange={setValue}
            toolbar={["image"]}
            value={controlled ? value : undefined}
            uploadImage={(_file, { signal }) =>
              new Promise<string>((resolve) => {
                signal.addEventListener("abort", () => setAborted(true), {
                  once: true,
                });
                finishUpload.current = () => resolve("/late.png");
              })
            }
          />
        </Activity>
        <Button type="reset">Reset hidden editor</Button>
        <Button type="submit">Submit editor</Button>
      </form>
      <Button onClick={() => finishUpload.current?.()}>
        Finish editor upload
      </Button>
      <output aria-label="Editor visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Editor upload aborted">{String(aborted)}</output>
      <output aria-label="Editor form submitted">{String(submitted)}</output>
    </>
  );
}

export function FormResetActivityFixture() {
  const [visible, setVisible] = useState(true);
  const [aborted, setAborted] = useState(false);
  const [completed, setCompleted] = useState(0);
  const finishUpload = useRef<(() => void) | null>(null);

  return (
    <>
      <Button onClick={() => setVisible((current) => !current)}>
        Toggle form fields
      </Button>
      <form aria-label="Reset activity form">
        <Activity mode={visible ? "visible" : "hidden"}>
          <Input defaultValue="Initial" label="Title" name="title" />
          <TagsInput defaultValue={["Initial"]} label="Tags" name="tags" />
          <FileUpload
            defaultAttachments={[
              { filename: "initial.txt", value: "initial-file" },
            ]}
            label="Attachments"
            multiple
            name="attachments"
            onUpload={() => setCompleted((current) => current + 1)}
            upload={(file, { signal }) =>
              new Promise<UploadedFile>((resolve) => {
                signal.addEventListener("abort", () => setAborted(true), {
                  once: true,
                });
                // Deliberately finish even after cancellation: the field
                // must ignore a result that no longer belongs to the form.
                finishUpload.current = () =>
                  resolve({ filename: file.name, value: "new-file" });
              })
            }
          />
        </Activity>
        <Button type="reset">Reset hidden fields</Button>
      </form>
      <Button onClick={() => finishUpload.current?.()}>
        Finish pending upload
      </Button>
      <output aria-label="Form field visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Upload aborted">{String(aborted)}</output>
      <output aria-label="Completed uploads">{completed}</output>
    </>
  );
}

export function UploadActivityFixture() {
  const [visible, setVisible] = useState(true);
  const [stored, setStored] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const finishes = useRef<(() => void)[]>([]);

  return (
    <>
      <form
        aria-label="Background upload form"
        id="background-upload-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <Button type="submit">Submit uploaded files</Button>
      </form>
      <Activity mode={visible ? "visible" : "hidden"}>
        <FileUpload
          concurrency={2}
          form="background-upload-form"
          label="Background attachments"
          multiple
          name="attachments"
          // Each committed callback must see the latest consumer state,
          // including while Activity keeps the field hidden.
          onUpload={(result) => setStored([...stored, String(result.value)])}
          required
          upload={(file) =>
            new Promise<UploadedFile>((resolve) => {
              finishes.current.push(() =>
                resolve({ filename: file.name, value: file.name }),
              );
            })
          }
        />
      </Activity>
      <Button onClick={() => setVisible((current) => !current)}>
        Toggle upload fields
      </Button>
      <Button onClick={() => finishes.current[0]?.()}>
        Finish first upload
      </Button>
      <Button onClick={() => finishes.current[1]?.()}>
        Finish second upload
      </Button>
      <Button onClick={() => finishes.current.forEach((finish) => finish())}>
        Finish all uploads
      </Button>
      <output aria-label="Upload field visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Stored upload results">{stored.join(",")}</output>
      <output aria-label="Upload form submitted">{String(submitted)}</output>
    </>
  );
}

const calendarDate = (day: number, hour = 0) => new Date(2026, 8, day, hour);
const calendarEvents: CalendarEvent[] = [
  {
    id: "review",
    title: "Review",
    start: calendarDate(24, 9),
    end: calendarDate(24, 10),
  },
  {
    id: "other",
    title: "Other",
    start: calendarDate(24, 12),
    end: calendarDate(24, 13),
  },
];

export function SplitterDragFixture() {
  const [sizes, setSizes] = useState([30, 70]);
  const [min, setMin] = useState(0);
  const [changes, setChanges] = useState(0);
  useHotkeys([
    [
      "f2",
      () => {
        setMin(60);
        setSizes([60, 40]);
      },
    ],
  ]);

  return (
    <>
      <Splitter
        className="mt-8 h-60"
        data-testid="splitter-control"
        minSizes={[min, 0]}
        onPointerDown={(event) => {
          event.currentTarget.dataset.pointerId = String(event.pointerId);
        }}
        onSizesChange={(next) => {
          setSizes(next);
          setChanges((current) => current + 1);
        }}
        sizes={sizes}
        stackOnMobile={false}
      >
        <div>List</div>
        <div>Detail</div>
      </Splitter>
      <output aria-label="Splitter sizes">{JSON.stringify(sizes)}</output>
      <output aria-label="Splitter changes">{changes}</output>
    </>
  );
}

const filterActivityRows = [
  { id: 1, name: "Original" },
  { id: 2, name: "External" },
];
const filterActivityColumns: Column<(typeof filterActivityRows)[number]>[] = [
  { filter: "input", key: "name", label: "Name" },
];

export function FilterActivityFixture() {
  const [visible, setVisible] = useState(true);
  const [query, setQuery] = useState(() =>
    createDataTableQuery({ filters: { name: "Original" } }),
  );
  useHotkeys([
    ["f4", () => setVisible((current) => !current), { allowInFields: true }],
    [
      "f3",
      () => setQuery(createDataTableQuery({ filters: { name: "External" } })),
    ],
  ]);

  return (
    <>
      <Activity mode={visible ? "visible" : "hidden"}>
        <DataTable
          clientSide
          columns={filterActivityColumns}
          data={filterActivityRows}
          onQueryChange={setQuery}
          query={query}
        />
      </Activity>
      <output aria-label="Filter visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Committed filter">
        {String(query.filters.name ?? "")}
      </output>
    </>
  );
}

export function SliderDragFixture() {
  const [max, setMax] = useState(100);
  const [readOnly, setReadOnly] = useState(false);
  const [visible, setVisible] = useState(true);
  const [value, setValue] = useState(50);
  const [changes, setChanges] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  useHotkeys([
    ["f2", () => setMax((current) => (current === 100 ? 20 : 100))],
    ["f3", () => setReadOnly((current) => !current)],
    ["f4", () => setVisible((current) => !current)],
  ]);

  return (
    <>
      <Activity mode={visible ? "visible" : "hidden"}>
        <Slider
          aria-label="Volume"
          className="mt-8"
          data-testid="slider-control"
          max={max}
          onChange={(next) => {
            setValue(next);
            setChanges((current) => current + 1);
          }}
          onChangeEnd={(next) => setCompleted((current) => [...current, next])}
          onPointerDown={(event) => {
            event.currentTarget.dataset.pointerId = String(event.pointerId);
          }}
          readOnly={readOnly}
          value={value}
        />
      </Activity>
      <output aria-label="Slider visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Slider changes">{changes}</output>
      <output aria-label="Completed slider values">
        {completed.join(",")}
      </output>
    </>
  );
}

export function CalendarMoveFixture() {
  const [events, setEvents] = useState(calendarEvents);
  const [maxDate, setMaxDate] = useState(calendarDate(30));
  const [visible, setVisible] = useState(true);
  const [moves, setMoves] = useState(0);
  const [opened, setOpened] = useState("");
  // Change the consumer's state while the pointer remains pressed, as a
  // response from the server or a page hidden by Activity would do.
  useHotkeys([
    ["f2", () => setMaxDate(calendarDate(24))],
    [
      "f3",
      () =>
        setEvents((current) =>
          current.filter((event) => event.id !== "review"),
        ),
    ],
    ["f4", () => setVisible((current) => !current)],
  ]);

  return (
    <>
      <Activity mode={visible ? "visible" : "hidden"}>
        <Calendar
          className="h-136"
          events={events}
          initialDate={calendarDate(24)}
          maxDate={maxDate}
          onEventClick={(event) => setOpened(event.id)}
          onEventDrop={() => setMoves((current) => current + 1)}
          renderEvent={(event, context) => (
            <span
              data-moving={String(context.dragging)}
              data-testid={`${event.id}-preview`}
            >
              {event.title}
            </span>
          )}
        />
      </Activity>
      <output aria-label="Calendar visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Committed moves">{moves}</output>
      <output aria-label="Opened event">{opened}</output>
    </>
  );
}

export function CalendarSlotFixture() {
  const [date, setDate] = useState(calendarDate(24));
  const [minDate, setMinDate] = useState(calendarDate(24));
  const [visible, setVisible] = useState(true);
  const [ranges, setRanges] = useState<string[]>([]);
  useHotkeys([
    ["f2", () => setMinDate(calendarDate(25))],
    ["f3", () => setDate(calendarDate(25))],
    ["f4", () => setVisible((current) => !current)],
  ]);

  return (
    <>
      <div
        data-testid="calendar-slots"
        onPointerDown={(event) => {
          event.currentTarget.dataset.pointerId = String(event.pointerId);
        }}
      >
        <Activity mode={visible ? "visible" : "hidden"}>
          <Calendar
            className="h-136"
            currentDate={date}
            dayEndHour={12}
            initialView="day"
            minDate={minDate}
            nowIndicator={false}
            onSlotDragEnd={(range) =>
              setRanges((current) => [...current, range.start.toISOString()])
            }
            setCurrentDate={setDate}
            dayStartHour={9}
          />
        </Activity>
      </div>
      <output aria-label="Slot calendar visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Selected slot ranges">{ranges.length}</output>
    </>
  );
}

// Keep the dialog inside the custom menu item: its portal events still
// bubble through the menu's React ancestors.
function DialogMenuItem() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit record</Button>
      <Dialog onClose={() => setOpen(false)} open={open} title="Edit record">
        <div className="flex flex-col gap-4">
          <Input defaultValue="Adam" label="Name" />
          <Button>Save record</Button>
        </div>
      </Dialog>
    </>
  );
}

export function MenuFixture({ kind }: { kind: string | null }) {
  const items = [<DialogMenuItem key="edit" />];

  return kind === "context" ? (
    <ContextMenu aria-label="Record actions" items={items}>
      <button type="button">Record actions</button>
    </ContextMenu>
  ) : (
    <Dropdown items={items} trigger={<span>Record actions</span>} />
  );
}

export function UpdatingMenuFixture({ kind }: { kind: string | null }) {
  const [showSubmenu, setShowSubmenu] = useState(true);
  const [picked, setPicked] = useState("");
  const items: DropdownEntry[] = [
    showSubmenu && {
      label: "More actions",
      items: [{ label: "Nested action" }],
    },
    { label: "Keep record", onClick: () => setPicked("Keep record") },
    { label: "Archive record", onClick: () => setPicked("Archive record") },
  ];

  return (
    <div
      onKeyDownCapture={(event) => {
        // Update the items while focus remains in the portaled submenu,
        // as when a server response changes the available actions.
        if (event.key === "F2") {
          event.preventDefault();
          setShowSubmenu(false);
        }
      }}
    >
      {kind === "context" ? (
        <ContextMenu aria-label="Dynamic actions" items={items}>
          <button type="button">Dynamic actions</button>
        </ContextMenu>
      ) : (
        <Dropdown items={items} trigger={<span>Dynamic actions</span>} />
      )}
      <output aria-label="Picked action">{picked}</output>
    </div>
  );
}

interface Row {
  id: number;
  name: string;
}

const columns: Column<Row>[] = [{ editable: true, key: "name", label: "Name" }];

const resizeRows: Row[] = [{ id: 1, name: "Adam" }];
const resizeColumns: Column<Row>[] = [
  { key: "name", label: "Name", width: 200 },
];

export function TableResizeFixture() {
  const [resizable, setResizable] = useState(true);
  const [visible, setVisible] = useState(true);
  useHotkeys([
    ["f2", () => setResizable((current) => !current)],
    ["f3", () => setVisible((current) => !current)],
  ]);

  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      <DataTable
        columns={resizeColumns}
        data={resizeRows}
        data-testid="resizing-table"
        onPointerDownCapture={(event) => {
          event.currentTarget.dataset.pointerId = String(event.pointerId);
        }}
        resizableColumns={resizable}
      />
    </Activity>
  );
}

export function TableFixture() {
  const [data, setData] = useState<Row[]>([{ id: 1, name: "Adam" }]);
  const [saving, setSaving] = useState(false);
  const rejectSave = useRef<(() => void) | null>(null);

  return (
    <>
      <DataTable
        clientSide
        columns={columns}
        data={data}
        enableCsvExport
        exportFilename="people"
        onCellEdit={(row, key, value) => {
          // Model a consumer that updates its cache optimistically. The
          // table must show and export its restored value after rejection,
          // even before the consumer refetches its rows.
          setData((current) =>
            current.map((item) =>
              item.id === row.id ? { ...item, [key]: value } : item,
            ),
          );
          setSaving(true);
          return new Promise<void>((_resolve, reject) => {
            rejectSave.current = () => {
              rejectSave.current = null;
              setSaving(false);
              reject(new Error("The name is taken."));
            };
          });
        }}
      />
      <Button disabled={!saving} onClick={() => rejectSave.current?.()}>
        Reject pending save
      </Button>
      <output aria-label="Consumer row">{data[0].name}</output>
    </>
  );
}

const cursorColumns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name" },
];
const originalPageInfo = {
  endCursor: "old-page-end",
  hasNextPage: true,
  hasPreviousPage: true,
  startCursor: "old-page-start",
};
const filteredPageInfo = {
  endCursor: "filtered-page-end",
  hasNextPage: true,
  hasPreviousPage: false,
  startCursor: "filtered-page-start",
};

export function CursorPaginationFixture() {
  const [firstPage, setFirstPage] = useState(false);
  const [requests, setRequests] = useState<string[]>([]);

  return (
    <>
      <Pagination
        currentPage={firstPage ? 1 : 3}
        onChange={(direction, cursor) =>
          setRequests((current) => [
            ...current,
            cursor === undefined ? direction : `${direction}:${cursor}`,
          ])
        }
        pageInfo={firstPage ? filteredPageInfo : originalPageInfo}
      />
      <Button onClick={() => setFirstPage(true)}>Finish first page load</Button>
      <output aria-label="Cursor page requests">{requests.join(",")}</output>
    </>
  );
}

function CursorTable({ filtered }: { filtered: boolean }) {
  const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });

  return (
    <DataTable
      columns={cursorColumns}
      data={[{ id: 1, name: filtered ? "Eva" : "Adam" }]}
      onQueryChange={setQuery}
      pageInfo={filtered ? filteredPageInfo : originalPageInfo}
      query={query}
      total={100}
    />
  );
}

export function CursorRouterFixture() {
  const [search, setSearch] = useState("?page=2&after=old-page-start");
  const [requests, setRequests] = useState<string[]>([]);
  const [filtered, setFiltered] = useState(false);

  return (
    <UIProvider
      router={{
        navigate: (href) => setRequests((current) => [...current, href]),
        pathname: "/people",
        search,
      }}
    >
      <CursorTable filtered={filtered} />
      <Button
        disabled={requests.length === 0}
        onClick={() => {
          const href = requests.at(-1);
          if (!href) return;
          // The router and its loader publish the new query and response
          // together; before this, the table still has the old pageInfo.
          setSearch(new URL(href, window.location.origin).search);
          setFiltered(true);
        }}
      >
        Finish navigation
      </Button>
      <ol aria-label="Requested navigations">
        {requests.map((href, index) => (
          <li key={index}>{href}</li>
        ))}
      </ol>
    </UIProvider>
  );
}
