import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ListPage() {
  return (
    <DocPage imports={["List", "ListItem"]} title="List">
      <Example
        description={
          <p>
            Rows of a title, a <code>description</code> and content at the{" "}
            <code>end</code>, with an <code>icon</code> on a tinted square. With{" "}
            <code>href</code> the whole row is a link of the router, with{" "}
            <code>onClick</code> a button - and a chevron says it leads on.{" "}
            <code>framed</code> puts the rows in a frame of their own.
          </p>
        }
        name="list/basic"
        title="Sections of a record"
      />
      <Example
        description={
          <p>
            <code>plain</code> rows have no lines and round under the pointer -
            a menu, in a <code>&lt;nav&gt;</code>. <code>current</code> marks
            the page shown (<code>aria-current=&quot;page&quot;</code>);{" "}
            <code>size=&quot;md&quot;</code> suits a list tapped through on a
            phone.
          </p>
        }
        name="list/menu"
        title="Menu"
      />
      <Example
        description={
          <p>
            <code>start</code> takes an <code>Avatar</code> or a thumbnail in
            place of the icon. A row that is a link or a button cannot hold
            controls - <code>actions</code> sit beside it. <code>separate</code>{" "}
            makes every row a card of its own.
          </p>
        }
        name="list/actions"
        title="Avatars, actions and cards"
      />

      <Section title="Accessibility">
        <Prose>
          <ul>
            <li>
              The list is a <code>&lt;ul role=&quot;list&quot;&gt;</code> -
              Safari keeps the semantics of a list without bullets then. Name a
              list with <code>aria-label</code> where the page has several, and
              wrap a menu in a <code>&lt;nav&gt;</code>.
            </li>
            <li>
              A link or a button is named by its title, the description and the
              content at the end; the icon and the chevron are decorative.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="List" />
        <PropsTable of="ListItem" />
      </Section>
    </DocPage>
  );
}
