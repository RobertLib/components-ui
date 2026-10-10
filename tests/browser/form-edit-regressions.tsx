import { Activity, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  DataTable,
  FileUpload,
  Input,
  RadioGroup,
  SegmentedControl,
  UIProvider,
  type Column,
} from "../../src";
import shadowStyles from "./fixture.css?inline";

interface DateRow {
  id: number;
  joined: Date;
  name: string;
}

const dateColumns: Column<DateRow>[] = [
  { key: "joined", label: "Joined", editable: true },
  { key: "name", label: "Name", editable: true },
];
const choiceOptions = [
  { label: "First", value: "a" },
  { label: "Second", value: "b" },
];

function DateEditingFixture() {
  const [rows, setRows] = useState<DateRow[]>([
    { id: 1, joined: new Date(2026, 8, 24), name: "Adam" },
  ]);
  const [saved, setSaved] = useState<string[]>([]);

  return (
    <section aria-label="Date cell editing" className="space-y-3">
      <DataTable
        columns={dateColumns}
        data={rows}
        onCellEdit={(row, key, value) => {
          setRows((current) =>
            current.map((item) =>
              item.id === row.id ? { ...item, [key]: value } : item,
            ),
          );
          if (key === "joined" && value instanceof Date) {
            const iso = [
              value.getFullYear(),
              String(value.getMonth() + 1).padStart(2, "0"),
              String(value.getDate()).padStart(2, "0"),
            ].join("-");
            setSaved((current) => [...current, iso]);
          }
        }}
        pagination={false}
      />
      <Input aria-label="Outside date editor" />
      <output aria-label="Saved cell dates">{JSON.stringify(saved)}</output>
    </section>
  );
}

function PendingRemovalFixture() {
  const resolveRemoval = useRef<(() => void) | null>(null);
  const [pending, setPending] = useState(false);
  const [refused, setRefused] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(0);
  const [values, setValues] = useState("");

  return (
    <section aria-label="Pending file removal" className="space-y-3">
      <form
        aria-label="Pending removal form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted((current) => current + 1);
          setValues(JSON.stringify([...new FormData(event.currentTarget)]));
        }}
      >
        <FileUpload
          accept=".pdf"
          defaultAttachments={[
            {
              id: "existing",
              filename: "existing.pdf",
              value: "existing-id",
            },
          ]}
          label="Documents"
          name="documents"
          onError={(_error, file) =>
            setRefused((current) => [...current, file.name])
          }
          onRemove={() => {
            setPending(true);
            return new Promise<void>((resolve) => {
              resolveRemoval.current = resolve;
            });
          }}
        />
        <Button type="submit">Submit removal form</Button>
      </form>
      <Button
        disabled={!pending}
        onClick={() => {
          resolveRemoval.current?.();
          resolveRemoval.current = null;
          setPending(false);
        }}
      >
        Finish attachment removal
      </Button>
      <output aria-label="Removal pending">{String(pending)}</output>
      <output aria-label="Refused files">{JSON.stringify(refused)}</output>
      <output aria-label="Removal form submissions">{submitted}</output>
      <output aria-label="Submitted removal values">{values}</output>
    </section>
  );
}

function UnnamedActivityFixture({
  initiallyHidden,
}: {
  initiallyHidden: boolean;
}) {
  const [visible, setVisible] = useState(!initiallyHidden);
  const [submitted, setSubmitted] = useState("");

  return (
    <section aria-label="Unnamed activity choices" className="space-y-3">
      <Button onClick={() => setVisible((current) => !current)}>
        Toggle unnamed choices
      </Button>
      <form
        aria-label="Unnamed activity form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(JSON.stringify([...new FormData(event.currentTarget)]));
        }}
      >
        <input name="marker" type="hidden" value="kept" />
        <Activity mode={visible ? "visible" : "hidden"}>
          <div className="space-y-3">
            <RadioGroup
              defaultValue="a"
              label="Unnamed radios"
              options={choiceOptions}
            />
            <SegmentedControl
              defaultValue="b"
              label="Unnamed segments"
              options={choiceOptions}
            />
            <RadioGroup
              defaultValue="a"
              label="Named radios"
              name="named-radio"
              options={choiceOptions}
            />
            <SegmentedControl
              defaultValue="b"
              label="Named segments"
              name="named-segment"
              options={choiceOptions}
            />
          </div>
        </Activity>
        <Button type="submit">Submit unnamed choices</Button>
      </form>
      <output aria-label="Unnamed choice visibility">
        {visible ? "visible" : "hidden"}
      </output>
      <output aria-label="Submitted unnamed choices">{submitted}</output>
    </section>
  );
}

export default function FormEditRegressions({
  initiallyHidden,
  shadow,
}: {
  initiallyHidden: boolean;
  shadow: boolean;
}) {
  const [roots, setRoots] = useState<{
    app: HTMLDivElement;
    portal: HTMLDivElement;
  } | null>(null);
  const attachShadow = useCallback((host: HTMLDivElement | null) => {
    if (!host || host.shadowRoot) return;
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = shadowStyles;
    const app = document.createElement("div");
    const portal = document.createElement("div");
    root.append(style, app, portal);
    setRoots({ app, portal });
  }, []);
  const choices = <UnnamedActivityFixture initiallyHidden={initiallyHidden} />;

  return (
    <div className="space-y-8">
      <DateEditingFixture />
      <PendingRemovalFixture />
      {shadow ? (
        <>
          <div ref={attachShadow} />
          {roots &&
            createPortal(
              <UIProvider portalContainer={roots.portal}>{choices}</UIProvider>,
              roots.app,
            )}
        </>
      ) : (
        choices
      )}
    </div>
  );
}
