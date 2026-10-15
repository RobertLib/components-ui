/** The colleagues the examples mention - a Czech company of a dozen people. */
export const colleagues = [
  {
    email: "jana.novakova@firma.cz",
    id: "user:12",
    name: "Jana Nováková",
    role: "Accountant",
  },
  {
    email: "petr.svoboda@firma.cz",
    id: "user:7",
    name: "Petr Svoboda",
    role: "Sales",
  },
  {
    email: "lukas.dvorak@firma.cz",
    id: "user:9",
    name: "Lukáš Dvořák",
    role: "IT",
  },
  {
    email: "tereza.cerna@firma.cz",
    id: "user:21",
    name: "Tereza Černá",
    role: "Warehouse",
  },
  {
    email: "martin.prochazka@firma.cz",
    id: "user:3",
    name: "Martin Procházka",
    role: "CFO",
  },
  {
    email: "eva.kucerova@firma.cz",
    id: "user:18",
    name: "Eva Kučerová",
    role: "Customer care",
  },
  {
    email: "tomas.vesely@firma.cz",
    id: "user:25",
    name: "Tomáš Veselý",
    role: "Logistics",
  },
  {
    email: "lucie.horakova@firma.cz",
    id: "user:30",
    name: "Lucie Horáková",
    role: "HR",
  },
];

/** The support tickets the `#` trigger finds. */
export const tickets = [
  { id: "ticket:1042", state: "Open", title: "Invoice 2026-0042 not sent" },
  { id: "ticket:1043", state: "Waiting", title: "Wrong VAT on credit note" },
  { id: "ticket:1051", state: "Open", title: "Delivery to Brno delayed" },
  {
    id: "ticket:1060",
    state: "Resolved",
    title: "Duplicate payment from Alza",
  },
];

/** Waits like a request - rejects with an `AbortError` once `signal` aborts. */
export const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
