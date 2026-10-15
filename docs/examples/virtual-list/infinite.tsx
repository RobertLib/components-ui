import { useState } from "react";
import { Avatar, Switch, VirtualList } from "components-ui";
import { createPeople, type Person } from "../../mocks/data";

// The "server": 480 contacts, sent 50 at a time
const TOTAL = 480;
const PAGE_SIZE = 50;
const contacts = createPeople(TOTAL, 11);

function fetchContacts(offset: number, fail: boolean) {
  return new Promise<Person[]>((resolve, reject) =>
    setTimeout(() => {
      if (fail) reject(new Error("503 Service Unavailable"));
      else resolve(contacts.slice(offset, offset + PAGE_SIZE));
    }, 700),
  );
}

export default function Infinite() {
  const [items, setItems] = useState<Person[]>([]);
  const [fail, setFail] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch
          checked={fail}
          label="Make loading fail"
          onChange={(event) => setFail(event.target.checked)}
        />
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {items.length} of {TOTAL} loaded
        </span>
      </div>
      <VirtualList
        aria-label="Contacts"
        className="rounded-lg border border-neutral-200 dark:border-neutral-800"
        estimateSize={57}
        hasMore={items.length < TOTAL}
        height={360}
        itemClassName="border-b border-neutral-200 px-4 py-2 dark:border-neutral-800"
        // Screen readers hear "12 of 480" - not of those loaded so far
        itemCount={TOTAL}
        items={items}
        // Called near the end - the promise shows the loading row, and its
        // rejection the error row with "Try again"
        onEndReached={() =>
          fetchContacts(items.length, fail).then((page) =>
            setItems((current) => [...current, ...page]),
          )
        }
        renderItem={(person) => (
          <div className="flex items-center gap-3">
            <Avatar alt="" color="auto" name={person.name} size={32} />
            <div className="min-w-0">
              <div className="truncate font-medium">{person.name}</div>
              <div className="truncate text-sm text-neutral-600 dark:text-neutral-400">
                {person.department} · {person.city}
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
