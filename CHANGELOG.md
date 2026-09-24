# Changelog

## 0.2.0

A review of the whole library: every component was audited and what the
audit found is fixed and covered by tests. The React Compiler now compiles
every component and hook (`npm run lint` checks it), and the package is MIT
licensed.

It also brings the components and features that the common UI libraries offer
and this one lacked: form fields (NumberInput, DateRangePicker, CheckboxGroup,
SegmentedControl, PinInput, Slider, TagsInput, Field), overlays and actions
(Sheet, `useConfirm`, CommandPalette, ContextMenu, ButtonGroup, SplitButton,
CopyButton), data display (TreeView, Timeline, Stat, EmptyState, AvatarGroup,
CircularProgress, Kbd), layout (Splitter, AccordionGroup, Separator, Link,
VisuallyHidden), hooks and a color scheme switch - and new features for most
of the existing components, from DataTable column resizing, pinning, editing,
virtualization and CSV export to the agenda, resource and recurring events of
Calendar. Everything is localized in English and Czech, renders on the server
and compiles with the React Compiler, and every new component has a docs page
with live examples.

### Upgrading

- A complete custom locale needs the new texts `autocomplete.emptyOption`,
  `autocomplete.maxSelections` (plural forms), `calendar.eventLabel`,
  `calendar.rangeSelected`, `dateTimePicker.selectDateTime`,
  `select.emptyOption`, `stepper.completed`, `stepper.error`,
  `descriptionList.moreInfo` and `form.labelSuffix` (the `":"` after field
  labels - `" :"` in French, `""` for none). `input.hidePassword` is gone:
  the password toggle is named `input.showPassword` in both states and says
  its state with `aria-pressed`.
- A complete custom locale also needs the texts of the new components and
  features (locales made with `createLocale` get them from their base locale):
  - the new sections `avatar`, `checkboxGroup`, `chip`, `colorScheme`,
    `commandPalette`, `copyButton`, `dateRangePicker`, `link`, `numberInput`,
    `pinInput`, `slider`, `splitButton`, `splitter`, `tagsInput`, `textarea`,
    `timeline` and `treeView`,
  - `calendar.agenda`, `calendar.dayOf`, `calendar.from`, `calendar.noEvents`,
    `calendar.resourceTime`, `calendar.today` and `calendar.until`,
  - `dataTable.columnWidth` (plural forms), `dataTable.density` (`label`,
    `compact`, `normal`, `comfortable`), `dataTable.editCell`,
    `dataTable.editFailed`, `dataTable.exportCsv`, `dataTable.invalidNumber`,
    `dataTable.resizeColumn`, `dataTable.saving` and `dataTable.summary`
    (`sum`, `avg`, `min`, `max`, `count`),
  - `input.clear`,
  - `richTextEditor` - the names of the new tools, the texts of the link and
    table forms and `keys` (`alt`, `ctrl`, `shift`).
- The props of `Autocomplete` are a union by `multiple`, and so are
  `AsyncAutocompleteProps` / `StaticAutocompleteProps` - extend them with an
  intersection type instead of `interface … extends`. In multiple mode
  `items[i]` belongs to `values[i]` (`null` for a value without an item).
- Tests that find elements by role or name: a `ConfirmDialog` is an
  `alertdialog`; `Calendar` event tiles are named by their title and time
  ("Standup, Thursday, September 24, 2026, 9:00 – 10:00 AM"); an
  `Autocomplete` with `asSelect` is a `combobox` element without text editing
  (read its text, not its `value`); a disabled `<Button link>` has no `href`.
- `Calendar` - `end` is exclusive, also for all-day events (a one-day event
  ends at the next midnight), and `initialView` defaults to the first of
  `viewOptions`.
- `Chip` renders a `<span>` - a `ref` gets an `HTMLSpanElement`.
- The `onChange` of `DateTimePicker` is typed as the new
  `DateTimePickerChangeEvent` - what it always got: `target` /
  `currentTarget` with `name` and `value`, `type`, and `preventDefault()` /
  `stopPropagation()` that do nothing. Handlers typed for native change
  events still compile.
- `FileUpload` with a `name` and `required` counts only the files with a
  `value` - they are what the form submits. Give `defaultAttachments` the
  `value` the server needs to keep them, or leave out `name` where the
  attachments are saved separately.
- `Pagination` puts its props (`className`, `id`, `data-*`, `aria-*`) on the
  `<nav>`, no longer on the `<ul>` - the props type is
  `ComponentProps<"nav">`, and an `aria-label` replaces the default one.
- A `required` custom `DateTimePicker` has no clear button, like the native
  inputs - `clearable` sets it explicitly.
- `getNestedErrors` names a nested record by its path ("Order 1 › Item A:
  …"), not by the top record only.
- `Popover` and `Tooltip` handle Escape after the page's key handlers (bubble
  phase, like `Dialog` and `Drawer`): a handler inside them, or on a Popover
  trigger, that calls `preventDefault()` or `stopPropagation()` on Escape
  keeps them open.
- `Autocomplete` - Enter in a closed typing field no longer opens the list:
  it submits the form, as in a text input (ArrowDown opens). `asSelect`
  still opens on Enter and Space.
- Tests that open a `Dropdown` with Enter / Space / ArrowDown: the focus
  moves into the menu with the first item highlighted - the next Enter picks
  it.
- Tests that find elements by role: a `warning` `Alert` is announced
  assertively (`role="alert"`, `aria-live="assertive"`); an `Avatar` showing
  initials is an `img` named after the person (`alt=""` makes it decorative).
- Every `Tooltip` can be hovered: it no longer lets clicks through to what
  is under it, a click on a plain tooltip hides it, and it hides 150 ms after
  the pointer leaves.
- **RichTextEditor** - the default toolbar has undo / redo, headings,
  underline, strikethrough, lists, indentation, a quote and clear formatting;
  pass `toolbar={["bold", "italic", "paragraph", "link"]}` for the old set.
  Allow the new elements in your server-side sanitizer: `h2`, `h3`, `ul`,
  `ol`, `li`, `blockquote`, `u`, `s`, `code`, `hr`, `table`, `thead`, `tbody`,
  `tr`, `th`, `td`. Tests: the toolbar is one Tab stop, so fewer `user.tab()`
  presses reach the editor; Ctrl + B / I are handled by the editor.
- `sanitizeRichText` keeps those elements instead of turning them into
  paragraphs, and moves a link around a block into it (`<p><a>…</a></p>`);
  `{ formats: ["bold", "italic", "link"] }` gives the old reduction. It also
  drops paragraphs that show nothing (empty or only whitespace), parses HTML
  in standards mode like the page it renders into (a table ends a paragraph,
  stray end tags come out as the page shows them) and turns blocks inside the
  inline elements of a paragraph into its lines.
- **useSnackbar** - `enqueueSnackbar` returns the id of the toast: a function
  typed to return a specific type that returns its call no longer compiles.
  Objects typed as `SnackbarApi` (mocks in tests) need the new `closeSnackbar`
  and `promise`.
- **Toast** - `title` is a heading above the message, no longer the native
  tooltip attribute.
- **Calendar**
  - `CalendarView` includes `"agenda"` - an exhaustive `switch` over it needs
    the case,
  - the event fields `recurrence`, `exdates`, `resourceId`, `recurringEventId`
    and `occurrenceStart` have a meaning now: `recurrence` repeats the event
    (a value the calendar cannot read shows it once), and with `resources` an
    event shows only in the column of its `resourceId` - rename app data of
    these names,
  - the header has a Today button - tests that tab through the header or count
    its buttons meet it.
- **DataTable**
  - every table has a "Row density" button in its toolbar and a resize
    handle - a focusable `separator` - in each column header;
    `densityControl={false}` / `resizableColumns={false}` leave them out, and
    tests counting buttons or Tab stops may need updating,
  - the saved settings keep the user's pins as `columnPinning` (it replaces
    `pinnedColumns`) next to the new `columnWidths` and `density`; settings
    saved by 0.1.0 are read, while 0.1.0 finds no pins in newer settings,
  - rows carry `data-row-index`, and the cells of columns clipped at their
    width wrap their content in a `<div>` - snapshot tests change.
- **Input** with `prefix`, `suffix` or `clearable` (and a password field with
  a floating label) draws its border on a frame around the `<input>`;
  `className` still goes to the `<input>`. `InputProps` no longer includes the
  rarely used HTML `prefix` attribute - `prefix` is content shown in the
  field.
- **Select** - `options` is `(SelectOption | SelectOptionGroup)[]`; code
  reading `props.options` as `SelectOption[]` needs a narrowing check.
- **Progress** without a `value` is indeterminate (it showed an empty bar) -
  pass `0` for an empty one. The percentage follows the locale: "40 %" with a
  non-breaking space in Czech.
- **FileUpload** - the progress bar has no `aria-valuenow` until `upload`
  reports progress.
- **CollapsibleContent** - and so the content of an `Accordion` - clips its
  content only while it animates: content wider than its container shows past
  it; give it `overflow-x-auto` where it should scroll.
- **Tabs** - the gaps between the tabs are `gap-*` (a `space-x-*` in
  `className` no longer changes them); the tab list has `aria-orientation`.
- **Stepper** - the dashed lines of the horizontal stepper leave smaller gaps
  on phones (`mx-1`, `mx-4` from `sm`), so that more steps fit.
