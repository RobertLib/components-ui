import { useState } from "react";
import { Avatar, Button, Skeleton } from "components-ui";

const comments = [
  {
    author: "Jana Nováková",
    text: "The invoice for September went out today. Acme confirmed the new delivery address, so the next shipment can leave on Monday.",
  },
  {
    author: "Petr Svoboda",
    text: "Thanks - I moved the order to the warehouse queue.",
  },
];

export default function SkeletonVariants() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="max-w-lg space-y-4">
      <Button onClick={() => setLoading((value) => !value)} size="sm">
        {loading ? "Show the content" : "Load again"}
      </Button>

      {/* The region tells screen readers it is loading - the skeletons
          themselves are hidden from them */}
      <ul aria-busy={loading} className="space-y-4 text-sm">
        {comments.map((comment) => (
          <li className="flex gap-3" key={comment.author}>
            {loading ? (
              <Skeleton height="h-8" variant="circle" width="w-8" />
            ) : (
              <Avatar name={comment.author} size="md" />
            )}
            <div className="flex-1">
              {loading ? (
                <>
                  <Skeleton variant="text" width="w-32" />
                  {/* Lines as high as the text they stand for */}
                  <Skeleton lines={2} variant="text" />
                </>
              ) : (
                <>
                  <div className="font-medium">{comment.author}</div>
                  <p>{comment.text}</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
