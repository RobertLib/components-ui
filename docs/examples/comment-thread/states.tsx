import { useEffect, useState } from "react";
import {
  CommentThread,
  SegmentedControl,
  type CommentThreadItem,
} from "components-ui";

type State = "loading" | "empty" | "read-only";

const comments: CommentThreadItem[] = [
  {
    author: { id: 7, name: "Petr Svoboda" },
    body: "Goods picked up by the carrier, tracking number 1Z 999 AA1.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    id: 1,
  },
];

// Placeholders while the comments load, a message without any, and a
// thread without `onSubmit` - nothing to write, e.g. in an archived record
export default function States() {
  const [state, setState] = useState<State>("loading");
  const [loaded, setLoaded] = useState(false);

  // The comments arrive a moment after the thread shows
  useEffect(() => {
    if (state !== "loading" || loaded) return;
    const timer = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(timer);
  }, [loaded, state]);

  return (
    <div className="max-w-2xl space-y-4">
      <SegmentedControl<State>
        aria-label="State"
        onChange={(value) => {
          setState(value);
          setLoaded(false);
        }}
        options={[
          { label: "Loading", value: "loading" },
          { label: "Empty", value: "empty" },
          { label: "Read-only", value: "read-only" },
        ]}
        value={state}
      />
      {state === "loading" && (
        <CommentThread
          comments={loaded ? comments : []}
          loading={!loaded}
          onSubmit={() => {}}
        />
      )}
      {state === "empty" && (
        <CommentThread
          comments={[]}
          emptyMessage="No comments yet - ask the warehouse about the delivery."
          onSubmit={() => {}}
          placeholder="Ask about the delivery…"
        />
      )}
      {state === "read-only" && <CommentThread comments={comments} />}
    </div>
  );
}
