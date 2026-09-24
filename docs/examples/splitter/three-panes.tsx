import { Splitter } from "components-ui";

const folders = ["Inbox", "Orders", "Invoices", "Archive"];
const messages = [
  { from: "Petra Horáková", subject: "Order 2026-0412 shipped" },
  { from: "Lars Jansen", subject: "Invoice for September" },
  { from: "Support", subject: "Your ticket was answered" },
];

export default function ThreePanes() {
  return (
    <Splitter
      className="h-[320px] rounded-lg border border-neutral-200 text-sm dark:border-neutral-800"
      collapsible={[true, false, false]}
      defaultSizes={[20, 35, 45]}
      minSizes={[12, 25, 25]}
      paneLabels={["Folders", "Messages"]}
    >
      <ul className="space-y-1 p-3">
        {folders.map((folder) => (
          <li key={folder}>{folder}</li>
        ))}
      </ul>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {messages.map((message) => (
          <li className="px-3 py-2" key={message.subject}>
            <span className="block font-medium">{message.from}</span>
            <span className="block text-neutral-500 dark:text-neutral-400">
              {message.subject}
            </span>
          </li>
        ))}
      </ul>
      <div className="p-4">
        <h3 className="font-semibold">Order 2026-0412 shipped</h3>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Your order left our warehouse today and should arrive on Monday.
        </p>
      </div>
    </Splitter>
  );
}
