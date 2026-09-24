import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function AvatarPage() {
  return (
    <DocPage imports={["Avatar", "AvatarGroup"]} title="Avatar">
      <Example
        description={
          <p>
            Without a picture - or when it fails to load - the avatar shows the
            initials of the first and the last word of <code>name</code> ("Jan
            Amos Komenský" is JK), and without a name a generic user icon.
          </p>
        }
        name="avatar/basic"
        title="Picture, initials and icon"
      />
      <Example
        description={
          <p>
            <code>status</code> puts a dot in the corner: online, busy, away or
            offline. Screen readers hear it with the name ("Jana Nováková,
            Online"), also when the avatar is decorative (<code>alt=""</code>
            ); the pointer shows it as the title of the dot. Besides the color,
            each has a shape of its own: online is a dot, busy has a bar, away
            is a crescent and offline is hollow.
          </p>
        }
        name="avatar/status"
        title="Status"
      />

      <Section title="AvatarGroup">
        <Prose>
          <p>
            Overlapping avatars of several people. <code>max</code> is the
            number of circles shown - with more people, the last of them says
            "+N" (it never stands for a single person). Its tooltip lists the
            names of the people it stands for, on hover, keyboard focus and tap;
            screen readers hear "+2 more" and the names as its description.{" "}
            <code>total</code> counts people the page has no avatars of, e.g.
            the first three members an API returned with the count of all.{" "}
            <code>size</code> goes to the avatars that set none of their own.
          </p>
        </Prose>
      </Section>
      <Example name="avatar/group" title="A group with max and total" />

      <Section title="Props">
        <PropsTable of="Avatar" />
        <PropsTable of="AvatarGroup" />
      </Section>
    </DocPage>
  );
}
