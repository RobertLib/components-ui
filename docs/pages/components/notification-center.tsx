import CodeBlock from "../../components/code-block";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const navbar = `<Navbar
  actions={
    <NotificationCenter
      notifications={notifications}          // newest first - the app keeps them
      unreadCount={unreadTotal}              // all unread, also those not loaded
      onReadChange={(item, read) => markRead(item.id, read)}
      onMarkAllRead={markAllRead}
      hasMore={hasNextPage}
      loadingMore={isFetchingNextPage}
      onLoadMore={fetchNextPage}
      error={isError}
      onRetry={refetch}
    />
  }
  user={user}
/>`;

export default function NotificationCenterPage() {
  return (
    <DocPage
      imports={["NotificationCenter", "type NotificationItem"]}
      title="NotificationCenter"
    >
      <Example
        description={
          <p>
            A bell with the count of unread notifications opens them in a
            popover - a sheet from the bottom on phones. Each has a title, a
            text, the time (relative, the date on hover) and an icon or an
            avatar; an unread one is marked. The title with <code>href</code> or{" "}
            <code>onClick</code> opens it - the whole row is its link - and
            marks it read. <code>actions</code> are buttons on the notification.
            "Load more" (or scrolling to the end) calls <code>onLoadMore</code>;
            a returned promise shows a spinner. Add a new notification: screen
            readers hear the new unread count once a burst settles.
          </p>
        }
        name="notification-center/basic"
        title="Notifications in the navbar"
      />
      <Example
        description={
          <p>
            <code>loading</code> shows placeholder rows, <code>error</code> a
            message with "Try again" (<code>onRetry</code>) - at the end of the
            list when only loading more failed - and an empty list says so, in
            the words of its filter.
          </p>
        }
        name="notification-center/states"
        title="Loading, errors and nothing to show"
      />

      <Section title="Usage">
        <Prose>
          <p>
            The notifications are the app's: it loads them, adds new ones as
            they come (a WebSocket, polling) and changes them as they are read -
            the component calls <code>onReadChange</code> and{" "}
            <code>onMarkAllRead</code>. Put it into the <code>actions</code> of{" "}
            <code>Navbar</code>:
          </p>
        </Prose>
        <CodeBlock code={navbar} />
        <Prose>
          <ul>
            <li>
              The All / Unread filter filters the loaded notifications;{" "}
              <code>filter</code> / <code>onFilterChange</code> let the app load
              the unread ones instead. A notification read while the Unread
              filter shows it stays until the filter changes - its row, and the
              focus in it, do not vanish.
            </li>
            <li>
              The bell is named by the count ("Notifications, 3 unread"), the
              badge itself is hidden from screen readers. An unread notification
              is read as "Unread:" before its title, described by its text and
              time.
            </li>
            <li>
              Tab goes through the controls of the panel; the arrow keys, Home
              and End move between the notifications. Escape closes the panel
              and gives the focus back to the bell.
            </li>
            <li>
              A new unread count is announced politely, once a burst of
              notifications settles - not the count of the first load, nor a
              count going down.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="NotificationCenter" />
        <PropsTable of="NotificationItem" />
        <PropsTable of="NotificationAction" />
      </Section>
    </DocPage>
  );
}
