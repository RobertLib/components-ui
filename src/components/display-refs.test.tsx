import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import Accordion from "./accordion";
import AccordionGroup from "./accordion-group";
import Alert from "./alert";
import Avatar from "./avatar";
import AvatarGroup from "./avatar-group";
import Badge from "./badge";
import Breadcrumbs from "./breadcrumbs";
import Button from "./button";
import ButtonGroup from "./button-group";
import Calendar from "./calendar";
import Card from "./card";
import Chip from "./chip";
import CollapsibleContent from "./collapsible-content";
import CopyButton from "./copy-button";
import DataTable from "./data-table";
import DescriptionList from "./description-list";
import EmptyState from "./empty-state";
import IconButton from "./icon-button";
import Kbd from "./kbd";
import Link from "./link";
import LoadingOverlay from "./loading-overlay";
import Pagination from "./pagination";
import Panel from "./panel";
import Progress, { CircularProgress } from "./progress";
import Separator from "./separator";
import Skeleton from "./skeleton";
import Sparkline from "./sparkline";
import Spinner from "./spinner";
import Splitter from "./splitter";
import Stat from "./stat";
import Stepper from "./stepper";
import Table, {
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableRow,
} from "./table";
import Tabs from "./tabs";
import Timeline from "./timeline";
import TreeView from "./tree-view";
import VisuallyHidden from "./visually-hidden";

/** A `ref` and a test id - both should reach the same element. */
interface Props {
  "data-testid": string;
  ref: React.RefObject<never>;
}

/**
 * Each component with the props given, and the element they should reach
 * - its root, or the element named in its docs.
 */