- **Dropdown** - `DropdownProps.items` and `NavbarUser.menuItems` are typed
  `DropdownEntry[]`; `(DropdownItem | ReactNode)[]` arrays still fit and
  `DropdownItem` stays an interface.
- **Colors** - texts reach the contrast WCAG AA asks for (4.5:1), focus rings
  and the parts of graphics 3:1: filled primary, success and danger buttons
  (and `.btn`) are a shade darker, warning buttons and selected warning chips
  are yellow with dark text, the text of outline and ghost buttons, of danger
  links and the error texts of the fields (`text-danger-700`,
  `dark:text-danger-400`) are darker, focus rings use the 500 - 700 shades
  (with a gap on filled buttons), muted texts are lighter in dark mode,
  progress bars and status dots are darker, the selected and current days of
  `Calendar` and the pickers and the current step of `Stepper` are
  `primary-600`, and the placeholders of the fields are `neutral-500`
  (`neutral-400` in dark mode). Screenshot and class-name tests change.
- **Drawer** is a `<nav aria-label="Main navigation">` - it was an `<aside>`
  around an unnamed `<nav>`, and `DrawerProps` are `ComponentProps<"nav">`;
  the bar of **Navbar** inside its `<header>` is a `<div>`. Tests finding the
  drawer as `complementary` look for the `navigation` named "Main navigation"
  (a closed drawer is hidden - `{ hidden: true }`), the navbar is the
  `banner`; styles for `aside.drawer` or `.navbar nav` use `.drawer` /
  `.navbar`.
- **SnackbarProvider** shows at most 3 toasts at a time (`maxToasts`); more
  wait until one closes, and their time starts when they show.
- **Pagination** buttons and the "Clear filters" / "Reset columns" buttons of
  `DataTable` keep the focus when their own press disables them: they are
  `aria-disabled` until the focus moves on - a test expecting
  `toBeDisabled()` right after the press sees `aria-disabled`.
- Czech texts: "…" instead of "...", "Nahrávání…" in `FileUpload`, the range
  of `Pagination` is "41–60 z 1 234"; the plural messages of `cs` have a
  `many` form for decimal numbers ("1,5 dne"). Tests matching the old texts
  need updating.
- **Progress** and **CircularProgress** round the percentage down (99.6 %
  shows "99 %").
- **Avatar** initials are the first letters of the first and the last word
  ("Jan Amos Komenský" → "JK").
- **Calendar** - the day view has a visually hidden heading with the day,
  announced when it changes; tests counting headings meet it.
- **Popover** with `interactiveTrigger` leaves Enter and Space to the control
  in its trigger - they no longer open or close it.

### New components

- **NumberInput** - a locale-aware number field:
  - formatted with `Intl.NumberFormat` of the `UIProvider` locale while it has
    no focus ("1 234,5" in Czech, "1,234.5" in English), the plain number
    while it is edited,
  - reads typed text leniently ("1.5" is 1.5 in Czech, "1,234.5" and "1.234,5"
    anywhere, a pasted "1 234,50 Kč") and refuses letters, a minus sign above
    a `min` of 0 and a decimal separator of whole numbers,
  - `min` / `max` / `step` on the grid of a native number input,
    `maximumFractionDigits` or `formatOptions` (currency, percent, unit); the
    value is clamped on blur or Enter and rounded to the fraction digits of
    the format,
  - step buttons that repeat while held (plus / minus on touch screens) and
    the keyboard: arrows, Page Up / Page Down (10 steps), Home / End (min /
    max); the mouse wheel only with `changeOnWheel`,
  - `value: number | null` + `onChange(value)`, `defaultValue`; the form gets
    the plain number ("1234.5") under `name`, and `form.reset()` brings back
    the default,
  - a `spinbutton` with `aria-valuenow` / `-valuemin` / `-valuemax` /
    `-valuetext`, and an `inputMode` that suits the phone.
- **DateRangePicker** - a from - to range of days. The value is
  `{ start, end }` (`DateRange`) in the `YYYY-MM-DD` format of
  `DateTimePicker`, `null` without a range (`value` / `defaultValue` /
  `onChange(range)`). The field shows it in the date format of the locale
  (`24.09.2026 – 30.09.2026`) and takes it typed - with any separator between
  the days; a reversed pair is swapped, one day is a range of that day. The
  calendar shows two months side by side (one on phones): the first click
  picks the first day, the second the last, and the range to the day under the
  pointer or in focus is previewed with its length; the arrow keys move on
  across the months, and the week starts on the first day of the locale.
  `presets` offers built-in localized ranges (`today`, `yesterday`,
  `last7Days`, `last30Days`, `thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`,
  `thisYear`, `lastYear` - `presets` alone six of them) and ranges of your own
  (`{ label, range }`), cut to `min` / `max`; `minDays` / `maxDays` limit the
  length. `startName` / `endName` submit the days, `name` the range as an ISO
  8601 interval (`2026-09-01/2026-09-30`); `required`, `disabled`, `readOnly`,
  `clearable`, `form`, `form.reset()`, `label`, `description`, `error` and
  `dim` work as in `DateTimePicker`. New types `DateRange`,
  `DateRangePickerProps`, `DateRangePreset` and `DateRangePresetKey`.
- **CheckboxGroup** - several of a few options, the counterpart of
  `RadioGroup`: a `<fieldset>` with a `<legend>` (or a named `group`),
  `options` (`CheckboxOption` - `label`, `value`, `description`, `disabled`),
  `value` / `defaultValue` / `onChange(values)` - in the order of the options,
  numbers stay numbers - `orientation`, `dim`, `description`, `error`, `form`.
  The checkboxes share `name` (`formData.getAll(name)`). `required` (=
  `min={1}`) and `min` make the browser refuse the form with a message in the
  language of the locale; `max` disables the other options once reached and
  says so. `selectAll` adds a partly-checkable "Select all" checkbox.
- **SegmentedControl** - a compact choice of one option (view switchers,
  periods): radios underneath - one Tab stop, the arrow keys move and pick -
  `options` (`SegmentedControlOption` - `label`, `value`, `icon`, `disabled`,
  `aria-label` for icon-only options, also their tooltip), `value` /
  `defaultValue` / `onChange(value)`, `name`, `required`, `size`, `fullWidth`,
  `label`, `description`, `error`. The selection slides to the picked option
  (at once with reduced motion).
- **PinInput** - one-time codes and PINs in a row of cells: `length`, `type`
  (`numeric` / `alphanumeric`), `mask`, `placeholder`, `dim`, `value` /
  `defaultValue` / `onChange(value)`, `onComplete(value)`, `autoFocus`, `name`
  (the joined code), `required` (every cell). Typing moves on, Backspace goes
  back, the arrow keys move; a paste into any cell and the code a phone offers
  (`autocomplete="one-time-code"`) fill the cells; digit keys type digits also
  on layouts with letters on them. One Tab stop; the cells are named "Digit 2
  of 6" in the language of the locale.
- **Slider** - a value or a range (`value: number | [number, number]`): `min`
  / `max` / `step`, `marks` (`SliderMark`), `formatValue` (value label,
  `showValue`, `aria-valuetext`), `valueLabel`, `minDistance`, `orientation`,
  `size`, `onChange` and `onChangeEnd` (once a drag or a key press is done).
  The keyboard of the WAI-ARIA slider, pointer and touch dragging (a finger on
  the track may still scroll the page), a press on the track moves the nearest
  thumb, the thumbs of a range do not cross, Escape during a drag puts the
  thumb back. `name` submits the value - a range two values under the name,
  the start first.
- **TagsInput** - free-form values (e-mail recipients, keywords): `value` /
  `defaultValue` / `onChange(tags)`, `separators`, `addOnBlur`, pasted text
  split at the separators and line breaks, `maxTags`, `allowDuplicates`
  (values compared ignoring case), `validate(tag)`, `suggestions` (a combobox
  matched ignoring case and diacritics), `name` (a hidden input per value),
  `required`. Every value has a × button; Backspace in the empty input moves
  to the last value, a second one removes it.
- **Field** - the label (with the required star and `form.labelSuffix`),
  description and error message of the library's fields for any control:
  `<Field label="…">{(controlProps) => <Control {...controlProps} />}</Field>`
  passes `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid` and
  `aria-required` (`FieldControlProps`). **FormDescription** - the help text
  under a field - is public.
- **Sheet** - a side panel dialog for record details and edit forms: `side`
  (`right`, `left`, `top`, `bottom`), `size`, `title`, `open` / `onClose`,
  `closeDisabled`, `closeOnBackdropClick`. It slides in and out (fades for
  users who prefer reduced motion), keeps its header and a `DialogFooter` in
  place while the content scrolls and takes the whole width on phones. It
  shares the implementation of `Dialog`: focus trap and return, Escape through
  the overlay stack, scroll lock, nesting with dialogs and popovers.
- **useConfirm** + **ConfirmProvider** -
  `if (await confirm({ title, message, confirmLabel, confirmColor })) …`
  without `open` state. The options are the props of `ConfirmDialog`; an async
  `onConfirm` keeps the dialog open with a spinner until it settles -
  returning `false` or rejecting keeps it open (logged in development), so the
  user can try again or cancel. Questions asked meanwhile wait for the open
  one, and one asked from its `onConfirm` shows above it; unmounting the
  provider answers them `false` (and a question asked after it right away),
  and `useConfirm()` outside the provider throws a clear error.
