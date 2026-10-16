import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KanbanBoard, {
  type KanbanBoardProps,
  type KanbanCard,
  type KanbanColumn,
  type KanbanMove,
} from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import Dialog from "../dialog";
import { applyMove } from "./model";

interface Deal extends KanbanCard {
  title: string;
  value: number;
}

const columns: KanbanColumn[] = [
  { color: "info", id: "lead", title: "Lead" },
  { id: "offer", limit: 2, title: "Offer" },
  { color: "success", id: "won", title: "Won" },
];

const deals: Deal[] = [
  { columnId: "lead", id: 1, title: "Alza", value: 120 },
  { columnId: "lead", id: 2, title: "Rohlik", value: 80 },
  { columnId: "lead", id: 3, title: "Kofola", value: 50 },
  { columnId: "offer", id: 4, title: "Skoda", value: 900 },
  { columnId: "won", id: 5, title: "CEZ", value: 300 },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Props = Partial<KanbanBoardProps<Deal>>;

function Board(props: Props) {
  return (
    <KanbanBoard<Deal>
      aria-label="Deals"
      columns={columns}
      defaultCards={deals}
      renderCard={(deal) => (
        <>
          <strong>{deal.title}</strong> {deal.value} k
        </>
      )}
      {...props}
    />
  );
}

/** The card `title` on the board - not its copy beside the pointer. */
const card = (title: string) => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>("[data-kanban-card]"),
  ).find((element) => element.querySelector("strong")?.textContent === title);
  if (!found) throw new Error(`No card ${title}`);
  return found;
};
const column = (title: string) => screen.getByRole("group", { name: title });
const titlesIn = (title: string) =>
  within(column(title))
    .queryAllByRole("listitem")
    .filter((item) => !item.hasAttribute("data-kanban-placeholder"))
    .map((item) => item.querySelector("strong")?.textContent);
/** What the live region of the moves says - without the space that tells a repeated text apart. */
const announced = () =>
  screen.getAllByRole("status").at(-1)?.textContent?.replace(/ $/, "");

