import { useState } from "react";
import { Button, DataTable, useLocale, type Column } from "components-ui";

interface Part {
  /** An assembly - its parts are loaded when it is expanded. */
  hasParts: boolean;
  /** Unique across the whole bill of materials. */
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

const part = (
  id: string,
  name: string,
  quantity: number,
  unit: string,
  unitCost: number,
  hasParts = false,
): Part => ({ hasParts, id, name, quantity, unit, unitCost });

// The top-level rows - the products
const products: Part[] = [
  part("VZV-25", "Forklift VZV 2.5 t", 1, "pc", 612_400, true),
  part("PVN-20", "Pallet truck PVN 2.0 t", 1, "pc", 18_900, true),
  part("ZPL-08", "Scissor lift ZPL 8 m", 1, "pc", 248_000, true),
];

// What a server would return for each assembly
const partsOf: Record<string, Part[]> = {
  "VZV-25": [
    part("VZV-25-100", "Frame weldment", 1, "pc", 84_500, true),
    part("VZV-25-200", "Hydraulic unit", 1, "pc", 96_200, true),
    part("VZV-25-300", "Mast assembly", 1, "pc", 142_800, true),
    part("VZV-25-900", "Paint RAL 1003", 18, "kg", 410),
  ],
  "VZV-25-100": [
    part("S235-10", "Steel plate S235, 10 mm", 240, "kg", 32),
    part("SVR-G3", "Welding wire G3Si1", 6, "kg", 95),
  ],
  "VZV-25-200": [
    part("HC-2525", "Hydraulic pump HC 25", 1, "pc", 38_400),
    part("HV-4W", "Control valve, 4 ways", 1, "pc", 21_900),
    part("HH-12", 'Hydraulic hose 1/2"', 14, "m", 310),
  ],
  "VZV-25-300": [
    part("ML-3300", "Mast profile 3.3 m", 2, "pc", 41_200),
    part("RC-28", "Lifting chain 28 mm", 7, "m", 1_850),
  ],
  "PVN-20": [
    part("PVN-20-100", "Fork frame", 1, "pc", 7_400),
    part("PVN-20-200", "Pump unit", 1, "pc", 5_900),
    part("KL-80", "Polyurethane wheel 80 mm", 4, "pc", 520),
  ],
  "ZPL-08": [
    part("ZPL-08-100", "Scissor arms", 4, "pc", 28_600),
    part("ZPL-08-200", "Platform 2.4 m", 1, "pc", 36_900),
    part("BAT-24", "Battery 24 V / 240 Ah", 1, "pc", 41_500),
  ],
};

// The hydraulic unit fails at first - try again with the button in its row
const failedOnce = new Set<string>();

/** A request of the parts of an assembly - aborted when it is collapsed. */
function fetchParts(assembly: Part, { signal }: { signal: AbortSignal }) {
  return new Promise<Part[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (assembly.id === "VZV-25-200" && !failedOnce.has(assembly.id)) {
        failedOnce.add(assembly.id);
        reject(new Error("The parts service is not responding"));
        return;
      }
      resolve(partsOf[assembly.id] ?? []);
    }, 800);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

/** An amount in the number format of the language of `UIProvider`. */
function Amount({ value }: { value: number }) {
  const { code } = useLocale();

  return (
    <span className="whitespace-nowrap tabular-nums">
      {new Intl.NumberFormat(code, { maximumFractionDigits: 2 }).format(value)}{" "}
      CZK
    </span>
  );
}

const columns: Column<Part>[] = [
  { key: "id", label: "Part number", width: 200 },
  { key: "name", label: "Name" },
  {
    key: "quantity",
    label: "Qty",
    render: (row) => `${row.quantity} ${row.unit}`,
  },
  {
    key: "unitCost",
    label: "Unit cost",
    render: (row) => <Amount value={row.unitCost} />,
  },
  {
    getValue: (row) => row.quantity * row.unitCost,
    key: "cost",
    label: "Cost",
    render: (row) => <Amount value={row.quantity * row.unitCost} />,
  },
];

const hasParts = (row: Part) => row.hasParts;

export default function TreeLazy() {
  // A new key loads the parts shown again - e.g. after a change of them
  const [version, setVersion] = useState(0);

  return (
    <DataTable
      aria-label="Bill of materials"
      columns={columns}
      data={products}
      hasSubRows={hasParts}
      loadSubRows={fetchParts}
      loadSubRowsKey={version}
      maxHeight="480px"
      pagination={false}
      toolbar={
        <Button
          onClick={() => setVersion((current) => current + 1)}
          size="sm"
          variant="outline"
        >
          Reload parts
        </Button>
      }
    />
  );
}
