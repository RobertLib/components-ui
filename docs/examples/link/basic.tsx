import { Link } from "components-ui";
import DemoRouter from "../../lib/demo-router";

export default function Basic() {
  return (
    // DemoRouter stands in for your app's router (React Router, Next.js, …)
    <DemoRouter initialPath="/orders/1042">
      <div className="max-w-xl space-y-4 text-sm leading-6">
        <p>
          Order 1042 was placed by{" "}
          <Link href="/customers/42">Jana Nováková</Link> and is waiting for{" "}
          <Link href="/orders/1042/payment">the payment</Link>. Questions go to{" "}
          <Link href="mailto:orders@example.com">orders@example.com</Link>; the
          terms are in the{" "}
          <Link external href="https://example.com/terms">
            general terms and conditions
          </Link>
          .
        </p>
        <ul className="space-y-1">
          <li>
            <Link href="/invoices/2026-0141" underline="hover">
              Invoice 2026-0141
            </Link>{" "}
            - underlined on hover, e.g. in a table or a list
          </li>
          <li>
            <Link color="neutral" href="/orders" underline="none">
              All orders
            </Link>{" "}
            - neutral, never underlined
          </li>
          <li className="text-danger-700 dark:text-danger-400">
            The payment failed -{" "}
            <Link color="inherit" href="/orders/1042/payment">
              try again
            </Link>
          </li>
        </ul>
      </div>
    </DemoRouter>
  );
}
