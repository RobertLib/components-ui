import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";

const errorShapes = `// REST (Rails, Laravel, Django REST framework, ASP.NET, …)
{ "email": ["has already been taken"] }
{ "errors": { "email": ["has already been taken"], "base": ["…"] } }
{ "errors": [{ "field": "email", "message": "has already been taken" }] }
{ "errors": [{ "source": { "pointer": "/data/attributes/email" }, "detail": "…" }] } // JSON:API
{ "title": "…", "errors": { "": ["…"], "Email": ["…"], "$.age": ["…"] } } // ASP.NET - "" is the whole form
{ "title": "…", "errors": [{ "pointer": "#/email", "detail": "…" }] } // problem details (RFC 9457)
{ "title": "…", "invalid-params": [{ "name": "email", "reason": "…" }] } // problem details (RFC 7807)
{ "errors": [{ "field": "email", "defaultMessage": "must not be blank" }] } // Spring Boot
{ "errors": [{ "path": "email", "msg": "Invalid value" }] } // express-validator
{ "detail": [{ "loc": ["body", "email"], "msg": "Field required" }] } // FastAPI
{ "formErrors": ["…"], "fieldErrors": { "email": ["…"] } } // Zod flatten()
{ "code": "VALIDATION_FAILED", "message": "…", "fieldErrors": { "email": ["…"] } }
class ApiError extends Error { fieldErrors = { email: ["…"] }; formErrors = ["…"] } // an error class of your client

// GraphQL - errors with the field messages in the extensions
{ "errors": [{ "message": "Validation failed", "extensions": { "email": ["…"] } }] }
{ "errors": [{ "extensions": { "problems": [{ "path": ["email"], "explanation": "…" }] } }] }
// Apollo Client 4 (CombinedGraphQLErrors) / 3 (ApolloError) / urql (CombinedError)
error.errors[0].extensions   error.graphQLErrors[0].extensions

// GraphQL "user errors" in the mutation payload
{ "userErrors": [{ "field": ["input", "email"], "message": "…" }] }`;

const registerForm = `import { useForm } from "react-hook-form";
import { Button, Checkbox, Input, Select, Textarea } from "components-ui";

function ProfileForm({ profile }) {
  const { formState, handleSubmit, register, reset } = useForm({
    defaultValues: profile, // { name, bio, role, newsletter }
  });

  return (
    <form onSubmit={handleSubmit(save)}>
      <Input
        {...register("name", { required: "Enter a name" })}
        clearable
        error={formState.errors.name?.message}
        label="Name"
      />
      <Textarea {...register("bio")} label="Bio" maxLength={200} showCount />
      <Select {...register("role")} label="Role" options={roles} />
      <Checkbox {...register("newsletter")} label="Newsletter" />
      <Button onClick={() => reset()} variant="outline">
        Reset
      </Button>
    </form>
  );
}`;

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
            ref={field.ref}
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

const unsavedChanges = `import { useForm } from "react-hook-form";
import { useRouter, useUnsavedChanges } from "components-ui";

function EditOrder({ order }) {
  const { formState, handleSubmit, register, reset } = useForm({
    defaultValues: order,
  });
  const { release } = useUnsavedChanges(formState.isDirty);
  const { navigate } = useRouter();

  const save = async (values) => {
    await api.saveOrder(values);
    reset(values); // not dirty - from the next render on
    release(); // …so let this navigation go now
    navigate(\`/orders/\${order.id}\`);
  };

  return <form onSubmit={handleSubmit(save)}>…</form>;
}`;

const reactRouterBlocker = `import { useEffect } from "react";
import { useBlocker } from "react-router";
import { confirmLeave, hasUnsavedChanges } from "components-ui";

// Once, inside the router (e.g. in the root route): the app's own links,
// its navigate() and back / forward in every browser ask too
export function UnsavedChangesBlocker() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      hasUnsavedChanges(),
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void confirmLeave().then((leave) =>
      leave ? blocker.proceed() : blocker.reset(),
    );
  }, [blocker]);

  return null;
}`;

