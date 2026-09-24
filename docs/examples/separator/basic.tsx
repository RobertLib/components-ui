import { Bold, Italic, Link, Redo, Undo } from "lucide-react";
import { Button, IconButton, Input, Separator } from "components-ui";

export default function Basic() {
  return (
    <div className="max-w-sm space-y-8">
      {/* A labeled separator between two ways to sign in */}
      <div className="space-y-4">
        <Button className="w-full" color="default" variant="outline">
          Sign in with SSO
        </Button>
        <Separator label="or" />
        <Input label="E-mail" name="email" type="email" />
      </div>

      {/* A section title with a rule */}
      <div>
        <Separator label="Billing address" labelPosition="start" />
        <p className="mt-3 text-sm">Acme s.r.o., Náměstí 1, Brno</p>
      </div>

      {/* Vertical lines between groups of buttons */}
      <div
        aria-label="Formatting"
        className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
        role="group"
      >
        <IconButton aria-label="Undo">
          <Undo size={16} />
        </IconButton>
        <IconButton aria-label="Redo">
          <Redo size={16} />
        </IconButton>
        <Separator className="mx-1" orientation="vertical" />
        <IconButton aria-label="Bold">
          <Bold size={16} />
        </IconButton>
        <IconButton aria-label="Italic">
          <Italic size={16} />
        </IconButton>
        <Separator className="mx-1" orientation="vertical" />
        <IconButton aria-label="Link">
          <Link size={16} />
        </IconButton>
      </div>

      {/* Only for the eye - hidden from screen readers */}
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
        <div className="px-4 py-3 font-medium">Order 1042</div>
        <Separator decorative />
        <div className="px-4 py-3 text-sm">3 items · €1,240.00</div>
      </div>
    </div>
  );
}
