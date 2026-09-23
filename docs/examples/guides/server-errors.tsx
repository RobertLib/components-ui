import { useState } from "react";
import {
  Alert,
  Button,
  getBaseError,
  getFieldError,
  Input,
  Select,
  Tabs,
  useSnackbar,
} from "components-ui";
import { people } from "../../mocks/data";

type Backend = "rest" | "graphql";

const CREATE_PERSON = /* GraphQL */ `
  mutation CreatePerson($input: PersonInput!) {
    createPerson(input: $input) {
      id
      name
      email
    }
  }
`;

// Resolves with the server error (or null) - the REST error body or the
// GraphQL response with `errors`
async function createPerson(backend: Backend, input: Record<string, string>) {
  if (backend === "rest") {
    const response = await fetch("/api/people", {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return response.ok ? null : await response.json();
  }

  const response = await fetch("/api/graphql", {
    body: JSON.stringify({ query: CREATE_PERSON, variables: { input } }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const body = await response.json();
  return body.errors ? body : null;
}

export default function ServerErrors() {
  const [backend, setBackend] = useState<Backend>("rest");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="max-w-md space-y-4">
      <Tabs
        items={[
          { label: "REST", value: "rest" },
          { label: "GraphQL", value: "graphql" },
        ]}
        onChange={(value) => {
          setBackend(value as Backend);
          setError(null);
        }}
        size="sm"
        value={backend}
      />
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const input = Object.fromEntries(
            new FormData(event.currentTarget),
          ) as Record<string, string>;
          setSaving(true);
          const serverError = await createPerson(backend, input);
          setSaving(false);
          setError(serverError);
          if (!serverError) enqueueSnackbar("Saved", "success");
        }}
      >
        {/* Messages that belong to no field */}
        <Alert type="danger">{getBaseError(error)}</Alert>

        <Input
          defaultValue="Jana Nováková"
          error={getFieldError(error, "name")}
          label="Name"
          name="name"
        />
        <Input
          // This address exists already - the server rejects it
          defaultValue={people[0].email}
          error={getFieldError(error, "email")}
          label="Email"
          name="email"
        />
        <Select
          label="Role"
          name="role"
          options={[
            { label: "Editor", value: "Editor" },
            { label: "Viewer", value: "Viewer" },
          ]}
        />
        <Button loading={saving} type="submit">
          Save via {backend === "rest" ? "REST" : "GraphQL"}
        </Button>
        <p className="text-xs text-neutral-500">
          Name "error" triggers a general error, a new email address saves.
        </p>
      </form>
    </div>
  );
}
