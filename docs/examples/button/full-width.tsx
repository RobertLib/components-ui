import { Button, Input } from "components-ui";

export default function FullWidth() {
  return (
    <form
      className="mx-auto flex max-w-xs flex-col gap-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <Input label="E-mail" name="email" type="email" />
      <Button fullWidth type="submit">
        Sign in
      </Button>
    </form>
  );
}
