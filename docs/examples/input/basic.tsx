import { Input } from "components-ui";

export default function Basic() {
  return (
    <div className="grid max-w-md gap-4">
      <Input label="Name" name="name" placeholder="Jana Nováková" />
      <Input label="Email" name="email" required type="email" />
      <Input label="Age" min={0} name="age" type="number" />
    </div>
  );
}
