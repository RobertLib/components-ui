# Changelog

## 0.1.0

The first version as a standalone library, extracted from the
`src/components/ui` folder of an application. Everything app-specific was
removed and every coupling to that app replaced by configuration.

### Moving an app from the embedded folder to the library

- Import from `components-ui` instead of `../components/ui`, and add
  `@import "components-ui/styles.css";` after `@import "tailwindcss";` - the
  color tokens, animations and helper classes moved there from `index.css`.
- Wrap the app in `UIProvider` with `locale={cs}` (the texts were Czech-only
  before; the default is now English) and the router adapter - see the
  Routing page of the docs.
- `SnackbarContext` → `SnackbarProvider` + `useSnackbar()`,
  `DrawerContext` → `DrawerProvider` + `useDrawer()` (`AppShell` renders it).
- Not part of the library any more - they stay in the app: authentication
  (`lib/auth`, `session-context`, `jwt`, `encryption`), `ProtectedRoute`,
  roles and route permissions, the dictionaries and the pages.
- `<Accordion open={false}>` becomes `<Accordion defaultOpen={false}>` -
  `open` now controls the accordion.
- The English locale shows times on the 12-hour clock (`9:05 PM`); for the
  24-hour one derive a locale with `time: "HH:mm"` and
  `dateTime: "MM/DD/YYYY HH:mm"`.
- A complete custom locale needs the new texts `common.loading`, `common.yes`,
  `common.no`, `dataTable.moveColumn`, `dateTimePicker.month`,
  `dateTimePicker.year`, `fileUpload.dropHint` and
  `fileUpload.fileTypeNotAccepted`, and plural forms for `calendar.more` and
  the three `dataTable.selection` counts.

### Changed APIs

- **Accordion** - `open` + `onOpenChange` control it, `defaultOpen` sets the
  initial state. Its toggle button is the keyboard control; the header is no
  button around another one.
- **Checkbox** is controlled (`checked`) or uncontrolled (`defaultChecked`)
  like a native one - it keeps no state of its own.
- **Popover** - Tab moves from a click trigger into the open panel and out of
  it to what follows the trigger; Escape gives the focus back to the trigger.
- **Spinner** tells screen readers "Loading…" (`label` changes it).
- **Stepper** without `onStepClick` shows no buttons.
- **Tabs** with values are one tab stop - the arrow keys and Home / End select
  the next tab. The indicator follows tabs that change size (web fonts).
- **Toast** - the time on screen does not run while it is hovered or focused.
  `SnackbarProvider` adds the toasts to live regions that exist before them,
  so screen readers announce them.
- **Tooltip** shows at once on keyboard focus and describes the focused
  element (`aria-describedby`) while it is shown.
- The components use the theme tokens only - `neutral-*` instead of
  Tailwind's `gray-*` / `zinc-*`, and the `warning` button the `warning-*`
  scale instead of yellow and orange.
- The type declarations import with file extensions, so TypeScript projects
  with `moduleResolution: "node16"` / `"nodenext"` get the types (they saw
  `any` before).

- **Navbar** no longer reads the session: pass `user` (`name`,
  `description`, `menuItems`), `actions`, `children` and `loading`.
- **Drawer** takes the logo as `header` (it was a fixed `/logo.webp`), skips
  falsy items and hides empty groups; groups can be `defaultExpanded`. Of
  several matching items only the most specific is active.
- **Dialog** without `open` no longer calls `navigate(-1)` - it calls
  `onClose` after the closing animation, so pass
  `onClose={() => navigate(-1)}` for route dialogs. Escape closes it - only
  the topmost of several open dialogs. New `closeDisabled`, which
  `ConfirmDialog` uses while `loading`.
- **Popover** - new `interactiveTrigger` for a trigger that contains its own
  control (the wrapper then is no button). An Autocomplete, Dropdown or
  picker inside a click popover no longer closes it, and Escape closes the
  innermost popover only.
- **Header** goes back through the router adapter; `onBack` overrides it.
- **Breadcrumbs** - the home crumb is configurable (`home`, or `false`).
- **Tabs** also switch local state (`value` + `onChange`); a link tab is
  active on its path and below it (`/users` is no longer active on
  `/users-archive`).