- **CommandPalette** - a ⌘K / Ctrl+K command menu: a search over grouped
  `items` (ignoring case and diacritics, matches highlighted, best first - the
  group of the best match on top, so Enter runs it), `href` items navigating
  through the router (addresses with a scheme only as `http(s):`, `mailto:`
  or `tel:` - a `javascript:` one from data is not opened),
  `loadItems(query, { signal })` for results from an API, item shortcuts shown
  with `Kbd`, full screen on phones.
- **ContextMenu** - a menu of actions for an element, e.g. a row: opened at
  the pointer by a right click, by a long press on touch screens, and next to
  the focused element by Shift + F10 or the context menu key (with its first
  item highlighted). The items and keys are those of `Dropdown`; it closes on
  Escape (a submenu first), a press outside, scrolling, resizing and after a
  pick, and gives the focus back. A single child element (a `<tr>`) gets the
  handlers itself; `disabled`, `onOpenChange`, `aria-label`.
- **ButtonGroup** - buttons joined into one piece, in a row or a column
  (`orientation`), a named `role="group"`. Its `color`, `size` and `variant`
  go to the buttons that do not set their own; a `Dropdown` with a button
  trigger or a `Tooltip` around a button joins it too.
- **SplitButton** - the button of a main action joined with a menu of related
  ones: `color`, `variant`, `size`, `disabled` and `loading` apply to both,
  `items` are those of `Dropdown`, the other props (`onClick`,
  `type="submit"`, `startIcon`, …) go to the main button. The menu button is
  named "More options" (`splitButton.moreOptions`) or `toggleLabel`.
- **CopyButton** - an icon button that copies `value`; its icon, name and
  tooltip say "Copied" for a moment (or that copying failed).
- **TreeView** - a tree of items to expand, select or check (the ARIA tree
  view pattern): arrow keys, Home / End, `*`, typeahead and a roving tab stop;
  `expanded`, `selected` (`selectionMode` `none` / `single` / `multiple` with
  Shift ranges and Ctrl / ⌘ + A) and `checked` work controlled and
  uncontrolled. `checkable` turns it into a checkbox tree with tri-state
  propagation (disabled items keep their state); a click on a checkbox toggles
  only it, also with `selectionMode`. `loadChildren` loads the children of
  `hasChildren` items on first expand, with a loading row and a retry after a
  failure - also by expanding the item again. `filter` shows the matching
  items with their ancestors, highlighted (ignoring case and diacritics).
  `renderLabel` and `renderActions` customize the rows; items with `href` are
  router links and the current page is marked and expanded to (of links to
  one path, the one whose query parameters the page has). `name` submits the
  checked (or selected) items with a form, and a reset brings back the
  defaults. Only expanded items are rendered - thousands of items stay fast;
  in right-to-left pages the arrow keys and the chevrons are mirrored.
- **Timeline** - events along a line for activity and audit logs: items with a
  `title`, `description`, `content`, `time` (a `Date` written by the locale in
  a `<time>` element, or a string), `icon` and `color`; `pending` items (a
  spinning marker, a dashed line, "Pending" for screen readers); `loading`
  placeholders; `size="sm"` for a compact list; `alternate` puts the items on
  both sides of the line (one side on phones); `timeFormat` takes
  `Intl.DateTimeFormat` options, e.g. a `timeZone` for server rendering. An
  ordered list.
- **Stat** - a key figure of a dashboard: `label`, `value` (a number in the
  format of the language - `formatOptions` - or any content), `change` (a
  share shown as a signed percentage, "+12.5%" / "+12,5 %", with an arrow,
  green for good and red for bad - none for a change that rounds to 0 %;
  `invertTrend` for costs, `trend` for content), `description`, `icon`, and
  `loading` placeholders as high as the text (`aria-busy`). A description
  list for screen readers; put it into a `Panel` for a card.
- **EmptyState** - takes the place of missing content (an empty list, a search
  without results, a first run): `icon`, `title` (a heading - `headingLevel`,
  3 by default), `description`, `action`, `children` and a compact
  `size="sm"`.
- **AvatarGroup** - overlapping avatars: `max` circles with "+N" in the last
  place (never "+1") - its tooltip lists the names, screen readers hear "+N
  more"; `total` counts people without an avatar; `size` for the avatars
  without their own.
- **CircularProgress** - a progress ring: `size` (32 - 96 px), `strokeWidth`,
  `showPercentage` or `children` in the middle; without a value it spins.
- **Kbd** - a key (`<Kbd>Esc</Kbd>`) or a keyboard shortcut
  (`<Kbd shortcut="mod+k" />` - ⌘ K on a Mac, Ctrl + K elsewhere; the server
  writes the Windows notation and the browser corrects it). The shortcut
  syntax (`"mod+shift+p"`, `"alt+arrowup"`, `"?"`) is shared by `useHotkeys`,
  the `shortcut` of `Dropdown` items and `CommandPalette`; `formatShortcut`,
  `matchesShortcut` and `parseShortcut` are exported - letters and digits also
  match by their place on the keyboard where the layout types another
  character (a Czech keyboard types "ě" on the 2 key).
- **Splitter** - resizable panes (`orientation` `horizontal` / `vertical`):
  handles dragged with the mouse, a pen or a finger, or moved from the
  keyboard (arrows, Shift for larger steps, Home / End, Enter collapses and
  restores a `collapsible` pane); a double click resets the two panes, Escape
  cancels a drag. `defaultSizes` / `sizes` + `onSizesChange`, `minSizes` /
  `maxSizes`, `paneLabels`; `storageKey` remembers the sizes (SSR-safe; kept
  within `minSizes` / `maxSizes`, and invalid stored sizes fall back to
  `defaultSizes`). Side-by-side panes stack on phones (`stackOnMobile`), and
  the handles follow the pointer and the arrow keys in right-to-left pages.
- **AccordionGroup** - `Accordion`s that open together: `type="single"`
  (opening one closes the open one; `collapsible` lets it close too, otherwise
  its toggle is `aria-disabled`) or `type="multiple"`; `value` /
  `defaultValue` / `onValueChange` by the new `value` of `Accordion`; the
  arrow keys, Home and End move between the section toggles. A standalone
  `Accordion` works as before; one nested in the content of a section stays on
  its own.
- **Separator** - a horizontal or vertical line, optionally with a `label`
  (`labelPosition` `start` / `center` / `end`); a named `separator` for
  assistive technology unless `decorative`.
- **Link** - a text link: paths go through the router's `Link`; addresses with
  a scheme, `#anchors` and downloads are plain links; `external` opens a new
  tab (`rel="noopener noreferrer"`) with an icon and a localized "(opens in a
  new tab)" for screen readers; `underline` (`always`, `hover`, `none`) and
  theme colors including `inherit`.
- **VisuallyHidden** - content for screen readers only; `focusable` shows it
  while it or a link in it has the focus, e.g. a "Skip to content" link.
- **Hooks**
  - `useMediaQuery(query, { serverValue })` - whether a media query matches,
    read on the first render in the browser; the server (and the hydrating
    page) renders `serverValue`,
  - `useDisclosure(initialOpen)` -
    `{ open, onOpen, onClose, onToggle, onOpenChange }`, named after the props
    they fit (`<Dialog open onClose>`, `<Popover open onOpenChange>`),
  - `useClipboard({ timeout })` - `copy(text)` (resolves with whether it
    worked, never rejects), `copied` for `timeout` ms, `error`, `reset()`;
    falls back to the copy command on `http://` pages,
  - `useDebouncedValue(value, delay)` and
    `useDebouncedCallback(callback, delay, { flushOnUnmount })` with
    `cancel()` / `flush()`,
  - `useLocalStorage(key, defaultValue, { serialize, deserialize })` -
    `[value, setValue, remove]`, JSON by default, shared by the hooks of one
    key and across browser tabs; the default on the server and while
    hydrating, for unreadable text and with blocked storage,
  - `useHotkeys(hotkeys, { enabled, preventDefault })` - shortcuts in the
    syntax of `Kbd`; not while typing into fields (unless `allowInFields`),
    not for key presses the page has handled, not under a modal dialog.
- **Color scheme** - `useColorScheme()` (light / dark / system, remembered in
  `localStorage`, applied as the `dark` class and `color-scheme` of `<html>`,
  following the system), `ColorSchemeToggle`, and `getColorSchemeScript()` /
  `ColorSchemeScript` against a flash of the wrong scheme before the app
  loads.

### New features

- `form` on `RadioGroup`, `RichTextEditor` and `FileUpload` - their inputs
  belong to a form elsewhere in the page, whose reset resets them, like the
  other fields.
- `description` - a help text under the field, in `aria-describedby` after the
  error and before your own ids - on `Input`, `Textarea`, `Select`, `Switch`,
  `RadioGroup`, `Autocomplete`, `DateTimePicker` (also in `native` mode),
  `RichTextEditor` and `FileUpload`, like `Checkbox` has it (its `description`
  takes any content now).
- **Checkbox** - `indeterminate` shows a partly checked state (announced as
  "mixed"), e.g. a "select all" of a partly selected list; a click clears it
  like on a native checkbox, and the next render brings it back while the prop
  says so.
- **Input**
  - `prefix` / `suffix` - an icon, a unit or `https://` inside the border of
    the field; a click on them focuses it,
  - `clearable` - a clear button (`input.clear`) that fires a real change
    event and moves the focus into the field.
- **Textarea**
  - `autosize` with `minRows` / `maxRows` (CSS `field-sizing`, measured where
    it is not supported),
  - `showCount` - a character counter ("123 / 500" with `maxLength`); screen
    readers are told how many characters are left near the limit.
