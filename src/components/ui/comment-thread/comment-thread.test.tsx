import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommentThread, {
  type CommentThreadItem,
  type CommentThreadProps,
} from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";

const MINUTE = 60_000;
const jana = { id: 1, name: "Jana Nováková" };
const petr = { id: 7, name: "Petr Svoboda" };

const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE);

const comments: CommentThreadItem[] = [
  {
    author: petr,
    body: "Faktura je odeslaná, @[Jana Nováková](1) prosím zkontroluj.",
    createdAt: ago(120),
    id: "c1",
    replies: [
      {
        author: jana,
        body: "Díky, vypadá dobře.",
        createdAt: ago(90),
        id: "r1",
      },
    ],
  },
  {
    author: jana,
    body: "Splatnost posunuta na 7. 10.",
    createdAt: ago(5),
    editedAt: ago(3),
    id: "c2",
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const articles = () => screen.getAllByRole("article");
/** A button of the comment itself - the first, before those of its replies. */
const action = (article: HTMLElement, name: string) =>
  within(article).getAllByRole("button", { name })[0];
const status = () =>
  screen
    .getAllByRole("status")
    .map((element) => element.textContent?.trim())
    .filter(Boolean)
    .at(-1);

function Thread(props: Partial<CommentThreadProps>) {
  return (
    <CommentThread
      comments={comments}
      currentUser={jana}
      suggestions={[jana, petr].map(({ id, name }) => ({ id, label: name }))}
      {...props}
    />
  );
}

describe("CommentThread display", () => {
  it("shows the comments with their author, time, mentions and replies", () => {
    render(<Thread getMentionHref={(mention) => `/users/${mention.id}`} />);

    expect(screen.getByRole("list", { name: "Comments" })).toBeVisible();
    const [first, reply, second] = articles();
    expect(first).toHaveAccessibleName("Petr Svoboda 2 hours ago");
    expect(
      within(first).getByRole("link", { name: "@Jana Nováková" }),
    ).toHaveAttribute("href", "/users/1");
    expect(
      screen.getByRole("list", { name: "Replies to Petr Svoboda" }),
    ).toContainElement(reply);
    expect(reply).toHaveTextContent("Díky, vypadá dobře.");
    expect(second).toHaveAccessibleName("Jana Nováková 5 minutes ago (edited)");
    expect(within(second).getByText("5 minutes ago")).toHaveAttribute(
      "dateTime",
      (comments[1].createdAt as Date).toISOString(),
    );
  });

  it("writes the times in Czech, the date and time in a tooltip", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <Thread onSubmit={() => {}} />
      </UIProvider>,
    );

    expect(screen.getByRole("list", { name: "Komentáře" })).toBeVisible();
    const time = screen.getByText("před 5 minutami");
    // A tap shows it at once - a hover after the delay of the tooltip, which
    // a busy test run may stretch past the wait of `findByRole`
    await user.click(time);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/,
    );
    expect(screen.getByText("(upraveno)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Odeslat" })).toBeDisabled();
  });

  it("shows placeholders while loading, and a message without comments", () => {
    const { rerender } = render(<Thread comments={[]} loading />);
    expect(screen.getByText("Loading…").closest("section")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    rerender(<Thread comments={[]} />);
    expect(screen.getByText("No comments yet.")).toBeVisible();
    rerender(<Thread comments={[]} emptyMessage="Be the first." />);
    expect(screen.getByText("Be the first.")).toBeVisible();
  });

  it("renders the attachments of a comment", () => {
    render(
      <Thread
        renderAttachments={(comment) =>
          comment.id === "c2" ? <a href="/files/1">smlouva.pdf</a> : null
        }
      />,
    );
    expect(
      within(articles()[2]).getByRole("link", { name: "smlouva.pdf" }),
    ).toBeVisible();
  });
});

