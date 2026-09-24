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
import { Autocomplete, DateTimePicker, Input, NumberInput } from "components-ui";

function ProjectForm() {
  const { control, handleSubmit } = useForm({
    defaultValues: { name: "", ownerId: null, deadline: "", budget: null },
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
      <Controller
        control={control}
        name="budget"
        render={({ field, fieldState }) => (
          <NumberInput
            error={fieldState.error?.message}
            formatOptions={{ currency: "EUR", style: "currency" }}
            label="Budget"
            onBlur={field.onBlur}
            onChange={field.onChange}
            ref={field.ref}
            value={field.value}
          />
        )}
      />
    </form>
  );
}`;

const thirdParty = `import { Controller } from "react-hook-form";
import PhoneInput from "some-phone-input-library";
import { Field, getFieldError } from "components-ui";

<Controller
  control={control}
  name="phone"
  render={({ field }) => (
    <Field
      description="With the country code."
      error={getFieldError(serverError, "phone")}
      label="Phone"
      required
    >
      {(controlProps) => <PhoneInput {...controlProps} {...field} />}
    </Field>
  )}
/>`;

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
            <code>DateTimePicker</code>, <code>DateRangePicker</code>,{" "}
            <code>FileUpload</code>, <code>NumberInput</code>,{" "}
            <code>PinInput</code>, <code>RichTextEditor</code>,{" "}
            <code>Slider</code>, <code>TagsInput</code> and{" "}
            <code>TreeView</code> render hidden inputs (
            <code>CheckboxGroup</code> and <code>SegmentedControl</code> are
            native checkboxes and radios), and a hidden validation input makes
            the browser enforce <code>required</code>.
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
            with the value and the selected item, <code>NumberInput</code> with
            a <code>number</code> (or <code>null</code>),{" "}
            <code>CheckboxGroup</code> and <code>TagsInput</code> with an array,{" "}
            <code>Slider</code> with a number or a <code>[start, end]</code>{" "}
            pair, <code>DateRangePicker</code> with{" "}
            <code>{"{ start, end }"}</code> (or <code>null</code>) and{" "}
            <code>RichTextEditor</code> with the HTML.
          </p>
        </Prose>
      </Section>

      <Section title="Help texts">
        <Prose>
          <p>
            Every field takes a <code>description</code> - help text under the
            field, e.g. the expected format. It describes the field for screen
            readers: the control&apos;s <code>aria-describedby</code> lists the{" "}
            <code>error</code> message first, then the description, then your
            own <code>aria-describedby</code>. The ids derive from the id of the
            field - <code>{"${id}-error"}</code> and{" "}
            <code>{"${id}-description"}</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Custom and third-party controls">
        <Prose>
          <p>
            <code>Field</code> gives any control the label, the description and
            the error message of the library&apos;s fields. Its child is a
            function that gets the <code>id</code> and the ARIA attributes to
            spread on the control - the phone input below stands for a control
            of another library. <code>FormDescription</code> and{" "}
            <code>FormError</code> are the pieces for a field laid out by hand.
          </p>
        </Prose>
        <Example collapsed name="field/basic" title="Field" />
        <CodeBlock code={thirdParty} />
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
            element they render; the <code>ref</code> of{" "}
            <code>NumberInput</code> is its visible text field.
          </p>
        </Callout>
      </Section>
    </DocPage>
  );
}
