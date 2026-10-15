import { DataTable, useLocale, useSnackbar, type Column } from "components-ui";

interface Account {
  /** Sub-accounts - none for an analytical account. */
  children?: Account[];
  credit: number;
  debit: number;
  /** The account number - unique across all levels. */
  id: string;
  name: string;
}

/** An analytical account with its turnovers. */
const analytical = (id: string, name: string, debit: number, credit = 0) => ({
  credit,
  debit,
  id,
  name,
});

/** A synthetic account or a class - the totals of its sub-accounts. */
const parent = (id: string, name: string, children: Account[]): Account => ({
  children,
  credit: children.reduce((total, account) => total + account.credit, 0),
  debit: children.reduce((total, account) => total + account.debit, 0),
  id,
  name,
});

// A trial balance by the Czech chart of accounts - classes, synthetic and
// analytical accounts
const accounts: Account[] = [
  parent("0", "Long-term assets", [
    parent("01", "Intangible assets", [
      analytical("013100", "ERP licence", 480_000),
      analytical("013200", "CAD software", 210_000),
    ]),
    parent("02", "Tangible assets", [
      analytical("022100", "Production line", 2_350_000),
      analytical("022200", "Delivery vans", 1_180_000, 120_000),
    ]),
  ]),
  parent("2", "Financial accounts", [
    parent("21", "Cash", [
      analytical("211100", "Cash desk Praha", 245_200, 200_000),
      analytical("211200", "Cash desk Brno", 118_700, 100_000),
    ]),
    parent("22", "Bank accounts", [
      analytical("221100", "ČSOB current account", 9_820_400, 8_000_000),
      analytical("221200", "Fio savings account", 3_500_000),
    ]),
  ]),
  parent("3", "Receivables and payables", [
    analytical("311000", "Customers", 12_324_300, 11_400_000),
    analytical("321000", "Suppliers", 5_612_800, 6_225_600),
  ]),
  parent("4", "Equity", [
    analytical("411000", "Share capital", 0, 2_000_000),
    analytical("428000", "Retained earnings", 0, 5_956_300),
  ]),
  parent("5", "Expenses", [
    parent("50", "Consumed purchases", [
      analytical("501000", "Material consumed", 4_870_000),
    ]),
    parent("51", "Services", [
      analytical("511000", "Repairs and maintenance", 312_000),
    ]),
    parent("52", "Personnel expenses", [
      analytical("521000", "Wages", 3_960_000),
      analytical("524000", "Social and health insurance", 1_338_500),
    ]),
  ]),
  parent("6", "Revenue", [
    parent("60", "Sales", [
      analytical("601100", "Products - domestic", 0, 8_240_000),
      analytical("601200", "Products - export (EU)", 0, 3_120_000),
      analytical("602000", "Services", 0, 960_000),
    ]),
  ]),
];

/** An amount in the number format of the language of `UIProvider`. */
function Amount({ value }: { value: number }) {
  const { code } = useLocale();

  return (
    <span className="whitespace-nowrap tabular-nums">
      {new Intl.NumberFormat(code).format(value)} CZK
    </span>
  );
}

const columns: Column<Account>[] = [
  { key: "id", label: "Account", sortable: true, width: 110 },
  { filter: "input", key: "name", label: "Name", sortable: true },
  {
    key: "debit",
    label: "Debit",
    render: (account) => <Amount value={account.debit} />,
    sortable: true,
    summary: "sum",
  },
  {
    key: "credit",
    label: "Credit",
    render: (account) => <Amount value={account.credit} />,
    sortable: true,
    summary: "sum",
  },
];

// Outside the component - the same function on every render
const getSubAccounts = (account: Account) => account.children;

export default function TreeData() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <DataTable
      aria-label="Trial balance"
      // Checking a class checks all of its accounts
      cascadeSelection
      clientSide
      columns={columns}
      data={accounts}
      // The classes start expanded, showing their synthetic accounts
      defaultExpandDepth={1}
      enableCsvExport
      enableGlobalSearch
      exportFilename="trial-balance"
      getRowClassName={(account) =>
        account.children ? "font-semibold" : undefined
      }
      getSubRows={getSubAccounts}
      groupActions={[
        {
          label: "Lock accounts",
          onClick: (rows) =>
            enqueueSnackbar(
              `Locked ${rows.map((account) => account.id).join(", ")}`,
              "success",
            ),
        },
      ]}
      maxHeight="520px"
      // The toggles and the indentation go with the names
      treeColumn="name"
    />
  );
}
