import { Autocomplete, type LoadOptionsParams } from "components-ui";

interface Person {
  email: string;
  id: string;
  name: string;
}

const PEOPLE = /* GraphQL */ `
  query People($search: String, $first: Int!, $after: String) {
    people(search: $search, first: $first, after: $after) {
      nodes {
        id
        name
        email
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

async function loadPeople({ after, first, search, signal }: LoadOptionsParams) {
  const response = await fetch("/api/graphql", {
    body: JSON.stringify({
      query: PEOPLE,
      variables: { after, first, search },
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  const { data, errors } = await response.json();

  if (errors?.length) throw new Error(errors[0].message);

  // A Relay connection - `{ nodes, pageInfo }` - is returned as it is
  return data.people as {
    nodes: Person[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

export default function GraphQL() {
  return (
    <div className="max-w-sm">
      <Autocomplete
        getOptionLabel={(person) => `${person.name} (${person.email})`}
        label="Person (GraphQL)"
        loadOptions={loadPeople}
        pageSize={20}
        placeholder="Type a name…"
      />
    </div>
  );
}
