import { useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  VirtualList,
  type VirtualListHandle,
} from "components-ui";

interface Message {
  id: number;
  mine: boolean;
  text: string;
}

const texts = [
  "Hi, is the delivery for Stavby Novák still on for Thursday?",
  "Yes, the truck leaves Brno at 7 am.",
  "Great. They asked whether the driver can call 30 minutes before arriving - the site manager is not always at the gate.",
  "Sure, I'll add it to the delivery note.",
  "Thanks! And the invoice FV-2026-0142 - should it go to the same address as last time?",
  "No, to the head office in Praha, please.",
  "👍",
];

// Message `id` of a history of 300 - the oldest is 1
const createMessage = (id: number): Message => ({
  id,
  mine: id % 3 === 1,
  text: `${texts[id % texts.length]} (#${id})`,
});
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) =>
    createMessage(from + index),
  );

export default function Chat() {
  const listRef = useRef<VirtualListHandle>(null);
  // The latest 30 messages - older ones are loaded on scrolling up
  const [messages, setMessages] = useState(() => range(271, 300));
  const [draft, setDraft] = useState("");
  // Scroll to the last message - at first, and after sending one
  const toEnd = useRef(true);

  useEffect(() => {
    if (!toEnd.current) return;
    toEnd.current = false;
    listRef.current?.scrollToIndex(messages.length - 1, { align: "end" });
  }, [messages.length]);

  const loadOlder = () => {
    const first = messages[0].id;
    if (first <= 1) return;
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        setMessages((current) => [
          ...range(Math.max(1, first - 30), first - 1),
          ...current,
        ]);
        resolve();
      }, 700),
    );
  };

  return (
    <div className="max-w-lg space-y-3">
      <VirtualList
        aria-label="Messages"
        className="rounded-lg border border-neutral-200 dark:border-neutral-800"
        estimateSize={52}
        // The view stays on its messages as older ones come before them
        getItemKey={(message) => message.id}
        handleRef={listRef}
        height={360}
        itemClassName="px-3 py-1"
        items={messages}
        onStartReached={loadOlder}
        renderItem={(message) => (
          <div className={message.mine ? "flex justify-end" : "flex"}>
            <p
              className={
                message.mine
                  ? "max-w-[80%] rounded-2xl rounded-ee-sm bg-primary-600 px-3 py-2 text-sm text-white"
                  : "max-w-[80%] rounded-2xl rounded-es-sm bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800"
              }
            >
              <span className="sr-only">
                {message.mine ? "You: " : "Dispatch: "}
              </span>
              {message.text}
            </p>
          </div>
        )}
      />
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          toEnd.current = true;
          setMessages((current) => [
            ...current,
            { id: current[current.length - 1].id + 1, mine: true, text: draft },
          ]);
          setDraft("");
        }}
      >
        <div className="flex-1">
          <Input
            aria-label="Message"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message…"
            value={draft}
          />
        </div>
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
