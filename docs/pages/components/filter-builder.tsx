import {
  DEFAULT_FILTER_OPERATORS,
  useLocale,
  type FilterFieldType,
} from "components-ui";
import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const valueShape = `// "Status is Paid and (Total at least 10 000 or Customer contains “Novák”)"
const filter: FilterGroup = {
  combinator: "and",                 // or "or"
  conditions: [
    { field: "status", operator: "equals", value: "paid" },
    {
      combinator: "or",              // a nested group
      conditions: [
        { field: "total", operator: "greaterThanOrEqual", value: 10000 },
        { field: "customer", operator: "contains", value: "Novák" },
      ],
    },
  ],
};

// The other kinds of values
{ field: "status", operator: "in", value: ["sent", "overdue"] }        // a list
{ field: "total", operator: "between", value: { from: 1000, to: 5000 } } // a range
{ field: "issuedOn", operator: "onOrAfter", value: "2026-10-01" }      // a day
{ field: "paidAt", operator: "before", value: "2026-10-15T12:00" }     // a moment
{ field: "reverseCharge", operator: "equals", value: true }
{ field: "note", operator: "isEmpty" }                                 // no value`;

const types: [FilterFieldType, string][] = [
  ["text", "Input"],
  ["number", "NumberInput"],
  ["date", "DateTimePicker - a day"],
  ["datetime", "DateTimePicker - a day and a time"],
  ["select", "Select, Autocomplete for a list"],
  ["multiSelect", "Autocomplete"],
  ["boolean", "Yes / No"],
  ["custom", "render"],
];

