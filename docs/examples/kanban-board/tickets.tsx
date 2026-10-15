import { useState } from "react";
import {
  Chip,
  KanbanBoard,
  type ChipColor,
  type KanbanCard,
  type KanbanColumn,
} from "components-ui";

type Priority = "low" | "normal" | "high" | "urgent";

interface Ticket extends KanbanCard {
  customer: string;
  key: string;
  priority: Priority;
  title: string;
}

const priorityColors: Record<Priority, ChipColor> = {
  high: "warning",
  low: "neutral",
  normal: "info",
  urgent: "danger",
};

const columns: KanbanColumn[] = [
  { id: "new", title: "New" },
  { color: "primary", id: "progress", limit: 3, title: "In progress" },
  { color: "warning", id: "waiting", title: "Waiting for customer" },
  { color: "success", id: "resolved", title: "Resolved" },
  { collapsed: true, color: "neutral", id: "closed", title: "Closed" },
];

const initialTickets: Ticket[] = [
  {
    columnId: "new",
    customer: "Alza.cz",
    id: 1042,
    key: "SUP-1042",
    priority: "urgent",
    title: "Invoice 2026-0042 not sent",
  },
  {
    columnId: "new",
    customer: "Kofola",
    id: 1051,
    key: "SUP-1051",
    priority: "normal",
    title: "Delivery to Brno delayed",
  },
  {
    columnId: "progress",
    customer: "Notino",
    id: 1043,
    key: "SUP-1043",
    priority: "high",
    title: "Wrong VAT on a credit note",
  },
  {
    columnId: "progress",
    customer: "Rohlik.cz",
    id: 1047,
    key: "SUP-1047",
    priority: "normal",
    title: "Export of orders times out",
  },
  {
    columnId: "progress",
    customer: "ČEZ",
    id: 1049,
    key: "SUP-1049",
    priority: "low",
    title: "Add a second billing address",
  },
  {
    columnId: "waiting",
    customer: "Škoda Auto",
    id: 1038,
    key: "SUP-1038",
    priority: "normal",
    title: "Missing purchase order number",
  },
  {
    columnId: "resolved",
    customer: "Alza.cz",
    id: 1060,
    key: "SUP-1060",
    priority: "high",
    title: "Duplicate payment refunded",
  },
  {
    columnId: "closed",
    customer: "Mall.cz",
    id: 1021,
    key: "SUP-1021",
    priority: "low",
    title: "Password reset e-mail",
  },
];

let nextId = 1100;

// The tickets of a support team. "In progress" takes at most 3 tickets
// (`enforceLimits`) - finish one first. A click or Enter opens a ticket,
// Space picks it up; "Add card" files a new one.
export default function Tickets() {
  const [tickets, setTickets] = useState(initialTickets);
  const [opened, setOpened] = useState<Ticket | null>(null);

  return (
    <div className="space-y-3">
      <KanbanBoard<Ticket>
        aria-label="Support tickets"
        cards={tickets}
        columns={columns}
        enforceLimits
        getCardLabel={(ticket) => `${ticket.key} ${ticket.title}`}
        onAddCard={(column) => {
          const id = nextId++;
          setTickets((current) => [
            ...current,
            {
              columnId: column.id,
              customer: "New customer",
              id,
              key: `SUP-${id}`,
              priority: "normal",
              title: "New ticket",
            },
          ]);
        }}
        onCardClick={setOpened}
        onCardsChange={setTickets}
        renderCard={(ticket) => (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-mono">{ticket.key}</span>
              <Chip color={priorityColors[ticket.priority]} size="sm">
                {ticket.priority}
              </Chip>
            </div>
            <div className="font-medium">{ticket.title}</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              {ticket.customer}
            </div>
          </div>
        )}
      />
      <p aria-live="polite" className="text-sm">
        {opened
          ? `Opened ${opened.key} - ${opened.title}`
          : "Click a ticket to open it."}
      </p>
    </div>
  );
}
