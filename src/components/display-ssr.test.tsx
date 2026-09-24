import { act, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Avatar from "./avatar";
import AvatarGroup from "./avatar-group";
import Chip from "./chip";
import EmptyState from "./empty-state";
import FileUpload from "./file-upload";
import Link from "./link";
import Progress, { CircularProgress } from "./progress";
import Separator from "./separator";
import Skeleton from "./skeleton";
import Stat from "./stat";
import VisuallyHidden from "./visually-hidden";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

function Page() {
  return (
    <UIProvider locale={cs}>
      <AvatarGroup max={3}>
        <Avatar name="Jana Nováková" status="online" />
        <Avatar alt="" name="Petr Svoboda" status="busy" />
        <Avatar name="Eva Malá" />
        <Avatar name="Karel Dvořák" />
      </AvatarGroup>
      <Chip onRemove={() => {}}>Zaplaceno</Chip>
      <Chip defaultSelected>Moje</Chip>
      <Stat
        change={0.125}
        formatOptions={{ currency: "CZK", style: "currency" }}
        label="Tržby"
        value={128400}
      />
      <Stat label="Objednávky" loading value={undefined} />
      <Progress label="Zpracování" />
      <Progress label="Nahrávání" showPercentage value={40} />
      <CircularProgress aria-label="Kvóta" showPercentage value={73} />
      <CircularProgress aria-label="Načítání" />
      <Separator label="nebo" />
      <Skeleton lines={3} variant="text" />
      <EmptyState description="Zkuste jiné hledání." title="Žádné výsledky" />
      <p>
        Viz <Link href="/zakaznici/42">zákazník</Link> a{" "}
        <Link external href="https://example.com">
          dokumentace
        </Link>
        .
      </p>
      <VisuallyHidden focusable>
        <a href="#obsah">Přeskočit na obsah</a>
      </VisuallyHidden>
      <FileUpload
        defaultAttachments={[{ filename: "foto.jpg", url: "/foto.jpg" }]}
        description="Obrázky do 5 MB"
        label="Přílohy"
        preview
        upload={vi.fn()}
      />
    </UIProvider>
  );
}

describe("Display components on the server", () => {
  it("render to HTML and hydrate without a mismatch", async () => {
    const html = renderToString(<Page />);
    expect(html).toContain("Jana Nováková, Online");
    expect(html).toContain("128 400,00 Kč");
    expect(html).toContain("(otevře se v novém panelu)");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, <Page />, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    // The ids of the server connect the remove button with its chip
    expect(
      within(container).getByRole("button", { name: "Odebrat Zaplaceno" }),
    ).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });
});