- **Select** - option groups (`{ label, options }` → `<optgroup>`, type
  `SelectOptionGroup`) and `disabled` per option or group.
- **RadioGroup** - `disabled` and `description` per option,
  `orientation: "vertical" | "horizontal"`.
- **Calendar**
  - an agenda view (`"agenda"` in `viewOptions` / `view`): the events of a
    period as a list grouped by day - all-day events first, then by start,
    with their times on the clock of the locale, color, icon, resource and
    actions. An event over several days is listed on each of them ("Day 2/3",
    "from 8:00 PM", "until 6:00 AM"). `agendaPeriod` sets the period - the
    month of the current date (default), its week or day, or a number of days
    from it; Previous / Next move by it. The day headings stay on top, a
    period with today opens at today, a heading picks its day (`onDateClick`),
    the events are buttons reached by Tab, and an empty period says "No
    events",
  - `resources` (`CalendarResource` - `id`, `title`, `color`) and the
    `resourceId` of events: the day view shows a column for each resource, the
    week view one for each resource of every day, with the resource names in
    the sticky header. Dragging an event to another column moves it to that
    resource (`EventTimeChange.newResourceId`, also given on resizes); ranges
    and slot clicks come with the `resourceId`
    (`NewEventTimeRange.resourceId`, the second argument of `onDateClick`).
    Events without a color take that of their resource, and the names of tiles
    and slots include it. Many resources scroll sideways under the sticky time
    column - a drag near the edge scrolls along,
  - recurring events: `recurrence` - a `CalendarRecurrence` (`freq`,
    `interval`, `count`, `until`, `byWeekday` also with the nth weekday,
    `byMonthDay`, `byMonth`, `bySetPos`, `weekStart`) or an iCalendar
    `RRULE` - and `exdates`. The calendar shows the occurrences of the visible
    range with the clock time of the event, also over a daylight saving
    change, all-day ones as whole days. Each has an `id` of its own,
    `recurringEventId` and `occurrenceStart`, so a click, drop or resize can
    change one occurrence or the whole series; an event of the app with the
    `recurringEventId` and `occurrenceStart` of an occurrence replaces it,
  - a Today button in the header,
  - `expandRecurringEvents(events, range)` - the occurrences of recurring
    events in a range, e.g. for a list next to the calendar,
  - `getCalendarVisibleRange` takes `{ agendaPeriod }` as a fourth argument
    (`CalendarVisibleRangeOptions`); new types `CalendarAgendaPeriod`,
    `CalendarRecurrence` and `CalendarResource`.
- **DataTable**
  - column resizing: a handle on the edge of each column header - drag it
    (also by touch), or focus it (a `separator` with its width in pixels) and
    use the arrow keys (Shift for bigger steps), Home / End for the limits; a
    double-click or Enter brings back the column's width. `minWidth` /
    `maxWidth` limit it, `Column.resizable: false` and
    `resizableColumns={false}` turn it off, the new `Column.width` sets a
    starting width. Widths are remembered under `tableId` and cleared by
    "Reset columns",
  - `Column.pinned` (`"left"` / `"right"`) pins a column by default - users
    still pin and unpin columns in the column settings. Pinned columns stick
    after the expand, selection and actions columns, also with resized widths,
    and cast a shadow over the columns scrolled under them; where they would
    cover more than half of a narrow view, they scroll along,
  - `density` (`"compact"`, `"normal"`, `"comfortable"`) and a row density
    control in the toolbar (`densityControl={false}` leaves it out); the
    user's choice is remembered under `tableId`,
  - CSV export: `enableCsvExport` adds a toolbar button exporting every page
    of what the user sees - all matching rows of a `clientSide` table in their
    order, or the rows `onExport(query)` returns with server data (a spinner
    meanwhile) - in the visible columns and their order, with the values the
    cells show (`getValue`, dates and booleans by the locale, the new
    `Column.exportValue`). UTF-8 with a BOM, RFC 4180 quoting (texts with `,`,
    `;` or a tab are quoted whatever the separator), `;` for languages writing
    a decimal comma and `,` otherwise (`csvSeparator`), numbers with the
    decimal separator of the language, a leading `'` for texts a spreadsheet
    would run as a formula (also after spaces; numbers written as text, like
    "-3.50", stay numbers), `exportFilename`. `createCsv`,
    `downloadCsv` and `getCsvSeparator` are exported for exports of your own,
  - `virtualized` renders only the rows in view of the scrolling table: rows
    and expanded details are measured, the header and summary rows stick,
    selection, filters, sorting and the search cover all rows, the row with
    the focus stays rendered while it is scrolled away, pinned columns work,
    and `aria-rowcount` / `aria-rowindex` tell screen readers the rest.
    Columns sized by their content keep the widths of the rows shown first
    while the table scrolls,
  - inline editing: `Column.editable` (`true` or a function of the row) with
    `onCellEdit(row, columnKey, value)`. Built-in editors by the values of the
    column or `Column.editor` (`text`, `number`, `select` with
    `editorOptions`, `date`, `checkbox`), your own with `Column.renderEditor`,
    checks with `Column.validate`. Enter, F2 or a double-click (a tap on the
    focused cell on touch screens) start editing, Enter saves, Escape cancels,
    Tab / Shift + Tab save and edit the next / previous editable cell, and
    leaving the field saves - a field left unchanged saves nothing (also when
    the row was refetched meanwhile), a new day keeps the time of a date-time,
    and the number editor refuses text that is no number. While the promise of
    `onCellEdit` runs the cell shows the new value with a spinner (also when
    the table gets new row objects meanwhile); when it rejects, the value from
    before with the message. While a cell is edited the rows keep their
    places, and a new order applies once the editing ends; another page, sort,
    filter or search ends the editing,
  - summary row: `Column.summary` (`sum`, `avg`, `min`, `max`, `count` or a
    function of the rows) over all rows matching the filters of a `clientSide`
    table, `summaryValues` for the values of a server - written by the locale,
    sticky at the bottom with `maxHeight`,
  - new types `CellEditorProps`, `ColumnEditor`, `ColumnPin`, `ColumnSummary`,
    `DataTableDensity`, `CsvOptions`.
- **Dropdown** items:
  - `icon`, `description` (a second line), `danger` and `shortcut` (shown with
    `Kbd` in the notation of the platform, announced by `aria-keyshortcuts` -
    display only),
  - `disabled` - reachable with the arrow keys and announced as unavailable,
    as the ARIA menu pattern asks, but not picked,
  - `{ type: "separator" }` and `{ type: "group", label, items }` - items
    under a heading that names their group,
  - checkboxes (`checked` + `onCheckedChange`) and radio options
    (`{ type: "radio", value, onChange, options }`): Space toggles them and
    keeps the menu open, Enter and a click close it unless `keepOpen`,
  - submenus (`items` on an item): opened after a moment of hovering, by a
    click or tap, ArrowRight, Enter or Space, closed by ArrowLeft or Escape;
    the pointer may cross other items on its way to one; they open to the left
    near the edge of the screen and below their item on phones,
  - typed letters move to the next item starting with them,
  - new types `DropdownEntry`, `DropdownGroup`, `DropdownRadioGroup`,
    `DropdownRadioOption`, `DropdownSeparator`; new `onOpenChange`.
- **Button** - `startIcon` / `endIcon`, spaced by the size and hidden from
  screen readers (the loading spinner takes the place of the start icon), and
  `fullWidth`.
- **useSnackbar** - `enqueueSnackbar` returns the id of the toast,
  `closeSnackbar(id?)` closes one toast or all, and
  `promise(promise, { loading, success, error })` shows one toast that turns
  from a spinner into the success or error message (texts, or functions of the
  value / error) and returns the promise. New options `action`
  (`{ label, onClick }`, e.g. "Undo" - the toast closes after it and stays 6 s
  by default) and `title`.
- **Toast** - `action`, `title`, `loading` and `open` (`false` slides it out).
- **SnackbarProvider** - `maxToasts` (3 by default, `Infinity` for no limit):
  further toasts wait in order and show as others close, their time starting
  then; `closeSnackbar` drops a waiting one. New type `SnackbarProviderProps`.
- **Tooltip** - a width class lets the element in it fill its container:
  `<Tooltip className="w-full">` around a `w-full truncate` title.
- **Drawer** - `id` on items keeps the state of a group (expanded, its
  popover) when items before it come and go.
- **DateTimePicker** and **DateRangePicker** read typed dates without a year
  (the current one) and with two digits ("1.1.26", "9/24/26" - 80 years back
  to 19 ahead), where the year follows the day or month; `111226` is
  11.12.2026.
