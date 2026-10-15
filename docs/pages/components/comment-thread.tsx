import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CommentThreadPage() {
  return (
    <DocPage
      imports={["CommentThread", "type CommentThreadItem"]}
      title="CommentThread"
    >
      <Example
        description={
          <p>
            The comments of a record, oldest first. Each shows its author, the
            time relative to now (the date and time in a tooltip), "edited" when
            it has an <code>editedAt</code>, and its text with mentions as chips
            - links with <code>getMentionHref</code>. The field at the end is a{" "}
            <code>MentionInput</code> with the <code>suggestions</code> or{" "}
            <code>loadSuggestions</code> given; Ctrl / ⌘ + Enter sends. The own
            comments of <code>currentUser</code> can be edited inline and
            deleted after a confirmation (<code>canEdit</code> /{" "}
            <code>canDelete</code> decide otherwise), <code>allowReplies</code>{" "}
            adds one level of replies, and <code>hasMore</code> with{" "}
            <code>onLoadMore</code> pages back. <code>renderAttachments</code>{" "}
            shows what your comment type carries - files here.
          </p>
        }
        name="comment-thread/invoice"
        title="Comments on an invoice"
      />
      <Example
        description={
          <p>
            <code>loading</code> shows placeholders, a thread without comments
            says so (<code>emptyMessage</code>), and one without{" "}
            <code>onSubmit</code> has no field.
          </p>
        }
        name="comment-thread/states"
        title="Loading, empty and read-only"
      />

      <Section title="Saving">
        <Prose>
          <p>
            <code>onSubmit</code>, <code>onEdit</code>, <code>onDelete</code>{" "}
            and <code>onLoadMore</code> may return a promise. Meanwhile the text
            stays in its field, read-only, and the button shows a spinner; once
            it resolves the field empties (or closes). A rejection keeps the
            text with the error under it - the message of an <code>Error</code>,
            else a localized one - so nothing the user wrote is lost. The thread
            changes no comments itself: update <code>comments</code> when the
            server confirms.
          </p>
        </Prose>
      </Section>

      <Section title="Accessibility">
        <Prose>
          <p>
            The comments are a list of <code>{"<article>"}</code> elements named
            by their author and time; the actions of a comment are described by
            them too, so "Edit" says whose comment it edits. Comments of others
            added at the end - not older ones loaded above, nor the user's own -
            are announced politely, as is a deletion. The focus stays where the
            user works: in the field after sending, on "Edit" after editing, on
            "Reply" after replying.
          </p>
        </Prose>
      </Section>

      <Callout title="Relative times and server rendering">
        <p>
          The times are written by <code>useFormatRelativeTime</code> and
          updated every minute. The server, and a page while it hydrates, writes
          the date and time instead - the clock of the server is not the user's.
          Pass the <code>timeZone</code> of the user to write them on their
          clock.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="CommentThread" />
        <PropsTable of="CommentThreadItem" />
        <PropsTable of="CommentAuthor" />
      </Section>
    </DocPage>
  );
}
