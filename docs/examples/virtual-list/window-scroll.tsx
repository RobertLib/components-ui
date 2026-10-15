import { useState } from "react";
import { Avatar, Button, VirtualList } from "components-ui";
import { createPeople } from "../../mocks/data";

const people = createPeople(40, 3);
const actions = [
  "approved invoice",
  "commented on order",
  "sent a reminder for invoice",
  "closed ticket",
];

// 2 000 posts of an activity feed
const posts = Array.from({ length: 2_000 }, (_, index) => ({
  action: actions[index % actions.length],
  id: index + 1,
  person: people[(index * 7) % people.length],
  subject: `FV-2026-${String(2_000 - index).padStart(4, "0")}`,
}));

// The page scrolls the list - it is as tall as all its posts
export default function WindowScroll() {
  const [shown, setShown] = useState(false);

  return (
    <div className="space-y-3">
      <Button onClick={() => setShown(!shown)} size="sm" variant="outline">
        {shown ? "Hide the feed" : "Show the feed (2 000 posts)"}
      </Button>
      {shown && (
        <VirtualList
          aria-label="Activity"
          estimateSize={56}
          itemClassName="border-b border-neutral-200 py-2 dark:border-neutral-800"
          items={posts}
          renderItem={(post) => (
            <div className="flex items-center gap-3 text-sm">
              <Avatar alt="" color="auto" name={post.person.name} size={32} />
              <p>
                <strong className="font-medium">{post.person.name}</strong>{" "}
                {post.action} <span className="font-mono">{post.subject}</span>
              </p>
            </div>
          )}
          useWindowScroll
        />
      )}
    </div>
  );
}
