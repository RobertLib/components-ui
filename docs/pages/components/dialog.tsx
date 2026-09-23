import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

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
              The focus moves into the dialog, stays trapped in it while it is
              open - also after a click on the backdrop or the page - and
              returns to where it was afterwards. Popovers opened in it and the
              toasts of <code>SnackbarProvider</code> stay reachable; the toasts
              show above the backdrop.
            </li>
            <li>
              Escape closes it - unless a popover, a list or a tooltip inside is
              open, which closes first. One Escape closes one overlay, the
              topmost, also when a Dialog is opened from a popover or over the
              slid-in Drawer.
            </li>
            <li>The page behind does not scroll.</li>
            <li>
              It is rendered into <code>document.body</code>, so sticky table
              headers and transformed parents never paint over it.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Dialog" />
      </Section>
    </DocPage>
  );
}
