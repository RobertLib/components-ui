import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const layout = `// Once in the layout of the signed-in part of the app
<SessionTimeout
  enabled={!!user}
  idleTimeout={15 * 60_000}        // 15 minutes without activity in any tab
  expiresAt={session.expiresAt}    // and / or the end of the session on the server
  warningBefore={2 * 60_000}
  onExtend={async () => (await api.refreshSession()).expiresAt}
  onLogout={({ fromOtherTab }) => logout({ callServer: !fromOtherTab })}
  onTimeout={() => navigate("/login?reason=timeout")}
/>`;

export default function SessionTimeoutPage() {
  return (
    <DocPage
      imports={["SessionTimeout", "useIdle"]}
      title="SessionTimeout & useIdle"
    >
      <Example
        description={
          <p>
            <code>idleTimeout</code> ends the session after a time without
            activity - a key, the pointer, a touch or the wheel - in any tab of
            the app. <code>warningBefore</code> the end an alert dialog counts
            down the time left; "Stay signed in" (and Escape) calls{" "}
            <code>onExtend</code>, with a spinner while its promise is pending
            and an error message when it fails. "Sign out" calls{" "}
            <code>onLogout</code>, the end <code>onTimeout</code>. Sign in and
            leave the page alone.
          </p>
        }
        name="session-timeout/idle"
        title="Ending a session for inactivity"
      />
      <Example
        description={
          <p>
            <code>expiresAt</code> is the end of the session on the server.{" "}
            <code>onExtend</code> may return its new end - or the app gives a
            new <code>expiresAt</code>, which takes a warning away. The other
            tabs take a later end too. With both, the earlier end counts.
          </p>
        }
        name="session-timeout/expires-at"
        title="The end of a server session"
      />

      <Section title="Usage">
        <CodeBlock code={layout} />
        <Prose>
          <ul>
            <li>
              The tabs of the app share the activity, a stay, the end of the
              session on the server and the end on a{" "}
              <code>BroadcastChannel</code> (by <code>localStorage</code> in a
              browser without one): working in one tab keeps the others, a stay
              in one closes the warning in all, a later <code>expiresAt</code>{" "}
              in one moves the end in all - also of a tab opened with an older
              one - and a sign out or the end in one ends them all -{" "}
              <code>fromOtherTab</code> tells which. <code>syncKey</code> names
              the channel, <code>false</code> keeps a tab alone.
            </li>
            <li>
              The time is measured by the clock, not by timers alone: a computer
              woken from sleep after the end ends the session at once, without a
              warning, and a tab brought back from the background shows the
              right time left.
            </li>
            <li>
              Moving the mouse during the warning does not keep the user signed
              in - they choose. Screen readers hear the warning as it opens,
              with the time left, and then the time left at every minute, at 30
              and at 10 seconds - not every second.
            </li>
            <li>
              After the end it does nothing until it is turned on again (
              <code>enabled</code>) or gets a new <code>expiresAt</code> - a new
              session.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="useIdle">
        <Prose>
          <p>
            <code>useIdle(timeout, options)</code> tells whether the user has
            done nothing for <code>timeout</code> milliseconds, in this tab or
            another tab of the app - e.g. for a presence status, or to pause
            polling. Activity is a key, the pointer, a touch or the wheel (
            <code>events</code>) - not a scroll, which a script scrolling a live
            log makes too. The events are throttled (<code>throttle</code>), the
            time is measured by the clock, and it is not idle on the server.{" "}
            <code>reset()</code> counts as activity,{" "}
            <code>getLastActive()</code> reads the time of the last one.
          </p>
        </Prose>
        <Example
          description={
            <p>
              <code>onIdle</code> and <code>onActive</code> are called as the
              state changes - activity in another tab of the docs counts too.
            </p>
          }
          name="session-timeout/use-idle"
          title="Away status"
        />
        <PropsTable of="UseIdleOptions" title="useIdle options" />
        <PropsTable of="UseIdleResult" title="useIdle result" />
      </Section>

      <Section title="Props">
        <PropsTable of="SessionTimeout" />
        <PropsTable of="SessionEndDetails" />
      </Section>
    </DocPage>
  );
}
