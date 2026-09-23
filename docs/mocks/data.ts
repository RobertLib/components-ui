/** Deterministic sample data of the mock API and the examples. */

export type Role = "Admin" | "Editor" | "Viewer";
export type Status = "active" | "invited" | "suspended";

export interface Person {
  city: string;
  /** `YYYY-MM-DD` */
  createdAt: string;
  department: string;
  email: string;
  firstName: string;
  id: number;
  lastName: string;
  name: string;
  role: Role;
  salary: number;
  status: Status;
}

// Small seeded PRNG (mulberry32) - the same data on every load
function createRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(42);
const pick = <T>(items: readonly T[]) =>
  items[Math.floor(random() * items.length)];

const FIRST_NAMES = [
  "Anna",
  "Anežka",
  "Björn",
  "Carlos",
  "Chloé",
  "Daniel",
  "Eliška",
  "Emma",
  "František",
  "Hana",
  "Ivan",
  "Jakub",
  "Jiří",
  "José",
  "Karolína",
  "Lars",
  "Lucie",
  "Marek",
  "Marie",
  "Martin",
  "Noah",
  "Olivia",
  "Ondřej",
  "Petra",
  "Radek",
  "Sofia",
  "Šimon",
  "Tereza",
  "Tomáš",
  "Věra",
  "William",
  "Zoë",
] as const;

const LAST_NAMES = [
  "Andersen",
  "Bauer",
  "Černý",
  "Dvořák",
  "Fischer",
  "García",
  "Horák",
  "Jansen",
  "Kovář",
  "Král",
  "Lindqvist",
  "Martínez",
  "Müller",
  "Nováková",
  "Novák",
  "Pokorný",
  "Procházka",
  "Rossi",
  "Růžička",
  "Schmidt",
  "Svoboda",
  "Svobodová",
  "Weber",
  "Wilson",
  "Zelený",
] as const;

export const DEPARTMENTS = [
  "Engineering",
  "Finance",
  "Marketing",
  "Sales",
  "Support",
] as const;

export const CITIES = [
  "Berlin",
  "Brno",
  "Lisbon",
  "Madrid",
  "Oslo",
  "Ostrava",
  "Prague",
  "Vienna",
  "Warsaw",
] as const;

const ROLES: Role[] = ["Admin", "Editor", "Viewer", "Viewer", "Editor"];
const STATUSES: Status[] = [
  "active",
  "active",
  "active",
  "invited",
  "suspended",
];

const toAscii = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const people: Person[] = Array.from({ length: 240 }, (_, index) => {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const created = new Date(2022, 0, 1 + Math.floor(random() * 1300));

  return {
    city: pick(CITIES),
    createdAt: `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`,
    department: pick(DEPARTMENTS),
    email: `${toAscii(firstName)}.${toAscii(lastName)}${index}@example.com`,
    firstName,
    id: index + 1,
    lastName,
    name: `${firstName} ${lastName}`,
    role: pick(ROLES),
    salary: 30_000 + Math.round(random() * 90) * 1_000,
    status: pick(STATUSES),
  };
});

/** Options for select filters. */
export const departmentOptions = DEPARTMENTS.map((department) => ({
  label: department,
  value: department,
}));

export const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Invited", value: "invited" },
  { label: "Suspended", value: "suspended" },
];

export const roleOptions = [
  { label: "Admin", value: "Admin" },
  { label: "Editor", value: "Editor" },
  { label: "Viewer", value: "Viewer" },
];
