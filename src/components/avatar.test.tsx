import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar from "./avatar";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

describe("Avatar", () => {
  it("shows the picture, named after the person", () => {
    render(<Avatar name="Jana Nováková" src="/jana.png" />);

    expect(screen.getByRole("img", { name: "Jana Nováková" })).toHaveAttribute(
      "src",
      "/jana.png",
    );
  });

  it("falls back to the initials when the picture fails", () => {
    const { container } = render(<Avatar name="Jana Nováková" src="data:," />);

    fireEvent.error(screen.getByRole("img"));

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("JN")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute(
      "title",
      "Jana Nováková",
    );
  });

  it("names the initials after the person, unless it is decorative", () => {
    render(
      <>
        <Avatar name="Jana Nováková" />
        <Avatar alt="" name="Petr Novák" />
      </>,
    );

    // The initials themselves are not read out
    expect(screen.getByRole("img")).toHaveAccessibleName("Jana Nováková");
    expect(screen.getByText("JN")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("PN").parentElement).not.toHaveAttribute("role");
  });

  it("takes the initials of the first and the last name, as they are read", () => {
    render(
      <>
        <Avatar name="Jan Amos Komenský" />
        {/* "Š" as macOS may hand it over - S and a combining caron */}
        <Avatar name={"Šárka  nováková"} />
        <Avatar name="🚀 Deploy" />
        <Avatar name="Madonna" />
      </>,
    );

    const [jan, sarka, deploy, madonna] = screen.getAllByRole("img");
    expect(jan).toHaveTextContent(/^JK$/);
    expect(sarka).toHaveTextContent(/^ŠN$/);
    // A word without a letter has no initial - no half of an emoji
    expect(deploy).toHaveTextContent(/^D$/);
    expect(madonna).toHaveTextContent(/^M$/);
  });

  it("shows an icon without a picture or a name", () => {
    const { container } = render(<Avatar />);

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("names an avatar with only an alt text", () => {
    render(<Avatar alt="Unknown user" />);

    expect(
      screen.getByRole("img", { name: "Unknown user" }),
    ).toBeInTheDocument();
  });

  it("comes in an extra large size", () => {
    render(<Avatar name="Jana Nováková" size="xl" />);

    expect(screen.getByRole("img")).toHaveClass("h-16", "w-16", "text-xl");
  });
});

describe("Avatar with a status", () => {
  it("tells the status with the name - of a picture too", () => {
    render(
      <>
        <Avatar name="Jana Nováková" src="/jana.png" status="online" />
        <Avatar name="Petr Svoboda" status="busy" />
      </>,
    );

    const jana = screen.getByRole("img", { name: "Jana Nováková, Online" });
    // One image - the picture inside is part of it
    expect(jana.querySelector("img")).toHaveAttribute("alt", "");
    expect(jana).not.toHaveClass("overflow-hidden");
    expect(
      screen.getByRole("img", { name: "Petr Svoboda, Busy" }),
    ).toBeInTheDocument();
    // A pointer shows the status on the dot
    expect(screen.getAllByTitle("Online")).toHaveLength(1);
  });

  it("draws each status in a shape of its own, not by color alone", () => {
    render(
      <>
        <Avatar name="A" status="online" />
        <Avatar name="B" status="busy" />
        <Avatar name="C" status="away" />
        <Avatar name="D" status="offline" />
      </>,
    );

    // The dots - titled with the status alone
    const [online, busy, away, offline] = [
      "Online",
      "Busy",
      "Away",
      "Offline",
    ].map((status) => screen.getByTitle(status).className);
    // A dot, a bar in it, a crescent cut out by the surface, a ring
    expect(online).not.toMatch(/after:|border-2/);
    expect(busy).toMatch(/after:bg-white/);
    expect(away).toMatch(/overflow-hidden.*after:bg-surface/);
    expect(offline).toMatch(/border-2/);
  });

  it("still tells the status of a decorative avatar", () => {
    const { container } = render(
      <Avatar alt="" name="Jana Nováková" status="away" />,
    );

    expect(screen.getByRole("img")).toHaveAccessibleName("Away");
    expect(container.firstElementChild).not.toHaveAttribute("role");
  });

  it("says the status in the language of the page", () => {
    render(
      <UIProvider locale={cs}>
        <Avatar name="Jana Nováková" status="offline" />
        <Avatar status="busy" />
      </UIProvider>,
    );

    expect(
      screen.getByRole("img", { name: "Jana Nováková, Offline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Zaneprázdněno" }),
    ).toBeInTheDocument();
  });
});

describe("Avatar tooltip", () => {
  it("says what the name says, so screen readers do not read the name twice", () => {
    render(<Avatar name="Jana Nováková" status="online" />);

    const avatar = screen.getByRole("img", { name: /Jana Nováková/ });
    expect(avatar).toHaveAttribute("title", avatar.getAttribute("aria-label"));
  });
});
