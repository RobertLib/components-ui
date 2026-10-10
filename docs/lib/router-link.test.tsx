import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import RouterLink from "./router-link";

const current = "/projects/42/settings?tab=current#old";

describe("the documented React Router link adapter", () => {
  it.each([
    ["settings", "/projects/42/settings"],
    ["../reports?sort=asc#top", "/projects/reports?sort=asc#top"],
    ["?tab=archived", "/projects/42/settings?tab=archived"],
    ["#details", "/projects/42/settings?tab=current#details"],
    ["/archive?year=2026", "/archive?year=2026"],
    ["https://example.com/report", "https://example.com/report"],
    ["mailto:help@example.com", "mailto:help@example.com"],
  ])("resolves %s as a browser link", (href, expected) => {
    render(
      <MemoryRouter initialEntries={[current]}>
        <Routes>
          <Route
            path="/projects/:id/:section"
            element={<RouterLink href={href}>Destination</RouterLink>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Destination" })).toHaveAttribute(
      "href",
      expected,
    );
  });

  it("keeps the router basename and navigates relative to the current page", async () => {
    const user = userEvent.setup();
    function Page() {
      const location = useLocation();
      return (
        <>
          <RouterLink href="?tab=archived">Archived</RouterLink>
          <output aria-label="Location">
            {location.pathname + location.search}
          </output>
        </>
      );
    }
    render(
      <MemoryRouter basename="/app" initialEntries={[`/app${current}`]}>
        <Routes>
          <Route path="/projects/:id/:section" element={<Page />} />
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Archived" });
    expect(link).toHaveAttribute(
      "href",
      "/app/projects/42/settings?tab=archived",
    );
    await user.click(link);
    expect(screen.getByLabelText("Location")).toHaveTextContent(
      "/projects/42/settings?tab=archived",
    );
  });
});
