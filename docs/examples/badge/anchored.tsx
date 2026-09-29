import { Mail, ShoppingCart } from "lucide-react";
import { Avatar, Badge, Button } from "components-ui";

export default function Anchored() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <Badge count={5}>
        <Mail aria-hidden="true" size={24} />
      </Badge>
      <Badge color="primary" count={3} placement="bottom-end">
        <ShoppingCart aria-hidden="true" size={24} />
      </Badge>
      {/* On the edge of a round child, not on the corner of its box */}
      <Badge color="success" dot overlap="circular">
        <Avatar name="Jana Nováková" size="lg" />
      </Badge>
      <Badge count={2} overlap="circular" placement="top-start">
        <Avatar name="Petr Svoboda" size="lg" />
      </Badge>
      <Badge count={4}>
        <Button variant="outline">Messages</Button>
      </Badge>
    </div>
  );
}
