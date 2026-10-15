/** The id of a card or a column. */
export type KanbanId = string | number;

/** A column of `KanbanBoard`. */
export interface KanbanColumn {
  /**
   * Starts collapsed - a narrow strip with the title and the number of
   * cards. The user collapses and expands the columns; a change of this
   * field collapses or expands the column again.
   */
  collapsed?: boolean;
  /** Color of the strip at the top of the column - e.g. by the stage. */
  color?: KanbanColor;
  /** Unique among the columns. */
  id: KanbanId;
  /**
   * The most cards the column should have (a WIP limit) - shown as "3 / 5"
   * in its header, in the warning color once exceeded. With
   * `enforceLimits` a full column takes no more cards.
   */
  limit?: number;
  /** Heading of the column - also in the announcements of the moves. */
  title: string;
}

/** The colors of the strip at the top of a column. */
export type KanbanColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

/** A card of `KanbanBoard` - with the fields of your own `renderCard` shows. */
export interface KanbanCard {
  /** The column it is in. */
  columnId: KanbanId;
  /** Unique among the cards. */
  id: KanbanId;
  /**
   * Names the card in the announcements of its moves - or give
   * `getCardLabel`.
   */
  title?: string;
}

/** A move of a card - what `onMoveCard` gets. */
export interface KanbanMove {
  cardId: KanbanId;
  fromColumnId: KanbanId;
  /** Its position in the column it came from, from 0. */
  fromIndex: number;
  toColumnId: KanbanId;
  /** Its position in the column it went to, from 0 - among the cards there. */
  toIndex: number;
}

/** A place a card can be dropped at - its position among the other cards. */
export interface KanbanPlace {
  columnId: KanbanId;
  index: number;
}

/** A key of an id that tells `1` from `"1"`. */
export const idKey = (id: KanbanId) =>
  typeof id === "number" ? `n${id}` : `s${id}`;

/** The cards of a column, in their order. */
export const cardsIn = <T extends KanbanCard>(
  cards: readonly T[],
  columnId: KanbanId,
) => cards.filter((card) => card.columnId === columnId);

/** Where a card is - `null` for a card not in `cards`. */
export function placeOf(
  cards: readonly KanbanCard[],
  cardId: KanbanId,
): KanbanPlace | null {
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) return null;
  return {
    columnId: card.columnId,
    index: cardsIn(cards, card.columnId).indexOf(card),
  };
}

/**
 * The cards with one moved to `toColumnId` at `toIndex` (among the other
 * cards of that column) - the card itself is copied with the new
 * `columnId`.
 */
export function applyMove<T extends KanbanCard>(
  cards: readonly T[],
  {
    cardId,
    toColumnId,
    toIndex,
  }: Pick<KanbanMove, "cardId" | "toColumnId" | "toIndex">,
): T[] {
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) return [...cards];

  const rest = cards.filter((candidate) => candidate !== card);
  const moved =
    card.columnId === toColumnId ? card : { ...card, columnId: toColumnId };
  const column = cardsIn(rest, toColumnId);
  const before = column[Math.max(0, toIndex)];

  if (before && toIndex < column.length) {
    rest.splice(rest.indexOf(before), 0, moved);
  } else {
    // After the last card of the column - at the end without any
    const last = column.at(-1);
    rest.splice(last ? rest.indexOf(last) + 1 : rest.length, 0, moved);
  }
  return rest;
}

/** Whether two places are the same. */
export const samePlace = (a: KanbanPlace | null, b: KanbanPlace | null) =>
  a === b || (!!a && !!b && a.columnId === b.columnId && a.index === b.index);
