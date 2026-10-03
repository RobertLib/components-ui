import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ImageViewerPage() {
  return (
    <DocPage
      imports={["ImageViewer", "type ImageViewerImage"]}
      title="ImageViewer"
    >
      <Example
        name="image-viewer/basic"
        title="Image gallery and zoom"
        description={
          <p>
            Open the gallery with <code>open</code> and{" "}
            <code>onOpenChange</code>, or start an uncontrolled one with{" "}
            <code>defaultOpen</code>. Each image has a URL, a descriptive{" "}
            <code>alt</code>, an optional caption and a smaller{" "}
            <code>thumbnailSrc</code>. Images show loading and error feedback.
          </p>
        }
      />
      <Section title="Navigation and controlled state">
        <Prose>
          <p>
            Use <code>index</code> and <code>onIndexChange</code> to control the
            current image, or <code>defaultIndex</code> for an initial position.
            Navigation wraps unless <code>loop={false}</code>. Arrows follow
            reading direction; Home and End jump to the first and last image.
            Zoom runs from 100% to 300%; scroll the image viewport to inspect
            it. Changing the image or reopening resets zoom.
          </p>
          <p>
            The viewer uses Dialog's focus trap, Escape and backdrop closing,
            focus restoration and mobile full-screen layout.{" "}
            <code>onClose</code> reports a user close. Give the dialog a useful{" "}
            <code>title</code> and each image meaningful alternative text.
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="ImageViewer" />
        <PropsTable of="ImageViewerImage" />
      </Section>
    </DocPage>
  );
}
