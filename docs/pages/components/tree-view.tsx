import { Kbd } from "components-ui";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const keys: [React.ReactNode, string][] = [
  [
    <Kbd key="down">↓</Kbd>,
    "Next item - with Shift in a multiple selection also toggles it",
  ],
  [
    <Kbd key="up">↑</Kbd>,
    "Previous item - with Shift in a multiple selection also toggles it",
  ],
  [
    <Kbd key="right">→</Kbd>,
    "Expands a collapsed item, moves into an expanded one",
  ],
  [
    <Kbd key="left">←</Kbd>,
    "Collapses an expanded item, moves to the parent of another",
  ],
  [
    <span className="flex gap-1" key="home">
      <Kbd>Home</Kbd>
      <Kbd>End</Kbd>
    </span>,
    "First / last item - Ctrl + Shift + Home / End select up to it",
  ],
  [
    <Kbd key="enter">Enter</Kbd>,
    "Follows a link, selects, checks or toggles - like a click",
  ],
  [
    <Kbd key="space">Space</Kbd>,
    "Selects, toggles the selection or the checkbox - in a tree that does neither, follows a link or toggles like a click",
  ],
  [<Kbd key="star">*</Kbd>, "Expands all siblings of the focused item"],
  [
    <Kbd key="a">a…z</Kbd>,
    "Moves to the next item starting with the typed letters",
  ],
  [
    <Kbd key="all" shortcut="mod+a" />,
    "Selects all shown items of a multiple selection",
  ],
  [
    <Kbd key="cut" shortcut="mod+x" />,
    "With onMove: picks up the focused item to move it - with the other selected items when it is selected",
  ],
];

// The keys while an item picked up with Ctrl / ⌘ + X is being moved
const moveKeys: [React.ReactNode, string][] = [
  [
    <span className="flex gap-1" key="up-down">
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd>
    </span>,
    "The previous / next place to drop at - each is announced",
  ],
  [
    <span className="flex gap-1" key="home-end">
      <Kbd>Home</Kbd>
      <Kbd>End</Kbd>
    </span>,
    "The first / last place",
  ],
  [
    <span className="flex gap-1" key="right-left">
      <Kbd>→</Kbd>
      <Kbd>←</Kbd>
    </span>,
    "Expands / collapses the item of the place - its children load",
  ],
  [
    <span className="flex gap-1" key="drop">
      <Kbd>Enter</Kbd>
      <Kbd shortcut="mod+v" />
    </span>,
    "Drops the items at the place - onMove",
  ],
  [
    <Kbd key="escape">Esc</Kbd>,
    "Cancels - so does leaving the tree; the focus stays on the item",
  ],
];

