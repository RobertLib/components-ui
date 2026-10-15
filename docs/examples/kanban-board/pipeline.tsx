import { useState } from "react";
import {
  Avatar,
  KanbanBoard,
  Switch,
  type KanbanCard,
  type KanbanColumn,
  type KanbanMove,
} from "components-ui";

interface Deal extends KanbanCard {
  closeDate: string;
  company: string;
  owner: string;
  title: string;
  /** In CZK. */
  value: number;
}

const columns: KanbanColumn[] = [
  { color: "neutral", id: "lead", title: "Lead" },
  { color: "info", id: "qualified", title: "Qualified" },
  { color: "primary", id: "offer", limit: 3, title: "Offer sent" },
  { color: "warning", id: "negotiation", limit: 2, title: "Negotiation" },
  { color: "success", id: "won", title: "Won" },
  { collapsed: true, color: "danger", id: "lost", title: "Lost" },
];

const initialDeals: Deal[] = [
  {
    closeDate: "30. 10.",
    columnId: "lead",
    company: "Kofola",
    id: 1,
    owner: "Petr Svoboda",
    title: "Vending machines",
    value: 180_000,
  },
  {
    closeDate: "15. 11.",
    columnId: "lead",
    company: "Notino",
    id: 2,
    owner: "Eva Kučerová",
    title: "Warehouse scanners",
    value: 95_000,
  },
  {
    closeDate: "12. 11.",
    columnId: "qualified",
    company: "Rohlik.cz",
    id: 3,
    owner: "Petr Svoboda",
    title: "Cold chain sensors",
    value: 420_000,
  },
  {
    closeDate: "20. 10.",
    columnId: "offer",
    company: "Alza.cz",
    id: 4,
    owner: "Jana Nováková",
    title: "Returns terminal",
    value: 260_000,
  },
  {
    closeDate: "25. 10.",
    columnId: "offer",
    company: "Pilsner Urquell",
    id: 5,
    owner: "Petr Svoboda",
    title: "Brewery tour app",
    value: 140_000,
  },
  {
    closeDate: "18. 10.",
    columnId: "negotiation",
    company: "Škoda Auto",
    id: 6,
    owner: "Jana Nováková",
    title: "Fleet telematics",
    value: 1_250_000,
  },
  {
    closeDate: "2. 10.",
    columnId: "won",
    company: "ČEZ",
    id: 7,
    owner: "Eva Kučerová",
    title: "Meter readings",
    value: 680_000,
  },
  {
    closeDate: "28. 9.",
    columnId: "lost",
    company: "Mall.cz",
    id: 8,
    owner: "Petr Svoboda",
    title: "Parcel lockers",
    value: 310_000,
  },
];

const czk = new Intl.NumberFormat("cs-CZ", {
  currency: "CZK",
  maximumFractionDigits: 0,
  style: "currency",
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A sales pipeline: drag a deal (or press Space on it and use the arrows).
// The move is saved to the "server" - switch on its failures to see the
// deal move back. A deal is won only from Negotiation; the WIP limits of
// Offer sent and Negotiation are shown, not enforced.
export default function Pipeline() {
  const [deals, setDeals] = useState(initialDeals);
  const [failing, setFailing] = useState(false);

  const saveMove = async (move: KanbanMove) => {
    await wait(800);
    if (failing)
      throw new Error(`Saving the move of deal ${move.cardId} failed`);
  };

  return (
    <div className="space-y-4">
      <Switch
        checked={failing}
        label="Saving fails"
        onChange={(event) => setFailing(event.target.checked)}
      />
      <KanbanBoard<Deal>
        aria-label="Sales pipeline"
        canDrop={(move) =>
          move.toColumnId !== "won" ||
          move.fromColumnId === "negotiation" ||
          move.fromColumnId === "won"
        }
        canMoveCard={(deal) => deal.columnId !== "won"}
        cards={deals}
        className="h-136"
        columns={columns}
        getCardLabel={(deal) => `${deal.company} - ${deal.title}`}
        onCardsChange={setDeals}
        onMoveCard={saveMove}
        renderCard={(deal, { pending }) => (
          <div className="space-y-2">
            <div>
              <div className="font-semibold">{deal.company}</div>
              <div className="text-neutral-600 dark:text-neutral-400">
                {deal.title}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium tabular-nums">
                {czk.format(deal.value)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                {pending ? "Saving…" : deal.closeDate}
                <Avatar color="auto" name={deal.owner} size="sm" />
              </span>
            </div>
          </div>
        )}
        renderColumnActions={(column) => (
          <span className="text-xs whitespace-nowrap text-neutral-600 tabular-nums dark:text-neutral-400">
            {czk.format(
              deals
                .filter((deal) => deal.columnId === column.id)
                .reduce((sum, deal) => sum + deal.value, 0),
            )}
          </span>
        )}
      />
    </div>
  );
}
