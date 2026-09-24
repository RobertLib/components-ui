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
    "Selects, toggles the selection or the checkbox",
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
];

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
            collapsed; clearing the filter brings back the tree as it was. Only
            the expanded items are rendered, so a tree of a thousand items (this
            one) stays fast - also with everything expanded.
          </p>
        }
        name="tree-view/filter"
        title="Filtering"
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
          <p>
            Items with an <code>href</code> are links rendered with the{" "}
            <code>Link</code> of the router - Enter, Space or a click follow
            them, and a parent also expands. The item of the current page is
            marked (<code>aria-current="page"</code>), and an uncontrolled tree
            expands to it - at first and whenever the page changes. Of items
            that link to the same path with different queries, the one whose
            query the page has is the current one.
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
        <div className="my-4 max-w-3xl overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {keys.map(([key, action], index) => (
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
        <Callout title="Screen readers">
          <p>
            Items are announced with their level, position and state (expanded,
            selected, checked or partly checked). The children of an item are in
            a group it owns, named after it. Name the tree with{" "}
            <code>aria-label</code> or <code>aria-labelledby</code>.
          </p>
        </Callout>
      </Section>

      <Section title="Props">
        <PropsTable of="TreeView" />
        <PropsTable of="TreeItem" />
        <PropsTable of="TreeItemState" />
      </Section>
    </DocPage>
  );
}
