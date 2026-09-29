import { Kbd } from "components-ui";
import { Link } from "react-router";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const keys: [React.ReactNode, string][] = [
  [
    <span className="flex gap-1" key="open">
      <Kbd>↓</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>Space</Kbd>
    </span>,
    "Opens the popup and moves the focus into it - into the search field, or the tree without one (Alt + ↓ too)",
  ],
  [
    <Kbd key="letter">a…z</Kbd>,
    "On the field: opens the popup and searches for the letter",
  ],
  [
    <Kbd key="down">↓</Kbd>,
    "In the search field: into the tree (Enter too) - ↑ on the first item goes back",
  ],
  [
    <span className="flex gap-1" key="pick">
      <Kbd>Enter</Kbd>
      <Kbd>Space</Kbd>
    </span>,
    "In the tree: picks the item and closes - checks or unchecks it in a multiple field",
  ],
  [
    <Kbd key="escape">Esc</Kbd>,
    "Empties the search, then closes the popup - the focus goes back to the field",
  ],
  [
    <Kbd key="tab">Tab</Kbd>,
    "Moves on from the popup to the next field and closes it; Shift + Tab from its start goes back to the field",
  ],
  [
    <Kbd key="backspace">Backspace</Kbd>,
    "On a multiple field: removes the last chip",
  ],
];

export default function TreeSelectPage() {
  return (
    <DocPage imports={["TreeSelect", "type TreeItem"]} title="TreeSelect">
      <Example
        description={
          <p>
            A select of an item of a tree: the field opens a{" "}
            <Link to="/components/tree-view">TreeView</Link> in a popup - the
            items are the same plain objects with an <code>id</code>, a{" "}
            <code>label</code> and <code>children</code>. A click, Enter or
            Space picks an item and closes the popup; the popup opens expanded
            to the selection. <code>value</code> / <code>onChange</code> (the id
            and the item, <code>null</code> once cleared) control it, or{" "}
            <code>defaultValue</code> starts an uncontrolled one.{" "}
            <code>showPath</code> shows the ancestors of the item in the field,
            the × button clears it (<code>clearable</code>). The search field (
            <code>searchable</code>, on by default) filters the tree - ignoring
            case and diacritics; typing a letter on the closed field starts it.
            A disabled item cannot be picked.
          </p>
        }
        name="tree-select/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>multiple</code> picks several items with checkboxes - the
            value is an array, and the popup stays open. With the default{" "}
            <code>checkMode="cascade"</code> checking an item checks what is
            under it, and a parent whose children are all checked shows as one
            chip; the value (and the form) holds every checked item, the parent
            included. <code>checkMode="independent"</code> checks every item on
            its own, a chip each. The × of a chip unchecks its item - and what
            it stands for - and <code>maxChips</code> shows the rest as one "+2
            more" chip. Disabled items keep their state.
          </p>
        }
        name="tree-select/multiple"
        title="Multiple"
      />
      <Example
        description={
          <p>
            <code>loadChildren</code> loads the children of an item with{" "}
            <code>hasChildren</code> as it is first expanded, with a loading row
            meanwhile - see TreeView. The field keeps them while the popup is
            closed, so a folder loads once. The label of a value in children not
            loaded yet shows as its id - give the items on the way to it their{" "}
            <code>children</code>. For thousands of items,{" "}
            <code>virtualized</code> renders only the rows in view of the popup.
          </p>
        }
        name="tree-select/folders"
        title="Loading children"
      />
      <Example
        description={
          <p>
            The field takes part in a native form: <code>name</code> submits the
            value in hidden inputs - one per checked item of a multiple field,
            an empty one for a single field without a value - <code>form</code>{" "}
            ties them to a form elsewhere, and a reset brings back{" "}
            <code>defaultValue</code>. <code>required</code> keeps the form from
            being submitted without a value, with the message of the browser.{" "}
            <code>readOnly</code> shows the value, focusable and submitted,
            without a popup and without the buttons that change it;{" "}
            <code>disabled</code> - also by a disabled <code>fieldset</code> -
            is neither focusable, submitted nor validated.
          </p>
        }
        name="tree-select/form"
        title="Forms"
      />
      <Example
        description={
          <p>
            <code>dim</code> gives the field the heights, paddings and font
            sizes of <code>Input</code>, so fields side by side line up. The{" "}
            <code>ref</code> is the combobox - the element that takes the focus,
            with <code>data-state=&quot;open&quot;</code> while the tree is
            shown - and the other attributes of a <code>div</code> go to the
            wrapper.
          </p>
        }
        name="tree-select/sizes"
        title="Sizes"
      />

      <Section title="Keyboard">
        <Prose>
          <p>
            The field is a combobox that opens a tree (the ARIA combobox
            pattern). The focus moves into the popup - the tree has the keys of
            a TreeView there, typeahead included:
          </p>
        </Prose>
        <div className="my-4 max-w-3xl overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {keys.map(([key, action], index) => (
                <tr key={index}>
                  <td className="w-44 px-3 py-2 whitespace-nowrap">{key}</td>
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
            The field is a <code>combobox</code> that says it opens a tree (
            <code>aria-haspopup="tree"</code>, <code>aria-expanded</code>,{" "}
            <code>aria-controls</code>), named by the <code>label</code> - so is
            the tree. It reads the picked item, or the chips of a multiple
            field; a read-only one is <code>aria-readonly</code>. Without a
            label, name it with <code>aria-label</code>.
          </p>
        </Callout>
      </Section>

      <Section title="Props">
        <PropsTable of="TreeSelect" />
      </Section>
    </DocPage>
  );
}
