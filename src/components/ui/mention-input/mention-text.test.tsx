import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MentionText from "./mention-text";
import { renderMentions } from "./render-mentions";
import UIProvider from "../../../providers/ui-provider";

const value =
  "Díky @[Jana Nováková](user:12)!\nViz #[1043](ticket:1043) a jana@firma.cz.";

describe("MentionText", () => {
  it("shows the text with its line breaks and the mentions as chips", () => {
    render(<MentionText data-testid="text" value={value} />);

    const text = screen.getByTestId("text");
    expect(text).toHaveTextContent(
      "Díky @Jana Nováková! Viz #[1043](ticket:1043)",
    );
    expect(text).toHaveClass("whitespace-pre-wrap");
    expect(text.querySelectorAll("[data-mention]")).toHaveLength(1);
    // Only the triggers given are mentions
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links the mentions through the router, never to an unsafe address", () => {
    const visited: string[] = [];
    render(
      <UIProvider
        router={{
          Link: ({ href, ...props }) => (
            <a {...props} data-router="" href={href} />
          ),
          navigate: (href) => visited.push(href),
        }}
      >
        <MentionText
          getMentionHref={(mention) =>
            mention.trigger === "#"
              ? `/tickets/${mention.id.replace("ticket:", "")}`
              : mention.id
          }
          triggers={["@", "#"]}
          value={`${value} @[Eva](javascript:alert(1))`}
        />
      </UIProvider>,
    );

    const ticket = screen.getByRole("link", { name: "#1043" });
    expect(ticket).toHaveAttribute("href", "/tickets/1043");
    expect(ticket).toHaveAttribute("data-router");
    // "user:12" is no address to follow either - a chip then
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("@Eva")).toHaveAttribute("data-mention");
  });

  it("renders the mentions yourself, and as nodes with renderMentions", () => {
    render(
      <>
        <MentionText
          renderMention={(mention, index) => (
            <mark>
              {index}:{mention.label}
            </mark>
          )}
          value={value}
        />
        <p data-testid="nodes">
          {renderMentions("@[Petr](7), @[Eva](3)", {
            getMentionHref: (mention) => `/people/${mention.id}`,
          })}
        </p>
      </>,
    );

    expect(screen.getByText("0:Jana Nováková").tagName).toBe("MARK");
    expect(screen.getByTestId("nodes")).toHaveTextContent("@Petr, @Eva");
    expect(screen.getByRole("link", { name: "@Eva" })).toHaveAttribute(
      "href",
      "/people/3",
    );
  });
});
