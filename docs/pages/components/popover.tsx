import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function PopoverPage() {
  return (
    <DocPage imports={["Popover"]} title="Popover">
      <Example
        description={
          <p>
            A click trigger is a button: pass a <code>Button</code> (or an{" "}
            <code>IconButton</code>, a <code>&lt;button&gt;</code>) with{" "}
            <code>buttonTrigger</code> and it gets <code>aria-expanded</code>{" "}
            and the focus itself. Any other trigger - a text, an icon - is
            wrapped in a focusable <code>div role=&quot;button&quot;</code>{" "}
            instead; give it a name with <code>aria-label</code> when it has no
            text.
          </p>
        }
        name="popover/basic"
        title="Hover and click"
      />
      <Example
        description={
          <p>
            Control it with <code>open</code> + <code>onOpenChange</code>, e.g.
            to close it after a form inside is submitted - the focus in the
            closing panel goes back to the trigger.
          </p>
        }
        name="popover/controlled"
        title="Controlled, with a form"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              Popovers flip to the opposite side when there is not enough room -
              measured again while open, as the content grows. A panel that fits
              on neither side opens where there is more room, as tall as that
              room, and scrolls. <code>align</code> picks the edge of the
              trigger <code>top</code> / <code>bottom</code> ones line up with,
              and <code>left</code> / <code>right</code> ones move up into the
              viewport.
            </li>
            <li>
              The panel follows the trigger while the page scrolls or resizes,
              on phones too. There it stretches to the screen width when it
              would overflow. The trigger stays clickable while the panel is
              open.
            </li>
            <li>
              The panel is a <code>dialog</code> named by its trigger (or{" "}
              <code>contentLabel</code> - give one to a hover popover with an
              icon trigger). A panel that only holds a menu or a listbox takes{" "}
              <code>popupRole=&quot;menu&quot;</code> /{" "}
              <code>&quot;listbox&quot;</code>: it gets no role of its own and
              the trigger the matching <code>aria-haspopup</code>.
            </li>
            <li>
              It closes once the focus leaves trigger and panel - not when it
              moves into a Dialog or popover opened from the panel. Such a
              Dialog paints above the panel and gets Escape first: one Escape
              closes one overlay, the topmost. Escape, or the panel closing with
              the focus in it, gives the focus back to the trigger - also after
              a Dialog opened from the panel closes, even when the same click
              closed the panel.
            </li>
            <li>
              A control in the panel that handles Escape itself and calls{" "}
              <code>preventDefault()</code> - the link form of a{" "}
              <code>RichTextEditor</code>, a search field - keeps the panel
              open: the popover listens for Escape after the key handlers of the
              page, like the Dialog.
            </li>
            <li>
              Clicks in the panel stay in it: they do not reach the handlers of
              the popover&apos;s parents (a pick in a menu does not also click a
              clickable row around it) nor bubbling <code>document</code>{" "}
              listeners - a capture listener (
              <code>addEventListener(&quot;click&quot;, fn, true)</code>) sees
              them.
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