const tanstackBlocker = `import { useBlocker } from "@tanstack/react-router";
import { confirmLeave, hasUnsavedChanges } from "components-ui";

export function UnsavedChangesBlocker() {
  useBlocker({
    // The library asks the browser before an unload itself
    enableBeforeUnload: false,
    shouldBlockFn: async ({ current, next }) =>
      current.pathname !== next.pathname &&
      hasUnsavedChanges() &&
      !(await confirmLeave()),
  });

  return null;
}`;

const nextBlocker = `"use client";
import { useRouter } from "next/navigation";
import { Button, confirmLeave } from "components-ui";

// Next.js has no blocker: the links of the library ask through the adapter -
// render your own with Link of components-ui, and ask before router.push()
function OrderActions() {
  const router = useRouter();

  return (
    <Button
      onClick={async () => {
        if (await confirmLeave()) router.push("/orders");
      }}
    >
      Orders
    </Button>
  );
}`;

const layoutCode = `<form>
  <FormSection columns={2} labelPosition="start" title="Company">
    <Input label="Name" name="name" />
    <Input label="Company ID" name="companyId" />
    <FormGridItem span="full">
      <Textarea label="Note" name="note" />
    </FormGridItem>
  </FormSection>
  <FormActions dirty={dirty} sticky>
    <Button type="reset" variant="outline">Cancel</Button>
    <Button type="submit">Save</Button>
  </FormActions>
</form>`;

