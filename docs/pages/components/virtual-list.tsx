import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function VirtualListPage() {
  return (
    <DocPage
      imports={["VirtualList", "useVirtualList", "type VirtualListHandle"]}
      title="VirtualList"
    >
      <Example
        description={
          <p>
            Only the items in view - and <code>overscan</code> items above and
            below - are rendered, so 10 000 of them scroll as smoothly as 10.
            The items can be of any height: each rendered one is measured, the
            others are estimated (<code>estimateSize</code>, refined by the
            average of those measured). Give the list a <code>height</code> or{" "}
            <code>maxHeight</code>, and pad the items with{" "}
            <code>itemClassName</code> rather than give them margins, which are
            not measured. <code>handleRef</code> gives{" "}
            <code>scrollToIndex(index, {"{ align, behavior }"})</code> - it
            scrolls to an item that is not rendered too, and places it again as
            the items it passed are measured.
          </p>
        }
        name="virtual-list/basic"
        title="10 000 items of different heights"
      />
      <Example
        description={
          <p>
            <code>onEndReached</code> is called as the view comes within{" "}
            <code>endReachedThreshold</code> (200 px) of the end - once for each
            length of <code>items</code>, and at once for a list too short to
            fill the view - until <code>hasMore</code> is <code>false</code>. A
            returned promise shows a loading row while it is pending, and an
            error row with &quot;Try again&quot; when it rejects -{" "}
            <code>loadingMore</code> and <code>loadMoreError</code> show them
            for an app that tracks the request itself. <code>itemCount</code> is
            the number of all items, e.g. the total of the server. Turn on the
            switch, scroll down, then turn it off and try again.
          </p>
        }
        name="virtual-list/infinite"
        title="Infinite scroll"
      />
      <Example
        description={
          <p>
            A chat starts at its last message (
            <code>scrollToIndex(last, {'{ align: "end" }'})</code> in an effect)
            and loads older messages as the view nears the top:{" "}
            <code>onStartReached</code> puts them before the others and the view
            stays on the messages it showed - give <code>getItemKey</code>, so
            that the measured heights and the focus stay with their messages. A
            message sent scrolls to the end.
          </p>
        }
        name="virtual-list/chat"
        title="Chat: loading older messages"
      />
      <Example
        description={
          <p>
            With <code>useWindowScroll</code> the page scrolls the list - it
            takes the height of all its items, and <code>height</code> and{" "}
            <code>maxHeight</code> are not used. For a feed that is the page
            itself.
          </p>
        }
        name="virtual-list/window-scroll"
        title="Scrolling with the page"
      />
      <Example
        description={
          <p>
            <code>useVirtualList</code> virtualizes markup of your own, e.g. a{" "}
            <code>{"<ul>"}</code> or a grid of cards in rows. Put{" "}
            <code>scrollRef</code> on the scroll container - positioned, with{" "}
            <code>overflow-y: auto</code> and a height; <code>listRef</code> and{" "}
            <code>listStyle</code> on the element around the items, which must
            not be padded otherwise; and <code>measureRef</code>,{" "}
            <code>data-index</code> and the <code>style</code> of the virtual
            item on each item. Make the container a Tab stop, and give the items
            their position, as <code>VirtualList</code> does.
          </p>
        }
        name="virtual-list/hook"
        title="The hook: markup of your own"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            The list is a <code>role=&quot;list&quot;</code> of{" "}
            <code>listitem</code>s that tell screen readers their position -{" "}
            <code>aria-posinset</code> and <code>aria-setsize</code>, the number
            of all items: <code>itemCount</code>, the length of{" "}
            <code>items</code>, or -1 (unknown) while <code>onEndReached</code>{" "}
            may bring more. Name it with <code>aria-label</code> or{" "}
            <code>aria-labelledby</code>.
          </p>
          <p>
            The scroll container is a Tab stop, so the arrow keys and Page Up /
            Down scroll it - and, when the list has a name, a region of that
            name. An item with the focus stays rendered while it is scrolled out
            of view, so the focus is not lost. The loading rows are live regions
            - screen readers hear &quot;Loading more…&quot; - and the error row
            is an alert.
          </p>
        </Prose>
      </Section>

      <Callout title="Server rendering">
        <p>
          The server renders the first items - as many as fill a numeric{" "}
          <code>height</code> or <code>maxHeight</code> at the{" "}
          <code>estimateSize</code>, and <code>overscan</code> more (20 for a
          list without one). In the browser the list measures them and renders
          those in view from then on.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="VirtualList" />
        <PropsTable of="VirtualListHandle" />
        <PropsTable of="VirtualListScrollOptions" />
        <PropsTable of="UseVirtualListOptions" />
        <PropsTable of="UseVirtualListResult" />
        <PropsTable of="VirtualItem" />
      </Section>
    </DocPage>
  );
}
