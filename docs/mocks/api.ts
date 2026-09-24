import { removeDiacritics } from "components-ui";
import { people, type Person } from "./data";

/**
 * A fake backend living in the browser: `fetch` calls to `/api/…` are
 * answered here with a small delay, so the examples use real `fetch` code -
 * a REST API under `/api/people` and a GraphQL API under `/api/graphql`.
 */

export interface LoggedRequest {
  body?: string;
  duration?: number;
  id: number;
  method: string;
  status?: number;
  url: string;
}

let requestId = 0;
let log: LoggedRequest[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const requestLog = {
  clear() {
    log = [];
    emit();
  },
  getSnapshot: () => log,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const updateEntry = (id: number, changes: Partial<LoggedRequest>) => {
  log = log.map((entry) =>
    entry.id === id ? { ...entry, ...changes } : entry,
  );
  emit();
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The request was aborted.", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The request was aborted.", "AbortError"));
    });
  });

const fold = (text: string) => removeDiacritics(text).toLowerCase();

interface ListQuery {
  filters?: Record<string, string>;
  order?: string;
  search?: string;
  sortBy?: string;
}

const FILTERABLE = [
  "city",
  "createdAt",
  "department",
  "role",
  "status",
] as const;

function queryPeople({ filters = {}, order, search, sortBy }: ListQuery) {
  let result = people;

  if (search) {
    const term = fold(search);
    result = result.filter((person) =>
      fold(`${person.name} ${person.email} ${person.city}`).includes(term),
    );
  }

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    if (key === "name" || key === "email") {
      result = result.filter((person) =>
        fold(person[key]).includes(fold(value)),
      );
    } else if ((FILTERABLE as readonly string[]).includes(key)) {
      result = result.filter((person) =>
        String(person[key as keyof Person]).startsWith(value),
      );
    }
  }

  if (sortBy && sortBy in (people[0] ?? {})) {
    const direction = order === "desc" ? -1 : 1;
    const key = sortBy as keyof Person;
    result = [...result].sort((a, b) => {
      const left = a[key];
      const right = b[key];
      return (
        (typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right))) * direction
      );
    });
  }

  return result;
}

/** The salaries of people added up. */
const sumSalaries = (list: Person[]) =>
  list.reduce((total, person) => total + person.salary, 0);

const takenEmails = new Set(people.map((person) => person.email));

/** Validation shared by the REST and the GraphQL "create person". */
function validatePerson(input: { email?: string; name?: string }) {
  const errors: Record<string, string[]> = {};

  if (!input.name?.trim()) errors.name = ["can't be blank"];
  if (!input.email?.trim()) {
    errors.email = ["can't be blank"];
  } else if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    errors.email = ["is not a valid email"];
  } else if (takenEmails.has(input.email.trim().toLowerCase())) {
    errors.email = ["has already been taken"];
  }
  if (input.name?.trim().toLowerCase() === "error") {
    errors.base = ["The server rejected this record - try another name."];
  }

  return errors;
}

// --- REST ---------------------------------------------------------------

function handleRest(url: URL, method: string, body: string | undefined) {
  if (url.pathname !== "/api/people") {
    return json({ message: "Not found" }, 404);
  }

  if (method === "POST") {
    const input = JSON.parse(body ?? "{}") as { email?: string; name?: string };
    const errors = validatePerson(input);

    return Object.keys(errors).length
      ? json({ errors, message: "Validation failed" }, 422)
      : json({ item: { id: people.length + 1, ...input } }, 201);
  }

  const params = url.searchParams;
  const ids = params.get("ids");

  if (ids) {
    const wanted = ids.split(",").map(Number);
    return json({
      items: people.filter((person) => wanted.includes(person.id)),
    });
  }

  const filters: Record<string, string> = {};
  for (const key of [...FILTERABLE, "name", "email"]) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }

  const matching = queryPeople({
    filters,
    order: params.get("order") ?? undefined,
    search: params.get("q") ?? params.get("search") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
  });

  // Page-based (?page=&pageSize=) or offset-based (?offset=&limit=)
  const limit = Number(params.get("limit") ?? params.get("pageSize") ?? 20);
  const offset = params.has("offset")
    ? Number(params.get("offset"))
    : (Number(params.get("page") ?? 1) - 1) * limit;

  return json({
    items: matching.slice(offset, offset + limit),
    // Totals of all matching rows - for a summary row
    summary: { salary: sumSalaries(matching) },
    total: matching.length,
  });
}

