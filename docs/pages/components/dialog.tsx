import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const exempt = `// A chat widget or a captcha of a third party stays usable while a
// Dialog is open - its focus is not pulled back into the dialog
<div data-focus-trap-exempt="">
  <ChatWidget />
</div>`;

export default function DialogPage() {
  return (
    <DocPage imports={["Dialog", "DialogFooter"]} title="Dialog">
      <Example
        description={
          <p>
            Controlled with <code>open</code> and <code>onClose</code>.{" "}
            <code>DialogFooter</code> pins the buttons to the bottom while the
            content scrolls.
          </p>
        }
        name="dialog/basic"
        title="Basic"
      />
      <Example name="dialog/sizes" title="Sizes" />
      <Example
        description={
          <p>
            Leave out <code>open</code> for a dialog that is shown as long as it
            is mounted - typically a route of its own, closed with{" "}
            <code>{"onClose={() => navigate(-1)}"}</code>.
          </p>
        }
        name="dialog/uncontrolled"
        title="Uncontrolled (route dialogs)"
      />

      <Section title="Behavior">
        <Prose>
          <ul>
            <li>
              The focus moves into the dialog (onto the dialog itself when
              nothing in it can take it, e.g. while a request disables its close
              button), stays trapped in it while it is open - also after a click
              on the backdrop or the page - and returns to where it was
              afterwards; to the trigger of a popover when the dialog was opened
              from its panel, which has closed meanwhile. Popovers opened in it
              and the toasts of <code>SnackbarProvider</code> stay reachable -
              Tab goes on from the last control of the dialog to the toasts. The
              toasts show above the backdrop.
            </li>
            <li>
              Escape closes it - unless a popover, a list or a tooltip inside is
              open, which closes first, or a field inside handles the Escape and
              calls <code>preventDefault()</code>. One Escape closes one
              overlay, the topmost, also when a Dialog is opened from a popover
              or over the slid-in Drawer.
            </li>
            <li>
              The page behind does not scroll, and does not shift sideways where
              its scrollbar takes room.
            </li>
            <li>
              It is rendered into <code>document.body</code>, so sticky table
              headers and transformed parents never paint over it.
            </li>
            <li>
              <code>role=&quot;alertdialog&quot;</code> is for a dialog that
              interrupts with a question - <code>ConfirmDialog</code> is one.
            </li>
            <li>
              Rendered on the server, it renders nothing and opens once the page
              has hydrated.
            </li>
            <li>
              A panel sliding in from an edge of the screen, for the details or
              the edit form of a record, is a{" "}
              <Link to="/components/sheet">Sheet</Link> - the same dialog.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Your own overlays">
        <Prose>
          <p>
            A panel of your own joins the stack the Dialog, Popover, Tooltip and
            the slid-in Drawer share with <code>useOverlay</code>: Escape goes
            to the topmost overlay only, overlays opened later count above it,
            and a Dialog under it lets the focus into it. With{" "}
            <code>modal</code> it also traps the focus, locks the page scroll
            and gives the focus back once it closes. Wrap its content in{" "}
            <code>OverlayScope</code>, so popovers opened in it stack above it
            even when they open together with it. <code>Overlay</code> is the
            dimmed backdrop to put behind it. (For a side panel of your own,
            first see whether a <Link to="/components/sheet">Sheet</Link> does.)
          </p>
        </Prose>
      </Section>
      <Example name="dialog/custom-overlay" title="A side panel of your own" />
      <Prose>
        <p>
          Content that is not an overlay but has to stay usable while a Dialog
          traps the focus - a chat widget, a captcha - goes into an element with
          the <code>data-focus-trap-exempt</code> attribute. The toasts of{" "}
          <code>SnackbarProvider</code> are such a region.
        </p>
      </Prose>
      <CodeBlock code={exempt} />

      <Section title="Props">
        <PropsTable of="Dialog" />
        <PropsTable of="Overlay" />
        <PropsTable of="UseOverlayOptions" title="useOverlay(options)" />
        <PropsTable of="UseOverlayResult" title="useOverlay() returns" />
      </Section>
    </DocPage>
  );
}