describe("KanbanBoard columns", () => {
  it("shows the columns with their cards, counts and limits", () => {
    render(
      <Board
        cards={[
          ...deals,
          { columnId: "offer", id: 6, title: "Lidl", value: 1 },
          { columnId: "offer", id: 7, title: "Tesco", value: 1 },
        ]}
      />,
    );

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(titlesIn("Lead")).toEqual(["Alza", "Rohlik", "Kofola"]);
    expect(within(column("Lead")).getByRole("heading")).toHaveTextContent(
      "Lead3, 3 cards",
    );
    // Over the limit - in the warning color, said to screen readers
    const offer = within(column("Offer")).getByRole("heading");
    expect(offer).toHaveTextContent("Offer3 / 2, 3 cards, over the limit of 2");
    expect(offer.querySelector("[data-over-limit]")).not.toBeNull();
    expect(column("Lead")).toHaveClass("border-t-info-500");
  });

  it("collapses and expands a column", async () => {
    const user = userEvent.setup();
    const onColumnCollapsedChange = vi.fn();
    render(<Board onColumnCollapsedChange={onColumnCollapsedChange} />);

    const collapse = screen.getByRole("button", { name: "Collapse Lead" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await user.click(collapse);

    expect(onColumnCollapsedChange).toHaveBeenCalledWith("lead", true);
    expect(within(column("Lead")).queryByRole("list")).toBeNull();
    expect(column("Lead")).toHaveTextContent("3, 3 cards");
    const expand = screen.getByRole("button", { name: "Expand Lead" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);
    expect(titlesIn("Lead")).toHaveLength(3);
  });

  it("follows a change of `collapsed`", () => {
    const { rerender } = render(<Board />);
    rerender(
      <Board
        columns={columns.map((entry) => ({
          ...entry,
          collapsed: entry.id === "won",
        }))}
      />,
    );
    expect(screen.getByRole("button", { name: "Expand Won" })).toBeVisible();
  });

  it("has the actions, the add button and a message of an empty column", async () => {
    const user = userEvent.setup();
    const onAddCard = vi.fn();
    render(
      <Board
        defaultCards={deals.filter((deal) => deal.columnId !== "won")}
        onAddCard={onAddCard}
        renderColumnActions={(entry) => (
          <button type="button">Sort {entry.title}</button>
        )}
      />,
    );

    expect(within(column("Won")).getByText("No cards")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sort Offer" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Add a card to Offer" }),
    );
    expect(onAddCard).toHaveBeenCalledWith(columns[1]);
  });

  it("opens a card - a link, or a button with onCardClick", async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    const { rerender } = render(<Board onCardClick={onCardClick} />);

    await user.click(screen.getByText("Rohlik"));
    expect(onCardClick).toHaveBeenCalledWith(deals[1]);
    card("Alza").focus();
    await user.keyboard("{Enter}");
    expect(onCardClick).toHaveBeenLastCalledWith(deals[0]);

    // Space too, on a card that cannot move
    rerender(<Board disabled onCardClick={onCardClick} />);
    card("Kofola").focus();
    await user.keyboard(" ");
    expect(onCardClick).toHaveBeenLastCalledWith(deals[2]);
    rerender(
      <Board canMoveCard={(deal) => deal.id !== 5} onCardClick={onCardClick} />,
    );
    card("CEZ").focus();
    await user.keyboard(" ");
    expect(onCardClick).toHaveBeenLastCalledWith(deals[4]);

    // Not for a control inside the card
    onCardClick.mockClear();
    rerender(
      <Board
        onCardClick={onCardClick}
        renderCard={(deal) => (
          <>
            <strong>{deal.title}</strong>
            <button type="button">Call {deal.title}</button>
          </>
        )}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Call Alza" }));
    expect(onCardClick).not.toHaveBeenCalled();

    rerender(<Board getCardHref={(deal) => `/deals/${deal.id}`} />);
    expect(screen.getByRole("link", { name: /Alza/ })).toHaveAttribute(
      "href",
      "/deals/1",
    );
  });
});

describe("KanbanBoard moving with the keys", () => {
  it("picks up with Space, moves with the arrows and drops with Space", async () => {
    const user = userEvent.setup();
    const onMoveCard = vi.fn();
    const onCardsChange = vi.fn();
    render(<Board onCardsChange={onCardsChange} onMoveCard={onMoveCard} />);

    const alza = card("Alza");
    expect(alza).toHaveAttribute("role", "button");
    expect(alza).toHaveAttribute("aria-roledescription", "card");
    expect(alza).toHaveAccessibleDescription(
      "Press Space to pick up the card, move it with the arrow keys, drop it with Space or Enter, or cancel with Escape.",
    );

    alza.focus();
    await user.keyboard(" ");
    expect(announced()).toBe(
      "Picked up the card “Alza”. Column Lead, position 1 of 3.",
    );
    expect(alza).toHaveAccessibleDescription(/Being moved$/);

    await user.keyboard("{ArrowDown}");
    expect(announced()).toBe("Column Lead, position 2 of 3.");
    await user.keyboard("{ArrowRight}");
    expect(announced()).toBe("Column Offer, position 2 of 2.");
    // The place shows with a copy of the card
    expect(
      column("Offer").querySelector("[data-kanban-placeholder]"),
    ).toHaveTextContent("Alza");
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Column Offer, position 1 of 2.");

    await user.keyboard(" ");
    expect(onMoveCard).toHaveBeenCalledWith({
      cardId: 1,
      fromColumnId: "lead",
      fromIndex: 0,
      toColumnId: "offer",
      toIndex: 0,
    });
    expect(announced()).toBe(
      "Card “Alza” moved to column Offer, position 1 of 2.",
    );
    expect(titlesIn("Offer")).toEqual(["Alza", "Skoda"]);
    expect(onCardsChange).toHaveBeenLastCalledWith(
      applyMove(deals, { cardId: 1, toColumnId: "offer", toIndex: 0 }),
    );
    // The focus stays on the card at its new place
    expect(card("Alza")).toHaveFocus();
    expect(document.querySelector("[data-kanban-placeholder]")).toBeNull();
  });

  it("drops with Enter, goes to the ends with Home and End", async () => {
    const user = userEvent.setup();
    const onMoveCard = vi.fn();
    render(<Board onMoveCard={onMoveCard} />);

    card("Alza").focus();
    await user.keyboard("{Enter}{End}");
    expect(announced()).toBe("Column Lead, position 3 of 3.");
    await user.keyboard("{Home}{End}{Enter}");
    expect(titlesIn("Lead")).toEqual(["Rohlik", "Kofola", "Alza"]);
    expect(onMoveCard).toHaveBeenCalledWith(
      expect.objectContaining({ fromIndex: 0, toColumnId: "lead", toIndex: 2 }),
    );
  });

  it("cancels with Escape - not the dialog around - and when the focus leaves", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMoveCard = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Pipeline">
        <Board onMoveCard={onMoveCard} />
        <button type="button">Elsewhere</button>
      </Dialog>,
    );

    card("Rohlik").focus();
    await user.keyboard(" {ArrowRight}{Escape}");
    expect(announced()).toBe("Moving the card “Rohlik” cancelled.");
    expect(onClose).not.toHaveBeenCalled();
    expect(onMoveCard).not.toHaveBeenCalled();
    expect(titlesIn("Lead")).toEqual(["Alza", "Rohlik", "Kofola"]);

    await user.keyboard(" {ArrowRight}");
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    expect(announced()).toBe("Moving the card “Rohlik” cancelled.");
    expect(document.querySelector("[data-kanban-placeholder]")).toBeNull();
  });

  it("says when a card stays where it was", async () => {
    const user = userEvent.setup();
    const onMoveCard = vi.fn();
    render(<Board onMoveCard={onMoveCard} />);

    card("Skoda").focus();
    await user.keyboard(" {ArrowUp} ");
    expect(announced()).toBe("The card “Skoda” stays where it was.");
    expect(onMoveCard).not.toHaveBeenCalled();
  });

  it("mirrors the arrows right to left", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl" style={{ direction: "rtl" }}>
        <Board />
      </div>,
    );

    card("Alza").focus();
    await user.keyboard(" {ArrowLeft}");
    expect(announced()).toBe("Column Offer, position 1 of 2.");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(announced()).toBe("Column Lead, position 1 of 3.");
  });

  it("skips the places canDrop refuses, and the full columns of enforceLimits", async () => {
    const user = userEvent.setup();
    render(
      <Board
        // Straight to Won is not allowed
        canDrop={(move) => move.toColumnId !== "won"}
        defaultCards={[
          ...deals,
          { columnId: "offer", id: 6, title: "Lidl", value: 1 },
        ]}
        enforceLimits
      />,
    );

    card("Alza").focus();
    await user.keyboard(" {ArrowRight}");
    // Offer is full, Won refused - it stays
    expect(announced()).toBe("Column Lead, position 1 of 3.");

    // Within its column a full one still moves
    card("Skoda").focus();
    await user.keyboard(" {ArrowDown}");
    expect(announced()).toBe("Column Offer, position 2 of 2.");
  });

  it("does not pick up what canMoveCard refuses", async () => {
    const user = userEvent.setup();
    render(<Board canMoveCard={(deal) => deal.id !== 5} />);

    expect(card("CEZ")).not.toHaveAttribute("aria-roledescription");
    card("CEZ").focus();
    await user.keyboard(" ");
    expect(card("CEZ")).not.toHaveAttribute("data-moving");
  });

  it("drops into a collapsed column at its end", async () => {
    const user = userEvent.setup();
    const onMoveCard = vi.fn();
    render(
      <Board
        columns={columns.map((entry) =>
          entry.id === "offer" ? { ...entry, collapsed: true } : entry,
        )}
        onMoveCard={onMoveCard}
      />,
    );

    card("Alza").focus();
    await user.keyboard(" {ArrowRight}");
    expect(announced()).toBe("Column Offer, position 2 of 2.");
    // Its cards are not shown - the card goes nowhere else in it
    await user.keyboard("{Home}{ArrowUp}");
    expect(announced()).toBe("Column Offer, position 2 of 2.");
    await user.keyboard(" ");
    expect(onMoveCard).toHaveBeenCalledWith(
      expect.objectContaining({ toColumnId: "offer", toIndex: 1 }),
    );
    // The card is in the collapsed column - the focus goes to its button
    expect(screen.getByRole("button", { name: "Expand Offer" })).toHaveFocus();
  });

  it("moves the focus between the cards with the arrows", async () => {
    const user = userEvent.setup();
    render(<Board />);

    card("Rohlik").focus();
    await user.keyboard("{ArrowDown}");
    expect(card("Kofola")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(card("Skoda")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowLeft}{Home}");
    expect(card("Alza")).toHaveFocus();
    await user.keyboard("{End}");
    expect(card("Kofola")).toHaveFocus();
  });

  it("skips the cards that take no focus, and takes ids with spaces", async () => {
    const user = userEvent.setup();
    render(
      <Board
        canMoveCard={(deal) => deal.id !== 2}
        columns={columns.map((entry) => ({
          ...entry,
          id: `${entry.id} "x"`,
        }))}
        defaultCards={deals.map((deal) => ({
          ...deal,
          columnId: `${deal.columnId} "x"`,
        }))}
      />,
    );

    expect(column("Lead")).toBeVisible();
    card("Alza").focus();
    await user.keyboard("{ArrowDown}");
    expect(card("Kofola")).toHaveFocus();
    await user.keyboard(" {ArrowRight} ");
    expect(titlesIn("Offer")).toEqual(["Skoda", "Kofola"]);
    expect(card("Kofola")).toHaveFocus();
  });

  it("announces in Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <Board
          columns={[
            { id: "lead", title: "Nové" },
            { id: "won", title: "Hotovo" },
          ]}
        />
      </UIProvider>,
    );

    card("Rohlik").focus();
    await user.keyboard(" ");
    expect(announced()).toBe(
      "Karta „Rohlik“ zvednuta. Sloupec Nové, pozice 2 z 3.",
    );
    await user.keyboard("{ArrowRight}{ArrowDown} ");
    expect(announced()).toBe(
      "Karta „Rohlik“ přesunuta do sloupce Hotovo, pozice 2 z 2.",
    );
    expect(within(column("Hotovo")).getByRole("heading")).toHaveTextContent(
      "Hotovo2, 2 karty",
    );
  });
});