// --- GraphQL ------------------------------------------------------------

const encodeCursor = (index: number) => btoa(`cursor:${index}`);
const decodeCursor = (cursor: string) =>
  Number(atob(cursor).replace("cursor:", ""));

interface GraphQLBody {
  query: string;
  variables?: Record<string, unknown>;
}

function handleGraphQL(body: string | undefined) {
  const { query, variables = {} } = JSON.parse(body ?? "{}") as GraphQLBody;

  if (/\bcreatePerson\b/.test(query)) {
    const input = (variables.input ?? {}) as { email?: string; name?: string };
    const errors = validatePerson(input);

    if (Object.keys(errors).length) {
      // Field messages in the extensions, as e.g. graphql-ruby reports them
      return json({
        data: { createPerson: null },
        errors: [
          {
            extensions: { code: "BAD_USER_INPUT", ...errors },
            message: "Validation failed",
            path: ["createPerson"],
          },
        ],
      });
    }

    return json({
      data: { createPerson: { id: String(people.length + 1), ...input } },
    });
  }

  if (/\bpeopleByIds\b/.test(query)) {
    const ids = ((variables.ids as (string | number)[]) ?? []).map(Number);
    return json({
      data: { peopleByIds: people.filter((person) => ids.includes(person.id)) },
    });
  }

  if (/\bpeople\b/.test(query)) {
    const matching = queryPeople({
      filters: variables.filters as Record<string, string> | undefined,
      order: variables.order as string | undefined,
      search: variables.search as string | undefined,
      sortBy: variables.sortBy as string | undefined,
    });

    const first = variables.first as number | undefined;
    const last = variables.last as number | undefined;
    const after = variables.after as string | undefined;
    const before = variables.before as string | undefined;

    let start: number;
    let end: number;

    if (last !== undefined) {
      end = before ? decodeCursor(before) : matching.length;
      start = Math.max(0, end - last);
    } else {
      start = after ? decodeCursor(after) + 1 : 0;
      end = Math.min(matching.length, start + (first ?? 20));
    }

    const nodes = matching.slice(start, end);

    return json({
      data: {
        people: {
          edges: nodes.map((node, index) => ({
            cursor: encodeCursor(start + index),
            node,
          })),
          nodes,
          pageInfo: {
            endCursor: nodes.length ? encodeCursor(end - 1) : null,
            hasNextPage: end < matching.length,
            hasPreviousPage: start > 0,
            startCursor: nodes.length ? encodeCursor(start) : null,
          },
          salaryTotal: sumSalaries(matching),
          totalCount: matching.length,
        },
      },
    });
  }

  return json({ errors: [{ message: "Unknown operation" }] });
}

let installed = false;

export function installMockApi() {
  if (installed) return;
  installed = true;

  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(
      request ? request.url : String(input),
      window.location.href,
    );

    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);

    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : undefined;
    const signal = init?.signal ?? request?.signal;
    const id = ++requestId;
    const started = performance.now();

    log = [{ body, id, method, url: url.pathname + url.search }, ...log].slice(
      0,
      30,
    );
    emit();

    try {
      await wait(250 + Math.random() * 350, signal);

      const response =
        url.pathname === "/api/graphql"
          ? handleGraphQL(body)
          : handleRest(url, method, body);

      updateEntry(id, {
        duration: Math.round(performance.now() - started),
        status: response.status,
      });

      return response;
    } catch (error) {
      updateEntry(id, { status: 0 });
      throw error;
    }
  };
}
