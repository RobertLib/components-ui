// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as ui from "./index";

// The server rendering of the whole public API, the way a Next.js or Remix
// server does it: without `window`, `document` or `DOMParser` - the tests of
// the hydration run in jsdom, where code reaching for them would still pass.

const noop = () => {};
const options = [
  { label: "Praha", value: "praha" },
  { label: "Brno", value: "brno" },
];
const start = new Date(2026, 8, 24, 9);
const end = new Date(2026, 8, 24, 10);

/** Each exported component with the props that take its special paths. */
const fixtures: Record<string, () => React.ReactElement> = {
  Accordion: () => <ui.Accordion title="Details">Content</ui.Accordion>,
  AccordionGroup: () => (
    <ui.AccordionGroup>
      <ui.Accordion title="First">One</ui.Accordion>
      <ui.Accordion title="Second">Two</ui.Accordion>
    </ui.AccordionGroup>
  ),
  Alert: () => (
    <ui.Alert title="Heads up" type="warning">
      Text
    </ui.Alert>
  ),
  AppShell: () => (
    <ui.AppShell
      drawer={<ui.Drawer items={[{ href: "/", label: "Home" }]} />}
      navbar={<ui.Navbar title="App" />}
    >
      Page
    </ui.AppShell>
  ),
  Autocomplete: () => (
    <ui.Autocomplete
      defaultValue="brno"
      label="City"
      name="city"
      options={options}
    />
  ),
  Avatar: () => <ui.Avatar name="Jana Nováková" status="online" />,
  AvatarGroup: () => (
    <ui.AvatarGroup max={1}>
      <ui.Avatar name="Jana Nováková" />
      <ui.Avatar name="Petr Svoboda" />
    </ui.AvatarGroup>
  ),
  Breadcrumbs: () => (
    <ui.Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Here" }]} />
  ),
  Button: () => <ui.Button link="/orders">Orders</ui.Button>,
  ButtonGroup: () => (
    <ui.ButtonGroup>
      <ui.Button>One</ui.Button>
      <ui.Button>Two</ui.Button>
    </ui.ButtonGroup>
  ),
  Calendar: () => (
    <ui.Calendar
      events={[
        { end, htmlTitle: "<b>Standup</b>", id: "1", start, title: "Standup" },
        {
          end,
          id: "2",
          recurrence: "FREQ=WEEKLY;COUNT=3",
          start,
          title: "Weekly",
        },
      ]}
    />
  ),
  Checkbox: () => <ui.Checkbox defaultChecked label="Agree" name="agree" />,
  CheckboxGroup: () => (
    <ui.CheckboxGroup
      defaultValue={["brno"]}
      label="Cities"
      name="cities"
      options={options}
    />
  ),
  Chip: () => <ui.Chip onRemove={noop}>Paid</ui.Chip>,
  CircularProgress: () => (
    <ui.CircularProgress aria-label="Quota" showPercentage value={40} />
  ),
  CollapsibleContent: () => (
    <ui.CollapsibleContent isOpen>Content</ui.CollapsibleContent>
  ),
  ColorSchemeScript: () => <ui.ColorSchemeScript />,
  ColorSchemeToggle: () => <ui.ColorSchemeToggle />,
  CommandPalette: () => (
    <ui.CommandPalette
      items={[{ id: "orders", label: "Orders", onSelect: noop }]}
      onOpenChange={noop}
      open
    />
  ),
  ConfirmDialog: () => (
    <ui.ConfirmDialog onClose={noop} onConfirm={noop} open title="Delete?">
      For good
    </ui.ConfirmDialog>
  ),
  ConfirmProvider: () => <ui.ConfirmProvider>App</ui.ConfirmProvider>,
  ContextMenu: () => (
    <ui.ContextMenu items={[{ label: "Open", onClick: noop }]}>
      <div>Target</div>
    </ui.ContextMenu>
  ),
  CopyButton: () => <ui.CopyButton value="secret" />,
  DataTable: () => (
    <ui.DataTable
      columns={[
        { editable: true, key: "name", label: "Name", summary: "count" },
      ]}
      data={[{ id: 1, name: "Jana" }]}
    />
  ),
  DateRangePicker: () => (
    <ui.DateRangePicker
      defaultValue={{ end: "2026-09-30", start: "2026-09-24" }}
      label="Period"
      name="period"
    />
  ),
  DateTimePicker: () => (
    <ui.DateTimePicker
      defaultValue="2026-09-24T09:00"
      label="When"
      name="when"
      type="datetime-local"
    />
  ),
  DescriptionList: () => (
    <ui.DescriptionList items={[{ desc: "Jana", term: "Name" }]} />
  ),
  Dialog: () => (
    <ui.Dialog onClose={noop} open title="Edit">
      Form
    </ui.Dialog>
  ),
  DialogFooter: () => <ui.DialogFooter>Buttons</ui.DialogFooter>,
  Drawer: () => <ui.Drawer items={[{ href: "/", label: "Home" }]} />,
  DrawerProvider: () => <ui.DrawerProvider>App</ui.DrawerProvider>,
  Dropdown: () => (
    <ui.Dropdown
      items={[{ label: "Edit", onClick: noop }]}
      trigger={<span>Menu</span>}
    />
  ),
  EmptyState: () => <ui.EmptyState description="Nothing yet" title="Empty" />,
  ErrorBoundary: () => <ui.ErrorBoundary>Content</ui.ErrorBoundary>,
  Field: () => (
    <ui.Field id="email" label="Email">
      {(props) => <input {...props} />}
    </ui.Field>
  ),
  FileUpload: () => (
    <ui.FileUpload
      label="Attachments"
      name="files"
      upload={async (file) => ({ name: file.name, value: file.name })}
    />
  ),
  FormDescription: () => <ui.FormDescription>Help</ui.FormDescription>,
  FormError: () => <ui.FormError>Required</ui.FormError>,
  Header: () => <ui.Header back title={undefined} />,
  IconButton: () => <ui.IconButton aria-label="Close">×</ui.IconButton>,
  Input: () => (
    <ui.Input
      clearable
      defaultValue="secret"
      label="Password"
      name="password"
      type="password"
    />
  ),
  Kbd: () => <ui.Kbd shortcut="mod+k" />,
  Link: () => (
    <ui.Link external href="https://example.com">
      Site
    </ui.Link>
  ),
  Navbar: () => <ui.Navbar title="App" />,
  NumberInput: () => (
    <ui.NumberInput
      defaultValue={1234.5}
      formatOptions={{ currency: "CZK", style: "currency" }}
      label="Price"
      name="price"
    />
  ),
  Overlay: () => <ui.Overlay>Content</ui.Overlay>,
  OverlayScope: () => <ui.OverlayScope value={[]}>Content</ui.OverlayScope>,
  Pagination: () => (
    <ui.Pagination currentPage={2} onChange={noop} pageSize={20} total={200} />
  ),
  Panel: () => <ui.Panel title="Summary">Content</ui.Panel>,
  PinInput: () => <ui.PinInput label="Code" length={4} name="code" />,
  Popover: () => (
    <ui.Popover open trigger={<span>Open</span>}>
      Panel
    </ui.Popover>
  ),
  Progress: () => <ui.Progress label="Upload" showPercentage value={40} />,
  RadioGroup: () => (
    <ui.RadioGroup
      defaultValue="brno"
      label="City"
      name="city"
      options={options}
    />
  ),
  RichTextEditor: () => (
    <ui.RichTextEditor
      defaultValue="<h2>Title</h2><p>Hi <b>there</b></p><table><tbody><tr><td>1</td></tr></tbody></table>"
      label="Notes"
      name="notes"
    />
  ),
  SegmentedControl: () => (
    <ui.SegmentedControl
      defaultValue="brno"
      label="City"
      name="city"
      options={options}
    />
  ),
  Select: () => <ui.Select label="City" name="city" options={options} />,
  Separator: () => <ui.Separator label="or" />,
  Sheet: () => (
    <ui.Sheet onClose={noop} open title="Detail">
      Content
    </ui.Sheet>
  ),
  Skeleton: () => <ui.Skeleton />,
  Slider: () => (
    <ui.Slider
      defaultValue={[20, 80]}
      label="Range"
      marks={[{ label: "50", value: 50 }]}
      name="range"
    />
  ),
  SnackbarProvider: () => <ui.SnackbarProvider>App</ui.SnackbarProvider>,
  Spinner: () => <ui.Spinner label="Loading" />,
  SplitButton: () => (
    <ui.SplitButton items={[{ label: "Save as", onClick: noop }]}>
      Save
    </ui.SplitButton>
  ),
  Splitter: () => (
    <ui.Splitter storageKey="panes">
      <div>List</div>
      <div>Detail</div>
    </ui.Splitter>
  ),
  Stat: () => <ui.Stat change={0.125} label="Revenue" value={128400} />,
  Stepper: () => (
    <ui.Stepper
      currentStepId="b"
      steps={[
        { id: "a", title: "Cart" },
        { id: "b", title: "Payment" },
      ]}
    />
  ),
  Switch: () => <ui.Switch label="Notifications" name="notify" />,
  Tabs: () => (
    <ui.Tabs
      items={[
        { label: "First", value: "first" },
        { label: "Second", value: "second" },
      ]}
    />
  ),
  TagsInput: () => (
    <ui.TagsInput defaultValue={["a", "b"]} label="Tags" name="tags" />
  ),
  Textarea: () => (
    <ui.Textarea label="Note" maxLength={100} name="note" showCount />
  ),
  Timeline: () => <ui.Timeline items={[{ time: start, title: "Created" }]} />,
  Toast: () => <ui.Toast message="Saved" onClose={noop} title="Done" />,
  Tooltip: () => (
    <ui.Tooltip title="Help">
      <button type="button">?</button>
    </ui.Tooltip>
  ),
  TreeView: () => (
    <ui.TreeView
      checkable
      defaultExpanded={["1"]}
      items={[
        { children: [{ id: "2", label: "Child" }], id: "1", label: "Root" },
      ]}
    />
  ),
  UIProvider: () => <ui.UIProvider locale={ui.cs}>App</ui.UIProvider>,
  VisuallyHidden: () => <ui.VisuallyHidden>Label</ui.VisuallyHidden>,
};

// PascalCase - not the constants (DEFAULT_PAGE_SIZE) nor the error class
const isComponent = (name: string, value: unknown) =>
  /^[A-Z][a-z]/.test(name) &&
  (typeof value === "function" || typeof value === "object") &&
  name !== "UploadError";

describe("server rendering", () => {
  it("runs without a DOM", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("has a fixture for every exported component", () => {
    const exported = Object.entries(ui)
      .filter(([name, value]) => isComponent(name, value))
      .map(([name]) => name);

    expect(exported.filter((name) => !(name in fixtures))).toEqual([]);
  });

  // What they render is tested with the hydration - the dialogs, for one,
  // render nothing until then
  it.each(Object.entries(fixtures))("renders %s", (_, fixture) => {
    expect(() =>
      renderToString(
        <ui.UIProvider locale={ui.cs}>
          <ui.SnackbarProvider>
            <ui.ConfirmProvider>
              <ui.DrawerProvider>{fixture()}</ui.DrawerProvider>
            </ui.ConfirmProvider>
          </ui.SnackbarProvider>
        </ui.UIProvider>,
      ),
    ).not.toThrow();
  });
});
