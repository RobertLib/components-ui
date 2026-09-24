import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";
import RequestLog from "../../components/request-log";

const resultShapes = `// 1. The complete list - no further pages are requested
return items;

// 2. A page of a REST API - the next page is requested while
//    hasMore is true (or offset + items.length < total, or while
//    there is a nextCursor)
return { items, total };
return { items, hasMore: items.length === pageSize };
return { items, nextCursor: body.next }; // cursor-based REST

// 3. A GraphQL (Relay) connection, as the server returns it
return data.users; // { nodes | edges, pageInfo: { endCursor, hasNextPage } }`;

const apollo = `import { gql } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";

const USERS = gql\`
  query Users($search: String, $first: Int!, $after: String) {
    users(search: $search, first: $first, after: $after) {
      nodes { id name }
      pageInfo { endCursor hasNextPage }
    }
  }
\`;

function UserSelect() {
  const client = useApolloClient();

  return (
    <Autocomplete
      label="User"
      loadOptions={async ({ search, first, after, signal }) => {
        const { data } = await client.query({
          query: USERS,
          variables: { search, first, after },
          fetchPolicy: "network-only",
          context: { fetchOptions: { signal } },
        });
        return data.users;
      }}
    />
  );
}`;

export default function AutocompletePage() {
  return (
    <DocPage
      imports={["Autocomplete", "type LoadOptionsParams"]}
      title="Autocomplete"
    >
      <Section title="Static options">
        <Prose>
          <p>
            Pass <code>options</code> - <code>{"{ label, value }"}</code>{" "}
            objects (the examples use a list of cities, <code>cities.ts</code>).
            Typing filters them ignoring case and diacritics.
          </p>
        </Prose>
        <Example name="autocomplete/static" title="Single" />
        <Example
          description={
            <p>
              <code>multiple</code> shows the selection as chips - click a chip,
              press Backspace / Delete on a focused one or Backspace in the
              empty field to remove one. <code>maxSelections</code> caps the
              count: once it is reached, the list says so and offers only the
              selected options.
            </p>
          }
          name="autocomplete/multiple"
          title="Multiple"
        />
        <Example
          description={
            <p>
              <code>asSelect</code> turns off typing: a click opens the whole
              list on the selected option, and typed letters highlight the next
              option starting with them, as in a native select.{" "}
              <code>hasEmpty</code> adds an empty option to clear the value. An
              option with <code>disabled</code> is shown but cannot be picked.
            </p>
          }
          name="autocomplete/as-select"
          title="As a select"
        />
        <Example
          description={
            <p>
              With <code>value</code> the field is controlled - it always shows
              what the parent says, including resets from outside.
            </p>
          }
          name="autocomplete/controlled"
          title="Controlled"
        />
      </Section>

      <Section title="Options from an API">
        <Prose>
          <p>
            Pass <code>loadOptions</code> instead of <code>options</code>. It is
            called when the list opens, again (debounced) as the user types and
            for the next page once the list is scrolled to its end. It receives
            the search term and the page in the terms of every common pagination
            style, and may return a plain array, a REST page or a GraphQL
            connection - so it fits any backend.
          </p>
        </Prose>

        <Example
          description={
            <p>
              A REST endpoint with offset pagination. Watch the requests below
              while typing and scrolling - a newer request aborts an older one
              through <code>signal</code>.
            </p>
          }
          name="autocomplete/rest"
          title="REST"
        />
        {/* The other examples here call /api/people too - only this one
            starts its query with the search term */}
        <RequestLog filter="/api/people?q=" />

        <Example
          description={
            <p>
              A GraphQL query with Relay pagination: <code>first</code> /{" "}
              <code>after</code> go in, the connection comes back as it is.
            </p>
          }
          name="autocomplete/graphql"
          title="GraphQL"
        />
        <RequestLog filter="/api/graphql" showBody />

        <h3 className="mt-8 mb-2 text-lg font-semibold">With Apollo Client</h3>
        <CodeBlock code={apollo} />

        <h3 className="mt-8 mb-2 text-lg font-semibold">What to return</h3>
        <CodeBlock code={resultShapes} />
        <PropsTable of="LoadOptionsParams" />
      </Section>

      <Section title="Edit forms">
        <Example
          description={
            <p>
              A saved value holds ids, not labels.{" "}
              <code>loadSelectedOptions</code> loads the items of selected
              values the component has no label for yet, so an edit form shows
              the names right away. A value it does not deliver (a deleted
              record) shows as it is, so that it can be seen and removed.
            </p>
          }
          name="autocomplete/edit-form"
          title="Labels of saved values"
        />
        <Example
          description={
            <p>
              <code>loadOptionsDeps</code> reloads the list when other values it
              depends on change - here the department filter.
            </p>
          }
          name="autocomplete/dependent"
          title="Dependent fields"
        />
        <Example
          description={
            <p>
              <code>renderOption</code> renders an option any way you like;{" "}
              <code>option.data</code> is the loaded item.
            </p>
          }
          name="autocomplete/custom-option"
          title="Custom options"
        />
      </Section>

      <Callout title="Labels and values of items">
        <p>
          By default the label is read from <code>label</code>,{" "}
          <code>name</code> or <code>title</code> of an item and the value from{" "}
          <code>value</code> or <code>id</code>. For other shapes pass{" "}
          <code>getOptionLabel</code> / <code>getOptionValue</code> - they also
          read static <code>options</code> of any shape (type the item in the
          function, e.g. <code>{"(country: Country) => country.name"}</code>
          ). <code>onChange</code> gets the value and the item:{" "}
          <code>(value, item)</code>, or <code>(values, items)</code> in
          multiple mode, where <code>items[i]</code> belongs to{" "}
          <code>values[i]</code>. The item is <code>null</code> for a value
          without one - a static option without <code>data</code>, a saved value{" "}
          <code>loadSelectedOptions</code> did not deliver.
        </p>
      </Callout>

      <Section title="Forms and accessibility">
        <Prose>
          <ul>
            <li>
              With a <code>name</code>, hidden inputs submit the value(s), and{" "}
              <code>required</code> is enforced by the browser. A single field
              without a value submits an empty one, so that clearing it reaches
              the server; a <code>disabled</code> field submits nothing, like a
              disabled native input - and so does one in a disabled{" "}
              <code>&lt;fieldset&gt;</code>, which disables it.{" "}
              <code>form</code> ties the hidden inputs to a form elsewhere in
              the page, like the attribute of a native field.
            </li>
            <li>
              The field is a <code>combobox</code> with a <code>listbox</code>:
              ArrowDown opens it, the arrow keys move the highlight, Enter picks
              and Escape closes. Enter in a closed typing field submits the
              form, as in a text input. Home / End move the highlight in an{" "}
              <code>asSelect</code> field and the caret in a typing one. An{" "}
              <code>asSelect</code> field is a select-only combobox: Enter and
              Space open it on the selected option and pick, and letters
              highlight the options starting with them. Keys of an input method
              (IME) composing text are left to it.
            </li>
            <li>
              <code>description</code> puts help text under the field. It,{" "}
              <code>aria-describedby</code> and <code>aria-labelledby</code> go
              to the combobox itself - the combobox is described by the{" "}
              <code>error</code> message, the description and your{" "}
              <code>aria-describedby</code>, in this order.
            </li>
            <li>
              A form reset - a reset button, <code>form.reset()</code> or React
              after a form <code>action</code> - brings back the{" "}
              <code>defaultValue</code> of an uncontrolled field.
            </li>
            <li>
              Static <code>options</code> can grow on scroll: pass{" "}
              <code>loadMore</code>, and <code>hasMore={"{false}"}</code> once
              everything is loaded. A list the options do not fill calls it
              right away.
            </li>
            <li>
              Loading errors are logged in development and passed to{" "}
              <code>onLoadError</code>, e.g. to show a toast. The list then
              shows an error, and its next opening loads it again. Labels{" "}
              <code>loadSelectedOptions</code> failed to load show the values as
              they are and are asked for again when the list next opens.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Autocomplete" />
        <PropsTable of="AutocompleteOption" />
        <PropsTable of="LoadOptionsPage" />
        <PropsTable of="RelayConnection" />
      </Section>
    </DocPage>
  );
}