describe("KanbanBoard saving a move", () => {
  it("moves at once, shows the pending card, and moves it back when saving fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let reject: (error: Error) => void = () => {};
    const onMoveCard = vi.fn(
      () => new Promise<void>((_, fail) => (reject = fail)),
    );
    const onCardsChange = vi.fn();
    render(<Board onCardsChange={onCardsChange} onMoveCard={onMoveCard} />);

    card("Kofola").focus();
    await user.keyboard(" {ArrowRight} ");
    expect(titlesIn("Offer")).toEqual(["Skoda", "Kofola"]);
    expect(card("Kofola")).toHaveAttribute("aria-busy", "true");

    await act(async () => reject(new Error("Locked")));
    expect(titlesIn("Lead")).toEqual(["Alza", "Rohlik", "Kofola"]);
    expect(onCardsChange).toHaveBeenLastCalledWith(deals);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The card “Kofola” could not be moved.",
    );
    expect(card("Kofola")).not.toHaveAttribute("aria-busy");
    // The focus went back with it
    expect(card("Kofola")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Close alert" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("moves a card back when saving fails, also once other cards moved", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejects: ((error: Error) => void)[] = [];
    render(
      <Board
        onMoveCard={(move) =>
          move.cardId === 3
            ? new Promise<void>((_, fail) => rejects.push(fail))
            : undefined
        }
      />,
    );

    card("Kofola").focus();
    await user.keyboard(" {ArrowRight}{ArrowDown} ");
    card("Alza").focus();
    await user.keyboard(" {ArrowRight} ");
    expect(titlesIn("Offer")).toEqual(["Alza", "Skoda", "Kofola"]);

    await act(async () => rejects[0](new Error("Locked")));
    expect(titlesIn("Offer")).toEqual(["Alza", "Skoda"]);
    expect(titlesIn("Lead")).toEqual(["Rohlik", "Kofola"]);
  });

  it("moves every card back when saves fail together", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejects: ((error: Error) => void)[] = [];
    const onMoveCard = () => new Promise<void>((_, fail) => rejects.push(fail));
    function Controlled() {
      const [cards, setCards] = useState(deals);
      return (
        <Board cards={cards} onCardsChange={setCards} onMoveCard={onMoveCard} />
      );
    }

    for (const board of [
      <Board key="uncontrolled" onMoveCard={onMoveCard} />,
      <Controlled key="controlled" />,
    ]) {
      rejects.length = 0;
      const { unmount } = render(board);
      card("Alza").focus();
      await user.keyboard(" {ArrowRight} ");
      card("CEZ").focus();
      await user.keyboard(" {ArrowLeft} ");
      expect(titlesIn("Offer")).toEqual(["CEZ", "Alza", "Skoda"]);

      // The server is down - both fail at once
      await act(async () => {
        for (const reject of rejects) reject(new Error("Offline"));
      });
      expect(titlesIn("Lead")).toEqual(["Alza", "Rohlik", "Kofola"]);
      expect(titlesIn("Offer")).toEqual(["Skoda"]);
      expect(titlesIn("Won")).toEqual(["CEZ"]);
      unmount();
    }
  });

  it("moves a carried card from where it is once another card moves back", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let reject: (error: Error) => void = () => {};
    const onMoveCard = vi.fn((move: KanbanMove) =>
      move.cardId === 3
        ? new Promise<void>((_, fail) => (reject = fail))
        : undefined,
    );
    render(<Board onMoveCard={onMoveCard} />);

    card("Kofola").focus();
    await user.keyboard(" {ArrowRight}{ArrowUp} ");
    expect(titlesIn("Offer")).toEqual(["Kofola", "Skoda"]);

    // Skoda is picked up second - and is first once Kofola goes back
    card("Skoda").focus();
    await user.keyboard(" ");
    await act(async () => reject(new Error("Locked")));
    expect(titlesIn("Offer")).toEqual(["Skoda"]);
    await user.keyboard("{ArrowUp}");
    expect(announced()).toBe("Column Offer, position 1 of 1.");
    await user.keyboard(" ");
    expect(announced()).toBe("The card “Skoda” stays where it was.");
    expect(onMoveCard).toHaveBeenCalledTimes(1);
  });

  it("shows a move of a controlled board until onMoveCard settles", async () => {
    const user = userEvent.setup();
    let resolve = () => {};
    function Controlled() {
      const [cards, setCards] = useState(deals);
      return (
        <Board
          cards={cards}
          onMoveCard={(move) =>
            new Promise<void>((done) => (resolve = done)).then(() =>
              setCards((current) => applyMove(current, move)),
            )
          }
        />
      );
    }
    render(<Controlled />);

    card("Alza").focus();
    await user.keyboard(" {ArrowRight}{ArrowRight} ");
    expect(titlesIn("Won")).toEqual(["Alza", "CEZ"]);
    expect(card("Alza")).toHaveAttribute("aria-busy", "true");
    await act(async () => resolve());
    expect(titlesIn("Won")).toEqual(["Alza", "CEZ"]);
    expect(card("Alza")).not.toHaveAttribute("aria-busy");
  });

  it("shows the changed cards of a controlled board - not its saving moves again", async () => {
    const user = userEvent.setup();
    const saves = new Map<KanbanCard["id"], () => void>();
    const onCardsChange = vi.fn();
    function Controlled() {
      const [cards, setCards] = useState(deals);
      return (
        <Board
          cards={cards}
          onCardsChange={(next) => {
            onCardsChange(next);
            setCards(next);
          }}
          onMoveCard={(move) =>
            new Promise<void>((done) => saves.set(move.cardId, done))
          }
        />
      );
    }
    render(<Controlled />);

    card("Kofola").focus();
    await user.keyboard(" {ArrowRight} ");
    card("Skoda").focus();
    await user.keyboard(" {ArrowDown} ");
    expect(titlesIn("Offer")).toEqual(["Kofola", "Skoda"]);
    expect(card("Kofola")).toHaveAttribute("aria-busy", "true");

    // The later move is saved first - the earlier one, still saving, does
    // not undo it, nor does another move
    await act(async () => saves.get(4)!());
    expect(titlesIn("Offer")).toEqual(["Kofola", "Skoda"]);
    card("Alza").focus();
    await user.keyboard(" {ArrowRight}{ArrowRight} ");
    expect(titlesIn("Offer")).toEqual(["Kofola", "Skoda"]);
    const offer = (onCardsChange.mock.lastCall![0] as Deal[])
      .filter((deal) => deal.columnId === "offer")
      .map((deal) => deal.title);
    expect(offer).toEqual(["Kofola", "Skoda"]);
  });

  it("moves nothing in a controlled board without callbacks, or a disabled one", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Board cards={deals} />);

    expect(card("Alza")).not.toHaveAttribute("tabindex");
    rerender(<Board disabled onMoveCard={() => {}} />);
    expect(card("Alza")).not.toHaveAttribute("aria-roledescription");
    await user.keyboard(" ");
    expect(document.querySelector("[data-moving]")).toBeNull();
  });
});

