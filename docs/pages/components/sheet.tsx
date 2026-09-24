import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const route = `// A sheet that is a route of its own (/customers/:id) - uncontrolled:
// it slides in when mounted, and out before onClose navigates back
function CustomerRoute() {
  const { navigate } = useRouter();
  return (
    <Sheet onClose={() => navigate("/customers")} title="Customer">
      <CustomerForm />
    </Sheet>
  );
}`;

export default function SheetPage() {
  return (
    <DocPage imports={["Sheet", "DialogFooter"]} title="Sheet">
      <Example
        description={
          <p>
            The details of a record next to its list, with an edit form. The
            header and a <code>DialogFooter</code> stay in place while the
            content scrolls - put the footer inside the{" "}
            <code>&lt;form&gt;</code> and its submit button submits it.{" "}
            <code>closeDisabled</code> keeps the sheet open while the form is
            saved. Keep the record in state after closing, so the sheet slides
            out with its content.
          </p>
        }
        name="sheet/record-detail"
        title="Record detail with an edit form"
      />
      <Example
        description={
          <p>
            <code>side</code> is the edge it slides in from. A <code>left</code>{" "}
            / <code>right</code> sheet is as tall as the screen and{" "}
            <code>size</code> wide (the whole width on phones); a{" "}
            <code>top</code> / <code>bottom</code> one is as tall as its
            content, at most <code>size</code>. This one closes also on a click
            on the backdrop - <code>closeOnBackdropClick</code>, off by default
            so a stray click does not throw away a form being filled in.
          </p>
        }
        name="sheet/sides"
        title="Sides"
      />
      <Example
        description={
          <p>
            A <code>ConfirmDialog</code> rendered in the sheet opens above it:
            Escape closes the question first, then the sheet, and the focus goes
            back to the button that asked. Popovers, dropdowns and date pickers
            in a sheet stack above it the same way - and so do the questions of{" "}
            <Link to="/components/confirm-dialog">useConfirm</Link>.
          </p>
        }
        name="sheet/confirm"
        title="Confirming in a sheet"
      />

      <Section title="Behavior">
        <Prose>
          <ul>
            <li>
              It is a modal dialog like <code>Dialog</code> and shares its
              implementation: the focus moves in (to the first field, past the
              close button), stays trapped while it is open and goes back to
              where it was as the sheet starts sliding out. Escape closes the
              topmost overlay only - the next Escape, even while the sheet
              slides out, is for the one under it.
            </li>
            <li>
              The page behind does not scroll, and the sheet is rendered into{" "}
              <code>document.body</code>, above sticky headers and transformed
              parents. Toasts show above it and stay reachable with Tab.
            </li>
            <li>
              Controlled by <code>open</code>, it slides in and out; users who
              prefer reduced motion see it fade instead. Without{" "}
              <code>open</code> it opens when mounted and calls{" "}
              <code>onClose</code> once it has slid out - for a sheet that is a
              route of its own.
            </li>
            <li>
              Rendered on the server, it renders nothing and opens once the page
              has hydrated.
            </li>
          </ul>
        </Prose>
        <CodeBlock code={route} />
      </Section>

      <Section title="Props">
        <PropsTable of="Sheet" />
      </Section>
    </DocPage>
  );
}