- **Pagination** - `pageSize` replaces `first` / `last`; without `pageInfo`
  it pages by numbers from `total` and offers a "last page" button.
- **DataTable** reports a `DataTableQuery` (`query` / `onQueryChange`)
  instead of reading and writing Relay parameters in the URL:
  - the previous behavior is `useDataTableQuery({ syncWithUrl: true })`;
    the URL parameters are `page`, `pageSize`, `sortBy`, `order`, `search`,
    `filters`, `after`, `before` (no `first` / `last` / `status`),
  - `getTableParams(searchParams)` → `readQueryFromSearch()`, then
    `toRelayVariables(query)` for GraphQL or `toOffsetParams(query)` for REST,
  - new: `clientSide`, `maxHeight`, `pageSizeOptions`, `pagination`, column
    `getValue` / `filterFn`; row ids may be numbers,
  - the column settings are stored under `table-state-<tableId>` without the
    user's email - put the user into `tableId` if browsers are shared,
  - `filteredSelection` can be `true`, its labels default to the locale,
  - dates and booleans without a `render` are shown by the locale; client-side
    they are also found by that text, and texts sort by the rules of the
    language (`applyDataTableQuery` takes a `locale`),
  - "Clear filters" is in the toolbar of a table without an actions column,
  - the column settings are a panel operated from the keyboard too (Tab, and
    the arrow keys on a handle move a column),
  - a group action shows a spinner while its promise runs, cannot be pressed
    again meanwhile and keeps the selection when it rejects,
  - the header row sticks right under a toolbar that wraps onto more lines.
- **Autocomplete**
  - `loadOptions` gets `page`, `offset`, `cursor` and `pageSize` besides
    `after` / `first`, and may return an array, a page
    (`{ items, total }`, with `hasMore` or `nextCursor`) or a Relay
    connection with `nodes` or `edges`,
  - the default label is read from `label` / `name` / `title` (not `email`),
    the value from `value` / `id`; `getOptionValue` may return a number,
  - a controlled `value` is followed at all times (before, it was ignored
    after the first user interaction),
  - typing no longer drops a single selection; erasing the text does, and
    reports `onChange(null)`,
  - new: `pageSize`, `renderOption`, `onLoadError`; `loadSelectedOptions`
    also loads labels of a controlled `value`,
  - a named single field without a value submits an empty value (so a
    cleared field reaches the server), a disabled field submits nothing,
  - a failed load shows an error row and is retried on the next opening -
    a complete custom locale needs the new text `autocomplete.loadError`.
- **DateTimePicker** formats by the locale (Czech keeps `DD.MM.YYYY`), honors
  `min` / `max` (also for times), and takes `minuteStep`. It is operated from
  the keyboard (the time lists too), and forwards `ref`, `readOnly`,
  `onFocus` and `onBlur`. The value can be typed in the display format; the
  date popup has month and year selects (Shift + Page Up / Down pages by
  years), and opens with the focus in it only from the keyboard. Formats may
  use the 12-hour clock (`h`, `hh`, `A`). `required` is checked on the field
  itself. The date and time popup stacks on phones.
- **Calendar** - the hours are `dayStartHour` / `dayEndHour` (7 - 22 by
  default), the first day of the week comes from the locale, the app-specific
  event fields `canExcuse` / `myAttendanceId` were removed;
  `getVisibleRange` is exported as `getCalendarVisibleRange`, with the first
  day of the week as its required third argument. The week view shows
  all-day events. `view` can be controlled. Events are operated from the
  keyboard, and with `onDateClick` the days and time slots too (arrow keys);
  "+N more" opens the list of the day's events. `htmlTitle` is reduced to
  inline formatting - it can run no scripts. The time column follows the time
  format of the locale.
- **FileUpload** shows its errors under the field and reports them to
  `onError` (it needed `SnackbarContext` before); new `onRemove`.
  `uploadWithProgress` takes a `signal` that cancels the upload - `upload`
  gets one too, aborted by the new cancel button and when the field unmounts.
  Files can be dropped on the field; new `multiple`, `disabled` and
  `required`, and dropped files are checked against `accept`.
- **Stepper** - `icon` is optional and any icon component; the number is
  shown without it.
