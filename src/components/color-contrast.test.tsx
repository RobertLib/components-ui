import { render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { describe, expect, it } from "vitest";
import Avatar from "./avatar";
import Button, { type ButtonProps } from "./button";
import Chip, { type ChipColor, type ChipVariant } from "./chip";
import Link from "./link";
import Progress, { CircularProgress, type ProgressProps } from "./progress";
import Stepper from "./stepper";
import Timeline, { type TimelineColor } from "./timeline";
import { colorOf, contrast, pageBackgrounds } from "../test/contrast";

// WCAG 1.4.3 for text, 1.4.11 for focus rings and the parts of graphics
const TEXT = 4.5;
const GRAPHIC = 3;

const MODES = [false, true];

/** The pairs of colors below `minimum`, to name in a failure. */
function lowContrast(pairs: [string, string, string][], minimum: number) {
  return pairs
    .filter(([, first, second]) => contrast(first, second) < minimum)
    .map(
      ([where, first, second]) =>
        `${where}: ${first} on ${second} ${contrast(first, second).toFixed(2)}`,
    );
}

describe("Button", () => {
  const colors: NonNullable<ButtonProps["color"]>[] = [
    "default",
    "primary",
    "secondary",
    "success",
    "danger",
    "warning",
  ];
  const variants: NonNullable<ButtonProps["variant"]>[] = [
    "solid",
    "outline",
    "ghost",
  ];

  const classNamesOf = () =>
    colors.flatMap((color) =>
      variants.map((variant) => {
        const { unmount } = render(
          <Button color={color} variant={variant}>
            Save
          </Button>,
        );
        const { className } = screen.getByRole("button");
        unmount();
        return { className, name: `${color} ${variant}` };
      }),
    );

  it("writes its text at 4.5:1 - on its fill or on the page, also hovered", () => {
    const pairs: [string, string, string][] = [];

    for (const { className, name } of classNamesOf()) {
      for (const dark of MODES) {
        for (const hover of [false, true]) {
          const state = { dark, hover };
          const text = colorOf(className, "text", state);
          const fills = [
            colorOf(className, "from", state),
            colorOf(className, "to", state),
          ].filter((fill) => fill !== undefined);
          const fill = colorOf(className, "bg", state);
          // The gradient at both ends, a flat fill - or the page below
          const backgrounds =
            fills.length > 0 ? fills : fill ? [fill] : pageBackgrounds(dark);

          expect(text, name).toBeDefined();
          for (const background of backgrounds) {
            pairs.push([
              `${name}${dark ? " dark" : ""}${hover ? " hover" : ""}`,
              text!,
              background,
            ]);
          }
        }
      }
    }

    expect(lowContrast(pairs, TEXT)).toEqual([]);
  });

  it("draws its focus ring at 3:1 - clear of a fill of its own color", () => {
    const pairs: [string, string, string][] = [];

    for (const { className, name } of classNamesOf()) {
      for (const dark of MODES) {
        const ring = colorOf(className, "focus:ring", { dark });
        const offset = colorOf(className, "ring-offset", { dark });

        expect(ring, name).toBeDefined();
        // Around the page - and, on a filled button, the gap to the fill
        for (const background of [
          ...pageBackgrounds(dark),
          ...(offset ? [offset] : []),
        ]) {
          pairs.push([`${name}${dark ? " dark" : ""}`, ring!, background]);
        }
        if (name.endsWith("solid")) {
          expect(className, name).toContain("focus:ring-offset-2");
        }
      }
    }

    expect(lowContrast(pairs, GRAPHIC)).toEqual([]);
  });
});

describe("Chip", () => {
  const colors: ChipColor[] = [
    "primary",
    "secondary",
    "success",
    "danger",
    "warning",
    "info",
    "neutral",
  ];

  it("writes its text at 4.5:1 - selected, tinted or on the surface", () => {
    const pairs: [string, string, string][] = [];

    for (const color of colors) {
      for (const variant of [
        "default",
        "outline",
        "solid",
        "selected",
      ] as const) {
        const { unmount } = render(
          variant === "selected" ? (
            <Chip color={color} onSelectedChange={() => {}} selected>
              Paid
            </Chip>
          ) : (
            <Chip color={color} variant={variant as ChipVariant}>
              Paid
            </Chip>
          ),
        );
        const { className } = screen
          .getByText("Paid")
          .closest("span, button") as HTMLElement;
        unmount();

        for (const dark of MODES) {
          pairs.push([
            `${color} ${variant}${dark ? " dark" : ""}`,
            colorOf(className, "text", { dark })!,
            colorOf(className, "bg", { dark })!,
          ]);
        }
      }
    }

    expect(lowContrast(pairs, TEXT)).toEqual([]);
  });
});

describe("Link", () => {
  it("writes each color at 4.5:1 on the page, also hovered", () => {
    const pairs: [string, string, string][] = [];

    for (const color of [
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "neutral",
    ] as const) {
      const { unmount } = render(
        <Link color={color} href="/invoices">
          Invoices
        </Link>,
      );
      const { className } = screen.getByRole("link");
      unmount();

      for (const dark of MODES) {
        for (const hover of [false, true]) {
          for (const background of pageBackgrounds(dark)) {
            pairs.push([
              `${color}${dark ? " dark" : ""}${hover ? " hover" : ""}`,
              colorOf(className, "text", { dark, hover })!,
              background,
            ]);
          }
        }
      }
    }

    expect(lowContrast(pairs, TEXT)).toEqual([]);
  });
});

describe("Timeline", () => {
  it("draws the icon of an item at 4.5:1 on its tint", () => {
    const colors: TimelineColor[] = [
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "info",
      "neutral",
    ];
    const { container } = render(
      <Timeline
        items={colors.map((color) => ({
          color,
          icon: <Check />,
          title: color,
        }))}
      />,
    );

    const pairs: [string, string, string][] = [];
    container.querySelectorAll("svg").forEach((icon, index) => {
      const { className } = icon.parentElement!;
      for (const dark of MODES) {
        pairs.push([
          `${colors[index]}${dark ? " dark" : ""}`,
          colorOf(className, "text", { dark })!,
          colorOf(className, "bg", { dark })!,
        ]);
      }
    });

    expect(pairs).toHaveLength(colors.length * 2);
    expect(lowContrast(pairs, TEXT)).toEqual([]);
  });

  it("draws the dot of an item at 3:1 on the page", () => {
    const colors: TimelineColor[] = [
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "info",
      "neutral",
    ];
    const { container } = render(
      <Timeline items={colors.map((color) => ({ color, title: color }))} />,
    );

    const pairs: [string, string, string][] = [];
    container.querySelectorAll("span.rounded-full").forEach((dot, index) => {
      for (const dark of MODES) {
        for (const page of pageBackgrounds(dark)) {
          pairs.push([
            `${colors[index]}${dark ? " dark" : ""} on ${page}`,
            colorOf(dot.className, "bg", { dark })!,
            page,
          ]);
        }
      }
    });

    expect(pairs).toHaveLength(colors.length * 4);
    expect(lowContrast(pairs, GRAPHIC)).toEqual([]);
  });
});

describe("Progress", () => {
  const variants: NonNullable<ProgressProps["variant"]>[] = [
    "primary",
    "secondary",
    "success",
    "warning",
    "danger",
  ];

  it("fills the bar and the ring at 3:1 against the track", () => {
    const pairs: [string, string, string][] = [];

    for (const variant of variants) {
      const { container, unmount } = render(
        <>
          <Progress aria-label="Bar" value={50} variant={variant} />
          <CircularProgress aria-label="Ring" value={50} variant={variant} />
        </>,
      );
      const track = screen.getByRole("progressbar", { name: "Bar" });
      const fill = track.firstElementChild as HTMLElement;
      const [ringTrack, ring] = Array.from(
        container.querySelectorAll("circle"),
        (circle) => circle.getAttribute("class") ?? "",
      );
      unmount();

      for (const dark of MODES) {
        const mode = dark ? " dark" : "";
        pairs.push(
          [
            `bar ${variant}${mode}`,
            colorOf(fill.className, "bg", { dark })!,
            colorOf(track.className, "bg", { dark })!,
          ],
          [
            `ring ${variant}${mode}`,
            colorOf(ring, "stroke", { dark })!,
            colorOf(ringTrack, "stroke", { dark })!,
          ],
        );
      }
    }

    expect(lowContrast(pairs, GRAPHIC)).toEqual([]);
  });
});

describe("Avatar", () => {
  it("draws the status dot at 3:1 against the surface around it", () => {
    const pairs: [string, string, string][] = [];

    for (const status of ["online", "busy", "away", "offline"] as const) {
      const { unmount } = render(<Avatar name="Jana" status={status} />);
      const dot = screen.getByRole("img").lastElementChild as HTMLElement;
      unmount();

      for (const dark of MODES) {
        // A hollow dot is its ring
        const color =
          colorOf(dot.className, "border", { dark }) ??
          colorOf(dot.className, "bg", { dark });
        pairs.push([
          `${status}${dark ? " dark" : ""}`,
          color!,
          dark ? "surface-dark" : "surface",
        ]);
      }
    }

    expect(lowContrast(pairs, GRAPHIC)).toEqual([]);
  });
});

describe("Stepper", () => {
  it("writes the numbers of the steps at 4.5:1 on their circles", () => {
    const steps = [
      { id: 1, title: "Cart" },
      { hasError: true, id: 2, title: "Address" },
      { id: 3, title: "Payment" },
      { id: 4, title: "Summary" },
    ];
    const pairs: [string, string, string][] = [];

    // Done, failed, current (also failed) and to come - with buttons or not,
    // in a row or a column
    for (const currentStepId of [3, 2]) {
      for (const orientation of ["horizontal", "vertical"] as const) {
        for (const onStepClick of [undefined, () => {}]) {
          const { container, unmount } = render(
            <Stepper
              currentStepId={currentStepId}
              onStepClick={onStepClick}
              orientation={orientation}
              steps={steps}
            />,
          );
          const circles = Array.from(
            container.querySelectorAll<HTMLElement>(
              ".rounded-full.border-2:not(.absolute)",
            ),
          );
          unmount();
          expect(circles).toHaveLength(steps.length);

          circles.forEach((circle, index) => {
            for (const dark of MODES) {
              pairs.push([
                `step ${index + 1} of ${currentStepId}${dark ? " dark" : ""}`,
                colorOf(circle.className, "text", { dark })!,
                colorOf(circle.className, "bg", { dark })!,
              ]);
            }
          });
        }
      }
    }

    expect(lowContrast(pairs, TEXT)).toEqual([]);
  });
});