- The types `AvatarSize` and `ChipSize` are exported.
- **RichTextEditor**
  - headings (h2, h3), bulleted and numbered lists with indent / outdent,
    quotes, underline, strikethrough, inline code, horizontal lines, clear
    formatting, and undo / redo with an own history (typing is one step, and
    so is a word composed with an input method or a dead key; the browser's
    history is shared by the page),
  - tables - insert with a rows × columns form and an optional header row; add
    / remove rows and columns, toggle the header row and delete the table from
    the table tools; Tab / Shift + Tab move between cells and Tab in the last
    cell adds a row,
  - `toolbar` - the tools and their order, `"|"` between groups
    (`DEFAULT_RICH_TEXT_TOOLBAR` by default, `[]` for none); the value keeps
    only the formatting of these tools,
  - keyboard shortcuts for every tool (Ctrl / ⌘ + B, I, U, Ctrl + Shift + 7 /
    8 / 9, Ctrl + Alt + 0 / 2 / 3, Ctrl + K, Ctrl + Z / Y, …), shown in the
    tooltips and `aria-keyshortcuts`; Alt + F10 moves to the toolbar,
  - the link tool edits or removes the link at the caret,
  - `sanitizeRichText(html, { formats })`; new exports
    `DEFAULT_RICH_TEXT_TOOLBAR`, `RichTextTool`, `RichTextToolbarItem`,
    `RichTextFormat`, `SanitizeRichTextOptions`; `.rich-text` styles headings,
    lists, quotes, code, rules and tables. A table of more than 50 columns or
    10 000 cells comes out without its merged cells, and where it is still too
    big as lines of text - a few kilobytes of `colspan` cannot grow into
    millions of cells; the table tools stop at those limits.
- **Tabs**
  - `disabled` items - dimmed and not selectable, the arrow keys skip them; a
    disabled link tab has no `href` and no tab stop,
  - `icon` per item, shown before the label,
  - `orientation="vertical"` - a column switched with the up and down arrows.
- **Stepper**
  - `orientation`: `"vertical"` lists the steps with their titles and
    descriptions, `"responsive"` is vertical on phones (below `md`) and
    horizontal from it,
  - `description` per step - under the title in the vertical layout, in the
    tooltip and the accessible description of the horizontal one,
  - `content` per step - shown while it is the current step: right under it in
    the vertical layout (a vertical wizard), under the row of steps in the
    horizontal one. When the step changes with the focus in the content of the
    last one, the focus moves to the content of the new step (a group named
    after it),
  - native attributes on the wrapper (`id`, `aria-*`, `data-*`, …).
- **Chip**
  - `onRemove` adds a remove button named "Remove" and the text of the chip
    (`removeLabel`); Backspace / Delete on it remove the chip, and the focus
    moves on to the next chip,
  - `selected` / `defaultSelected` / `onSelectedChange` make it a toggle
    button (`aria-pressed`) - filled, with a check mark, when selected,
  - `icon`, `size` (`sm` / `md` / `lg`) and `disabled`.
