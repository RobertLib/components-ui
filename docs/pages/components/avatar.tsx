import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function AvatarPage() {
  return (
    <DocPage imports={["Avatar"]} title="Avatar">
      <Example name="avatar/basic" title="Picture, initials and icon" />
      <Section title="Props">
        <PropsTable of="Avatar" />
      </Section>
    </DocPage>
  );
}
