import { Copy } from "lucide-react";
import { useState } from "react";
import { Button, ConfirmProvider, usePrompt, useSnackbar } from "components-ui";

// Asks the server whether the name is free
const isNameTaken = (name: string, names: string[]) =>
  new Promise<boolean>((resolve) =>
    setTimeout(
      () =>
        resolve(
          names.some((other) => other.toLowerCase() === name.toLowerCase()),
        ),
      500,
    ),
  );

function OfferList() {
  const prompt = usePrompt();
  const { enqueueSnackbar } = useSnackbar();
  const [offers, setOffers] = useState(["Nabídka 2026-041 Hala Zlín"]);

  const handleDuplicate = async (offer: string) => {
    const name = await prompt({
      confirmLabel: "Duplicate",
      defaultValue: `Kopie - ${offer}`,
      label: "Name of the copy",
      maxLength: 80,
      required: true,
      title: "Duplicate the offer",
      validate: async (value) =>
        (await isNameTaken(value, offers))
          ? "An offer of this name exists already."
          : null,
    });
    if (name === null) return;
    setOffers((current) => [...current, name]);
    enqueueSnackbar(`"${name}" was created`, "success");
  };

  return (
    <ul className="space-y-2">
      {offers.map((offer) => (
        <li
          className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-2 dark:border-neutral-800"
          key={offer}
        >
          <span className="min-w-0 truncate">{offer}</span>
          <Button
            onClick={() => handleDuplicate(offer)}
            size="sm"
            startIcon={<Copy size={14} />}
            variant="outline"
          >
            Duplicate
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function PromptCopyName() {
  return (
    <ConfirmProvider>
      <OfferList />
    </ConfirmProvider>
  );
}