/** The operators of each type of field, in the language of the docs. */
function OperatorTable() {
  const { operators } = useLocale().messages.ui.filterBuilder;

  return (
    <table>
      <thead>
        <tr>
          <th>type</th>
          <th>Operators - the first for a new condition</th>
          <th>Value field</th>
        </tr>
      </thead>
      <tbody>
        {types.map(([type, editor]) => (
          <tr key={type}>
            <td>
              <code>{type}</code>
            </td>
            <td>
              {DEFAULT_FILTER_OPERATORS[type].map((operator, index) => (
                <span key={operator}>
                  {index > 0 && ", "}
                  <code title={operators[operator]}>{operator}</code>
                </span>
              ))}
            </td>
            <td>{editor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function FilterBuilderPage() {
  return (
    <DocPage
      imports={[
        "FilterBuilder",
        "matchesFilter",
        "describeFilter",
        "compactFilter",
        "type FilterField",
        "type FilterGroup",
      ]}
      title="FilterBuilder"
    >
      <Example
        description={
          <p>
            Each of the <code>fields</code> has a <code>key</code>, a{" "}
            <code>label</code> and a <code>type</code> - it decides the
            operators offered and the field the value is entered in. A new
            condition takes the first field and its first operator; changing the
            operator keeps what fits of the value (one value becomes the first
            item of a list or the start of a range). With two or more conditions
            a switch joins them by And or Or.{" "}
            <code>describeFilter(filter, fields, useLocale())</code> writes the
            filter as a sentence of the language of the page - switch it in the
            top bar.
          </p>
        }
        name="filter-builder/basic"
        title="Fields of every type"
      />
      <Example
        description={
          <p>
            The filter of a controlled builder (<code>value</code> +{" "}
            <code>onChange</code>) filters the rows of a <code>clientSide</code>{" "}
            <code>DataTable</code> with <code>matchesFilter</code>. Below is
            what a server would get instead: <code>compactFilter</code> leaves
            out the conditions without a value yet, the empty items of lists and
            ends of ranges, the groups left empty, the <code>id</code>s the
            builder gives to its conditions and groups, and - with{" "}
            <code>fields</code> - the conditions of fields that are not among
            them any more (an old saved filter).
          </p>
        }
        name="filter-builder/data-table"
        title="Filtering a table"
      />
      <Example
        description={
          <p>
            &quot;Add group&quot; adds a nested group with its own And / Or -
            groups nest up to <code>maxDepth</code> levels, the top group
            included (3 by default; 1 offers no groups). A group of several
            conditions is written in parentheses by <code>describeFilter</code>.
            The <code>group</code> of a field lists it under that heading in the
            field select. <code>dim</code> sizes the fields and buttons.
          </p>
        }
        name="filter-builder/groups"
        title="Nested groups"
      />
      <Example
        description={
          <p>
            A <code>select</code> or <code>multiSelect</code> field with{" "}
            <code>loadOptions</code> picks its values in an{" "}
            <code>Autocomplete</code> that loads them from an API - and{" "}
            <code>loadSelectedOptions</code> loads the labels of the values
            given at first. A field of the app has the type <code>custom</code>{" "}
            and a <code>render</code> - here a <code>Rating</code> - which gets
            the value, <code>onChange</code>, the <code>aria-label</code> of the
            locale, <code>dim</code> and <code>disabled</code>. Its{" "}
            <code>operators</code> pick and order the ones offered, and{" "}
            <code>match</code> decides how a record matches it in{" "}
            <code>matchesFilter</code>.
          </p>
        }
        name="filter-builder/async-and-custom"
        title="Options from an API and a custom field"
      />

      <Section title="Value and operators">
        <Prose>
          <p>
            The value is a <code>FilterGroup</code> - plain JSON: a{" "}
            <code>combinator</code> and a list of <code>conditions</code>, each
            of them a condition (<code>field</code>, <code>operator</code>,{" "}
            <code>value</code>) or a nested group. Save it, put it into the URL
            or send it to a server as it is. Days are <code>YYYY-MM-DD</code>{" "}
            and moments <code>YYYY-MM-DDTHH:mm</code> texts in the time of the
            user - <code>on</code> takes a day also for a <code>datetime</code>{" "}
            field.
          </p>
        </Prose>
        <CodeBlock code={valueShape} />
        <Prose>
          <p>
            The operators of each type are below - hover one for its name in the
            language of the page. <code>operators</code> of a field offers
            others, or fewer; the defaults are exported as{" "}
            <code>DEFAULT_FILTER_OPERATORS</code>. <code>isEmpty</code> and{" "}
            <code>isNotEmpty</code> take no value, <code>between</code> a range
            whose ends are both included (one end alone is &quot;at least&quot;
            / &quot;at most&quot;), <code>in</code> / <code>notIn</code> and the{" "}
            <code>has…</code> operators a list.
          </p>
          <OperatorTable />
        </Prose>
        <Callout title="Conditions without a value">
          <p>
            <code>onChange</code> reports every change, also a condition just
            added that has no value yet - <code>isConditionComplete</code> tells
            them apart. <code>matchesFilter</code>, <code>describeFilter</code>{" "}
            and <code>compactFilter</code> leave them out, so a half-written
            condition never empties a list.
          </p>
        </Callout>
      </Section>

      <Section title="Matching in the browser">
        <Prose>
          <p>
            <code>matchesFilter(row, filter, fields)</code> tells whether a
            record matches - <code>rows.filter(…)</code> filters a list. The
            value of a field is <code>row[key]</code>, or what its{" "}
            <code>getValue(row)</code> returns.
          </p>
          <ul>
            <li>
              Text ignores case and accents, as the searches of the library do -
              &quot;novak&quot; finds &quot;Novák&quot;.
            </li>
            <li>
              A negative operator (<code>notEquals</code>,{" "}
              <code>notContains</code>, <code>notIn</code>, <code>hasNone</code>
              ) matches every record the positive one does not - also one
              without a value.
            </li>
            <li>
              Numbers also match numbers stored as text (&quot;10.5&quot;);
              other text (&quot;N/A&quot;) is neither more nor less than a
              number.
            </li>
            <li>
              Dates compare as local days and moments: <code>Date</code>s, ISO
              texts (one with a time zone in the local time, also with a space
              for the <code>T</code>, as SQL writes them) and timestamps. A day
              matches all the moments of that day.
            </li>
            <li>
              A list of the record matches when one of its items does;{" "}
              <code>hasAll</code> when it has all the values.
            </li>
            <li>
              Conditions without a value, or of a field not in{" "}
              <code>fields</code>, are left out - an empty filter matches every
              record.
            </li>
          </ul>
          <p>
            A filter is compiled once for the <code>fields</code> it is matched
            with - define the fields outside the component (or memoize them), so
            that a list of thousands of rows does not compile it for each row.
          </p>
        </Prose>
      </Section>

      <Section title="Forms">
        <Example
          description={
            <p>
              With a <code>name</code> the builder submits the filter as JSON -
              compacted by <code>compactFilter</code> - in a hidden input, so it
              works in a plain <code>{"<form>"}</code> and with{" "}
              <code>FormData</code>. A reset of the form brings back{" "}
              <code>defaultValue</code>. <code>form</code> connects a builder
              outside the form; a <code>disabled</code> builder - or one in a
              disabled fieldset - is not submitted.
            </p>
          }
          name="filter-builder/form"
          title="In a form"
        />
      </Section>

      <Section title="Accessibility">
        <Prose>
          <p>
            The builder is a <code>{"<fieldset>"}</code> named by its{" "}
            <code>label</code> (its legend) - or by &quot;Filter&quot; of the
            locale, or <code>aria-label</code>. Each nested group is a fieldset
            named by its place, &quot;Group 2&quot;, and each condition a named
            group, &quot;Condition 2.1&quot;, whose field, operator and value
            fields have their own names; the remove buttons say what they remove
            (&quot;Remove condition 2.1&quot;). The And / Or between the
            conditions is shown for the eye - screen readers hear it from the
            switch of the group.
          </p>
          <p>
            A condition or group added takes the focus in its first field. A
            removed one gives it to the condition that took its place (or the
            one before), or to &quot;Add condition&quot; of a group left empty.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="FilterBuilder" />
        <PropsTable of="FilterField" />
        <PropsTable of="FilterGroup" />
        <PropsTable of="FilterCondition" />
        <PropsTable of="FilterRange" />
        <PropsTable of="FilterFieldOption" />
        <PropsTable of="FilterValueEditorProps" />
      </Section>
    </DocPage>
  );
}