- **Avatar** shows a picture (`src`) or initials (`name`).
- **RichTextEditor** - new `name`, `defaultValue`, `error`, `disabled`;
  `required` blocks the submit of an empty editor, and a loaded value or
  pasted or dropped content is reduced to its own formatting. A link is
  entered in a field of the editor (it was `window.prompt`), web, e-mail and
  phone links only.
- **Tooltip** also opens on keyboard focus and closes with Escape.
- **Dropdown** - the arrow keys also stop at custom content with a control,
  which then takes the focus.
- **Drawer** - collapsed to icons, a group opens its items from the keyboard
  too (Enter), with the focus in them.
- **Form fields** generate their ids with `useId` (they were
  `input-${name}`, which collided for equal names) - pass `id` for a fixed one.
  A controlled field always shows its `value` (a change the parent rejects
  no longer shows up); an uncontrolled one follows `defaultValue` until
  edited, and `form.reset()` and React form actions reset it.
- **ErrorBoundary** is part of the library, with `fallback` as a function and
  `onError`.
- **Overlays** - Dialog, Popover, Tooltip and the drawer on phones share one
  stack: Escape closes only the topmost one, the one opened later paints on
  top, and toasts show above dialogs. The drawer is modal on phones (focus
  moves in and back, Tab is trapped, the page does not scroll).
- **Popover** - new `popupRole` (`dialog`, `menu`, `listbox`, `none`) and
  `contentLabel`; consumer `onClick`, `onKeyDown`, `onMouseEnter` and
  `onMouseLeave` run before the internal handlers (`preventDefault` skips
  them), on Dropdown too. Panels follow scrolling on phones and flip
  horizontally.
- **Tooltip** flips and stays inside the viewport and follows scrolling.
- **`<Button link>`** forwards `ref`, `data-*`, `aria-*` and event handlers.
- **DataTable** - filters sit in a second header row and a column header's
  name is just its label (sort buttons are named by it; "Sort by …" is their
  title). Row checkboxes are named after the row's first cell, the select-all
  checkbox shows a partial selection, and "Select all N rows" is offered once
  the whole page is selected. A finished group action deselects only the rows
  it got. `pageSize` from the URL must be one of `pageSizeOptions` (new option
  of `useDataTableQuery`).
- **Pagination** - new `loading`; cursor prev/next wait for new `pageInfo`
  (or the end of loading) before the next move.
- New exports `resetPagination`, `setFilter`, `toggleSort`,
  `DEFAULT_PAGE_SIZE_OPTIONS` and the `UploadWithProgressOptions` type.
- **Autocomplete** - Backspace / Delete on a focused chip removes that chip;
  Home / End move the caret while typing (the highlight in `asSelect`);
  static `loadMore` stops with `hasMore={false}`. Loading and empty messages
  are outside the listbox.
- **FileUpload** - with `multiple={false}` a new file replaces the listed one
  (reported through `onRemove`); a late `defaultAttachments` is taken until the
  user changes the list.
- **RadioGroup** - `aria-label` / `aria-labelledby` without a `label`; the
  error state is on the group.
- **Calendar** - drag, resize and range selection use pointer events and work
  with touch (range selection stays mouse-only so a finger scrolls). A move
  keeps the event's length, a resize changes only the dragged edge.
  `htmlTitle` keeps only text-styling classes, none on links.
- **DateTimePicker** - the grids have week / month rows and `aria-selected`
  cells (instead of `aria-pressed` buttons); arrow keys stop at `min` / `max`
  and move on into the next year.
- A router adapter with only `navigate` re-reads the URL after navigating, so
  browsers without the Navigation API see the change.

### Fixed

- `Checkbox` came back checked on the next render after `form.reset()` (and
  after a React form action).
- `DataTable` showed nothing for `Date` and boolean values without `render`.
- `Calendar` showed an event over several days only on its first day in the
  day view (timed events over midnight in every view).
- `sanitizeRichText` kept the text of `<style>` and `<title>` of pasted SVG.
- The hidden inputs that enforce `required` (Autocomplete, RichTextEditor,
  FileUpload) took the focus on a failed submit - it goes to the field now.
- Czech texts of the filtered selection and "+N more" used one form for all
  counts.
- `Chip`, `Spinner` and `FormError` rendered fixed `data-testid`s.