describe("CommentThread composer", () => {
  it("sends with Ctrl + Enter, keeps the text read-only meanwhile and empties after", async () => {
    const user = userEvent.setup();
    let resolve = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    render(<Thread onSubmit={onSubmit} />);

    const field = screen.getByRole("textbox", { name: "New comment" });
    await user.type(field, "Ahoj @pe{Enter}díky");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onSubmit).toHaveBeenCalledWith("Ahoj @[Petr Svoboda](7) díky", {});
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "aria-busy",
      "true",
    );

    await act(async () => resolve());
    expect(field).toHaveValue("");
    expect(field).not.toHaveAttribute("readonly");
    expect(field).toHaveFocus();
  });

  it("keeps the text when sending fails, with the error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server unavailable"))
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce(undefined);
    render(<Thread onSubmit={onSubmit} />);

    const field = screen.getByRole("textbox", { name: "New comment" });
    await user.type(field, "Hotovo");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Server unavailable",
    );
    expect(field).toHaveValue("Hotovo");
    expect(field).toHaveAccessibleDescription("Server unavailable");

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The comment could not be sent.",
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(field).toHaveValue(""));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends nothing empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Thread onSubmit={onSubmit} />);

    const field = screen.getByRole("textbox", { name: "New comment" });
    await user.type(field, "   ");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("has no field without onSubmit", () => {
    render(<Thread />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("CommentThread actions", () => {
  it("edits the own comments inline - Ctrl + Enter or Save", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Thread onEdit={onEdit} />);

    // Only the own ones
    expect(screen.getAllByRole("button", { name: /^Edit/ })).toHaveLength(2);
    const edit = within(articles()[2]).getByRole("button", { name: "Edit" });
    expect(edit).toHaveAccessibleDescription(
      "Jana Nováková 5 minutes ago (edited)",
    );
    await user.click(edit);

    const field = screen.getByRole("textbox", { name: "Edit comment" });
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Splatnost posunuta na 7. 10.");
    await user.type(field, " (@petr{Enter})");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onEdit).toHaveBeenCalledWith(
      comments[1],
      "Splatnost posunuta na 7. 10. (@[Petr Svoboda](7) )",
    );
    expect(screen.queryByRole("textbox", { name: "Edit comment" })).toBeNull();
    expect(
      within(articles()[2]).getByRole("button", { name: "Edit" }),
    ).toHaveFocus();
  });

  it("cancels editing with Escape, and keeps it open when saving fails", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn().mockRejectedValue(new Error("Conflict"));
    render(<Thread canEdit={() => true} onEdit={onEdit} />);

    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    await user.click(action(articles()[0], "Edit"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // An emptied comment is not saved
    await user.click(action(articles()[0], "Edit"));
    await user.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onEdit).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");

    await user.click(action(articles()[0], "Edit"));
    await user.type(screen.getByRole("textbox"), "!");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Conflict");
    expect(screen.getByRole("textbox", { name: "Edit comment" })).toBeVisible();
  });

  it("deletes after a confirmation, and keeps the dialog when it fails", async () => {
    const user = userEvent.setup();
    const onDelete = vi
      .fn()
      .mockRejectedValueOnce(new Error("Forbidden"))
      .mockResolvedValueOnce(undefined);
    render(<Thread onDelete={onDelete} />);

    await user.click(
      within(articles()[2]).getByRole("button", { name: "Delete" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete the comment?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "The comment will be deleted permanently.",
    );

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Forbidden",
    );

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenLastCalledWith(comments[1]);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(status()).toBe("Comment deleted.");
  });

  it("replies one level - also to a reply, under its comment", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Thread allowReplies onSubmit={onSubmit} />);

    // Reply on the reply answers its comment
    await user.click(
      within(articles()[1]).getByRole("button", { name: "Reply" }),
    );
    const field = screen.getByRole("textbox", {
      name: "Reply to Petr Svoboda",
    });
    expect(field).toHaveFocus();
    await user.type(field, "Ok");
    await user.click(
      within(field.closest("article") as HTMLElement).getAllByRole("button", {
        name: "Send",
      })[0],
    );

    expect(onSubmit).toHaveBeenCalledWith("Ok", { parentId: "c1" });
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "Reply to Petr Svoboda" }),
      ).not.toBeInTheDocument(),
    );
    expect(action(articles()[0], "Reply")).toHaveFocus();

    // Escape closes the field
    await user.click(
      within(articles()[2]).getByRole("button", { name: "Reply" }),
    );
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("textbox", { name: "Reply to Jana Nováková" }),
    ).not.toBeInTheDocument();
  });

  it("gives the focus to the first comment once the last older ones load", async () => {
    const user = userEvent.setup();
    function Paged() {
      const [hasMore, setHasMore] = useState(true);
      return (
        <Thread
          hasMore={hasMore}
          onLoadMore={() =>
            new Promise<void>((done) => setTimeout(done, 10)).then(() =>
              setHasMore(false),
            )
          }
        />
      );
    }
    render(<Paged />);

    await user.click(
      screen.getByRole("button", { name: "Load older comments" }),
    );
    await waitFor(() => expect(articles()[0]).toHaveFocus());
  });

  it("loads older comments, and says when it fails", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Thread hasMore onLoadMore={onLoadMore} />);

    await user.click(
      screen.getByRole("button", { name: "Load older comments" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Older comments could not be loaded.",
    );
    await user.click(
      screen.getByRole("button", { name: "Load older comments" }),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});

describe("CommentThread announcements", () => {
  it("announces comments of others added at the end - not older ones, nor the own", () => {
    function Live() {
      const [items, setItems] = useState(comments);
      return (
        <>
          <Thread comments={items} />
          <button
            onClick={() =>
              setItems((current) => [
                ...current,
                { author: petr, body: "Nová", createdAt: new Date(), id: "c3" },
              ])
            }
            type="button"
          >
            Add
          </button>
          <button
            onClick={() =>
              setItems((current) => [
                { author: petr, body: "Stará", createdAt: ago(600), id: "c0" },
                ...current,
              ])
            }
            type="button"
          >
            Older
          </button>
          <button
            onClick={() =>
              setItems((current) => [
                ...current,
                { author: jana, body: "Moje", createdAt: new Date(), id: "c4" },
              ])
            }
            type="button"
          >
            Own
          </button>
        </>
      );
    }
    render(<Live />);

    act(() => screen.getByRole("button", { name: "Older" }).click());
    expect(status()).toBeUndefined();
    act(() => screen.getByRole("button", { name: "Own" }).click());
    expect(status()).toBeUndefined();
    act(() => screen.getByRole("button", { name: "Add" }).click());
    expect(status()).toBe("New comment by Petr Svoboda.");
  });
});
