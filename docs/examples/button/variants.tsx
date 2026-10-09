import { Button } from "components-ui";

export default function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Solid</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Invitation sent 2 days ago.{" "}
        <Button size="sm" variant="link">
          Resend it
        </Button>
      </p>
      <Button color="danger" size="sm" variant="link">
        Remove the photo
      </Button>
    </div>
  );
}
