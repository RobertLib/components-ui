import { Banknote, Clock, ShoppingCart, Users } from "lucide-react";
import { Panel, Stat } from "components-ui";

export default function Grid() {
  return (
    // Columns by the width of the container - two here, four on a wide page
    <div className="@container bg-neutral-100 p-4 dark:bg-neutral-950">
      <div className="grid gap-4 @lg:grid-cols-2 @5xl:grid-cols-4">
        <Panel>
          <Stat
            change={0.125}
            description="vs August"
            formatOptions={{ currency: "EUR", style: "currency" }}
            icon={<Banknote />}
            label="Revenue"
            value={128400}
          />
        </Panel>
        <Panel>
          <Stat
            change={-0.034}
            description="vs August"
            icon={<ShoppingCart />}
            label="Orders"
            value={1842}
          />
        </Panel>
        <Panel>
          {/* Down is good - shorter response times show green */}
          <Stat
            change={-0.18}
            description="vs August"
            icon={<Clock />}
            invertTrend
            label="Response time"
            value="2 h 40 min"
          />
        </Panel>
        <Panel>
          <Stat
            change="+38 new"
            description="this month"
            formatOptions={{ notation: "compact" }}
            icon={<Users />}
            label="Customers"
            trend="up"
            value={12650}
          />
        </Panel>
      </div>
    </div>
  );
}