const cases: [
  name: string,
  element: (props: Props) => React.ReactNode,
  expected: string,
][] = [
  ["Accordion", (props) => <Accordion header="A" {...props} />, "div"],
  [
    "AccordionGroup",
    (props) => (
      <AccordionGroup {...props}>
        <Accordion header="A" />
      </AccordionGroup>
    ),
    "div",
  ],
  ["Alert", (props) => <Alert {...props}>Saved</Alert>, "div[role=status]"],
  ["Avatar", (props) => <Avatar name="Jana" {...props} />, "div[role=img]"],
  [
    "AvatarGroup",
    (props) => (
      <AvatarGroup {...props}>
        <Avatar name="Jana" />
      </AvatarGroup>
    ),
    "div[role=group]",
  ],
  ["Badge", (props) => <Badge count={3} {...props} />, "span"],
  [
    "Badge on a child",
    (props) => (
      <Badge count={3} {...props}>
        <span>Inbox</span>
      </Badge>
    ),
    "span",
  ],
  [
    "Breadcrumbs",
    (props) => <Breadcrumbs items={[{ label: "A" }]} {...props} />,
    "nav",
  ],
  ["Button", (props) => <Button {...props}>Save</Button>, "button"],
  ["Button as a link", (props) => <Button link="/a" {...props} />, "a"],
  [
    "ButtonGroup",
    (props) => (
      <ButtonGroup {...props}>
        <Button>A</Button>
      </ButtonGroup>
    ),
    "div[role=group]",
  ],
  [
    "Calendar",
    (props) => <Calendar initialDate={new Date(2026, 8, 24)} {...props} />,
    "div",
  ],
  ["Card", (props) => <Card {...props} title="A" />, "div"],
  ["Card as a link", (props) => <Card href="/a" {...props} title="A" />, "div"],
  ["Chip", (props) => <Chip {...props}>A</Chip>, "span"],
  [
    "Chip as a toggle",
    (props) => (
      <Chip defaultSelected {...props}>
        A
      </Chip>
    ),
    "button",
  ],
  [
    "Chip with a remove button",
    (props) => (
      <Chip onRemove={() => {}} {...props}>
        A
      </Chip>
    ),
    "span[data-chip]",
  ],
  [
    "CollapsibleContent",
    (props) => (
      <CollapsibleContent isOpen {...props}>
        A
      </CollapsibleContent>
    ),
    "div",
  ],
  ["CopyButton", (props) => <CopyButton {...props} value="A" />, "button"],
  [
    "DataTable",
    (props) => (
      <DataTable
        columns={[{ key: "name", label: "Name" }]}
        data={[{ id: 1, name: "A" }]}
        {...props}
      />
    ),
    "div[role=region]",
  ],
  [
    "DescriptionList",
    (props) => (
      <DescriptionList items={[{ desc: "B", term: "A" }]} {...props} />
    ),
    "dl",
  ],
  ["EmptyState", (props) => <EmptyState {...props} title="A" />, "div"],
  ["IconButton", (props) => <IconButton aria-label="A" {...props} />, "button"],
  ["Kbd", (props) => <Kbd {...props} shortcut="mod+k" />, "kbd"],
  ["Link", (props) => <Link href="/a" {...props} />, "a"],
  [
    "LoadingOverlay",
    (props) => (
      <LoadingOverlay {...props} visible>
        A
      </LoadingOverlay>
    ),
    "div[aria-busy]",
  ],
  [
    "Pagination",
    (props) => <Pagination onChange={() => {}} {...props} total={45} />,
    "nav",
  ],
  ["Panel", (props) => <Panel {...props} />, "div"],
  [
    "Progress - its bar",
    (props) => <Progress aria-label="A" {...props} value={4} />,
    "div[role=progressbar]",
  ],
  [
    "CircularProgress",
    (props) => <CircularProgress aria-label="A" {...props} value={4} />,
    "div[role=progressbar]",
  ],
  ["Separator", (props) => <Separator {...props} />, "div[role=separator]"],
  [
    "Separator with a label",
    (props) => <Separator label="or" {...props} />,
    "div[role=separator]",
  ],
  ["Skeleton", (props) => <Skeleton {...props} />, "div"],
  [
    "Skeleton of text",
    (props) => <Skeleton lines={2} {...props} variant="text" />,
    "div",
  ],
  ["Sparkline", (props) => <Sparkline data={[1, 2]} {...props} />, "svg"],
  ["Spinner", (props) => <Spinner {...props} />, "div[role=status]"],
  [
    "Splitter",
    (props) => (
      <Splitter {...props}>
        <div>A</div>
        <div>B</div>
      </Splitter>
    ),
    "div[data-orientation]",
  ],
  ["Stat", (props) => <Stat label="A" {...props} value={1} />, "div"],
  [
    "Stepper",
    (props) => (
      <Stepper currentStepId={1} {...props} steps={[{ id: 1, title: "A" }]} />
    ),
    "div[data-orientation]",
  ],
  [
    "Table - the table in its frame",
    (props) => (
      <Table {...props}>
        <TableBody />
      </Table>
    ),
    "table",
  ],
  [
    "TableHead",
    (props) => (
      <table>
        <TableHead {...props} />
      </table>
    ),
    "thead",
  ],
  [
    "TableBody",
    (props) => (
      <table>
        <TableBody {...props} />
      </table>
    ),
    "tbody",
  ],
  [
    "TableFoot",
    (props) => (
      <table>
        <TableFoot {...props} />
      </table>
    ),
    "tfoot",
  ],
  [
    "TableRow",
    (props) => (
      <table>
        <tbody>
          <TableRow {...props} />
        </tbody>
      </table>
    ),
    "tr",
  ],
  [
    "TableCell",
    (props) => (
      <table>
        <tbody>
          <tr>
            <TableCell {...props} />
          </tr>
        </tbody>
      </table>
    ),
    "td",
  ],
  [
    "Tabs - the list of the tabs",
    (props) => <Tabs items={[{ label: "A", value: "a" }]} {...props} />,
    "ul[role=tablist]",
  ],
  [
    "Timeline",
    (props) => <Timeline items={[{ title: "A" }]} {...props} />,
    "ol",
  ],
  [
    "TreeView",
    (props) => (
      <TreeView aria-label="A" items={[{ id: "a", label: "A" }]} {...props} />
    ),
    "ul[role=tree]",
  ],
  [
    "VisuallyHidden",
    (props) => <VisuallyHidden {...props}>A</VisuallyHidden>,
    "span",
  ],
];

describe("The display components", () => {
  it.each(cases)(
    "%s passes its ref and its attributes on to the element",
    (_name, element, expected) => {
      const ref = createRef<HTMLElement | SVGElement>();
      render(
        element({
          "data-testid": "subject",
          ref: ref as React.RefObject<never>,
        }),
      );

      const subject = screen.getByTestId("subject");
      expect(ref.current).toBe(subject);
      expect(subject.matches(expected)).toBe(true);
    },
  );
});
