import { FileText } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  CommentThread,
  Switch,
  type CommentAuthor,
  type CommentThreadItem,
} from "components-ui";

const team: CommentAuthor[] = [
  { id: 12, name: "Jana Nováková" },
  { id: 7, name: "Petr Svoboda" },
  { id: 3, name: "Martin Procházka" },
  { id: 18, name: "Eva Kučerová" },
];
const [me, petr, martin, eva] = team;

interface InvoiceComment extends CommentThreadItem {
  /** Files attached to the comment. */
  files?: string[];
  replies?: InvoiceComment[];
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const initialComments: InvoiceComment[] = [
  {
    author: petr,
    body: "The customer asks for a split payment - 50 % now, the rest in 30 days. @[Martin Procházka](3) is that OK?",
    createdAt: minutesAgo(26 * 60),
    id: 1,
    replies: [
      {
        author: martin,
        body: "OK for this order, it is a long-term customer.",
        createdAt: minutesAgo(25 * 60),
        id: 2,
      },
    ],
  },
  {
    author: eva,
    body: "Signed order attached.",
    createdAt: minutesAgo(3 * 60),
    files: ["order-2026-0107.pdf"],
    id: 3,
  },
  {
    author: me,
    body: "Due date moved to 7. 10., invoice sent again. @[Petr Svoboda](7) FYI",
    createdAt: minutesAgo(40),
    editedAt: minutesAgo(35),
    id: 4,
  },
];

const olderComments: InvoiceComment[] = [
  {
    author: me,
    body: "Invoice 2026-0042 created from order 2026-0107.",
    createdAt: minutesAgo(3 * 24 * 60),
    id: 0,
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let nextId = 100;

// Comments on an invoice: send with Ctrl / ⌘ + Enter, edit or delete your
// own (Jana's), reply, mention with @. The "server" takes a moment - switch
// on its failures to see the text kept with the error.
export default function Invoice() {
  const [comments, setComments] = useState(initialComments);
  const [hasMore, setHasMore] = useState(true);
  const [failing, setFailing] = useState(false);

  const request = async () => {
    await wait(700);
    if (failing) throw new Error("The server is not responding - try again.");
  };

  const update = (change: (comment: InvoiceComment) => InvoiceComment | null) =>
    setComments((current) =>
      current.flatMap((comment) => {
        const changed = change(comment);
        if (!changed) return [];
        return [
          {
            ...changed,
            replies: changed.replies?.flatMap((reply) => {
              const changedReply = change(reply);
              return changedReply ? [changedReply] : [];
            }),
          },
        ];
      }),
    );

  return (
    <div className="max-w-2xl space-y-4">
      <Switch
        checked={failing}
        label="The server fails"
        onChange={(event) => setFailing(event.target.checked)}
      />
      <CommentThread<InvoiceComment>
        allowReplies
        comments={comments}
        currentUser={me}
        getMentionHref={(mention) => `/people/${mention.id}`}
        hasMore={hasMore}
        onDelete={async (comment) => {
          await request();
          update((entry) => (entry.id === comment.id ? null : entry));
        }}
        onEdit={async (comment, body) => {
          await request();
          update((entry) =>
            entry.id === comment.id
              ? { ...entry, body, editedAt: new Date() }
              : entry,
          );
        }}
        onLoadMore={async () => {
          await wait(600);
          setComments((current) => [...olderComments, ...current]);
          setHasMore(false);
        }}
        onSubmit={async (body, { parentId }) => {
          await request();
          const comment: InvoiceComment = {
            author: me,
            body,
            createdAt: new Date(),
            id: nextId++,
          };
          if (parentId === undefined) {
            setComments((current) => [...current, comment]);
          } else {
            update((entry) =>
              entry.id === parentId
                ? { ...entry, replies: [...(entry.replies ?? []), comment] }
                : entry,
            );
          }
        }}
        renderAttachments={(comment) =>
          comment.files?.map((file) => (
            <a
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              href={`#${file}`}
              key={file}
            >
              <FileText aria-hidden="true" size={14} />
              {file}
            </a>
          ))
        }
        suggestions={team.map((person) => ({
          icon: <Avatar alt="" color="auto" name={person.name} size="sm" />,
          id: person.id,
          label: person.name,
        }))}
      />
    </div>
  );
}
