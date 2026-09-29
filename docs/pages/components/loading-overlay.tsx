import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function LoadingOverlayPage() {
  return (
    <DocPage imports={["LoadingOverlay"]} title="LoadingOverlay">
      <Example
        description={
          <p>
            Wrap the region that reloads - a table, a form, a card - and pass{" "}
            <code>visible</code> while it loads. The region is{" "}
            <code>relative</code> and the overlay covers it with a translucent
            layer, a spinner and the <code>label</code> under it; give the
            region the radius of what it covers (<code>className</code>).{" "}
            <code>blur</code> blurs the content a little. The overlay fades in
            and out - at once for users who prefer reduced motion.
          </p>
        }
        name="loading-overlay/basic"
        title="Reloading a region"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            While visible, the covered content is <code>inert</code>: no click,
            no keyboard, and screen readers leave it out. The region is{" "}
            <code>aria-busy</code>, and a status says the <code>label</code> -
            or the localized "Loading…" - once the overlay shows. A focus in the
            content moves to the region and comes back once the overlay is gone,
            so the keyboard stays where it was. For a first load, with nothing
            to show yet, use placeholders (
            <Link to="/components/spinner">Skeleton</Link>) instead.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="LoadingOverlay" />
      </Section>
    </DocPage>
  );
}
