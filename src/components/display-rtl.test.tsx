import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Alert from "./alert";
import Avatar from "./avatar";
import Badge from "./badge";
import Breadcrumbs from "./breadcrumbs";
import Card from "./card";
import DescriptionList from "./description-list";
import IconButton from "./icon-button";
import LoadingOverlay from "./loading-overlay";
import Pagination from "./pagination";
import Progress from "./progress";
import Sparkline from "./sparkline";
import Stat from "./stat";
import Stepper from "./stepper";
import Table, { TableBody, TableCell, TableHead, TableRow } from "./table";
import Tabs from "./tabs";

describe("Right-to-left pages", () => {
  it("lay the display and navigation components out by start and end", () => {
    const { container } = render(
      <>
        <Alert
          actions={<button type="button">Retry</button>}
          onClose={() => {}}
        >
          Message
        </Alert>
        <Badge count={3}>
          <Avatar name="Jana" shape="square" status="online" />
        </Badge>
        <Breadcrumbs
          items={[
            { href: "/a", label: "A" },
            { href: "/b", label: "B" },
            { label: "C" },
          ]}
          maxItems={2}
        />
        <Card
          actions={<IconButton aria-label="More" size="sm" />}
          description="Description"
          footer="Footer"
          href="/card"
          title="Card"
        >
          Content
        </Card>
        <DescriptionList
          bordered
          columns={2}
          items={[{ desc: "Jana", term: "Name" }]}
        />
        <LoadingOverlay label="Loading" visible>
          Content
        </LoadingOverlay>
        <Pagination
          currentPage={5}
          pageCount={10}
          pageSizeOptions={[10, 20]}
          showJumpTo
          variant="pages"
        />
        <Progress description="report.pdf" label="Upload" value={40} />
        <Sparkline area data={[1, 2, 3]} highlightLast />
        <Stat label="Revenue" sparkline={[1, 2]} value={3} />
        <Stepper
          currentStepId={1}
          orientation="vertical"
          steps={[{ id: 1, optional: true, title: "One" }]}
        />
        <Table bordered caption="Table" stickyHeader striped>
          <TableHead>
            <TableRow>
              <TableCell>Head</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell align="end">1</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Tabs
          items={[
            { content: "One", label: "One", onClose: () => {}, value: "1" },
          ]}
        />
      </>,
    );

    const physical =
      /^(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|rounded-[lr]|rounded-[tb][lr]|border-[lr]|text-left|text-right)(?:-|$)/;
    // The page size select of Pagination is a Select - its own
    const classes = Array.from(
      container.querySelectorAll("[class]:not(select)"),
      (element) => (element.getAttribute("class") ?? "").split(/\s+/),
    ).flat();
    expect(classes.filter((name) => physical.test(name))).toEqual([]);
  });
});