- **Avatar** - `status` (`online` / `offline` / `busy` / `away`): a dot in the
  corner (a crescent for `away`), heard with the name ("Jana Nováková,
  Online"); new size `xl` (64 px).
- **Skeleton** - `variant`: `rect`, `circle` or `text` with `lines` as high as
  the text lines around, the last of several shorter.
- **Progress** - without a `value` (or with `indeterminate`) the bar keeps
  moving and tells screen readers no value; with reduced motion it fades in
  the middle of the track. It takes the props of a `<div>` - `id`,
  `aria-valuetext` ("3 of 5 files"), `data-*` go to the bar, `style` to the
  wrapper.
- **FileUpload** - `preview` shows thumbnails: a picked image while it
  uploads, then its new `thumbnailUrl` or `url`, an icon for other files;
  `aria-describedby`.

### Changed APIs

- **Autocomplete**
  - without `multiple`, `value` / `defaultValue` take one value or `null` and
    `onChange` is `(value, item)`; with it they take arrays and `onChange` is
    `(values, items)` - the casts in apps can go,
  - `asSelect` is a select-only combobox: Space picks the highlighted option
    and typed letters highlight the next option starting with them,
  - `loadSelectedOptions(values, { signal })` is aborted on unmount or when
    the values change first; a value it does not deliver shows as it is, and
    labels it failed to load are asked for again when the list next opens,
  - `form` ties the hidden inputs to a form elsewhere in the page, whose
    reset resets the field too,
  - `getOptionLabel` / `getOptionValue` also read static `options`, which may
    then be items of any shape,
  - options can be `disabled`; with `maxSelections` reached the list says so
    and offers only the selected options,
  - `aria-describedby` / `aria-labelledby` go to the combobox.
- **Calendar**
  - the `renderEventActions` controls and the links of an `htmlTitle` sit
    next to the button of the tile, no longer inside it,
  - events may come in any order: all-day events first, then by start, the
    longer of events starting together first (also the Tab order),
  - overlapping events are laid out side by side in columns; tiles are at
    least 24px high, and events without a length are shown,
  - resizing moves an edge by whole slots from where it is, like moving;
    moves and resizes follow the clock of the rows, also on daylight-saving
    days,
  - with `onSlotDragEnd` the slots are operated from the keyboard: Shift +
    arrow up / down select, Enter or Space create the range, Escape drops it;
    without `onDateClick`, Enter, Space or a tap on a slot creates a one-slot
    range,
  - Escape cancels a drag, a resize or a range selection; a drag near the top
    or bottom edge scrolls the view, and scrolling during a drag counts as
    moving,
  - the all-day row of the week view shows two events and "+N more",
  - `htmlTitle` is sanitized in the browser - server rendering shows the
    plain `title` until hydration,
  - the last row of `dayEndHour={24}` reads 12:00 AM, or 24:00 on the
    24-hour clock,
  - the header date field has no clear button and offers only
    `minDate` - `maxDate`,
  - month days have `aria-current="date"` (today, after hydration) and
    `aria-pressed` (the selected day),
  - a controlled `currentDate` without `setCurrentDate` logs a warning in
    development; server rendering should pass `initialDate` (documented),
  - the header has a Today button between Previous and Next; the date field is
    144px wide on phones (was 160px), and a calendar narrower than the screen
    wraps the view switcher into a row of its own instead of cutting it off,
  - moving an event near the left or right edge of a view that scrolls
    sideways (the week on a phone) scrolls it along.
- **DataTable**
  - `GroupActionSelection` has the `query` the rows were selected under -
    with `allFiltered` a server rebuilds the set from its `filters` and
    `search`; a `clientSide` table gives the action all matching rows, not
    just the page,
  - hiding a column (or "Reset columns") clears the filter of its field and
    reports the new query,
  - without `enableGlobalSearch` a `clientSide` table ignores `query.search`;
    "Clear filters" also clears such a search (a server still applies it)
    and shows whenever a hidden column filters,
  - a refetch keeps the selected rows that are still there; other filters
    still drop the selection,
  - full screen behaves like a dialog: Escape leaves it (after closing what
    is open in the table), Tab stays in the table, the page does not scroll,
  - lists without a `render` show as "alpha, beta" (objects in them as JSON),
    the search finds their items and a `select` filter matches any item;
    numbers stored as strings sort by their value,
  - tables with the same `tableId` share their column settings live, also
    across browser tabs,
  - filter keys without a column that has `filter` / `filterFn` (e.g. from
    an old link) are ignored by a `clientSide` table and
    `applyDataTableQuery`; a server table still sends them and offers "Clear
    filters" for them,
  - `GroupAction.onClick` may return anything - only `false` (or a promise of
    `false`) keeps the selection, so `(rows) => enqueueSnackbar(…)` still
    compiles,
  - the expand column sticks to the left like the selection column; a control
    the focus moves to is scrolled out from under the sticky header, summary
    and pinned columns,
  - column headers are named by their label alone (`aria-labelledby`),
  - pinned columns cast their shadow only while columns are scrolled under
    them.
- **useDataTableQuery** - URL-synced tables of one page (`urlPrefix`) build on
  each other's pending URL changes.
  It warns in development when a page size is not among its
  `pageSizeOptions` - pass the ones of the table, or the URL snaps it back to
  the default.
- **DateTimePicker**
  - the other native attributes (`aria-*`, `data-*`, `title`, `tabIndex`,
    `autoFocus`, `form`, key and pointer handlers) reach the visible field,
    `form` also the hidden input; `aria-describedby` is merged with the error
    message, and a key handler that prevents the default skips the picker's
    own,
  - `onFocus` / `onBlur` treat the field, its clear button and its popup as
    one field; `ref` is the visible field (its `value` is the displayed text),
  - a picked, typed or clamped time moves onto `minuteStep`, and
    `mode="native"` takes its `step` from it; a time range with `min` after
    `max` (22:00 - 06:00) spans midnight,
  - the popups are named dialogs the field points at (`aria-controls`); Tab
    and Shift + Tab move through a popup and out of it; the month and week
    grids and the time lists have Home / End / Page Up / Page Down,
  - AM / PM follow the locale, and week buttons follow the week format of the
    locale ("KW 39"),
  - new `clearable`.
- **Dialog** - `role` (`"dialog"` or `"alertdialog"`) is applied - it was
  ignored. After a Dialog opened from a popover panel closes, the focus goes
  to the trigger of the popover.
- **ConfirmDialog** is an `alertdialog` described by its `message`; new
  `className`.
- **Popover**
  - new `buttonTrigger`: a `Button`, `IconButton` or `<button>` given as
    `trigger` becomes the trigger itself (`aria-expanded`, `aria-haspopup`,
    `aria-controls`, the focus) instead of being wrapped in a
    `div role="button"`,
  - Escape in a hover popover, and a panel closing with the focus in it (a
    pick, a submitted form), give the focus back to the trigger,
  - `aria-*` props passed as `undefined` do not remove those of a
    `buttonTrigger`; `PopoverPopupRole` is exported.
- **Dropdown** - new `buttonTrigger`; Space picks the highlighted item and
  Home / End jump to the first / last one.
- **Overlays** - new `useOverlay` + `OverlayScope` join overlays of your own to
  the stack (Escape, stacking, focus trap, scroll lock), and
  `data-focus-trap-exempt` keeps third-party widgets usable while a Dialog
  traps the focus. Tab goes on from the last control of a Dialog, or of the
  slid-in Drawer, to the toasts over it. `Overlay` has a new `portal`.
- **Drawer** - collapsed, the popover of a group opens on hover and on
  keyboard focus, and Enter moves the focus into it; an item without `icon`
  shows the first letter of its label; a group expands when the current page
  moves into it; on phones the drawer is a modal dialog.
- **Navbar** - the drawer toggle has `aria-expanded`; `user.menuItems` takes
  every `DropdownEntry` (separators, groups, submenus).
- **Toast** - new `onHide`; a toast renders nothing once it has hidden itself
  or was dismissed; an `id` prop is kept.
- **SnackbarProvider** - a message can be shown again while its previous toast
  slides out.
- **sanitizeRichText** (the sanitizer of `RichTextEditor`, for rendering
  stored HTML) and **isSafeHref** are exported.
- **FileUpload** - `accept="*/*"` (or `*`) accepts any file, and a file
  without a type fits `image/*`, `video/*` or `audio/*` by its extension
  (HEIC, AVIF, WebP, …).
- **RichTextEditor** - new `id`, `aria-label`, `aria-labelledby`, `onBlur`
  (when the focus leaves the editor and its toolbar) and `ref` (the editable
  element), so it can be named without a label and used with React Hook
  Form. An uncontrolled editor follows a `defaultValue` that arrives after
  the first render until the user edits. Pasted headings, list items, quotes
  and table rows become paragraphs, and the bold and italic text of Google
  Docs and Word stays. Formatting the value cannot keep (underline) is not
  applied. The link field also takes `localhost:3000`, e-mail addresses
  (`mailto:`) and phone numbers (`tel:`). Rendered on the server it is empty
  until it hydrates.
- **FileUpload** - new `className` (the field keeps its `my-4`; override it
  with e.g. `my-0!`); with a `name`, `required` counts only files with a
  `value`; Cancel makes the field ready at once, also when `upload` ignores
  the signal - its late result is ignored.
- **uploadWithProgress** - a failed response rejects with an `UploadError`
  (an `Error`, exported) with `status`, `statusText` and `responseText`
  (status 0 for network errors and timeouts); new options `withCredentials`
  and `timeout`.
- **ErrorBoundary** - new `resetKeys`; a thrown non-`Error` (`undefined`,
  `null`, `""`) is caught and passed on as an `Error` with the value as its
  `cause`.
- **Progress** - new `aria-label` / `aria-labelledby`; `description` describes
  the bar; the value is clamped to 0 - `max`.
- **Tabs** with `includeQueryParams` - the tab whose parameters all match the
  URL wins, the one with the most of them; the first tab only while the URL
  has none of the parameters of the tabs. A `ValueTabItem` takes `id` and
  `panelId` (`aria-controls`) to connect a tab with its panel.
- **Accordion** - clicks on links, buttons and fields in a `header` do not
  toggle the section; the toggle has `aria-controls`, and
  `CollapsibleContent` takes an `id`.
- **Breadcrumbs** wrap on narrow screens; an item without `href` before the
  last one is text (it linked to `/`).
- **Button** - a disabled or loading `<Button link>` renders an
  `<a role="link" aria-disabled="true">` without `href`, so neither a middle
  click nor the context menu opens it.
- **RadioGroup** without `name` is not submitted with its form (it was, under
  a generated name).
  It takes `id`, `ref` (the group element), `aria-describedby` and
  `onBlur` / `onFocus`; its error id derives from `id`.
- **Input** and **Textarea** take `dim="xs"`, like `Select` and `RadioGroup`.
- **Switch** keeps a consumer's `aria-labelledby` next to its `label`.
- **Tooltip** - every tooltip can be hovered (WCAG 1.4.13): the pointer may
  move onto it, and it hides 150 ms after the pointer leaves the trigger or
  the tooltip. A click on a plain tooltip hides it; `interactive` now means a
  click in it (text selection, scrolling a list) keeps it open.
- **getBaseError** gives the message of an error without field messages - the
  `message` of a GraphQL error, a `detail` (Django REST framework), a
  `message`, or the `title` of problem details (ASP.NET).
- **sanitizeInlineHtml** (the `htmlTitle` of `Calendar`) keeps classes only
  behind `dark:`, `hover:`, `focus:`, `focus-visible:` and `active:`, and
  only small paddings (`px-*` up to 3, `py-*` up to 1) and borders (up to
  2px).
- **removeDiacritics** folds letters with a stroke (ł → l, ø → o, đ → d, …) -
  "lodz" finds "Łódź".
- **Localization** - `createLocale` and the `messages` of `UIProvider` replace
  a plural message given with its `other` form as a whole; `formatPlural` and
  the counts of `DataTable` write numbers as the language does (`12,345`,
  `12 345`); a locale `code` that `Intl` does not understand falls back to
  `en-US` with a warning.
- `styles.css` tones down motion for users who prefer reduced motion: slides
  become fades, nothing pulses, the spinner turns slower and the components
  drop their moving transitions - also Tailwind's `animate-spin` /
  `animate-pulse` in your own markup.
- Modal overlays (`Dialog`, `Sheet`, the slid-in `Drawer`, `useOverlay` with
  `modal`) take the focus back when the focused element is removed with their
  content - a sheet switching from a record's details to its form - instead of
  losing it to the page.
- Focus traps and the Tab order the library computes (`Dialog`, `Sheet`,
  `Popover`, `Dropdown`, …) treat a radio group as one Tab stop, as the
  browser does.
- An uncontrolled `Dialog` leaves the overlay stack as soon as it starts
  closing: an Escape during its closing animation goes to the overlay under
  it, and clicks go through.
- `ConfirmDialog` gives the focus back to the confirm button when `loading`
  ends and the dialog stays open (the action failed), so Enter tries again.
- `enqueueSnackbar` does not merge toasts with an `action` and compares the
  `title` too; a dismissed toast gives the focus to the close button of the
  next toast, never to its action.
- **Tabs** - a bar wider than its container fades out at the edges that hide
  more tabs, keeps the active tab in view (also when the page opens on it and
  when Tab reaches a tab under a fade) and has a thin scrollbar; link tabs
  have the focus ring of the value tabs; the arrow keys ignore Alt / Ctrl /
  Meta (Alt + ArrowLeft goes back in the browser history).
- **Dropdown** - the menu is named by its trigger (`aria-labelledby`), is up
  to 24rem tall before it scrolls (was 15rem), grows so its labels stay on one
  line (from the `sm` breakpoint) and scrolls the highlighted item into view.
  The pointer and the keys move one highlight. Items are no Tab stops, and
  `""` / `true` entries are skipped like `false` / `null`.
- **Button** - the loading spinner sits where the start icon is, spaced like
  an icon (it had `mr-2 -ml-1`). In a `ButtonGroup` a button takes the
  defaults of the group and its joined corners.
- `useIsMobile` is built on `useMediaQuery` - same API and behavior.
- **Progress** writes the percentage as the language does ("40 %" in Czech);
  `value` is optional.
- **FileUpload** - the bar is indeterminate until `upload` reports progress
  (it sat at 0 %); the "drag and drop" hint is hidden on touch screens.
- **RichTextEditor**
  - the toolbar is one Tab stop (arrow keys, Home / End), its tools say their
    state with `aria-pressed`, and unavailable tools stay focusable with
    `aria-disabled`; ghost buttons that wrap in groups on phones,
  - pasted and loaded content keeps headings, lists, quotes and tables when
    their tools are there (h1 → h2, merged cells split; the lists of Word,
    nested too, become lists without their bullet characters); underline,
    strikethrough and monospace text of Google Docs / Word stay as well; what
    is pasted over the whole text (select all) keeps its blocks,
  - Enter in an empty list item or quoted line leaves it; Enter in a table
    cell breaks the line; an empty editor starts in a paragraph,
  - the editor shows the focus ring of a field while its text is focused.
- **FileUpload** writes the label suffix of the locale (`form.labelSuffix`)
  after its label, like the other fields.

### Fixed

- An open `Popover` covered its trigger: a second click into an open
  Autocomplete or date picker closed it and lost the focus; placing the
  caret, chip × and clear buttons failed; a hovered trigger got no clicks.
- `Select` showed and submitted its first option after `form.reset()` or a
  React form action when it had not been changed (a multiple one lost its
  selection) and ignored a later `defaultValue` there; a controlled one
  showed its first option after the reset of a form action. `RadioGroup`
  forgot a later `defaultValue`, and a controlled `RadioGroup`, `Checkbox` or
  `Switch` lost its state in that reset. `<Select multiple>` without
  `defaultValue` logged a React warning.
- `DateTimePicker`:
  - a time typed without minutes was read wrongly (`14` as 01:04, `10 pm` as
    13:00), and `5 pm` / `8` were refused,
  - Tab out of the popup lost the focus, and `onBlur` never came when the
    focus left from the popup,
  - a date typed before ArrowDown showed the old month, and Enter then
    overwrote it,
  - `event.currentTarget` and `event.preventDefault()` threw in `onChange`,
  - native attributes were dropped, the native mode replaced the
    `aria-describedby` of the caller, and `form="…"` submitted nothing,
  - an arrow key stopped at `min` / `max` made the next year click move the
    focus into the grid,
  - the date popup showed the years 0 - 99 as 19xx, and months and weeks
    before the year 1000 were emitted without four-digit years,
  - an empty time picker showed 00:00 as selected, and the popup opened by
    itself after `disabled` was toggled,
  - an invalid locale code crashed it,
  - `23:58` with a `minuteStep` of 5 snapped back to `23:55` of the same day
    instead of the nearer `00:00` of the next day; a time-only picker still
    stays on its day.
- `Calendar`:
  - action buttons and title links of draggable events did nothing on a mouse
    click,
  - server rendering crashed with an `htmlTitle`
    (`DOMParser is not defined`),
  - the time column and crowded tiles painted over the sticky header,
  - arrow keys and Enter started from a remembered slot or day, not the
    focused one,
  - midnight (`dayEndHour={24}`) was labeled 12:00 PM,
  - a second finger took over a drag, small resizes moved the edge the wrong
    way, and ranges could not be dragged upward,
  - the events of days disabled by `minDate` / `maxDate` could be moved and
    resized,
  - a click with a slight wobble was swallowed, the drop could miss the last
    pointer move, Ctrl + click on a Mac started a drag, and a drag whose
    release was lost stuck,
  - the day view dropped "(all day)" after an `htmlTitle`, month tiles with an
    icon were two lines high, and every pointer move rendered the whole week
    again,
  - a click or Enter on the row of the end hour picked a time after the grid
    (22:00 with `dayEndHour={22}`) - now the last slot,
  - slot names ignored the 12- / 24-hour clock of the locale,
  - an event dragged away and back to where it was opened as if clicked,
  - the month view and the navigation turned the years 0 - 99 into 19xx,
  - over a daylight saving change a range picked in the hour the clocks skip,
    or an event moved into it, came out with no length, and a resize could
    leave an event empty or ending before its start - a range now keeps its
    length from the end of the gap, a moved event its length in absolute
    time; the slots of the skipped hour were all named by its end ("3:00"),
  - an all-day event of `new Date("2026-09-24")` - `new Date("2026-09-25")`
    (UTC midnights) showed on two days outside UTC; such events now take
    their UTC days - pass local midnights (`new Date(2026, 8, 24)`),
  - drags cancelled by Escape kept their document listeners until the
    release, missed a lost release and then swallowed an unrelated click.
- `DataTable`:
  - text typed into a filter or the search was lost when a router applied the
    URL changes late,
  - it crashed with blocked `localStorage`, and saved column settings caused
    a hydration mismatch,
  - an `undefined` field in `defaultQuery` crashed it,
  - large client-side tables were slow: sorting set up the collation per
    comparison (10 000 rows: 320 → 13 ms), every render sorted again,
    select-all was quadratic, and the React Compiler skipped the component,
  - URL state appended the old hash at the root of a hash router and dropped
    the document hash under a `basename`,
  - array values without `render` crashed or ran together,
  - the first-load spinner covered the toolbar and the pagination, and Escape
    in the search left the focus in the hidden field,
  - two URL-synced tables changed together kept only the last change,
  - `applyDataTableQuery` returned wrong rows for a page below 1 or a
    fractional page,
  - a cleared filter could come back with a router that applies URL changes
    late,
  - rows had an unsupported `aria-selected`, and group actions with the same
    label collided,
  - Previous / Next built on the shown page instead of a change still on its
    way: with a router that applies the URL late two quick clicks on Next
    ended on page 2, and Next right after a filter change skipped pages of
    the new rows,
  - a client-side table filtered and sorted all rows again on every render
    of a parent passing a new `columns` array (`columns.slice(0, 4)`, an
    inline `render`),
  - URL state wrote `filters=` for filters equal to the defaults but set in
    another order, and the same filters made different URLs.
- `Autocomplete`:
  - Enter confirming an IME conversion picked an option, and the arrow keys
    of IME candidates moved the highlight,
  - Backspace removed a value while the chips were still loading, and Enter
    / Space toggled the list then,
  - the list opened on focus of a chip, the clear button, after a chip was
    removed, or from an invalid submit,
  - the first list load could not be aborted when the field unmounted first,
  - options with the same value shared a row key and a highlight (a warning
    now says so in development),
  - the hidden validation input was focusable while `aria-hidden`.
- `Autocomplete`: the clear button dropped the focus to the page from the
  keyboard; no keyboard focus was visible; a field disabled while open stayed
  "open" and opened again when enabled; static `loadMore` never ran when the
  options did not fill the list; `asSelect` + `hasEmpty` + `loadOptions`
  showed neither "Loading…" nor "No results"; the loading row put a `<div>`
  in a `<p>`; the React Compiler skipped it, so every hover rendered the
  whole list again.
- The slid-in `Drawer` ended up under its own backdrop in a parent with a
  transform, filter or z-index; the popover of a collapsed group closed under
  the pointer; a group did not expand when the current page moved into it; on
  phones a server-rendered drawer showed open until hydration.
- A `Toast` without `onClose` came back after hiding, and in
  `SnackbarProvider` new toasts kept a hidden one mounted.
- The focus was lost after a Dialog opened from a popover closed, and when a
  popover was closed from outside with the focus in its panel; an `autoFocus`
  field in a popover panel closed the popover. An uncontrolled Dialog
  unmounted by its parent did not give the focus back.
- `Popover` and `Tooltip` closed on Escape before a field inside could handle
  it - e.g. the link form of a `RichTextEditor` in a Popover.
- `Dropdown`: Enter or Space on a link item threw for external and `mailto:`
  links (now it follows the link like a click, `onClick` runs once);
  Shift + Tab from the open menu moved the focus to the end of the page.
- A popover hidden by `<Activity mode="hidden">` stayed in the overlay stack,
  so Escape no longer closed the Dialog around it.
- Locking the page scroll shifted the page by the width of the scrollbar, and
  a `size="full"` Dialog overflowed the right edge.
- `RichTextEditor` ran pasted lists, headings and table cells together, made
  Google Docs content all bold, showed formatting its value dropped, ignored
  a late `defaultValue`, and its server HTML submitted the unsanitized
  `defaultValue`.
- `sanitizeRichText` and `sanitizeInlineHtml` kept the `is` attribute, which
  could instantiate a customized built-in element of the app.
- `FileUpload` lost the focus after a removal, a cancel or a finished upload;
  `required` passed with nothing to submit; `accept` with a MIME type
  rejected files whose system reports another type (a .csv on Windows); a
  file dropped while it was disabled or uploading opened in the browser.
- `getFieldError` / `getBaseError`: one list entry without a `field` hid all
  errors; members of the error (`code`, `message`, `detail`) showed under
  fields of that name; dotted names did not reach nested objects; names with
  numbers or acronyms (`addressLine1`, `userID`) did not match.
- Accessibility: `Stepper` told the state of a step by color only; `Progress`
  without `label` could not be named; `Breadcrumbs` separators were read
  aloud; the info icon of `DescriptionList` could not be reached from the
  keyboard, and its name repeated the tooltip; a `RadioGroup` with a `label` put `aria-invalid` on a plain
  `<fieldset>`; `Navbar` named the user twice with an `avatarUrl`; the
  required `*` was part of the accessible names of the fields; the empty
  `hasEmpty` option had no name; Space in an open Dropdown scrolled the page.
- The error state of `Switch` was invisible, and its label and the floating
  labels of `Input` / `Textarea` did not turn red. `Input`, `Textarea` and
  `DateTimePicker` with `dim="sm"` kept the padding of `md`.
- `Tabs`, `Stepper`, `Progress`, `CollapsibleContent`, dialogs, the drawer and
  the floating labels moved also for users who prefer reduced motion, and the
  slide animations cut content taller than 500px.
- A locale `code` that `Intl` does not understand crashed `Calendar` and
  `DataTable`.
- Projects using the package got a Vite warning about an unresolved image URL
  ("… didn't resolve at build time") - Tailwind scanned the source map and
  the type declarations, and a comment there looked like a class.
- A floating label covered the format of an empty date or time `Input`, and
  a value the browser autofilled.
- The focus went to the page when a Dialog opened from a Popover or
  Dropdown pick closed: when the same pick closed the menu, the focus now
  goes back to the menu's trigger.
- `Popover` flipped a short panel that fit below (it assumed 240px), did not
  flip again when the content grew, and a panel that fit on neither side
  reached out of the viewport - it now opens on the larger side, as tall as
  the room, and scrolls. A reopened hover popover no longer shows a frame
  at its old place, and a closed one no longer renders twice on mount.
- `Dropdown` opened from the keyboard now highlights its first item
  (ArrowUp: the last one), as the ARIA menu button pattern asks.
- The panel of a hover `Popover` without `contentLabel` was a dialog without
  a name - its trigger names it now.
- A `Popover` rendered in a shadow root took a click on its trigger for a
  click outside and did not close.
- `Tooltip` - moving the pointer from an interactive tooltip back to its
  trigger hid it at once, and the trigger then waited the full `delay`
  again.
- A dismissed `Toast` (Escape or its close button) dropped the focus to the
  page - it goes back to where it was before the toasts, or else to the next
  toast.
- The Escape that ends an IME composition no longer closes a `Dialog`,
  `Popover`, `Tooltip`, `Toast`, the slid-in `Drawer`, a full-screen
  `DataTable` or a `useOverlay` overlay.
- `RichTextEditor`:
  - after dragging a whole bold word, later drops of foreign HTML went in
    unsanitized and files were not blocked,
  - a controlled editor kept showing an input its parent did not take,
  - the toolbar used from the keyboard could lose the selection (Firefox).
- `sanitizeRichText` output a link inside a link, which parsed differently.
- `ErrorBoundary` showed the raw error message in production.
- `uploadWithProgress` reported `NaN` for an empty body, and `Progress`
  rendered it as `aria-valuenow="NaN"`; non-finite values are now 0.
- `CollapsibleContent` could flash at full height for a frame when opened.
- A `Dialog` rendered open on the server, and `SnackbarProvider`, caused a
  hydration error - they render their portal right after hydration now.
- Toasts on phones were at most half the screen wide; the toast region is as
  wide as its widest toast, up to 36rem.
- Focus traps counted every radio of a group as a Tab stop, so Tab from a
  radio in a `Popover` could leave the panel.
- `Calendar` - the time column of the week and day views broke "10:00 AM" into
  two lines.
- `DataTable` - the label of a sortable column with a `maxWidth` was centered,
  with its sort icon at the far edge.
- `Input type="password"` with a `floating` label lost the rounded left
  corners of the field and shifted by a pixel.
- A loading `Button size="icon"` showed the spinner next to its icon - the
  spinner now replaces it.
- The menu of a `Dropdown` had no accessible name.
- The wrapper around a `buttonTrigger` of `Popover` showed a pointer cursor
  over its whole width, where clicks did nothing.
- The focus rings of fields and buttons at the edges of an open `Accordion`
  (`CollapsibleContent`) were cut off.
- A horizontal `Stepper` with many steps ran over the edge of a phone screen.
- An `Avatar` with only `alt` (no picture, no initials) was not named.
- `sanitizeRichText` and `sanitizeInlineHtml` threw on hostile input - content
  nested more than 100 elements deep now keeps only its text, and very long
  runs of nodes (a paragraph of 150 000 `<br>`s) are copied.
- `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` and `DateTimePicker`
  dropped an `aria-invalid` / `aria-required` passed to them (by `Field` or a
  form library) when they had no `error` / `required` of their own.
- A `ref` passed to `Tabs` replaced its own: the arrow keys selected the next
  tab but left the focus on the old one, and the indicator stopped working.
  The ref now gets the tab list alongside.
- `Avatar` - screen readers read the name twice (its tooltip was the
  description); the tooltip now says what the name says.
- `Calendar` in time zones whose clocks jump from 0:00 to 1:00 (Havana,
  Santiago, Beirut, Cairo, the Azores): the month view and a week starting on
  the day of the change reported the days after it with 1:00 (`onDateClick`)
  and disabled the `maxDate` day, the day of the change stayed enabled before
  `minDate` and showed events of the first hour of the next day, and
  `getCalendarVisibleRange` ended at 1:00 instead of midnight.
- `Calendar` - the icon of a timed tile (`renderEventIcon`) took a line of its
  own and pushed the title out of short tiles; they share a line now.
- `DataTable` - the focus moving into a pinned column (a selection checkbox, a
  sort button) scrolled the table sideways.
- Contrast below WCAG AA (see Upgrading): the text of filled and outline
  buttons, the focus rings (1.2 - 1.8:1), the error texts of the fields
  (3.8:1), the placeholders (2.9:1), muted texts in dark mode (3.5:1), the
  white text of selected days and steps (3.8:1), the days of other months in
  the calendars (2.6:1) and progress bars against their track.
- A `Dialog` with nothing to focus in it left the focus on the button that
  opened it - Enter or Space pressed it again behind the dialog; the dialog
  itself takes the focus now.
- A `Tooltip` around the trigger of a `Popover` or `Dropdown` showed over the
  open panel and took its first Escape.
- `Overlay` with `portal`, open on the first render, caused a hydration error.
- Toasts ran out while the page was hidden (another tab), so a message could
  go unseen, and many persistent toasts stacked past the bottom of the screen
  (now `maxToasts`).
- `Drawer`:
  - the expanded state of a group (its popover when collapsed) jumped to
    another group when items before it came or went - items are keyed by
    `id`, `href` or `label` now,
  - of two items with the same path the first one was active whatever the
    query - now the one whose query parameters the page has,
  - the page had an unnamed complementary region and two unnamed navigation
    landmarks (see Upgrading).
- `isActivePath`, `Tabs` and `Drawer` never marked a link with letters like
  "í" or a space (the path of the page is percent-encoded) or a relative one,
  and tabs with `includeQueryParams` none on a path with a trailing slash.
- `Tabs` - the arrow keys went the wrong way in right-to-left pages, and it
  threw without `ResizeObserver` (jsdom in the tests of an app).
- `Header` - while the title loaded, its heading was empty for screen readers;
  it says "Loading…".
- `DataTable`:
  - First / Last page (and Previous / Next onto the edge), "Clear filters"
    and "Reset columns" lost the focus to the page when their press disabled
    them,
  - changing the page or the sort kept the scroll position - the table showed
    the middle of the new page,
  - the column filters were of different heights (a select filter 30 px, a
    text filter 22 px),
  - it threw without `ResizeObserver`.
- `Pagination` - the range did not write its numbers by the language, and the
  Czech one read "41 - 60 / 1234567".
- `Autocomplete` and `FileUpload` ignored a disabled `<fieldset>` around them:
  their value could still change (a dropped file uploaded) and was then not
  submitted. `Autocomplete` put an `aria-invalid` / `aria-required` from
  `Field` or a form library on a wrapper instead of the combobox, and with
  `asSelect` it opened with nothing highlighted - it starts on the selected
  option now, and picking it again changes nothing, like a native select.
- `FileUpload` wrote its size limit with a decimal point in Czech ("2.5 MB").
- `Calendar`:
  - month view tiles grew past their day: titles were cut without "…" and
    the actions of `renderEventActions` were out of reach - on phones for
    nearly every tile,
  - changing the day of the day view was not announced to screen readers,
  - the day a time zone skipped (Samoa, 30 December 2011) showed as a second
    copy of the next day in the grids and the navigation.
- `DateTimePicker` - a date typed with a two-digit year or none was dropped
  without a word (it is read now, see New features); the clear button was a
  16 px target (24 px now).
- `createLocale`, and the `messages` of `UIProvider`, kept `null` texts - as a
  translation tool exports untranslated ones - instead of falling back to the
  base locale; `AvatarGroup` threw on them.
- `Avatar` initials - a name in decomposed Unicode lost its accent, an emoji
  broke the initials, and "Jan Amos Komenský" gave "JA".
- `Progress` showed "100 %" for 99.6.
- The Czech texts wrote "..." for "…", and decimal numbers took the wrong
  plural form ("1,5 dní").
- `RichTextEditor` - screen readers read the placeholder as the content of
  the empty editor (it is `aria-placeholder` now), and every keystroke
  sanitized the whole value two or three times - once now, and moving the
  caret not at all.

### Documentation

- The routing recipes: the Next.js one passes `{ scroll }` and explains its
  `<Suspense>`; the TanStack one compiles and keeps the scroll position of
  URL-state changes. The Apollo snippets import the hooks from
  `@apollo/client/react` (Apollo Client 4). Installing from a local folder
  explains deduplicating React.
- New page "Hooks & utilities". The search also finds pages by their
  keywords; prop tables show props that shadow HTML attributes (the `color`
  of `Chip`), inherited props and the defaults of hook options; the examples
  load with their page; a page that fails to load offers a reload instead of
  a blank site.
- A page with live examples for every new component, and examples of the new
  features on the pages of the existing ones.
- Forms & validation: help texts, custom and third-party controls with
  `Field`, NumberInput with React Hook Form, the fields that submit hidden
  inputs. Hooks & utilities: the new hooks. Theming: the color scheme and the
  script against a flash of the wrong scheme. Installation: `ConfirmProvider`.
- The docs switch their own theme with `useColorScheme`.
- Installation: server components can call the helpers of the library; the
  README explains the `install-scripts` warning of npm for a tarball.
  Theming: the contrast of the colors. Tooltip: a width for its children.
  Prop tables list the props of `Omit<…>` / `Pick<…>` types (`CopyButton`,
  `SplitButton`).

### Package

- MIT license; `package.json` has `license`, `repository` and `homepage`.
- `engines` declares the Node versions of Vite 8 (`^20.19.0 || >=22.12.0`) -
  `prepare` builds the package with it on an install from git.
- `npm run lint` also fails when the React Compiler cannot compile a
  component or hook (`scripts/check-react-compiler.mjs`), and on comments
  written as JSX text (`react/jsx-no-comment-textnodes`).
- The package is built as one module per source file: bundlers take only the
  modules an app imports, and only the modules that use React are marked
  `"use client"`. Server components (Next.js App Router) can call the helpers
  that need no React - `readQueryFromSearch` and the other query helpers,
  `getFieldError`, `formatMessage`, `cn`, `getColorSchemeScript`,
  `isActivePath`, `expandRecurringEvents`, … - which the whole package being
  `"use client"` turned into client references.
- `npm test` also renders every exported component on a server without a DOM
  (`src/server-rendering.test.tsx`).
- The CI workflow also checks the pushes to `development`, with the current
  GitHub actions (Node 24).

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
- The components use the theme tokens only (the named event colors of
  `Calendar` aside) - `neutral-*` instead of Tailwind's `gray-*` / `zinc-*`,
  and the `warning` button the `warning-*` scale instead of yellow and orange.
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