const stateStyles = `// The data attributes of the states, for Tailwind's data-* variants
<Checkbox className="data-[state=indeterminate]:opacity-75" label="All" />
<Input className="data-invalid:bg-danger-50" error={error} label="Email" />
<RadioGroup
  className="**:data-selected:font-semibold"
  label="Plan"
  options={plans}
  variant="card"
/>

// Or in a stylesheet
[role="combobox"][data-state="open"] { border-color: var(--color-primary-500); }
[role="option"][data-highlighted] { background: var(--color-primary-50); }`;

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
            native checkboxes and radios). With <code>required</code> the
            browser refuses to submit a field without a value and says why -
            also <code>Autocomplete</code>, the pickers, <code>FileUpload</code>
            , <code>NumberInput</code>, <code>PinInput</code>,{" "}
            <code>RichTextEditor</code> and <code>TagsInput</code>. A{" "}
            <code>Slider</code> always has a value, and <code>TreeView</code>{" "}
            has no <code>required</code>.
          </p>
        </Prose>
        <Example
          collapsed
          name="guides/form-data"
          title="FormData without state"
        />
      </Section>

      <Section title="Layout">
        <Prose>
          <p>
            <code>FormSection</code> is a titled part of a form - a fieldset
            named by its heading, with a description and actions.{" "}
            <code>FormGrid</code>, which lays out the fields of a section, puts
            them in 1 to 4 <code>columns</code> where the form is wide enough
            and in one on a phone; <code>FormGridItem</code> spans a field over
            more. <code>labelPosition=&quot;start&quot;</code> puts the labels
            beside the fields, in a column of <code>labelWidth</code> - every
            field of the library, its description and error message under the
            control. <code>FormActions</code> is the bar of the buttons at the
            end - with <code>sticky</code> it stays at the bottom of the screen
            until the end of a long form scrolls into view.
          </p>
        </Prose>
        <CodeBlock code={layoutCode} />
        <Example
          collapsed
          name="form-grid/labels-beside"
          title="Labels beside the fields"
        />
      </Section>

      <Section title="Read-only forms">
        <Prose>
          <p>
            <code>readOnly</code> of a <code>FormSection</code> or a{" "}
            <code>FormGrid</code> makes every field inside read-only, as its own{" "}
            <code>readOnly</code> would: the value shows, can be selected and
            copied, and is submitted, but not changed - one form for the detail
            and the edit of a record. It renders read-only on the server too. A
            field with <code>readOnly={"{false}"}</code> stays editable, and so
            do a grid with <code>readOnly={"{false}"}</code> inside and the
            fields of a dialog or a popover opened from the form.{" "}
            <code>Field</code> passes <code>readOnly</code> on to a control of
            your own.
          </p>
        </Prose>
        <Example
          collapsed
          name="form-section/detail-edit"
          title="Detail and edit"
        />
      </Section>

      <Section title="Controlled fields">
        <Prose>
          <p>
            Pass <code>value</code> and <code>onChange</code> for React state.
            Text fields, selects and pickers call <code>onChange</code> with an
            event (<code>event.target.value</code>), <code>Autocomplete</code>{" "}
            with the value and the selected item, <code>NumberInput</code> with
            a <code>number</code> (or <code>null</code>), <code>PinInput</code>{" "}
            with the code (a string), <code>CheckboxGroup</code> and{" "}
            <code>TagsInput</code> with an array, <code>Slider</code> with a
            number or a <code>[start, end]</code> pair,{" "}
            <code>DateRangePicker</code> with <code>{"{ start, end }"}</code>{" "}
            (or <code>null</code>) and <code>RichTextEditor</code> with the
            HTML.
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

      <Section title="Refs and attributes">
        <Prose>
          <p>
            The <code>ref</code> of a field is the element that takes the focus,
            so that <code>field.ref</code> of React Hook Form&apos;s{" "}
            <code>Controller</code> focuses the field with an error: the input,
            select or textarea of the text fields, the combobox of{" "}
            <code>Autocomplete</code>, <code>TreeSelect</code> and the pickers,
            the editable element of <code>RichTextEditor</code>, the first cell
            of <code>PinInput</code>, the first thumb of <code>Slider</code> and
            the slider of <code>Rating</code>. Groups of options -{" "}
            <code>RadioGroup</code>, <code>CheckboxGroup</code>,{" "}
            <code>SegmentedControl</code>, <code>DateCalendar</code>,{" "}
            <code>RangeCalendar</code> and <code>FileUpload</code> - point it at
            the group element.
          </p>
          <p>
            Every field passes the native attributes it does not use itself -{" "}
            <code>data-*</code>, <code>style</code>, <code>title</code>, event
            handlers: the fields of one native control to that control, the
            groups to the group element, <code>Slider</code> and{" "}
            <code>PinInput</code> to the element around the thumbs or the cells,{" "}
            <code>Autocomplete</code> and <code>TreeSelect</code> to their
            wrapper. A handler of yours runs before the field&apos;s own - a{" "}
            <code>preventDefault()</code> in it keeps the field from handling a
            key.
          </p>
        </Prose>
      </Section>

      <Section title="Sizes">
        <Prose>
          <p>
            <code>dim</code> - <code>xs</code>, <code>sm</code>, <code>md</code>{" "}
            (default) and <code>lg</code> - sizes every field. The fields that
            look like an <code>Input</code> are 22, 26, 34 and 46 px high, so
            fields of one <code>dim</code> line up in a row - a small one with a{" "}
            <code>size=&quot;sm&quot;</code> <code>Button</code>, a medium one
            with the default button. The boxes of the checkboxes and radios, the
            switches, stars, cells and thumbs grow with the <code>dim</code>{" "}
            too.
          </p>
        </Prose>
      </Section>

      <Section title="Styling the states">
        <Prose>
          <p>
            The fields mark their states with data attributes, on the element
            with the ARIA state - for your styles and tests:
          </p>
          <ul>
            <li>
              <code>data-state</code> - <code>checked</code>,{" "}
              <code>unchecked</code> or <code>indeterminate</code> on a{" "}
              <code>Checkbox</code>, a <code>Switch</code> and the options of
              the groups; <code>open</code> or <code>closed</code> on the field
              that opens a popup (<code>Autocomplete</code>, the pickers,{" "}
              <code>TreeSelect</code>, the swatch of <code>ColorInput</code>,{" "}
              <code>TagsInput</code> with suggestions).
            </li>
            <li>
              <code>data-selected</code> - a selected option, day, segment or
              card; <code>data-highlighted</code> - the option or the day the
              keys are on.
            </li>
            <li>
              <code>data-disabled</code>, <code>data-invalid</code> (an{" "}
              <code>error</code>, or a value the field refuses - out of{" "}
              <code>min</code> / <code>max</code>, a disabled day) and{" "}
              <code>data-readonly</code>; <code>data-orientation</code> on the
              groups and sliders.
            </li>
          </ul>
          <p>
            The flags are present and empty, or absent - never{" "}
            <code>&quot;false&quot;</code>, so <code>data-invalid:</code> and{" "}
            <code>[data-selected]</code> match them.
          </p>
        </Prose>
        <CodeBlock code={stateStyles} />
        <Callout>
          <p>
            In forced colors (Windows High Contrast), which leave out
            backgrounds and shadows, the fields keep their states: the focus
            shows as an outline instead of the ring, a switch that is on, a
            picked segment, card, day or option take the system&apos;s highlight
            color, an invalid field a thicker border, and a color swatch keeps
            its color. Style a focus of your own with{" "}
            <code>outline-hidden</code> rather than <code>outline-none</code> to
            keep it there.
          </p>
        </Callout>
      </Section>

      <Section title="Server validation errors">
        <Prose>
          <p>
            <code>getFieldError(error, field)</code> returns the message for one
            field and <code>getBaseError(error)</code> the general one, whatever
            shape the server sent - pass the parsed REST error body, the error
            your API client throws (with the <code>fieldErrors</code>,{" "}
            <code>formErrors</code> or <code>errors</code> of the body) or the
            GraphQL error / response as it is. An API that answers with codes (
            <code>REQUIRED</code>) has them translated by the app:{" "}
            <code>messages.errors[code]</code>. Field names match in camelCase
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

      <Section title="Forms in dialogs">
        <Prose>
          <p>
            <code>FormDialog</code> is a <code>Dialog</code> with a form - the
            fields, the error of the last save above them, and Cancel with the
            submit button in its footer. It spins its submit button and stays
            open while <code>saving</code>, and with <code>dirty</code> asks
            &quot;Discard changes?&quot; before Cancel, the close button, Escape
            or the backdrop throws the changes away. Any <code>Dialog</code> or{" "}
            <code>Sheet</code> can ask with <code>onBeforeClose</code>.
          </p>
        </Prose>
        <Example collapsed name="form-dialog/basic" title="An edit dialog" />
      </Section>
      <Section title="Unsaved changes of a page">
        <Prose>
          <p>
            <code>useUnsavedChanges(dirty)</code> asks before the user leaves a
            page with unsaved changes. The browser asks with its own words
            before a reload, closing the tab and a link to another site; the
            library asks &quot;Leave without saving?&quot; - in a{" "}
            <code>ConfirmDialog</code> of a <code>ConfirmProvider</code>, else
            with the browser&apos;s <code>confirm()</code> - before its own
            navigations to another path: the links it renders through the router
            adapter (<code>Drawer</code>, <code>Tabs</code>,{" "}
            <code>Breadcrumbs</code>, <code>Button href</code>,{" "}
            <code>Link</code>, the rows of <code>DataTable</code>…), the back
            button of <code>Header</code> and <code>navigate</code> and{" "}
            <code>back</code> of <code>useRouter()</code>. A change of the query
            or the hash alone - a tab, a filter, a page of a table kept in the
            URL - stays on the page and asks nothing.
          </p>
          <p>
            Several forms with changes ask once together. <code>dirty</code>{" "}
            going <code>false</code> - saved - asks no more, and so does the
            form the changes were made in once submitted to the server (a native
            POST) - not another form of the page, such as a search. A handler
            that saves and navigates at once calls <code>release()</code> before
            it navigates: the new <code>dirty</code> comes only with the next
            render. <code>onBeforeLeave</code> asks a question of your own, e.g.
            with a Save button.
          </p>
        </Prose>
        <Example
          collapsed
          name="guides/unsaved-changes"
          title="Leaving a form with changes"
        />
        <CodeBlock code={unsavedChanges} />

        <h3 className="mt-8 mb-2 text-lg font-semibold">
          The links of your app
        </h3>
        <Prose>
          <p>
            Navigations the library does not render - the links and{" "}
            <code>navigate()</code> calls of your app - are your router&apos;s.
            Its blocker asks with <code>hasUnsavedChanges()</code>, which tells
            synchronously whether a form has changes, and{" "}
            <code>confirmLeave()</code>, which asks the question of the form and
            resolves <code>true</code> to leave (at once without changes):
          </p>
        </Prose>
        <CodeBlock code={reactRouterBlocker} title="React Router" />
        <CodeBlock
          className="mt-4"
          code={tanstackBlocker}
          title="TanStack Router"
        />
        <CodeBlock className="mt-4" code={nextBlocker} title="Next.js" />
        <Callout title="Back and forward">
          <p>
            Back and forward between the pages of a single-page app are the
            router&apos;s too. Where the Navigation API lets a page cancel them
            - Chrome and Edge, once the user has interacted with the page - the
            library stops them, asks, and goes on to the same entry; elsewhere
            only a blocker of the router stops them. The library never cancels
            the router&apos;s own navigations (a push or a replace of the
            History API): the router would show a page the address does not - a
            blocker asks before them. A traversal to another document cannot be
            canceled at all - the browser asks before it unloads.
          </p>
        </Callout>
      </Section>
      <Section title="React Hook Form">
        <Prose>
          <p>
            <code>register()</code> suits the fields that render one native
            element and call <code>onChange</code> with its event:{" "}
            <code>Input</code>, <code>Textarea</code>, <code>Select</code>,{" "}
            <code>Checkbox</code>, <code>Switch</code> and a{" "}
            <code>DateTimePicker</code> with{" "}
            <code>mode=&quot;native&quot;</code>. They pass <code>ref</code>,{" "}
            <code>onBlur</code> and every other native attribute on to that
            element, and keep the value React Hook Form writes into it - the{" "}
            <code>defaultValues</code>, <code>setValue()</code>,{" "}
            <code>reset()</code> - as a native field does, with the clear
            button, the character count and a floating label following it:
          </p>
        </Prose>
        <CodeBlock code={registerForm} />
        <Prose>
          <p>
            The other fields - <code>NumberInput</code>,{" "}
            <code>Autocomplete</code>, the custom pickers, a multiple{" "}
            <code>Select</code>, <code>CheckboxGroup</code>,{" "}
            <code>RadioGroup</code>, <code>SegmentedControl</code>,{" "}
            <code>Slider</code>, <code>PinInput</code> and the like - report
            their value rather than hold it in one native element. Use{" "}
            <code>Controller</code> for them - it drives the fields as
            controlled components, which keeps <code>reset()</code> and default
            values in sync:
          </p>
        </Prose>
        <CodeBlock code={hookForm} />
        <Callout>
          <p>
            A field keeps a value a script writes through the element&apos;s{" "}
            <code>value</code> property. Options of a multiple select picked one
            by one, or a <code>value</code> attribute set, show only after the
            next change - hence <code>Controller</code> for a multiple{" "}
            <code>Select</code>. Pass <code>field.ref</code> on as the{" "}
            <code>ref</code> - of <code>NumberInput</code> its visible text
            field, of <code>Autocomplete</code> its combobox - for{" "}
            <code>Controller</code> to focus the field on an error.
          </p>
        </Callout>
      </Section>
    </DocPage>
  );
}