/** A table of keys and what they do. */
function KeyTable({ rows }: { rows: [React.ReactNode, string][] }) {
  return (
    <div className="my-4 max-w-3xl overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-start text-sm">
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map(([key, action], index) => (
            <tr key={index}>
              <td className="w-40 px-3 py-2 whitespace-nowrap">{key}</td>
              <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                {action}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TreeViewPage() {
  return (
    <DocPage imports={["TreeView", "type TreeItem"]} title="TreeView">
      <Example
        description={
          <p>
            Items are plain objects with an <code>id</code>, a{" "}
            <code>label</code> and nested <code>children</code>. A click, Enter
            or Space selects an item, the chevron (or → / ←, or a double click)
            expands it. <code>expanded</code> / <code>selected</code> with their
            change handlers control the state, or let the tree keep it with{" "}
            <code>defaultExpanded</code> / <code>defaultSelected</code>. A{" "}
            <code>disabled</code> item - and everything under it - can be
            focused and expanded, but not selected.
          </p>
        }
        name="tree-view/categories"
        title="Selection"
      />
      <Example
        description={
          <p>
            With <code>selectionMode="multiple"</code> a click, Enter or Space
            toggles an item, Shift + click selects a range from the last toggled
            one and <Kbd shortcut="mod+a" size="sm" /> selects all shown items.{" "}
            <code>none</code> selects nothing - a click then toggles a parent.
          </p>
        }
        name="tree-view/multiple"
        title="Multiple selection"
      />
      <Example
        description={
          <p>
            <code>checkable</code> gives every item a checkbox: checking an item
            checks all its descendants, and a parent is checked when all its
            children are, partly checked when some are. Disabled items keep
            their state - a parent with a disabled unchecked child stays partly
            checked, and the next click unchecks the rest. The tree works like a
            group of checkboxes in a form: <code>name</code> submits one value
            per checked item (parents included), and a reset brings back{" "}
            <code>defaultChecked</code>. An id in <code>checked</code> checks
            the whole branch under it. A tree can select and check at once (e.g.{" "}
            <code>selectionMode="single"</code> to show the details of an item):
            a click on the checkbox checks, a click elsewhere on the row
            selects, and Space checks.
          </p>
        }
        name="tree-view/permissions"
        title="Checkboxes"
      />
      <Example
        description={
          <p>
            <code>checkMode="independent"</code> checks every item on its own -
            checking a parent checks none of its children, and a child checks no
            parent - like the categories a product is listed in. Nothing is
            partly checked, and the value (<code>checked</code>,{" "}
            <code>onCheckedChange</code>, the submitted form) is exactly the
            checked items: an id in <code>checked</code> no longer stands for
            the items under it. Disabled items keep their state, and a reset
            brings back <code>defaultChecked</code> as in a cascade.
          </p>
        }
        name="tree-view/independent"
        title="Independent checkboxes"
      />
      <Example
        description={
          <p>
            An item with <code>hasChildren</code> (and no <code>children</code>)
            gets its children from <code>loadChildren</code> when it is first
            expanded. A loading row shows meanwhile; a failed load (the archive
            fails the first time) offers to try again, and so does expanding the
            item again - also when it was collapsed before the load failed.
            Loaded children are kept.
          </p>
        }
        name="tree-view/files"
        title="Loading children"
      />
      <Example
        description={
          <p>
            <code>filter</code> shows only the items whose label contains the
            text - ignoring case and diacritics - with their ancestors expanded
            and the match highlighted. Parts of the filtered tree can be
            collapsed; clearing the filter brings back the tree as it was. The
            children of collapsed items are not rendered, so a tree of a
            thousand items (this one) stays fast; one with thousands of items
            expanded at once is rendered only in view with{" "}
            <code>virtualized</code> (below).
          </p>
        }
        name="tree-view/filter"
        title="Filtering"
      />
      <Example
        description={
          <p>
            <code>virtualized</code> renders only the rows in view, and{" "}
            <code>overscan</code> (8) more above and below - here 10 020 people,
            all expanded. The tree scrolls itself, so give it a height (
            <code>h-80</code>, <code>max-h-96</code>, …); development builds
            warn when it has none. Every row is <code>rowHeight</code> high (32
            px, 40 on a touch screen) with its label on one line. The rows are
            one flat list of tree items - each still with its level, position
            and number of siblings - instead of nested groups. The keys, the
            focus, typeahead, <code>filter</code>, checkboxes, loading children
            and moving items work as in any tree: the focused item stays
            rendered when it is scrolled away, and the keys scroll to the item
            they move to.
          </p>
        }
        name="tree-view/virtualized"
        title="Many items"
      />
      <Example
        description={
          <p>
            <code>renderLabel</code> replaces the label - here with a count; its{" "}
            <code>state.label</code> keeps the filter highlight.{" "}
            <code>renderActions</code> adds controls to the row of the hovered
            or focused item: from the keyboard, Tab moves from the focused item
            into them and Shift + Tab back. They are not part of the name of the
            item, and their clicks and keys are their own. Delete an empty
            category: when the focused item is removed, the focus moves to the
            item that takes its place - its next sibling, else the row above.
          </p>
        }
        name="tree-view/custom"
        title="Labels and actions"
      />
      <Example
        description={
          <>
            <p>
              <code>onMove</code> lets the user move items: the mouse or a pen
              drags an item after a few pixels, a finger after resting on it for
              half a second (a finger that moves first scrolls the page). The
              dragged rows are dimmed; a line shows where they land - in the
              upper quarter of a row before it, in the lower quarter after it,
              indented to their level (below the last row of a group, how far
              left the pointer is chooses after which ancestor), and the middle
              of a row takes them inside, as its last children. A collapsed item
              hovered for a moment expands (loading its children), the tree or
              the page scrolls near its edge, and Escape cancels. From the
              keyboard, Ctrl / ⌘ + X picks up the focused item and the arrow
              keys go through the places to drop at - each announced, e.g.
              "After 2026, in Invoices" - and Enter drops it. In a multiple
              selection a selected item moves with the other selected ones.
            </p>
            <p>
              The tree reports the move -{" "}
              <code>{"{ itemIds, position, targetId }"}</code> - and changes
              nothing itself: apply it to your items (the <code>applyMove</code>{" "}
              of the example), keeping the ids, and the moved items show at
              their new place with the focus. It never offers places in or next
              to the moved items, among their descendants or in a disabled item;{" "}
              <code>canDrop</code> refuses more (here only folders take
              children), <code>canDrag</code> keeps items in place. Items can be
              dropped into a parent whose children are not loaded yet - add them
              on the server, and <code>loadChildren</code> brings them. To move
              items that <code>loadChildren</code> loaded, keep them in your
              items (as the <code>children</code> of their parent).
            </p>
          </>
        }
        name="tree-view/move"
        title="Moving items"
      />
      <Example
        description={
          <p>
            Items with an <code>href</code> are links rendered with the{" "}
            <code>Link</code> of the router - Enter or a click follows them, and
            a parent also expands. The item of the current page is marked (
            <code>aria-current="page"</code>), and an uncontrolled tree expands
            to it - at first and whenever the page changes. Of items that link
            to the same path with different queries, the one whose query the
            page has is the current one. A tree of links is a navigation:
            without <code>selected</code>, <code>defaultSelected</code>,{" "}
            <code>onSelectedChange</code> and <code>name</code> it selects
            nothing (<code>selectionMode</code> defaults to <code>none</code>),
            and Space follows a link too. The links of <code>items</code> decide
            it - links that <code>loadChildren</code> brings later into a tree
            of folders leave it selecting. A tree that selects - or checks -
            uses Space for that.
          </p>
        }
        name="tree-view/navigation"
        title="Navigation"
      />

      <Section title="Keyboard">
        <Prose>
          <p>
            The tree follows the ARIA tree view pattern. It is one tab stop -
            the focused item, at first the selected one - and the keys move
            within it (in a right-to-left page → and ← swap):
          </p>
        </Prose>
        <KeyTable rows={keys} />
        <Prose>
          <p>
            While items picked up with <Kbd shortcut="mod+x" size="sm" /> are
            being moved, the keys choose where they go - the focus stays on the
            picked item:
          </p>
        </Prose>
        <KeyTable rows={moveKeys} />
        <Callout title="Screen readers">
          <p>
            Items are announced with their level, position and state (expanded,
            selected, checked or partly checked). The children of an item are in
            a group it owns, named after it - in a virtualized tree the items
            are one flat list, each with its level and position. Name the tree
            with <code>aria-label</code> or <code>aria-labelledby</code>. A move
            is told by a polite live region: what was picked up and the keys,
            each place chosen, the drop and the cancel; the moved items are
            described as being moved.
          </p>
        </Callout>
      </Section>

      <Example
        name="tree-view/cache"
        title="Refreshing lazy children"
        description={
          <p>
            Change <code>loadChildrenKey</code> after a server mutation or
            source change. Cached children are discarded, running requests are
            aborted and expanded branches reload. Changing the loader function
            alone keeps the cache. <code>onLoadError(error, item)</code> reports
            a failed branch in addition to the retry control shown by the tree.
          </p>
        }
      />
      <Section title="Props">
        <PropsTable of="TreeView" />
        <PropsTable of="TreeItem" />
        <PropsTable of="TreeItemState" />
        <PropsTable of="TreeMove" />
      </Section>
    </DocPage>
  );
}
