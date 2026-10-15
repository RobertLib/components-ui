import { useMemo } from "react";
import {
  ChangeHistory,
  useLocale,
  type ChangeHistoryEntry,
  type ChangeHistoryField,
} from "components-ui";

// Times relative to now, so that Today and Yesterday show
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const daysAgo = (days: number, hours: number, minutes: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// A picture as a data URI - the others show their initials
const avatar = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#0f766e"/><circle cx="20" cy="16" r="7" fill="#ccfbf1"/><path d="M6 40c1-9 7-13 14-13s13 4 14 13z" fill="#ccfbf1"/></svg>`,
)}`;

const jana = { id: 1, name: "Jana Nováková" };
const petr = { avatarUrl: avatar, id: 2, name: "Petr Svoboda" };

// The history of invoice FV-2026-0142, newest first
const entries: ChangeHistoryEntry[] = [
  {
    action: "Approved",
    author: jana,
    changes: [{ field: "status", from: "sent", to: "approved" }],
    comment: "Checked against order OBJ-2026-0088.",
    id: 7,
    time: minutesAgo(5),
  },
  {
    action: "updated",
    author: petr,
    changes: [
      { field: "total", from: 11_900, to: 12_400 },
      { field: "dueDate", from: "2026-10-20", to: "2026-10-27" },
      { field: "discount", from: 5, to: null },
    ],
    id: 6,
    time: minutesAgo(140),
  },
  {
    action: "updated",
    // No author - a change of the system
    changes: [
      { field: "accountingId", from: null, to: "PH-88412" },
      { field: "exported", from: false, to: true },
    ],
    id: 5,
    time: daysAgo(1, 18, 40),
  },
  {
    action: "deleted",
    author: petr,
    changes: [
      {
        field: "item",
        from: "Transport Praha – Brno",
        label: "Line item",
        to: null,
      },
    ],
    id: 4,
    time: daysAgo(1, 9, 12),
  },
  {
    action: "updated",
    author: jana,
    changes: [
      {
        field: "customer",
        from: "Stavby Novák s.r.o.",
        to: "Stavby Novák a syn s.r.o.",
      },
      { field: "status", from: "draft", to: "sent" },
    ],
    id: 3,
    time: daysAgo(3, 14, 5),
  },
  {
    action: "created",
    author: jana,
    changes: [
      { field: "customer", to: "Stavby Novák s.r.o." },
      { field: "total", to: 11_900 },
      { field: "dueDate", to: "2026-10-20" },
      { field: "status", to: "draft" },
    ],
    id: 2,
    // Older than `absoluteAfterDays` - the time of day, not "9 days ago"
    time: daysAgo(9, 10, 30),
  },
];

const statusLabels: Record<string, string> = {
  approved: "Approved",
  draft: "Draft",
  sent: "Sent",
};

export default function Basic() {
  const { code } = useLocale();

  const fields = useMemo((): Record<string, ChangeHistoryField> => {
    const czk = new Intl.NumberFormat(code, {
      currency: "CZK",
      style: "currency",
    });
    return {
      accountingId: { label: "Accounting ID" },
      customer: { label: "Customer" },
      discount: { formatValue: (value) => `${value} %`, label: "Discount" },
      dueDate: { label: "Due date" },
      exported: { label: "Exported to accounting" },
      status: {
        formatValue: (value) => statusLabels[String(value)] ?? String(value),
        label: "Status",
      },
      total: {
        formatValue: (value) => czk.format(Number(value)),
        label: "Total",
      },
    };
  }, [code]);

  return <ChangeHistory entries={entries} fields={fields} />;
}
