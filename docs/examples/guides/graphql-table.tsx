import { useEffect, useState } from "react";
import {
  DataTable,
  toRelayVariables,
  useDataTableQuery,
  type DataTableQuery,
  type PageInfo,
} from "components-ui";
import type { Person } from "../../mocks/data";
import { personColumns } from "../data-table/columns";

const PEOPLE = /* GraphQL */ `
  query People(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $search: String
    $sortBy: String
    $order: String
    $filters: JSON
  ) {
    people(
      first: $first
      after: $after
      last: $last
      before: $before
      search: $search
      sortBy: $sortBy
      order: $order
      filters: $filters
    ) {
      nodes {
        id
        name
        email
        department
        role
        status
        city
        createdAt
        salary
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
      totalCount
    }
  }
`;

interface PeopleConnection {
  nodes: Person[];
  pageInfo: PageInfo;
  totalCount: number;
}

async function fetchPeople(query: DataTableQuery, signal: AbortSignal) {
  const response = await fetch("/api/graphql", {
    body: JSON.stringify({ query: PEOPLE, variables: toRelayVariables(query) }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  const { data, errors } = await response.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data.people as PeopleConnection;
}

export default function GraphQLTable() {
  const [query, setQuery] = useDataTableQuery({ defaults: { pageSize: 10 } });
  const [result, setResult] = useState<{
    key: string;
    people: PeopleConnection;
  }>();

  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    fetchPeople(query, controller.signal)
      .then((people) => setResult({ key, people }))
      .catch(() => {});
    return () => controller.abort();
    // `key` stands for the query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <DataTable
      columns={personColumns}
      data={result?.people.nodes ?? []}
      loading={result?.key !== key}
      maxHeight="480px"
      onQueryChange={setQuery}
      // Cursor pagination: next = `after: endCursor`, previous = `before: startCursor`
      pageInfo={result?.people.pageInfo}
      query={query}
      total={result?.people.totalCount}
    />
  );
}
