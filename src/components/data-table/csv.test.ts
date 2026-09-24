import { describe, expect, it, vi } from "vitest";
import { createCsv, downloadCsv, getCsvSeparator } from "./csv";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import type { Column } from "./types";

interface Task {
  done: boolean;
  due: Date | null;
  hours: number;
  id: number;
  tags: string[];
  title: string;
}

const tasks: Task[] = [
  {
    done: true,
    due: new Date(2026, 8, 24),
    hours: 1234.5,
    id: 1,
    tags: ["alpha", "beta"],
    title: "Report",
  },
  {
    done: false,
    due: null,
    hours: -3,
    id: 2,
    tags: [],
    title: 'Say "hi", then\nleave',
  },
];

const columns: Column<Task>[] = [
  { key: "title", label: "Title" },
  { key: "hours", label: "Hrs", labelTitle: "Hours" },
  { key: "done", label: "Done" },
  { key: "due", label: "Due" },
  { key: "tags", label: "Tags" },
];

const lines = (csv: string) => csv.split("\r\n");

describe("createCsv", () => {
  it("writes a header and a line per row in the order of the columns", () => {
    const csv = createCsv(tasks, columns, { locale: en });

    expect(lines(csv)[0]).toBe("Title,Hours,Done,Due,Tags");
    expect(lines(csv)[1]).toBe('Report,1234.5,Yes,09/24/2026,"alpha, beta"');
  });

  it("quotes fields with separators, quotes and line breaks", () => {
    const csv = createCsv([tasks[1]], [columns[0]], { locale: en });

    expect(csv).toBe('Title\r\n"Say ""hi"", then\nleave"');
  });

  it("writes the values of a language with a decimal comma for its spreadsheets", () => {
    const csv = createCsv(tasks, columns, { locale: cs });

    expect(lines(csv)[0]).toBe("Title;Hours;Done;Due;Tags");
    // No grouping - a spreadsheet reads `1234,5` as a number; a text with
    // a comma is quoted all the same
    expect(lines(csv)[1]).toBe('Report;1234,5;Ano;24.09.2026;"alpha, beta"');
    expect(lines(csv)[2]).toBe('"Say ""hi"", then\nleave";-3;Ne;;');
  });

  it("takes another separator", () => {
    const csv = createCsv([tasks[0]], columns.slice(0, 2), {
      locale: cs,
      separator: "\t",
    });

    expect(csv).toBe("Title\tHours\r\nReport\t1234,5");
  });

  it("keeps texts from starting a formula", () => {
    const rows = ["=SUM(A1:A2)", "+A1", "-2+3", "@cmd", "\tx", "＝1"].map(
      (title, id) => ({ id, title }),
    );
    const csv = createCsv(rows, [{ key: "title", label: "=Title" }], {
      locale: en,
    });

    expect(lines(csv)).toEqual([
      "'=Title",
      "'=SUM(A1:A2)",
      "'+A1",
      "'-2+3",
      "'@cmd",
      // A tab gets quotes too
      '"\'\tx"',
      "'＝1",
    ]);
  });

  it("writes numbers stored as texts without the quote of a formula", () => {
    const rows = ["-3.50", "+1e3", " -12", "+420 777 123 456", "-1-1"].map(
      (amount, id) => ({ amount, id }),
    );
    const csv = createCsv(rows, [{ key: "amount", label: "Amount" }], {
      locale: en,
    });

    // A phone number or a sum is no number - still protected
    expect(lines(csv).slice(1)).toEqual([
      "-3.50",
      "+1e3",
      " -12",
      "'+420 777 123 456",
      "'-1-1",
    ]);
  });

  it("quotes a text with either list separator - a spreadsheet may split at the other", () => {
    const rows = [
      { id: 1, title: "x,=cmd|' /C calc'!A0" },
      { id: 2, title: "x;=cmd|' /C calc'!A0" },
      { id: 3, title: "a\tb" },
    ];
    const titles = [{ key: "title", label: "Title" }];

    expect(lines(createCsv(rows, titles, { locale: cs })).slice(1)).toEqual([
      `"x,=cmd|' /C calc'!A0"`,
      `"x;=cmd|' /C calc'!A0"`,
      '"a\tb"',
    ]);
    expect(lines(createCsv(rows, titles, { locale: en })).slice(1)).toEqual([
      `"x,=cmd|' /C calc'!A0"`,
      `"x;=cmd|' /C calc'!A0"`,
      '"a\tb"',
    ]);
  });

  it("keeps texts from starting a formula after spaces", () => {
    const rows = [" =1+1", "\u00a0=1+1", "\u3000=1+1", "  plain"].map(
      (title, id) => ({ id, title }),
    );
    const csv = createCsv(rows, [{ key: "title", label: "Title" }], {
      locale: en,
    });

    expect(lines(csv).slice(1)).toEqual([
      "' =1+1",
      "'\u00a0=1+1",
      "'\u3000=1+1",
      "  plain",
    ]);
  });

  it("writes negative numbers with a hyphen-minus in every language", () => {
    const csv = createCsv(
      [{ amount: -1234.5, id: 1 }],
      [{ key: "amount", label: "Amount" }],
      { locale: { ...cs, code: "sv-SE" } },
    );

    expect(lines(csv)[1]).toBe("-1234,5");
  });

  it("writes negative numbers as numbers", () => {
    const csv = createCsv([tasks[1]], [columns[1]], { locale: en });

    expect(lines(csv)[1]).toBe("-3");
  });

  it("takes the exportValue of a column and JSON of objects", () => {
    const csv = createCsv(
      [{ id: 1, owner: { name: "Ann" }, title: "Report" }],
      [
        { key: "owner", label: "Owner" },
        {
          exportValue: (row) => row.title.toUpperCase(),
          key: "title",
          label: "Title",
          render: () => "not this",
        },
      ],
      { locale: en },
    );

    expect(lines(csv)[1]).toBe('"{""name"":""Ann""}",REPORT');
  });

  it("uses the getValue of a column", () => {
    const csv = createCsv(
      tasks,
      [{ getValue: (task) => task.tags.length, key: "count", label: "Tags" }],
      { locale: en },
    );

    expect(lines(csv).slice(1)).toEqual(["2", "0"]);
  });
});

describe("getCsvSeparator", () => {
  it("picks a semicolon for languages writing a decimal comma", () => {
    expect(getCsvSeparator("cs-CZ")).toBe(";");
    expect(getCsvSeparator("de-DE")).toBe(";");
    expect(getCsvSeparator("en-US")).toBe(",");
  });
});

describe("downloadCsv", () => {
  it("saves the text with a BOM under a .csv name", async () => {
    let blob: Blob | undefined;
    const createObjectURL = vi.fn((object: Blob) => {
      blob = object;
      return "blob:csv";
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("people.csv");
        expect(this.getAttribute("href")).toBe("blob:csv");
      });

    try {
      downloadCsv("Name\r\nBěla", "people");

      expect(click).toHaveBeenCalledTimes(1);
      expect(blob?.type).toBe("text/csv;charset=utf-8");
      const bytes = new Uint8Array(await (blob as Blob).arrayBuffer());
      // The UTF-8 BOM, then the text
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder().decode(bytes.slice(3))).toBe("Name\r\nBěla");
      // The link is gone again
      expect(document.querySelector("a[download]")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a name that ends with .csv", () => {
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:csv",
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("Report.CSV");
      });

    try {
      downloadCsv("a", "Report.CSV");
      expect(click).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
