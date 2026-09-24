import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ChipPage() {
  return (
    <DocPage imports={["Chip"]} title="Chip">
      <Example name="chip/variants" title="Colors and variants" />
      <Example
        description={
          <p>
            <code>onRemove</code> adds a remove button - named "Remove" and the
            text of the chip ("Remove Status: Unpaid"), or{" "}
            <code>removeLabel</code>. Backspace and Delete on it remove the chip
            too, and the focus moves on to the next chip (the previous one after
            the last), so a keyboard user can clear the filters one after
            another. A click on it does not reach a row or a card around the
            chip.
          </p>
        }
        name="chip/removable"
        title="Removable chips"
      />
      <Example
        description={
          <p>
            With <code>selected</code> and <code>onSelectedChange</code> - or{" "}
            <code>defaultSelected</code> - the chip is a toggle button: screen
            readers hear whether it is pressed, and a selected chip is filled in
            the <code>solid</code> variant of its <code>color</code> with a
            check mark, so the state is not told by color alone. Name the group
            of filters (<code>role="group"</code> with an{" "}
            <code>aria-label</code>).
          </p>
        }
        name="chip/filter"
        title="Filter chips"
      />
      <Example
        description={
          <p>
            <code>icon</code> goes before the text and is sized to the chip.{" "}
            <code>size</code> changes the text and the padding - <code>md</code>{" "}
            is as high as a line of text. <code>disabled</code> dims the chip
            and turns off its buttons.
          </p>
        }
        name="chip/icons-sizes"
        title="Icons, sizes and disabled"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            A plain chip is a <code>&lt;span&gt;</code> that fits into text. A
            removable one holds a button, a selectable one is a{" "}
            <code>&lt;button aria-pressed&gt;</code> - its props (
            <code>ref</code>, <code>aria-*</code>, event handlers) go to the
            button; <code>onClick</code> runs first, and{" "}
            <code>preventDefault()</code> in it keeps the state.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Chip" />
      </Section>
    </DocPage>
  );
}