describe("KanbanBoard dragging with the pointer", () => {
  // The columns side by side, 300px apart; their cards 60px apart from 100px
  // down, 50px high
  const COLUMN_WIDTH = 300;
  const CARD_STEP = 60;
  const TOP = 100;

  const columnElements = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-kanban-column]"));
  const cardsOf = (element: Element) =>
    Array.from(element.querySelectorAll<HTMLElement>("[data-kanban-card]"));

  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const columnElement = this.closest("[data-kanban-column]");
        const columnIndex = columnElement
          ? columnElements().indexOf(columnElement as HTMLElement)
          : -1;
        const rect = (
          left: number,
          top: number,
          width: number,
          height: number,
        ) =>
          ({
            bottom: top + height,
            height,
            left,
            right: left + width,
            toJSON: () => ({}),
            top,
            width,
            x: left,
            y: top,
          }) as DOMRect;

        if (this.hasAttribute("data-kanban-card") && columnElement) {
          const index = cardsOf(columnElement).indexOf(this as HTMLElement);
          return rect(
            columnIndex * COLUMN_WIDTH,
            TOP + index * CARD_STEP,
            280,
            50,
          );
        }
        if (columnElement) {
          return rect(columnIndex * COLUMN_WIDTH, 0, 280, 800);
        }
        return rect(0, 0, 900, 800);
      },
    );
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: (x: number, y: number) => {
        const columnElement = columnElements()[Math.floor(x / COLUMN_WIDTH)];
        if (!columnElement) return document.body;
        const index = Math.floor((y - TOP) / CARD_STEP);
        return (
          cardsOf(columnElement)[index] ??
          columnElement.querySelector("[data-kanban-scroll]") ??
          columnElement
        );
      },
    });
  });

  afterEach(() => {
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  });

  /** The middle of the card `title`, `ratio` of its height down. */
  const pointAt = (title: string, ratio = 0.5) => {
    const element = card(title);
    const columnElement = element.closest("[data-kanban-column]") as Element;
    const columnIndex = columnElements().indexOf(columnElement as HTMLElement);
    const index = cardsOf(columnElement).indexOf(element);
    return {
      clientX: columnIndex * COLUMN_WIDTH + 100,
      clientY: TOP + index * CARD_STEP + 50 * ratio,
    };
  };
  const press = (title: string, pointerType = "mouse") =>
    fireEvent.pointerDown(card(title), {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType,
      ...pointAt(title),
    });
  const moveTo = (point: { clientX: number; clientY: number }) =>
    fireEvent.pointerMove(document, { pointerId: 1, ...point });
  const release = () => fireEvent.pointerUp(document, { pointerId: 1 });

  it("drags a card past a few pixels and drops it where the placeholder shows", () => {
    const onMoveCard = vi.fn();
    const onCardClick = vi.fn();
    render(<Board onCardClick={onCardClick} onMoveCard={onMoveCard} />);

    press("Alza");
    // Jitter within 5px is no drag
    moveTo({ ...pointAt("Alza"), clientY: pointAt("Alza").clientY + 3 });
    expect(card("Alza")).not.toHaveAttribute("data-dragging");

    // The upper half of Skoda - before it
    moveTo(pointAt("Skoda", 0.2));
    expect(card("Alza")).toHaveAttribute("data-dragging");
    expect(card("Alza")).toHaveClass("opacity-50");
    expect(column("Offer")).toHaveClass("ring-2");
    const placeholder = column("Offer").querySelector(
      "[data-kanban-placeholder]",
    );
    expect(placeholder?.nextElementSibling).toContainElement(card("Skoda"));
    // The copy of the card beside the pointer
    expect(document.body.lastElementChild).toHaveTextContent("Alza");

    // The lower half - after it
    moveTo(pointAt("Skoda", 0.8));
    release();
    // The click that ends the drag opens nothing
    fireEvent.click(card("Alza"));

    expect(onMoveCard).toHaveBeenCalledWith({
      cardId: 1,
      fromColumnId: "lead",
      fromIndex: 0,
      toColumnId: "offer",
      toIndex: 1,
    });
    expect(onCardClick).not.toHaveBeenCalled();
    expect(titlesIn("Offer")).toEqual(["Skoda", "Alza"]);
    expect(announced()).toBe(
      "Card “Alza” moved to column Offer, position 2 of 2.",
    );
  });

  it("keeps the drag of the browser off a link card", () => {
    render(
      <Board
        getCardHref={(deal) => `/deals/${deal.id}`}
        onMoveCard={() => {}}
      />,
    );
    expect(fireEvent.dragStart(card("Alza"))).toBe(false);
  });

  it("refuses a column canDrop does not allow", () => {
    const onMoveCard = vi.fn();
    render(
      <Board
        canDrop={(move) => move.toColumnId !== "won"}
        onMoveCard={onMoveCard}
      />,
    );

    press("Alza");
    moveTo(pointAt("CEZ"));
    expect(column("Won")).toHaveClass("ring-danger-500");
    expect(document.querySelector("[data-kanban-placeholder]")).toBeNull();
    release();
    expect(onMoveCard).not.toHaveBeenCalled();
  });

  it("cancels with Escape - the release drops nothing", () => {
    const onMoveCard = vi.fn();
    render(<Board onMoveCard={onMoveCard} />);

    press("Rohlik");
    moveTo(pointAt("Skoda"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(card("Rohlik")).not.toHaveAttribute("data-dragging");
    release();
    expect(onMoveCard).not.toHaveBeenCalled();
    expect(announced()).toBe("Moving the card “Rohlik” cancelled.");
  });

  it("picks a card up after a finger rests on it, not when it moves first", () => {
    vi.useFakeTimers();
    const onMoveCard = vi.fn();
    render(<Board onMoveCard={onMoveCard} />);

    // A finger moving right away scrolls - no drag
    press("Alza", "touch");
    moveTo(pointAt("Skoda"));
    act(() => vi.advanceTimersByTime(600));
    expect(card("Alza")).not.toHaveAttribute("data-dragging");
    release();

    // Resting on it picks it up; the page does not scroll with the finger
    press("Alza", "touch");
    expect(fireEvent.touchMove(card("Alza"))).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(card("Alza")).toHaveAttribute("data-dragging");
    expect(fireEvent.touchMove(card("Alza"))).toBe(false);
    moveTo(pointAt("CEZ", 0.8));
    release();
    expect(onMoveCard).toHaveBeenCalledWith(
      expect.objectContaining({ toColumnId: "won", toIndex: 1 }),
    );
  });

  it("listens to the finger before it touches - Safari on iOS needs it so", () => {
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");
    render(<Board onMoveCard={() => {}} />);

    const board = document.querySelector("[data-kanban-board]");
    expect(listen.mock.contexts).toContain(board);
    const onBoard = listen.mock.calls.filter(
      (_, index) => listen.mock.contexts[index] === board,
    );
    expect(onBoard).toContainEqual([
      "touchmove",
      expect.any(Function),
      { passive: false },
    ]);

    // Not added only by a press
    listen.mockClear();
    press("Alza", "touch");
    expect(listen).not.toHaveBeenCalledWith(
      "touchmove",
      expect.anything(),
      expect.anything(),
    );
    release();
  });

  it("scrolls the board while the pointer is near its edge", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback),
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(<Board />);

    press("Alza");
    moveTo(pointAt("Skoda"));
    const scroller = card("Alza").closest("[data-kanban-column]")
      ?.parentElement as HTMLElement;
    expect(frames).toHaveLength(0);

    // 10px from the right edge of the board (900px wide)
    moveTo({ clientX: 890, clientY: 400 });
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(scroller.scrollLeft).toBeGreaterThan(0);
    release();
  });

  it("scrolls a column running on below the window at the edge of the window", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback),
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(<Board />);
    // The cards of Lead scroll - its column is 800px high, the window 768px
    const cardsOfLead = column("Lead").querySelector<HTMLElement>(
      "[data-kanban-scroll]",
    )!;
    cardsOfLead.style.overflowY = "auto";
    Object.defineProperty(cardsOfLead, "scrollHeight", { value: 1600 });
    Object.defineProperty(cardsOfLead, "clientHeight", { value: 700 });

    press("Alza");
    // 28px above the bottom of the window - 60px above that of the column
    moveTo({ clientX: 100, clientY: 740 });
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(cardsOfLead.scrollTop).toBeGreaterThan(0);
    release();
  });

  it("does not drag from a control in the card, nor a card that cannot move", () => {
    const onMoveCard = vi.fn();
    render(
      <Board
        canMoveCard={(deal) => deal.id !== 2}
        onMoveCard={onMoveCard}
        renderCard={(deal) => (
          <>
            <strong>{deal.title}</strong>
            <button type="button">Menu {deal.title}</button>
          </>
        )}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Menu Alza" }), {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      ...pointAt("Alza"),
    });
    moveTo(pointAt("Skoda"));
    expect(document.querySelector("[data-dragging]")).toBeNull();
    release();

    press("Rohlik");
    moveTo(pointAt("Skoda"));
    expect(document.querySelector("[data-dragging]")).toBeNull();
    release();
    expect(onMoveCard).not.toHaveBeenCalled();
  });

  it("drops into a collapsed column at its end", async () => {
    const onMoveCard = vi.fn();
    render(
      <Board
        columns={columns.map((entry) =>
          entry.id === "offer" ? { ...entry, collapsed: true } : entry,
        )}
        onMoveCard={onMoveCard}
      />,
    );

    press("Alza");
    moveTo({ clientX: COLUMN_WIDTH + 10, clientY: 400 });
    release();
    await waitFor(() =>
      expect(onMoveCard).toHaveBeenCalledWith(
        expect.objectContaining({ toColumnId: "offer", toIndex: 1 }),
      ),
    );
  });
});
