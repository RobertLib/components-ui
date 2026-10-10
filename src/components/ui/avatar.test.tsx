import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, onTestFinished } from "vitest";
import Avatar from "./avatar";
import AvatarGroup from "./avatar-group";
import { colorOf, contrast } from "../../test/contrast";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/ui/cs";

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

  it.each([
    ["falls back to the initials", false, "JN"],
    ["keeps a picture without a size of its own", true, null],
  ])(
    "server-rendered, with a picture done before it hydrates - %s",
    async (_, decodes, initials) => {
      const page = <Avatar name="Jana Nováková" src="/jana.svg" />;
      const container = document.createElement("div");
      container.innerHTML = renderToString(page);
      document.body.append(container);
      onTestFinished(() => container.remove());
      // Loaded or failed before React listened - a failed one decodes not
      const image = container.querySelector("img")!;
      Object.defineProperty(image, "complete", { value: true });
      image.decode = () =>
        decodes ? Promise.resolve() : Promise.reject(new Error("Broken"));

      const root = await act(async () => hydrateRoot(container, page));

      expect(container.querySelector("img") === null).toBe(!decodes);
      if (initials) expect(container).toHaveTextContent(initials);
      act(() => root.unmount());
    },
  );

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
    // Forced colors mode keeps their colors and shapes - it would drop the
    // fills - and the shapes are laid out by start and end
    for (const dot of [online, busy, away, offline]) {
      expect(dot).toMatch(/\bforced-color-adjust-none\b/);
      expect(dot).not.toMatch(/(?:^|[\s:])-?(?:left|right)-/);
    }
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

describe("Avatar shape and color", () => {
  it("is a rounded square with shape square - its status on the corner", () => {
    const { rerender } = render(<Avatar name="Acme" shape="square" />);
    expect(screen.getByRole("img", { name: "Acme" })).toHaveClass("rounded");
    expect(screen.getByRole("img", { name: "Acme" })).not.toHaveClass(
      "rounded-full",
    );

    rerender(<Avatar name="Acme" shape="square" size="xl" status="online" />);
    const avatar = screen.getByRole("img", { name: "Acme, Online" });
    expect(avatar).toHaveClass("rounded-xl");
    expect(avatar.lastElementChild).toHaveClass("-inset-e-0.5", "-bottom-0.5");
  });

  it("picks the same color for a name - different ones for different names", () => {
    const classOf = (name: string) => {
      const { unmount } = render(<Avatar color="auto" name={name} />);
      const { className } = screen.getByRole("img");
      unmount();
      return className.split(/\s+/).find((token) => token.startsWith("bg-"));
    };

    expect(classOf("Jana Nováková")).toBe(classOf("Jana Nováková"));
    const colors = new Set(
      [
        "Jana Nováková",
        "Petr Svoboda",
        "Eva Malá",
        "Karel Dvořák",
        "Lucie Černá",
        "Tomáš Procházka",
        "Anna Veselá",
        "Martin Kučera",
      ].map(classOf),
    );
    expect(colors.size).toBeGreaterThan(2);
  });

  it("keeps the primary color by default and takes one given", () => {
    const { rerender } = render(<Avatar name="Jana" />);
    expect(screen.getByRole("img")).toHaveClass("bg-primary-100");

    rerender(<Avatar color="success" name="Jana" />);
    expect(screen.getByRole("img")).toHaveClass(
      "bg-success-100",
      "text-success-800",
    );
  });

  it("writes the initials at 4.5:1 in every color", () => {
    const low: string[] = [];

    for (const color of [
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "info",
    ] as const) {
      const { unmount } = render(<Avatar color={color} name="Jana" />);
      const { className } = screen.getByRole("img");
      unmount();

      for (const dark of [false, true]) {
        const text = colorOf(className, "text", { dark })!;
        const fill = colorOf(className, "bg", { dark })!;
        if (contrast(text, fill) < 4.5) {
          low.push(`${color}${dark ? " dark" : ""}: ${text} on ${fill}`);
        }
      }
    }

    expect(low).toEqual([]);
  });

  it("gives its shape to the avatars of a group and the +N", () => {
    render(
      <AvatarGroup max={2} shape="square">
        <Avatar name="Acme" />
        <Avatar name="Globex" shape="circle" />
        <Avatar name="Initech" />
      </AvatarGroup>,
    );

    expect(screen.getByRole("img", { name: "Acme" })).toHaveClass("rounded");
    expect(screen.getByRole("button", { name: "+2 more" })).toHaveClass(
      "rounded",
    );
  });
});

describe("Avatar of a size in pixels", () => {
  it("is as big as the number says, with initials to fit", () => {
    render(<Avatar name="Jana Nováková" shape="square" size={40} />);

    const avatar = screen.getByRole("img", { name: "Jana Nováková" });
    expect(avatar).toHaveStyle({
      fontSize: "16px",
      height: "40px",
      width: "40px",
    });
    expect(avatar.className).not.toMatch(/\bh-(6|8|12|16)\b/);
    // The corners of the named size closest to it
    expect(avatar).toHaveClass("rounded-md");
  });
});
