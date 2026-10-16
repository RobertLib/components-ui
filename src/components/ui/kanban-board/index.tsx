import { AlertTriangle, Maximize2, Minimize2, Plus } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { attachRef } from "../../../hooks/use-form-control";
import {
  formatMessage,
  formatNumber,
  formatPlural,
} from "../../../i18n/ui/format";
import {
  useLocale,
  usePortalContainer,
  useRouterActions,
} from "../../../providers/ui-context";
import cn, { joinTokens } from "../../../utils/cn";
import isPromiseLike from "../../../utils/is-promise-like";
import logger from "../../../utils/logger";
import Alert from "../alert";
import Button from "../button";
import IconButton from "../icon-button";
import Spinner from "../spinner";
import {
  applyMove,
  cardsIn,
  idKey,
  placeOf,
  samePlace,
  type KanbanCard,
  type KanbanColumn,
  type KanbanId,
  type KanbanMove,
  type KanbanPlace,
} from "./model";
import useKanbanDrag, { findElement, isFromControl } from "./use-kanban-drag";

export type {
  KanbanCard,
  KanbanColor,
  KanbanColumn,
  KanbanId,
  KanbanMove,
} from "./model";

/** The state of a card `renderCard` renders. */
export interface KanbanCardState {
  /**
   * The card is being moved - its copy beside the pointer, and the card
   * itself, dimmed at its place.
   */
  dragging: boolean;
  /** `onMoveCard` of its last move is still running. */
  pending: boolean;
}

export interface KanbanBoardProps<
  T extends KanbanCard = KanbanCard,
> extends Omit<
  React.ComponentProps<"div">,
  "children" | "defaultValue" | "onChange"
> {
  /**
   * Whether a card may land at a place - e.g. the rules of a workflow: a
   * deal is not won before it was offered. The places it may not are
   * skipped by the keys and refused to the pointer.
   */
  canDrop?: (move: KanbanMove & { card: T }) => boolean;
  /** Whether a card can be moved at all - e.g. not a closed one. */
  canMoveCard?: (card: T) => boolean;
  /**
   * The cards of a controlled board, in their order - those of a column in
   * the order they are listed. Update them in `onCardsChange`.
   */
  cards?: readonly T[];
  /** The columns, in their order. */
  columns: readonly KanbanColumn[];
  /** The cards of an uncontrolled board at first. */
  defaultCards?: readonly T[];
  /** No card can be moved. */
  disabled?: boolean;
  /**
   * A column with a `limit` takes no more cards once it has as many - the
   * keys skip it, the pointer is refused. Off by default: the limit is only
   * shown, in the warning color once exceeded.
   */
  enforceLimits?: boolean;
  /**
   * The page of a card - the card is a link to it, through the router of
   * `UIProvider`. Space picks it up, Enter opens it.
   */
  getCardHref?: (card: T) => string | undefined;
  /**
   * Names a card in the announcements of its moves - its `title` by
   * default, else its id.
   */
  getCardLabel?: (card: T) => string;
  /** Level of the headings of the columns. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Adds an "Add card" button under the cards of each column. */
  onAddCard?: (column: KanbanColumn) => void;
  /**
   * Called on a click on a card, and Enter on it - e.g. to open its detail.
   * Space picks it up.
   */
  onCardClick?: (card: T) => void;
  /**
   * Called with the cards after a move - at once, and again with the card
   * moved back when `onMoveCard` rejects. Required to move the cards of a
   * controlled board, unless `onMoveCard` changes them.
   */
  onCardsChange?: (cards: T[]) => void;
  /** Called when the user collapses or expands a column. */
  onColumnCollapsedChange?: (columnId: KanbanId, collapsed: boolean) => void;
  /**
   * Called when a card is dropped at another place - e.g. to save the new
   * stage. The card moves at once; while a returned promise is pending it
   * shows a spinner, and when it rejects the board shows an error and the
   * card moves back (by `onCardsChange` in a controlled board that moved
   * it).
   */
  onMoveCard?: (move: KanbanMove) => Promise<void> | void;
  /**
   * The content of a card - the board draws its frame, which is the
   * button (or the link) the card is moved and opened with.
   */
  renderCard: (card: T, state: KanbanCardState) => React.ReactNode;
  /** Buttons in the header of a column - e.g. a menu of its actions. */
  renderColumnActions?: (column: KanbanColumn) => React.ReactNode;
  /** Content under the cards of a column - in place of "Add card". */
  renderColumnFooter?: (column: KanbanColumn) => React.ReactNode;
}

