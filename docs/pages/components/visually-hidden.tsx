import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function VisuallyHiddenPage() {
  return (
    <DocPage imports={["VisuallyHidden"]} title="VisuallyHidden">
      <Example
        description={
          <p>
            The content stays in the page for screen readers - a name for an
            icon button or a table column, a unit said in words. With{" "}
            <code>focusable</code> it shows while it, or a link in it, has the
            focus - a "Skip to content" link at the top of the page, styled with{" "}
            <code>className</code> for the moment it shows. Press Tab in the
            example.
          </p>
        }
        name="visually-hidden/basic"
        title="Labels and a skip link"
      />

      <Section title="Notes">
        <Prose>
          <p>
            It is an inline <code>&lt;span&gt;</code> with Tailwind's{" "}
            <code>sr-only</code>. For a whole element that screen readers should
            read but nobody should see - a heading, say - put the{" "}
            <code>sr-only</code> class on it directly. Content that should be
            hidden from everybody needs <code>hidden</code>, and content that
            only the eye needs, <code>aria-hidden</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="VisuallyHidden" />
      </Section>
    </DocPage>
  );
}
