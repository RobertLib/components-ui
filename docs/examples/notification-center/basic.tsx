import { FileCheck, FileWarning, PackageCheck, Plus } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Link,
  NotificationCenter,
  useSnackbar,
  type NotificationItem,
} from "components-ui";

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000;

// The first page the API returns - newest first
const firstPage = (): NotificationItem[] => [
  {
    avatar: { name: "Petr Svoboda" },
    body: "Can we deliver the order before Friday? The customer is asking.",
    href: "/orders/1042",
    id: 1,
    time: minutesAgo(4),
    title: "Petr Svoboda commented on order 1042",
  },
  {
    body: "Stavebniny Novák s.r.o. · 48 620 Kč",
    href: "/invoices/418",
    icon: <FileCheck />,
    id: 2,
    time: minutesAgo(52),
    title: "Invoice FV-2026-0418 was approved",
  },
  {
    icon: <PackageCheck />,
    id: 3,
    read: true,
    time: minutesAgo(26 * 60),
    title: "The shipment to Brno was delivered",
  },
];

// Older notifications, a page at a time
const olderPage = (page: number): NotificationItem[] =>
  Array.from({ length: 4 }, (_, index) => ({
    icon: <FileWarning />,
    id: `old-${page}-${index}`,
    read: true,
    time: minutesAgo((page * 4 + index + 2) * 24 * 60),
    title: `Invoice FV-2026-0${300 - page * 4 - index} is overdue`,
  }));

const loadPage = (page: number) =>
  new Promise<NotificationItem[]>((resolve) =>
    setTimeout(() => resolve(olderPage(page)), 700),
  );

export default function Basic() {
  const [notifications, setNotifications] = useState(firstPage);
  const [page, setPage] = useState(0);
  const { enqueueSnackbar } = useSnackbar();

  const setRead = (ids: NotificationItem["id"][] | "all", read = true) =>
    setNotifications((current) =>
      current.map((item) =>
        ids === "all" || ids.includes(item.id) ? { ...item, read } : item,
      ),
    );

  // Realtime - in an app a WebSocket or polling adds them
  const addLeaveRequest = () => {
    const id = `leave-${Date.now()}`;
    const resolve = (answer: string) => {
      setRead([id]);
      enqueueSnackbar(`Leave request ${answer}`, "success");
    };
    setNotifications((current) => [
      {
        actions: [
          {
            color: "success",
            label: "Approve",
            onClick: () => resolve("approved"),
          },
          { label: "Reject", onClick: () => resolve("rejected") },
        ],
        avatar: { name: "Jana Dvořáková" },
        body: "3. 11. - 7. 11. 2026, 5 days of holiday",
        id,
        time: Date.now(),
        title: "Jana Dvořáková asks for leave",
      },
      ...current,
    ]);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-2 dark:border-neutral-800">
      <Button
        onClick={addLeaveRequest}
        size="sm"
        startIcon={<Plus size={14} />}
        variant="outline"
      >
        A new notification
      </Button>
      <NotificationCenter
        footer={<Link href="/notifications">All notifications</Link>}
        hasMore={page < 3}
        notifications={notifications}
        onLoadMore={async () => {
          const older = await loadPage(page + 1);
          setNotifications((current) => [...current, ...older]);
          setPage(page + 1);
        }}
        onMarkAllRead={() => setRead("all")}
        onReadChange={(notification, read) => setRead([notification.id], read)}
      />
    </div>
  );
}