- `DataTable` rendered cell text as HTML (`dangerouslySetInnerHTML`) - a
  script in the data could run. The search highlight is now built from React
  nodes and no longer breaks on characters like `(`.
- The text filters of `DataTable` created a new debounce on every render, so
  every keystroke fired a request.
- Hidden validation inputs were submitted as `<name>_validation` fields.
- `RadioGroup` lost the checked state of numeric values after a change.
- A label pointed at the wrong element when a field got its own `id`.
- `FileUpload` crashed outside HTTPS (`crypto.randomUUID`).
- `DateTimePicker` used the UTC date for "today" in the date-time picker, and
  the calendar header parsed dates as UTC.
- `Calendar` month navigation skipped a month from the 31st.
- Popovers near the edge of the screen overflowed it, and a key press inside
  a click popover toggled it.
- The drawer flashed open on phones before the first measurement.
- The `Select` chevron was black in dark mode.
- `DataTable`:
  - pinned columns overlapped when pinned in another order than shown or
    next to a hidden pinned column, and the actions column covered the
    selection checkboxes,
  - `expandedByDefault` expanded only the rows of the first render,
  - the column settings kept the columns' defaults of the first render, so a
    column whose `visible` changed later stayed as it was,
  - long cell texts could not be opened on touch screens.
- Cursor pagination disabled "previous" after paging forward when the server
  reports `hasPreviousPage: false` there, as graphql-relay and many other
  servers do.
- `RichTextEditor` ran the event handlers of the HTML it was given
  (`<img onerror>`), kept all styles of pasted content and did not enforce
  `required`.
- `Tabs` marked the first of several matching links active - `/users`
  instead of `/users/archive`.
- `Accordion` content that starts open animated in on every page load.
- `Dialog`:
  - the page stayed unscrollable when a dialog and its `ConfirmDialog`
    closed together,
  - Escape in a `ConfirmDialog` closed the dialog under it,
  - the focus trap stopped at hidden inputs, so focus could get lost in a
    form with a picker or a file upload,
  - a double click on × called `onClose` twice.
- `Dropdown` swallowed Escape even when closed, so a surrounding dialog did
  not close, and Enter could run an item highlighted during an earlier
  opening.
- `Autocomplete` lost the labels of selected options after a search, and a
  mouse pick moved the focus out of the field.
- `Calendar`:
  - dragging past the last hour moved an event to the next morning,
  - a click with a slightly moving mouse moved the event,
  - in the day view, events could not be clicked once dragging was on,
  - a right click started a drag.
- `Autocomplete`, `RichTextEditor` and `FileUpload` ignored `form.reset()`
  and the reset after a React form action.
- `RichTextEditor` submitted the unsanitized `defaultValue` / `value` until
  the first edit, counted `<p><br></p>` as filled, and kept the styles of
  typed and plain-text pasted content in its value.
- `sanitizeInlineHtml` kept any class, so an event title could lay an
  invisible link over the page.
- `Autocomplete` kept the highlight on an index after the list changed, and
  static `loadMore` fired again at every scroll at the end.
- Form fields dropped their own `aria-describedby` while showing an error.
- `DataTable`:
  - cursor paging clicked twice quickly skipped ahead of the data,
  - with a router that updates the URL later, a second change dropped the
    first one,
  - URL state dropped the location hash,
  - selected rows kept their old objects after a refetch.
- `getBaseError` lost `{ errors: ["…"] }` string lists and JSON:API errors
  pointing at `/data`.
- `Dialog` let the focus out after a click on its blank area; a popover
  stayed above a dialog opened from it and took its Escape; Escape on a
  tooltip or in the drawer also closed the dialog; overlays opened in one
  commit were stacked in the wrong order.
- `Calendar`: dragging an event partly outside the working hours moved or
  shortened the part outside; a drag released off the tile swallowed the
  next click; slots on the day the clocks go forward came out of order; a
  range from the last row ran past `dayEndHour`; overlapping events ignored
  the dragged position.
- `DateTimePicker`: the arrow keys moved the focus onto disabled days,
  weeks and months (and the grid lost its Tab stop); text typed before moving
  into the popup was lost; years 0-99 became 19xx and `2026-02-31` showed as
  March 3.
- `formatDate` paired the ISO week with the calendar year.
- The package's `exports` had no `default` condition.
