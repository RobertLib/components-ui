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
  Menubar: () => (
    <ui.Menubar
      menus={[
        { id: "file", label: "File", items: [{ label: "New", onClick: noop }] },
      ]}
    />
  ),
  PhoneInput: () => (
    <ui.PhoneInput
      defaultCountry="CZ"
      defaultValue="+420777123456"
      label="Phone"
      name="phone"
      required
    />
  ),
  RepeatableField: () => (
    <ui.RepeatableField
      name="contacts"
      min={1}
      defaultValue={[{ id: "one", value: "Adam" }]}
      createItem={() => ""}
      renderItem={(item) => (
        <ui.Input
          label="Name"
          name={`${item.name}.name`}
          value={item.value}
          onChange={(event) => item.onChange(event.target.value)}
        />
      )}
    />
  ),
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
      banner={
        <ui.SystemBanner dismissible storageKey="outage" variant="warning">
          Outage
        </ui.SystemBanner>
      }
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
  Badge: () => (
    <ui.Badge count={120} label="120 unread">
      <span>Inbox</span>
    </ui.Badge>
  ),
  Breadcrumbs: () => (
    <ui.Breadcrumbs
      items={[
        { href: "/a", label: "A" },
        { href: "/b", label: "B" },
        { label: "Here" },
      ]}
      maxItems={2}
    />
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
  "Calendar (week)": () => (
    <ui.Calendar
      businessHours
      events={[{ end, id: "1", start, title: "Standup" }]}
      hiddenDays={[0, 6]}
      initialDate={start}
      initialView="week"
      onEventDrop={noop}
      renderEvent={(event) => event.title}
      restrictToBusinessHours
      slotDuration={15}
    />
  ),
  "Calendar (timeline)": () => (
    <ui.Calendar
      businessHours
      events={[{ end, id: "1", resourceId: "a", start, title: "Standup" }]}
      initialDate={start}
      initialView="timelineWeek"
      onDateClick={noop}
      onEventDrop={noop}
      resources={[{ id: "a", title: "Room A" }]}
    />
  ),
  Card: () => (
    <ui.Card
      actions={<button type="button">More</button>}
      description="This month"
      footer="Updated today"
      href="/orders"
      media={<img alt="" src="/cover.png" />}
      title="Orders"
    >
      Content
    </ui.Card>
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
  Chart: () => (
    <ui.Chart
      data={[{ label: "One", value: 10 }]}
      series={[{ key: "value", label: "Value" }]}
      title="Results"
      type="area"
    />
  ),
  ImageViewer: () => (
    <ui.ImageViewer
      defaultOpen
      images={[{ src: "/one.png", alt: "Landscape" }]}
    />
  ),
  TransferList: () => (
    <ui.TransferList
      defaultValue={["brno"]}
      label="Cities"
      name="cities"
      options={options}
      required
    />
  ),
  CircularProgress: () => (
    <ui.CircularProgress aria-label="Quota" showPercentage value={40} />
  ),
  CollapsibleContent: () => (
    <ui.CollapsibleContent isOpen>Content</ui.CollapsibleContent>
  ),
  ColorInput: () => (
    <ui.ColorInput
      alpha
      defaultValue="#1e90ff80"
      label="Color"
      name="color"
      swatches={["#ff0000", { label: "Blue", value: "#0000ff" }]}
    />
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
  CommentThread: () => (
    <ui.CommentThread
      allowReplies
      comments={[
        {
          author: { id: 1, name: "Jana Nováková" },
          body: "Ahoj @[Petr Svoboda](7)",
          createdAt: start,
          editedAt: end,
          id: 1,
          replies: [
            {
              author: { id: 7, name: "Petr Svoboda" },
              body: "Díky",
              createdAt: end,
              id: 2,
            },
          ],
        },
      ]}
      currentUser={{ id: 1, name: "Jana Nováková" }}
      getMentionHref={(mention) => `/users/${mention.id}`}
      hasMore
      onDelete={noop}
      onEdit={noop}
      onLoadMore={noop}
      onSubmit={noop}
      suggestions={[{ id: 7, label: "Petr Svoboda" }]}
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
        {
          children: [
            { filter: "multiSelect", key: "city", label: "City" },
            { filter: "numberRange", key: "age", label: "Age" },
            { filter: "dateRange", key: "born", label: "Born" },
          ],
          key: "details",
          label: "Details",
        },
      ]}
      data={[{ id: 1, name: "Jana" }]}
      getRowHref={() => "/jana"}
      selectionMode="single"
    />
  ),
  DateCalendar: () => (
    <ui.DateCalendar
      defaultValue={["2026-09-24", "2026-09-25"]}
      isDateDisabled={(day) => day.getDay() === 0}
      label="Days"
      multiple
      name="days"
      required
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
  DurationInput: () => (
    <ui.DurationInput
      clearable
      defaultValue="PT1H30M"
      display="units"
      label="Response time"
      max={480}
      name="responseTime"
      valueFormat="iso"
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
  FormDialog: () => (
    <ui.FormDialog
      dirty
      onClose={noop}
      onSubmit={noop}
      open
      submitLabel="Save"
      title="Edit"
    >
      <ui.Input label="Name" name="name" />
    </ui.FormDialog>
  ),
  FormError: () => <ui.FormError>Required</ui.FormError>,
  FormActions: () => (
    <ui.FormActions dirty sticky>
      <ui.Button type="submit">Save</ui.Button>
    </ui.FormActions>
  ),
  FormGrid: () => (
    <ui.FormGrid columns={2} labelPosition="start" labelWidth="12rem" readOnly>
      <ui.Input defaultValue="Acme" label="Company" name="company" />
    </ui.FormGrid>
  ),
  FormGridItem: () => (
    <ui.FormGrid columns={3}>
      <ui.FormGridItem span={2}>
        <ui.Textarea label="Note" name="note" />
      </ui.FormGridItem>
    </ui.FormGrid>
  ),
  FormSection: () => (
    <ui.FormSection
      actions={<ui.Button size="sm">Edit</ui.Button>}
      columns={2}
      description="Where the invoices go."
      readOnly
      title="Billing"
    >
      <ui.Input label="Street" name="street" />
    </ui.FormSection>
  ),
  Header: () => (
    <ui.Header
      back
      breadcrumbs={[{ href: "/a", label: "A" }]}
      title={undefined}
    >
      Meta
    </ui.Header>
  ),
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
  KanbanBoard: () => (
    <ui.KanbanBoard
      columns={[
        { color: "primary", id: "new", limit: 1, title: "Nové" },
        { collapsed: true, id: "done", title: "Hotovo" },
      ]}
      defaultCards={[
        { columnId: "new", id: 1, title: "Alza" },
        { columnId: "new", id: 2, title: "Rohlik" },
      ]}
      getCardHref={(card) => (card.id === 1 ? "/deals/1" : undefined)}
      onAddCard={noop}
      renderCard={(card) => card.title}
    />
  ),
  Kbd: () => <ui.Kbd shortcut="mod+k" />,
  KeyboardShortcutsDialog: () => (
    <ui.KeyboardShortcutsDialog
      defaultOpen
      shortcuts={[
        {
          description: "Move",
          group: "Table",
          shortcut: ["arrowup", "arrowdown"],
        },
      ]}
    />
  ),
  Link: () => (
    <ui.Link external href="https://example.com">
      Site
    </ui.Link>
  ),
  List: () => (
    <ui.List variant="framed">
      <ui.ListItem description="5 records" href="/grades" title="Grades" />
      <ui.ListItem onClick={noop} title="Switch account" />
      <ui.ListItem
        actions={<ui.Button size="sm">Edit</ui.Button>}
        title="Notes"
      />
    </ui.List>
  ),
  ListItem: () => (
    <ui.List>
      <ui.ListItem current href="/" title="Home" />
    </ui.List>
  ),
  LoadingOverlay: () => (
    <ui.LoadingOverlay label="Loading orders" visible>
      <button type="button">Covered</button>
    </ui.LoadingOverlay>
  ),
  MentionInput: () => (
    <ui.MentionInput
      autosize
      defaultValue="Ahoj @[Jana Nováková](1)"
      label="Komentář"
      maxLength={100}
      name="comment"
      showCount
      suggestions={[{ id: 1, label: "Jana Nováková" }]}
    />
  ),
  MentionText: () => (
    <ui.MentionText
      getMentionHref={(mention) => `/users/${mention.id}`}
      value="Ahoj @[Jana Nováková](1)"
    />
  ),
  Navbar: () => <ui.Navbar title="App" />,
  NotificationCenter: () => (
    <ui.NotificationCenter
      defaultOpen
      hasMore
      notifications={[
        {
          avatar: { name: "Jana Nováková" },
          body: "Order 1042",
          href: "/orders/1042",
          id: 1,
          time: start,
          title: "New comment",
        },
        { id: 2, read: true, time: "2026-09-20T08:00:00Z", title: "Export" },
      ]}
      onLoadMore={noop}
      onMarkAllRead={noop}
      onReadChange={noop}
    />
  ),
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
    <ui.Pagination
      currentPage={2}
      onChange={noop}
      pageSize={20}
      pageSizeOptions={[20, 50]}
      showJumpTo
      total={200}
      variant="pages"
    />
  ),
  Panel: () => <ui.Panel title="Summary">Content</ui.Panel>,
  PinInput: () => <ui.PinInput label="Code" length={4} name="code" />,
  Popover: () => (
    <ui.Popover open trigger={<span>Open</span>}>
      Panel
    </ui.Popover>
  ),
  Progress: () => <ui.Progress label="Upload" showPercentage value={40} />,
  PromptDialog: () => (
    <ui.PromptDialog
      defaultValue="Copy of Invoice 2026-041"
      label="Name"
      maxLength={100}
      multiline
      onClose={noop}
      onConfirm={noop}
      open
      required
      title="Duplicate the invoice"
    />
  ),
  RadioGroup: () => (
    <ui.RadioGroup
      defaultValue="brno"
      label="City"
      name="city"
      options={options}
    />
  ),
  RangeCalendar: () => (
    <ui.RangeCalendar
      defaultValue={{ end: "2026-09-30", start: "2026-09-24" }}
      label="Stay"
      months={2}
      name="stay"
      presets
    />
  ),
  Rating: () => (
    <ui.Rating allowHalf defaultValue={3.5} label="Rating" name="rating" />
  ),
  RequiredMark: () => <ui.RequiredMark />,
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
  SessionTimeout: () => (
    <ui.SessionTimeout
      expiresAt="2026-10-15T10:00:00Z"
      idleTimeout={15 * 60_000}
      onLogout={noop}
      onTimeout={noop}
    />
  ),
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
  Sparkline: () => (
    <ui.Sparkline area data={[3, 5, null, 4, 8]} highlightLast label="Sales" />
  ),
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
  Stat: () => (
    <ui.Stat
      change={0.125}
      label="Revenue"
      sparkline={[1, 3, 2, 5]}
      value={128400}
    />
  ),
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
  SystemBanner: () => (
    <ui.SystemBanner
      action={{ href: "/status", label: "Details" }}
      dismissible
      storageKey="outage"
      title="Planned outage"
    >
      Saturday 22:00
    </ui.SystemBanner>
  ),
  Table: () => (
    <ui.Table caption="Orders" stickyHeader striped>
      <ui.TableHead>
        <ui.TableRow>
          <ui.TableCell>Name</ui.TableCell>
        </ui.TableRow>
      </ui.TableHead>
      <ui.TableBody>
        <ui.TableRow>
          <ui.TableCell header>Jana</ui.TableCell>
        </ui.TableRow>
      </ui.TableBody>
      <ui.TableFoot>
        <ui.TableRow>
          <ui.TableCell align="end">1</ui.TableCell>
        </ui.TableRow>
      </ui.TableFoot>
    </ui.Table>
  ),
  TableBody: () => (
    <table>
      <ui.TableBody>
        <tr>
          <td>Cell</td>
        </tr>
      </ui.TableBody>
    </table>
  ),
  TableCell: () => (
    <table>
      <tbody>
        <tr>
          <ui.TableCell>Cell</ui.TableCell>
        </tr>
      </tbody>
    </table>
  ),
  TableFoot: () => (
    <table>
      <ui.TableFoot>
        <tr>
          <td>Cell</td>
        </tr>
      </ui.TableFoot>
    </table>
  ),
  TableHead: () => (
    <table>
      <ui.TableHead>
        <tr>
          <ui.TableCell>Head</ui.TableCell>
        </tr>
      </ui.TableHead>
    </table>
  ),
  TableRow: () => (
    <table>
      <tbody>
        <ui.TableRow>
          <td>Cell</td>
        </ui.TableRow>
      </tbody>
    </table>
  ),
  Tabs: () => (
    <ui.Tabs
      items={[
        { content: "One", label: "First", value: "first" },
        { content: "Two", label: "Second", onClose: noop, value: "second" },
      ]}
      keepMounted
      overflow="menu"
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
  Toolbar: () => (
    <ui.Toolbar
      items={[
        { icon: <svg />, iconOnly: true, id: "new", label: "New" },
        { type: "separator" },
        {
          id: "archived",
          label: "Archived",
          onPressedChange: noop,
          pressed: true,
          type: "toggle",
        },
        {
          id: "search",
          render: (props) => <input aria-label="Search" {...props} />,
          type: "custom",
        },
        { id: "delete", label: "Delete", menuOnly: true },
      ]}
    />
  ),
  Tooltip: () => (
    <ui.Tooltip title="Help">
      <button type="button">?</button>
    </ui.Tooltip>
  ),
  TreeSelect: () => (
    <ui.TreeSelect
      defaultValue={["2"]}
      items={[
        { children: [{ id: "2", label: "Child" }], id: "1", label: "Root" },
      ]}
      label="Category"
      multiple
      name="category"
      required
    />
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
  ChangeHistory: () => (
    <ui.ChangeHistory
      entries={[
        {
          action: "updated",
          author: { name: "Jana Nováková" },
          changes: [
            { field: "status", from: "draft", to: "sent" },
            { field: "note", from: "Old text ".repeat(20), to: "New text" },
          ],
          comment: "Sent to the customer",
          id: 1,
          time: start,
        },
        { action: "created", id: 2, time: "2026-09-20T08:00:00Z" },
      ]}
      filterable
      hasMore
      onLoadMore={noop}
      timeZone="Europe/Prague"
    />
  ),
  FilterBuilder: () => (
    <ui.FilterBuilder
      defaultValue={{
        combinator: "and",
        conditions: [
          { field: "city", operator: "in", value: ["brno"] },
          {
            combinator: "or",
            conditions: [
              { field: "total", operator: "between", value: { from: 1 } },
              { field: "due", operator: "before", value: "2026-10-01" },
              { field: "paid", operator: "equals", value: true },
            ],
          },
        ],
      }}
      fields={[
        { key: "city", label: "City", options, type: "select" },
        { key: "total", label: "Total", type: "number" },
        { key: "due", label: "Due", type: "date" },
        { key: "paid", label: "Paid", type: "boolean" },
      ]}
      name="filter"
    />
  ),
  VirtualList: () => (
    <ui.VirtualList
      aria-label="Orders"
      height={200}
      items={Array.from({ length: 1000 }, (_, index) => index)}
      onEndReached={noop}
      renderItem={(item) => `Order ${item}`}
    />
  ),
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

describe("server rendering of open overlays", () => {
  // Their portals wait for the hydration - also into a `portalContainer`
  it("renders them open, with their state", () => {
    const html = renderToString(
      <ui.UIProvider portalContainer={() => null}>
        <ui.Tooltip open title="Help">
          <button type="button">?</button>
        </ui.Tooltip>
        <ui.Popover open trigger={<span>Filters</span>} triggerType="click">
          Panel
        </ui.Popover>
        <ui.Dialog onClose={noop} open title="Edit">
          Content
        </ui.Dialog>
        <ui.Overlay />
      </ui.UIProvider>,
    );

    expect(html.match(/data-state="open"/g)).toHaveLength(2);
    expect(html).not.toContain("Panel");
    expect(html).not.toContain("Edit");
  });
});
