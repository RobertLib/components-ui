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
      <Example
        description={
          <p>
            <code>position</code> is the side of the trigger - <code>top</code>,{" "}
            <code>bottom</code>, or <code>start</code> / <code>end</code>, which
            follow the writing direction (<code>left</code> / <code>right</code>{" "}
            stay physical). <code>align</code> lines the panel up with the{" "}
            <code>start</code>, the <code>center</code> or the <code>end</code>{" "}
            of the trigger - the end edge is the left one right to left.{" "}
            <code>offset</code> is the gap in pixels and <code>arrow</code> adds
            an arrow pointing at the middle of the trigger: it goes along when
            the panel flips or is moved into the viewport, and takes the colors
            of the panel.
          </p>
        }
        name="popover/placement"
        title="Position, alignment and an arrow"
      />
      <Example
        description={
          <p>
            <code>anchor</code> places the panel at something else than its
            trigger: an element, a <code>DOMRect</code>, a point (
            <code>{"{ x, y }"}</code>, e.g. of a click) or a function returning
            one - here the box of the selected text, read again as the page
            scrolls. Without a <code>trigger</code> it is controlled by{" "}
            <code>open</code>; Escape and the focus leaving the panel still call{" "}
            <code>onOpenChange(false)</code>, and the focus goes back to where
            it was when the panel opened.
          </p>
        }
        name="popover/anchor"
        title="At an anchor - a toolbar over the selection"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              Popovers flip to the opposite side when there is not enough room -
              measured again while open, as the content grows. A panel that fits
              on neither side opens where there is more room, as tall as that
              room, and scrolls. A panel reaching out of the viewport along its
              trigger is moved back in - <code>left</code> / <code>right</code>{" "}
              ones up or down.
            </li>
            <li>
              The panel follows the trigger while the page - or a scrolling
              container around the trigger - scrolls or resizes, on phones too,
              where the room it flips by is what the on-screen keyboard leaves.
              It hides while the trigger is scrolled out of view, out of the
              screen or out of that container, and shows again once it is back.
              On a phone it stretches to the screen width when it would
              overflow. The trigger stays clickable while the panel is open.
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
              moves into a Dialog or popover opened from the panel, also one
              rendered elsewhere (the question of <code>useConfirm()</code>),
              and not on a press in them. Such a Dialog paints above the panel
              and gets Escape first: one Escape closes one overlay, the topmost.
              Escape, or the panel closing with the focus in it, gives the focus
              back to the trigger - also after a Dialog opened from the panel
              closes, even when the same click closed the panel - or, when the
              trigger went with it (the row a pick in its menu deleted), to the
              Tab stop next to it. A button trigger that turns{" "}
              <code>disabled</code> closes the panel.
            </li>
            <li>
              Tab moves from the trigger into the open panel and past its end on
              to what follows the trigger - also into the panel of a hover
              popover, which opens on keyboard focus, so its links can be
              reached. As the last control of a Dialog, Tab past the panel goes
              round to the first control of the dialog.
            </li>
            <li>
              The panel takes the writing direction of its trigger - in a part
              of the page with <code>dir=&quot;rtl&quot;</code> it is right to
              left too, though it is rendered into the body (or the{" "}
              <code>portalContainer</code> of <code>UIProvider</code>), and{" "}
              <code>start</code> / <code>end</code> are the other way round. The{" "}
              <code>align</code> values <code>left</code> / <code>right</code>{" "}
              are deprecated - they keep the physical edge.
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
              <code>ref</code> and the other props go to the wrapper around the
              trigger - <code>contentRef</code> is the panel&apos;s. For
              styling, the wrapper (and a <code>buttonTrigger</code>) has{" "}
              <code>data-state=&quot;open&quot;</code> or{" "}
              <code>&quot;closed&quot;</code>; the panel has{" "}
              <code>data-state=&quot;open&quot;</code>, the side it is shown on
              after flipping (<code>data-side</code>: <code>top</code>,{" "}
              <code>bottom</code>, <code>left</code>, <code>right</code>) and
              its <code>data-align</code> (<code>start</code>,{" "}
              <code>center</code>, <code>end</code>) - e.g.{" "}
              <code>data-[side=top]:origin-bottom</code>.
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
