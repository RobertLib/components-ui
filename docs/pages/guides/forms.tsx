import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";

const errorShapes = `// REST (Rails, Laravel, Django REST framework, ASP.NET, …)
{ "email": ["has already been taken"] }
{ "errors": { "email": ["has already been taken"], "base": ["…"] } }
{ "errors": [{ "field": "email", "message": "has already been taken" }] }
{ "errors": [{ "source": { "pointer": "/data/attributes/email" }, "detail": "…" }] } // JSON:API

// GraphQL - errors with the field messages in the extensions
{ "errors": [{ "message": "Validation failed", "extensions": { "email": ["…"] } }] }
{ "errors": [{ "extensions": { "problems": [{ "path": ["email"], "explanation": "…" }] } }] }
// Apollo Client 4 (CombinedGraphQLErrors) / 3 (ApolloError) / urql (CombinedError)
error.errors[0].extensions   error.graphQLErrors[0].extensions

// GraphQL "user errors" in the mutation payload
{ "userErrors": [{ "field": ["input", "email"], "message": "…" }] }`;

const hookForm = `import { Controller, useForm } from "react-hook-form";
import { Autocomplete, DateTimePicker, Input } from "components-ui";

function ProjectForm() {
  const { control, handleSubmit } = useForm({
    defaultValues: { name: "", ownerId: null, deadline: "" },
  });

  return (
    <form onSubmit={handleSubmit(save)}>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <Input {...field} error={fieldState.error?.message} label="Name" />
        )}
        rules={{ required: "Enter a name" }}
      />
      <Controller
        control={control}
        name="ownerId"
        render={({ field }) => (
          <Autocomplete
            label="Owner"
            loadOptions={loadUsers}
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="deadline"
        render={({ field }) => (
          <DateTimePicker
            label="Deadline"
            onChange={(event) => field.onChange(event.target.value)}
            type="date"
            value={field.value}
          />
        )}
      />
    </form>
  );
}`;

export default function FormsGuide() {
  return (
    <DocPage
      description="The fields work in plain HTML forms, as controlled React inputs and with form libraries - and read validation errors from REST and GraphQL responses."
      title="Forms & validation"
    >
      <Section title="Plain forms">
        <Prose>
          <p>
            Every field accepts a <code>name</code> and submits its value like a
            native input - also the composite ones: <code>Autocomplete</code>,{" "}
            <code>DateTimePicker</code>, <code>FileUpload</code> and{" "}
            <code>RichTextEditor</code> render hidden inputs, and a hidden
            validation input makes the browser enforce <code>required</code>.
          </p>
        </Prose>
        <Example
          collapsed
          name="guides/form-data"
          title="FormData without state"
        />
      </Section>

      <Section title="Controlled fields">
        <Prose>
          <p>
            Pass <code>value</code> and <code>onChange</code> for React state.
            Text fields, selects and pickers call <code>onChange</code> with an
            event (<code>event.target.value</code>), <code>Autocomplete</code>{" "}
            with the value and the selected item, <code>RichTextEditor</code>{" "}
            with the HTML.
          </p>
        </Prose>
      </Section>

      <Section title="Server validation errors">
        <Prose>
          <p>
            <code>getFieldError(error, field)</code> returns the message for one
            field and <code>getBaseError(error)</code> the general one, whatever
            shape the server sent - pass the parsed REST error body or the
            GraphQL error / response as it is. Field names match in camelCase
            and snake_case, <code>address.street</code> addresses nested fields,
            and <code>getNestedErrors()</code> lists the errors of nested
            records.
          </p>
        </Prose>
        <Example
          collapsed
          description={
            <p>
              The same form saved through the REST and the GraphQL mock API -
              the fields read their messages from either error.
            </p>
          }
          name="guides/server-errors"
          title="REST and GraphQL errors"
        />
        <h3 className="mt-8 mb-2 text-lg font-semibold">Understood shapes</h3>
        <CodeBlock code={errorShapes} />
      </Section>

      <Section title="React Hook Form">
        <Prose>
          <p>
            Use <code>Controller</code> - it drives the fields as controlled
            components, which keeps <code>reset()</code> and default values in
            sync:
          </p>
        </Prose>
        <CodeBlock code={hookForm} />
        <Callout>
          <p>
            <code>Input</code>, <code>Textarea</code>, <code>Select</code>,{" "}
            <code>Checkbox</code> and <code>Switch</code> pass <code>ref</code>,{" "}
            <code>onBlur</code> and every other native attribute on to the
            element they render.
          </p>
        </Callout>
      </Section>
    </DocPage>
  );
}
