import { Link } from "react-router";
import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const bell = `// The count in the name of the button - the badge is decorative
<IconButton aria-label={\`Notifications, \${count} unread\`} tooltip>
  <Badge count={count}>
    <Bell aria-hidden="true" />
  </Badge>
</IconButton>`;

export default function BadgePage() {
  return (
    <DocPage imports={["Badge"]} title="Badge">
      <Example
        description={
          <p>
            A <code>count</code> above <code>max</code> (99) is written as the
            limit with a plus - "99+", in the number format of the language. A
            count of 0 hides the badge, unless <code>showZero</code>;{" "}
            <code>dot</code> is a dot without a number. Its text stands out from
            each <code>color</code> by at least 4.5:1.
          </p>
        }
        name="badge/counts"
        title="Counts, dots and colors"
      />
      <Example
        description={
          <p>
            With children the badge sits on a corner of them -{" "}
            <code>placement</code> is <code>top-end</code> by default, the start
            and the end swap in a right-to-left page. A ring in the color of the
            surface keeps it apart from the child.{" "}
            <code>overlap="circular"</code> pulls it onto the edge of a round
            child, like an <Link to="/components/avatar">Avatar</Link>.
          </p>
        }
        name="badge/anchored"
        title="On an icon, an avatar or a button"
      />
      <Example
        description={
          <p>
            A badge that hides - a count of 0, or <code>invisible</code> -
            shrinks away and grows back when it shows again; for users who
            prefer reduced motion it fades.
          </p>
        }
        name="badge/notifications"
        title="A notification bell"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            A badge is decorative (<code>aria-hidden</code>) - a number on an
            icon means nothing to a screen reader on its own. Say what it says
            where it belongs:
          </p>
          <ul>
            <li>
              in the name of what it marks - the <code>aria-label</code> of the
              button of a notification bell, as below;
            </li>
            <li>
              or with <code>label</code>, rendered visually hidden next to the
              badge - "12 unread" after "Inbox" in a menu. A hidden badge (a
              count of 0, <code>invisible</code>) says nothing.
            </li>
          </ul>
          <p>
            A new count is not announced. Tell of a new message that matters
            with a toast, or a live region of your own.
          </p>
        </Prose>
        <CodeBlock code={bell} />
      </Section>

      <Section title="Props">
        <PropsTable of="Badge" />
      </Section>
    </DocPage>
  );
}
