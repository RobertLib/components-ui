import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function KanbanBoardPage() {
  return (
    <DocPage
      imports={["KanbanBoard", "type KanbanCard", "type KanbanColumn"]}
      title="KanbanBoard"
    >
      <Example
        description={
          <p>
            <code>columns</code> are <code>{"{ id, title }"}</code> with an
            optional <code>color</code> strip and a WIP <code>limit</code> - "2
            / 3" in the header, in the warning color once exceeded. The cards
            are <code>{"{ id, columnId }"}</code> and whatever your{" "}
            <code>renderCard</code> shows; the board draws their frame. A move
            calls <code>onCardsChange</code> with the cards reordered at once
            and <code>onMoveCard(move)</code> to save it - while its promise is
            pending the card is busy, and when it rejects the card moves back
            and the board shows an error. <code>canDrop</code> holds the rules
            of the workflow, <code>canMoveCard</code> pins a card (a won deal
            here); <code>renderColumnActions</code> adds to the header - the
            total of the column here.
          </p>
        }
        name="kanban-board/pipeline"
        title="A sales pipeline"
      />
      <Example
        description={
          <p>
            With <code>enforceLimits</code> a column at its <code>limit</code>{" "}
            takes no more cards. A <code>collapsed</code> column is a narrow
            strip that still takes cards (at its end); the button in each header
            collapses or expands it. <code>onCardClick</code> (or{" "}
            <code>getCardHref</code>, a link through the router) opens a card,{" "}
            <code>onAddCard</code> adds an "Add card" button under the cards -
            or put content of your own there with{" "}
            <code>renderColumnFooter</code>.
          </p>
        }
        name="kanban-board/tickets"
        title="Support tickets"
      />

      <Section title="Moving the cards">
        <Prose>
          <p>
            With a mouse or a pen a card is dragged once the pointer moves a few
            pixels; on a touch screen a finger rests on it for a moment first,
            so that a swipe still scrolls. A placeholder shows where it would
            land, a column that refuses it is outlined in red, and the board -
            sideways - and a column - up and down - scroll while the pointer is
            near their edges. Escape cancels a drag.
          </p>
          <p>
            With the keys, Space picks up the focused card (Enter too, for a
            card that does not open), the arrows choose its place - up and down
            in a column, left and right across the columns, mirrored in a
            right-to-left page - Home and End go to the ends of the column, and
            Space or Enter drops it; Escape or leaving the card cancels. Each
            step is announced: "Card “Alza” moved to column Won, position 2 of
            5." Not carrying a card, the arrows move the focus between the
            cards.
          </p>
        </Prose>
      </Section>

      <Section title="Controlled and uncontrolled">
        <Prose>
          <p>
            Give <code>defaultCards</code> and the board keeps the order itself,
            or <code>cards</code> with <code>onCardsChange</code> to keep it in
            your state. A controlled board with only <code>onMoveCard</code>{" "}
            shows a move until its promise settles - update <code>cards</code>{" "}
            by then; with <code>onCardsChange</code> too, it shows your{" "}
            <code>cards</code> as soon as they change. When saves fail, each
            card moves back - also when several fail at once. The cards of a
            column are in the order of the array; <code>toIndex</code> of a move
            is the position among the cards of the column it goes to.
          </p>
        </Prose>
      </Section>

      <Callout title="Phones">
        <p>
          Below the <code>sm</code> breakpoint each column is almost as wide as
          the screen and the board snaps to them as it scrolls sideways.
          Dragging near the edge of the board scrolls it to the next column.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="KanbanBoard" />
        <PropsTable of="KanbanColumn" />
        <PropsTable of="KanbanCard" />
        <PropsTable of="KanbanMove" />
      </Section>
    </DocPage>
  );
}
