import { Button } from "components-ui";

// `link` renders the router's Link configured in UIProvider -
// here it navigates the docs to another page.
export default function LinkButton() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button link="/components/icon-button" variant="outline">
        Go to IconButton
      </Button>
      <Button disabled link="/components/dropdown" variant="outline">
        Disabled link
      </Button>
    </div>
  );
}
