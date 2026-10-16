import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function MentionInputPage() {
  return (
    <DocPage
      imports={["MentionInput", "MentionText", "parseMentions"]}
      title="MentionInput"
    >
      <Example
        description={
          <p>
            Typing the trigger (<code>@</code>) at the start of a word opens the
            suggestions at the caret, filtered by the text after it ignoring
            case and diacritics - in the label, the <code>description</code> and
            the <code>keywords</code>. The arrows move through them, Enter or
            Tab inserts one, Escape closes the list (and only the list, not a
            dialog around). The field shows the mention as "@Jana Nováková"; its
            value stores it as a token, <code>@[Jana Nováková](user:12)</code>,
            which <code>parseMentions</code> reads.
          </p>
        }
        name="mention-input/basic"
        title="Mentioning colleagues"
      />
      <Example
        description={
          <p>
            <code>loadSuggestions(query, {"{ signal, trigger }"})</code> loads
            them from an API - right after the trigger, then once the typing
            pauses; the <code>signal</code> aborts the request of a query typed
            over, a failure shows in the list (and <code>onLoadError</code>).{" "}
            <code>triggers</code> adds more characters, each with suggestions, a
            list name and rules of its own - a ticket number has no spaces (
            <code>allowSpaces: false</code>); a name may ("@Jana Nov"). A query
            with a space that finds nothing closes the list: it was no mention.
            The list opened again loads anew - it offers nothing loaded before,
            maybe by another <code>loadSuggestions</code>.
          </p>
        }
        name="mention-input/async"
        title="Loaded suggestions and more triggers"
      />
      <Example
        description={
          <p>
            Like a <code>Textarea</code>: <code>label</code>,{" "}
            <code>description</code>, <code>error</code>, <code>required</code>,{" "}
            <code>autosize</code>, <code>maxLength</code> with{" "}
            <code>showCount</code>, controlled or uncontrolled. A hidden input
            submits the value with the tokens under <code>name</code>; a reset
            of the form brings back <code>defaultValue</code>.{" "}
            <code>mentionsToText</code> writes a value as plain text, e.g. for
            an e-mail.
          </p>
        }
        name="mention-input/form"
        title="In a form"
      />
      <Example
        description={
          <p>
            <code>MentionText</code> shows a stored value with its line breaks
            and its mentions as chips - links with <code>getMentionHref</code>,
            through the router of <code>UIProvider</code> (a{" "}
            <code>javascript:</code> link is left out - the id comes from the
            user). <code>renderMention</code> renders them yourself,{" "}
            <code>renderMentions</code> returns the nodes for an element of your
            own.
          </p>
        }
        name="mention-input/display"
        title="Showing a value"
      />

      <Section title="How it works">
        <Prose>
          <p>
            The field is a native <code>{"<textarea>"}</code> with the text as
            it shows, and a layer under it that draws the same text with the
            mentions highlighted. Typing, the input methods of Chinese or
            Japanese (IME), spell checking, the keyboards of phones, undo and
            screen readers all work as in any text field - an editable{" "}
            <code>div</code> with chips would have to rebuild each of them, and
            breaks some (composition next to a chip, Android keyboards). The
            price: a mention is highlighted, not a separate box, and its text
            keeps the font of the field.
          </p>
          <p>
            A mention behaves as one piece: Backspace after it (or Delete before
            it) deletes it whole - and so does deleting a word (⌥ / Ctrl +
            Backspace) after the spaces behind it - the caret skips over it, and
            a change inside it - typed into a selection reaching into it - makes
            it plain text again. Mentions are inserted by the editing of the
            browser, so undo takes an insertion back, and undo or redo bring the
            mentions of the text back with it. Copied and pasted between mention
            fields, mentions stay mentions - of the triggers the field has;
            pasted elsewhere they are text.
          </p>
          <p>
            Text that looks like a token is stored escaped - "@[" written as
            text is <code>@\[</code> in the value - so a value always reads back
            as it was typed. Read stored values with the same{" "}
            <code>triggers</code> as the field.
          </p>
        </Prose>
      </Section>

      <Section title="Accessibility">
        <Prose>
          <p>
            The field stays a multi-line text box for screen readers, with{" "}
            <code>aria-autocomplete="list"</code>; while the list is open it
            points at it (<code>aria-controls</code>) and at the highlighted
            suggestion (<code>aria-activedescendant</code>), as a combobox does.
            The number of suggestions is announced once the typing pauses, and
            so is an inserted mention.
          </p>
        </Prose>
      </Section>

      <Callout title="Ids come from the user">
        <p>
          The value is text the user sent - <code>parseMentions</code> returns
          whatever ids it contains. Check on the server that a mentioned person
          exists and may see the record before notifying them.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="MentionInput" />
        <PropsTable of="MentionSuggestion" />
        <PropsTable of="MentionTrigger" />
        <PropsTable of="MentionText" />
      </Section>
    </DocPage>
  );
}
