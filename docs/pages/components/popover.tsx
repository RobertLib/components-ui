import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function PopoverPage() {
  return (
    <DocPage imports={["Popover"]} title="Popover">
      <Example name="popover/basic" title="Hover and click" />
      <Example
        description={
          <p>
            Control it with <code>open</code> + <code>onOpenChange</code>, e.g.
            to close it after a form inside is submitted.
          </p>
        }
        name="popover/controlled"
        title="Controlled, with a form"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              Popovers flip to the opposite side when there is not enough room;{" "}
              <code>align</code> picks the edge of the trigger <code>top</code>{" "}
              / <code>bottom</code> ones line up with, and <code>left</code> /{" "}
              <code>right</code> ones move up into the viewport.
            </li>
            <li>
              The panel follows the trigger while the page scrolls or resizes,
              on phones too. There it stretches to the screen width when it
              would overflow.
            </li>
            <li>
              The panel is a <code>dialog</code> named by a click trigger (or{" "}
              <code>contentLabel</code>). A panel that only holds a menu or a
              listbox takes <code>popupRole=&quot;menu&quot;</code> /{" "}
              <code>&quot;listbox&quot;</code>: it gets no role of its own and
              the trigger the matching <code>aria-haspopup</code>.
            </li>
            <li>
              It closes once the focus leaves trigger and panel - not when it
              moves into a Dialog or popover opened from the panel. Such a
              Dialog paints above the panel and gets Escape first: one Escape
              closes one overlay, the topmost.
            </li>
            <li>
              Dropdown, Autocomplete and the date pickers are built on it.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Popover" />
      </Section>
    </DocPage>
  );
}