// The strip at the top of a column, in its color - a system color in
// forced colors mode
const stripColors = {
  danger: "border-t-danger-500",
  info: "border-t-info-500",
  neutral: "border-t-neutral-400 dark:border-t-neutral-500",
  primary: "border-t-primary-500",
  secondary: "border-t-secondary-500",
  success: "border-t-success-600 dark:border-t-success-500",
  warning: "border-t-warning-500",
};

// The frame of a card - also of its copy beside the pointer
const cardFrame =
  "relative block rounded-md border border-neutral-200 bg-surface p-3 text-sm text-neutral-900 shadow-xs dark:border-neutral-700 dark:bg-surface-dark dark:text-neutral-100";

/**
 * A board of columns with cards - a sales pipeline, the tickets of a
 * support team. Cards move between and within the columns by dragging
 * (a mouse, or a finger resting on a card) or with the keys: Space picks a
 * card up, the arrows choose its place, Space or Enter drops it and Escape
 * cancels; each step is announced. A move may be saved asynchronously
 * (`onMoveCard`) - a failure moves the card back. Columns can show a WIP
 * limit, collapse, and have actions of their own. On phones the columns
 * scroll sideways one by one.
 */
export default function KanbanBoard<T extends KanbanCard = KanbanCard>({
  canDrop,
  canMoveCard,
  cards,
  className,
  columns,
  defaultCards,
  disabled = false,
  enforceLimits = false,
  getCardHref,
  getCardLabel,
  headingLevel = 3,
  onAddCard,
  onBlur,
  onCardClick,
  onCardsChange,
  onColumnCollapsedChange,
  onMoveCard,
  ref,
  renderCard,
  renderColumnActions,
  renderColumnFooter,
  ...props
}: KanbanBoardProps<T>) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const { Link } = useRouterActions();
  const baseId = useId();
  const instructionsId = `${baseId}-instructions`;
  const movingId = `${baseId}-moving`;
  const Heading = `h${headingLevel}` as const;

  const boardRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // The board's own ref, and the one given to it
  const boardCallbackRef = useCallback(
    (element: HTMLDivElement | null) => {
      boardRef.current = element;
      const detachRef = attachRef(ref, element);
      return () => {
        boardRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  // The cards of an uncontrolled board
  const [internalCards, setInternalCards] = useState<readonly T[]>(
    () => defaultCards ?? [],
  );
  const isControlled = cards !== undefined;
  const baseCards = isControlled ? cards : internalCards;
  // The moves `onMoveCard` still saves - a controlled board shows them
  // until the app has the cards moved: once saved, or with `onCardsChange`
  // as soon as its cards change (they have the move then, and maybe newer
  // ones that showing it again would undo)
  const [pendingMoves, setPendingMoves] = useState<
    {
      /** The cards of the app when it was made. */
      base: readonly T[];
      card: T;
      move: KanbanMove;
      result: PromiseLike<unknown>;
      token: object;
    }[]
  >([]);
  const shownCards = isControlled
    ? pendingMoves.reduce<readonly T[]>(
        (list, { base, move }) =>
          onCardsChange && base !== baseCards ? list : applyMove(list, move),
        baseCards,
      )
    : baseCards;
  // The last move of each card - a failed move is moved back only while it
  // is the card's last one
  const [lastMoves, setLastMoves] = useState(() => new Map<string, object>());
  const pendingIds = new Set(
    pendingMoves.map(({ move }) => idKey(move.cardId)),
  );
  const [moveError, setMoveError] = useState<string | null>(null);

  // The collapsed columns - as the user left them, and as `collapsed` says
  // once it changes
  const [collapse, setCollapse] = useState(() => ({
    given: new Map(
      columns.map((column) => [idKey(column.id), !!column.collapsed]),
    ),
    ids: new Set(
      columns
        .filter((column) => column.collapsed)
        .map((column) => idKey(column.id)),
    ),
  }));
  if (
    columns.some(
      (column) => collapse.given.get(idKey(column.id)) !== !!column.collapsed,
    )
  ) {
    const ids = new Set(collapse.ids);
    for (const column of columns) {
      const key = idKey(column.id);
      if (collapse.given.get(key) === !!column.collapsed) continue;
      if (column.collapsed) ids.add(key);
      else ids.delete(key);
    }
    setCollapse({
      given: new Map(
        columns.map((column) => [idKey(column.id), !!column.collapsed]),
      ),
      ids,
    });
  }
  const isCollapsed = (columnId: KanbanId) => collapse.ids.has(idKey(columnId));

  const toggleCollapsed = (column: KanbanColumn) => {
    const key = idKey(column.id);
    const collapsed = !collapse.ids.has(key);
    const ids = new Set(collapse.ids);
    if (collapsed) ids.add(key);
    else ids.delete(key);
    setCollapse({ ...collapse, ids });
    onColumnCollapsedChange?.(column.id, collapsed);
  };

  const movable =
    !disabled && (!isControlled || !!onCardsChange || !!onMoveCard);
  const labelOf = (card: T) =>
    getCardLabel?.(card) ??
    (typeof card.title === "string" && card.title
      ? card.title
      : String(card.id));
  const canMove = (card: T) => movable && (canMoveCard?.(card) ?? true);

  const isAllowed = (card: T, origin: KanbanPlace, target: KanbanPlace) => {
    // Staying is always possible
    if (samePlace(origin, target)) return true;
    if (!canMove(card)) return false;
    const column = columns.find(
      (candidate) => candidate.id === target.columnId,
    );
    if (!column) return false;
    if (
      enforceLimits &&
      column.limit !== undefined &&
      target.columnId !== origin.columnId &&
      cardsIn(shownCards, column.id).length >= column.limit
    ) {
      return false;
    }
    return (
      canDrop?.({
        card,
        cardId: card.id,
        fromColumnId: origin.columnId,
        fromIndex: origin.index,
        toColumnId: target.columnId,
        toIndex: target.index,
      }) ?? true
    );
  };

  const commitMove = (card: T, origin: KanbanPlace, target: KanbanPlace) => {
    const move: KanbanMove = {
      cardId: card.id,
      fromColumnId: origin.columnId,
      fromIndex: origin.index,
      toColumnId: target.columnId,
      toIndex: target.index,
    };
    const next = applyMove(shownCards, move);
    setMoveError(null);
    if (!isControlled) setInternalCards(next);
    onCardsChange?.(next);

    const token = {};
    setLastMoves((current) => new Map(current).set(idKey(card.id), token));
    const result = onMoveCard?.(move);
    if (isPromiseLike(result)) {
      setPendingMoves((list) => [
        ...list,
        { base: baseCards, card, move, result, token },
      ]);
    }
  };

  const drag = useKanbanDrag<T>({
    boardRef,
    canMove,
    cards: shownCards,
    columns,
    enabled: movable,
    getLabel: labelOf,
    isAllowed,
    isCollapsed,
    onDrop: commitMove,
    scrollerRef,
  });

  // For the settling of the moves, which comes between renders
  const latest = {
    baseCards,
    isControlled,
    keepFocus: drag.keepFocus,
    labelOf,
    lastMoves,
    messages,
    onCardsChange,
  };
  const latestRef = useRef(latest);
  useLayoutEffect(() => {
    latestRef.current = latest;
  });

  /** Moves a card back where it came from - unless it moved on meanwhile. */
  const rollback = (move: KanbanMove, token: object) => {
    const {
      baseCards: current,
      isControlled,
      keepFocus,
      lastMoves,
      onCardsChange,
    } = latestRef.current;
    if (lastMoves.get(idKey(move.cardId)) !== token) return;
    // Back already - the app never moved it
    const from = { columnId: move.fromColumnId, index: move.fromIndex };
    const place = placeOf(current, move.cardId);
    if (!place || samePlace(place, from)) return;

    const next = applyMove(current, {
      cardId: move.cardId,
      toColumnId: from.columnId,
      toIndex: from.index,
    });
    // A move failing too before the board renders again is moved back in
    // these cards - not in those it last rendered, which would undo this
    latestRef.current = { ...latestRef.current, baseCards: next };
    keepFocus(move.cardId, from.columnId);
    if (!isControlled) setInternalCards(next);
    onCardsChange?.(next);
  };

  // The moves `onMoveCard` saves: settled, they are no longer shown as
  // pending - and a failed one is moved back, with an error
  const watchedMoves = useRef(new WeakSet<object>());
  useEffect(() => {
    for (const { card, move, result, token } of pendingMoves) {
      if (watchedMoves.current.has(token)) continue;
      watchedMoves.current.add(token);

      const settle = () =>
        setPendingMoves((list) =>
          list.filter((entry) => entry.token !== token),
        );
      Promise.resolve(result).then(settle, (error: unknown) => {
        logger.error("Failed to move the card", error);
        settle();
        rollback(move, token);
        const { labelOf, messages } = latestRef.current;
        setMoveError(
          formatMessage(messages.kanbanBoard.moveError, {
            card: labelOf(card),
          }),
        );
      });
    }
  });

  const session = drag.session;
  const draggedCard = session
    ? shownCards.find((card) => card.id === session.cardId)
    : undefined;

  /**
   * The cards of a column of the board `element` is in that take the focus
   * - not those that neither move nor open.
   */
  const cardElements = (element: Element, columnId: KanbanId) =>
    Array.from(
      findElement(
        element.closest("[data-kanban-board]"),
        "kanbanColumn",
        idKey(columnId),
      )?.querySelectorAll<HTMLElement>("[data-kanban-card]") ?? [],
    ).filter((card) => card.tabIndex >= 0);

  /** The arrows move the focus between the cards - not while one is carried. */
  const moveFocus = (event: React.KeyboardEvent<HTMLElement>, card: T) => {
    const column = cardElements(event.currentTarget, card.columnId);
    const index = column.indexOf(event.currentTarget);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next: HTMLElement | undefined;

    switch (event.key) {
      case "ArrowUp":
        next = column[index - 1];
        break;
      case "ArrowDown":
        next = column[index + 1];
        break;
      case "Home":
        next = column[0];
        break;
      case "End":
        next = column.at(-1);
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        const step = (event.key === "ArrowRight") !== rtl ? 1 : -1;
        const from = columns.findIndex(
          (candidate) => candidate.id === card.columnId,
        );
        for (let at = from + step; at >= 0 && at < columns.length; at += step) {
          const others = cardElements(event.currentTarget, columns[at].id);
          if (others.length > 0) {
            next = others[Math.min(index, others.length - 1)];
            break;
          }
        }
        break;
      }
      default:
        return;
    }

    event.preventDefault();
    next?.focus();
  };

  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    card: T,
    hasAction: boolean,
  ) => {
    // The keys of the controls inside the card are theirs
    if (event.target !== event.currentTarget) return;
    if (drag.onKeyDown(event, card, !hasAction)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;

    // A button card opens with Enter - and Space, unless Space moves it
    if (
      (event.key === "Enter" || (event.key === " " && !canMove(card))) &&
      onCardClick &&
      !getCardHref?.(card)
    ) {
      event.preventDefault();
      onCardClick(card);
      return;
    }
    moveFocus(event, card);
  };

  const renderCardItem = (card: T) => {
    const key = idKey(card.id);
    const dragging = session?.cardId === card.id;
    const pending = pendingIds.has(key);
    const href = getCardHref?.(card);
    const hasAction = !!href || !!onCardClick;
    const cardMovable = canMove(card);
    const focusable = hasAction || cardMovable;
    const state: KanbanCardState = { dragging, pending };

    const cardProps = {
      "aria-busy": pending || undefined,
      "aria-describedby": joinTokens(
        cardMovable ? instructionsId : undefined,
        dragging ? movingId : undefined,
      ),
      className: cn(
        cardFrame,
        // Picked up with a finger, it is not selected nor its menu opened
        cardMovable &&
          "[-webkit-touch-callout:none] pointer-coarse:select-none",
        focusable &&
          "cursor-pointer outline-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none",
        dragging && "opacity-50",
        dragging &&
          session?.mode === "keyboard" &&
          "opacity-60 ring-2 ring-primary-500 forced-colors:outline-2 forced-colors:outline-[Highlight]",
      ),
      "data-dragging": dragging ? "" : undefined,
      "data-kanban-card": key,
      "data-moving": dragging ? "" : undefined,
      "data-pending": pending ? "" : undefined,
      // Not for a click on a control inside the card - it is the control's
      onClick: onCardClick
        ? (event: React.MouseEvent<HTMLElement>) => {
            if (!isFromControl(event)) onCardClick(card);
          }
        : undefined,
      // A link or an image in it would start the drag of the browser, which
      // takes the pointer away
      onDragStart: cardMovable
        ? (event: React.DragEvent<HTMLElement>) => event.preventDefault()
        : undefined,
      onKeyDown: focusable
        ? (event: React.KeyboardEvent<HTMLElement>) =>
            handleCardKeyDown(event, card, hasAction)
        : undefined,
      onPointerDown: cardMovable
        ? (event: React.PointerEvent<HTMLElement>) =>
            drag.onPointerDown(event, card)
        : undefined,
    };
    const content = (
      <>
        {renderCard(card, state)}
        {pending && (
          <Spinner
            aria-hidden="true"
            className="absolute inset-e-2 top-2"
            size="sm"
          />
        )}
      </>
    );

    return (
      <li key={key}>
        {href ? (
          <Link {...cardProps} href={href}>
            {content}
          </Link>
        ) : (
          <div
            {...cardProps}
            aria-roledescription={
              cardMovable ? messages.kanbanBoard.card : undefined
            }
            role={focusable ? "button" : undefined}
            tabIndex={focusable ? 0 : undefined}
          >
            {content}
          </div>
        )}
      </li>
    );
  };

  /** Where a carried card would land - with its copy when moved by the keys. */
  const renderPlaceholder = () =>
    session &&
    draggedCard && (
      <li
        aria-hidden="true"
        className={cn(
          "rounded-md border-2 border-dashed border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/40 forced-colors:border-[Highlight]",
          session.mode === "keyboard" && "p-3 text-sm opacity-80",
        )}
        data-kanban-placeholder=""
        inert
        style={
          session.mode === "pointer" ? { height: session.height } : undefined
        }
      >
        {session.mode === "keyboard" &&
          renderCard(draggedCard, { dragging: true, pending: false })}
      </li>
    );

  const renderColumn = (column: KanbanColumn, columnIndex: number) => {
    const key = idKey(column.id);
    // By the position - an id may have spaces, which an id reference splits
    const titleId = `${baseId}-column-${columnIndex}`;
    const listId = `${baseId}-list-${columnIndex}`;
    const columnCards = cardsIn(shownCards, column.id);
    const count = columnCards.length;
    const limit = column.limit;
    const isOverLimit = limit !== undefined && count > limit;
    const collapsed = isCollapsed(column.id);

    const target = session?.target ?? null;
    const isTarget = !!session && target?.columnId === column.id;
    const isRefused =
      !!session &&
      session.mode === "pointer" &&
      session.overColumnId === column.id &&
      !isTarget;
    // The placeholder - not at the place the card is now
    const placeholderBefore =
      isTarget && target && session && !samePlace(target, session.origin)
        ? (columnCards.filter((card) => card.id !== session.cardId)[
            target.index
          ]?.id ?? null)
        : undefined;

    const countText = formatPlural(
      locale.code,
      messages.kanbanBoard.cardCount,
      count,
    );
    const countLabel =
      limit === undefined
        ? countText
        : formatMessage(
            isOverLimit
              ? messages.kanbanBoard.overLimit
              : messages.kanbanBoard.limitLabel,
            { cards: countText, limit: formatNumber(locale.code, limit) },
          );
    const counter = (
      <>
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            isOverLimit
              ? "bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-100 forced-colors:border forced-colors:border-[CanvasText]"
              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
          )}
          data-over-limit={isOverLimit ? "" : undefined}
        >
          {isOverLimit && <AlertTriangle className="size-3" />}
          {limit === undefined
            ? formatNumber(locale.code, count)
            : formatMessage(messages.kanbanBoard.limit, {
                count: formatNumber(locale.code, count),
                limit: formatNumber(locale.code, limit),
              })}
        </span>
        <span className="sr-only">, {countLabel}</span>
      </>
    );

    const collapseButton = (
      <IconButton
        aria-controls={collapsed ? undefined : listId}
        aria-expanded={!collapsed}
        aria-label={formatMessage(
          collapsed
            ? messages.kanbanBoard.expand
            : messages.kanbanBoard.collapse,
          { column: column.title },
        )}
        onClick={() => toggleCollapsed(column)}
        size="sm"
        tooltip
      >
        {collapsed ? <Maximize2 /> : <Minimize2 />}
      </IconButton>
    );

    const sectionClassName = cn(
      "flex max-h-full shrink-0 snap-start flex-col rounded-lg bg-neutral-100 transition-shadow motion-reduce:transition-none dark:bg-neutral-900 forced-colors:border forced-colors:border-[CanvasText]",
      column.color && ["border-t-4", stripColors[column.color]],
      // Forced colors drop the ring - an outline then
      isTarget &&
        "ring-2 ring-primary-500 dark:ring-primary-400 forced-colors:outline-2 forced-colors:outline-[Highlight]",
      isRefused &&
        "cursor-not-allowed ring-2 ring-danger-500 dark:ring-danger-400 forced-colors:outline-2 forced-colors:outline-[CanvasText] forced-colors:outline-dashed",
    );

    if (collapsed) {
      return (
        <div
          aria-labelledby={titleId}
          className={cn(sectionClassName, "w-12 items-center gap-2 py-2")}
          data-collapsed=""
          data-kanban-column={key}
          key={key}
          role="group"
        >
          {collapseButton}
          <Heading className="flex items-center gap-2 text-sm font-semibold [writing-mode:vertical-rl]">
            <span className="whitespace-nowrap" id={titleId}>
              {column.title}
            </span>
            {counter}
          </Heading>
        </div>
      );
    }

    const footer =
      renderColumnFooter?.(column) ??
      (onAddCard ? (
        <Button
          aria-label={formatMessage(messages.kanbanBoard.addCardTo, {
            column: column.title,
          })}
          className="w-full justify-start"
          onClick={() => onAddCard(column)}
          size="sm"
          startIcon={<Plus size={16} />}
          variant="ghost"
        >
          {messages.kanbanBoard.addCard}
        </Button>
      ) : null);

    return (
      <div
        aria-labelledby={titleId}
        className={cn(sectionClassName, "w-72 max-sm:w-[85vw]")}
        data-kanban-column={key}
        key={key}
        role="group"
      >
        <header className="flex items-center gap-2 px-3 pt-2 pb-1">
          <Heading className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
            <span className="truncate" id={titleId}>
              {column.title}
            </span>
            {counter}
          </Heading>
          {renderColumnActions?.(column)}
          {collapseButton}
        </header>
        <div
          className="flex min-h-16 flex-1 flex-col overflow-y-auto px-2 pb-2"
          data-kanban-scroll=""
        >
          <ul className="flex flex-col gap-2 pt-1" id={listId}>
            {columnCards.map((card) => (
              <Fragment key={idKey(card.id)}>
                {placeholderBefore === card.id && renderPlaceholder()}
                {renderCardItem(card)}
              </Fragment>
            ))}
            {placeholderBefore === null && renderPlaceholder()}
          </ul>
          {count === 0 && placeholderBefore === undefined && (
            <p className="py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
              {messages.kanbanBoard.empty}
            </p>
          )}
        </div>
        {footer !== null && footer !== undefined && (
          <div className="px-2 pb-2">{footer}</div>
        )}
      </div>
    );
  };

  return (
    <div
      {...props}
      className={cn(
        "flex min-h-0 flex-col gap-3",
        // The grabbing hand over the whole board while a card is dragged
        session?.mode === "pointer" && "cursor-grabbing **:cursor-grabbing",
        className,
      )}
      data-kanban-board=""
      onBlur={(event) => {
        drag.onBlur(event);
        onBlur?.(event);
      }}
      ref={boardCallbackRef}
    >
      {moveError && (
        <Alert onClose={() => setMoveError(null)} type="danger">
          {moveError}
        </Alert>
      )}
      <div
        className={cn(
          "flex min-h-0 flex-1 items-start gap-3 overflow-x-auto pb-2",
          // Phones scroll a column at a time - not while a drag scrolls
          session ? "snap-none" : "snap-x snap-mandatory sm:snap-none",
        )}
        ref={scrollerRef}
      >
        {columns.map(renderColumn)}
      </div>

      {/* The moves chosen with the keys and the drops, told */}
      <div className="sr-only" role="status">
        {drag.announcement}
      </div>
      {movable && (
        <span hidden id={instructionsId}>
          {messages.kanbanBoard.instructions}
        </span>
      )}
      {session && (
        <span hidden id={movingId}>
          {messages.kanbanBoard.beingMoved}
        </span>
      )}
      {session?.mode === "pointer" && draggedCard && (
        <DragGhost
          attach={drag.attachGhost}
          rtl={session.rtl}
          width={session.width}
        >
          {renderCard(draggedCard, {
            dragging: true,
            pending: pendingIds.has(idKey(draggedCard.id)),
          })}
        </DragGhost>
      )}
    </div>
  );
}

interface DragGhostProps {
  /** Places it at the pointer - the ref of the drag. */
  attach: (element: HTMLElement | null) => void;
  /** The content of the card. */
  children: React.ReactNode;
  rtl: boolean;
  width: number;
}

/**
 * The copy of a card beside the pointer - in the page, by the coordinates
 * of the pointer in the viewport (no column clips it). Only while the
 * pointer drags, in the browser.
 */
function DragGhost({ attach, children, rtl, width }: DragGhostProps) {
  const getPortalContainer = usePortalContainer();

  return createPortal(
    <div
      aria-hidden="true"
      // At the top left of the viewport, moved to the pointer by its
      // coordinates - physical ones in any writing direction
      className="pointer-events-none fixed top-0 left-0 z-50"
      dir={rtl ? "rtl" : "ltr"}
      ref={attach}
      style={{ width }}
    >
      <div
        className={cn(
          cardFrame,
          "rotate-2 shadow-xl motion-reduce:rotate-0 dark:shadow-black/40",
        )}
      >
        {children}
      </div>
    </div>,
    getPortalContainer(),
  );
}
