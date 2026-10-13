import { Activity, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  DataTable,
  Dialog,
  Field,
  Input,
  Popover,
  Slider,
  Stepper,
  Tabs,
  TagsInput,
  UIProvider,
  useHotkeys,
} from "../../src";
import { dateTimeZone, inTimeZone } from "../../src/utils/time-zone";
import shadowStyles from "./fixture.css?inline";

function ShadowApp({ children }: { children: ReactNode }) {
  const [roots, setRoots] = useState<{
    app: HTMLDivElement;
    portal: HTMLDivElement;
  } | null>(null);
  const attach = useCallback((host: HTMLDivElement | null) => {
    if (!host || host.shadowRoot) return;
    const shadow = host.attachShadow({ mode: "open" });
    const app = document.createElement("div");
    const portal = document.createElement("div");
    const style = document.createElement("style");
    style.textContent = shadowStyles;
    shadow.append(style, app, portal);
    setRoots({ app, portal });
  }, []);

  return (
    <>
      <div ref={attach} />
      {roots &&
        createPortal(
          <UIProvider portalContainer={roots.portal}>{children}</UIProvider>,
          roots.app,
        )}
    </>
  );
}

function HiddenDialog() {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  useHotkeys([["f2", () => setCount((value) => value + 1)]]);
  return (
    <>
      <Button onClick={() => setVisible(true)}>Show retained dialog</Button>
      <output aria-label="Shortcut count">{count}</output>
      <Activity mode={visible ? "visible" : "hidden"}>
        <span data-testid="hidden-dialog-commit" />
        <Dialog open title="Retained dialog" onClose={() => setVisible(false)}>
          <Input autoFocus label="Retained field" />
        </Dialog>
      </Activity>
    </>
  );
}

function HiddenPopover() {
  const [popupOpen, setPopupOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [closed, setClosed] = useState(0);
  return (
    <>
      <output aria-label="Close count">{closed}</output>
      <Dialog
        open={dialogOpen}
        title="Visible dialog"
        onClose={() => {
          setClosed((count) => count + 1);
          setDialogOpen(false);
        }}
      >
        <Button onClick={() => setPopupOpen(true)}>Open hidden layer</Button>
        <Input autoFocus label="Visible field" />
      </Dialog>
      <Activity mode="hidden">
        <span data-testid="hidden-popover-commit" data-open={popupOpen} />
        <Popover open={popupOpen} trigger={<span>Hidden trigger</span>}>
          Hidden panel
        </Popover>
      </Activity>
    </>
  );
}

function ClosableTabs() {
  const [values, setValues] = useState(["A", "B"]);
  return (
    <Tabs
      items={values.map((value) => ({
        value,
        label: value,
        content: value,
        onClose: () =>
          setValues((current) => current.filter((other) => other !== value)),
      }))}
    />
  );
}

function ChangingSteps() {
  const [step, setStep] = useState("a");
  return (
    <Stepper
      currentStepId={step}
      steps={[
        {
          id: "a",
          title: "A",
          content: <Button onClick={() => setStep("b")}>Next</Button>,
        },
        { id: "b", title: "B", content: <Input label="Second field" /> },
      ]}
    />
  );
}

function CanceledSlider() {
  const [changes, setChanges] = useState(0);
  return (
    <>
      <Slider
        label="Volume"
        defaultValue={50}
        onChange={() => setChanges((count) => count + 1)}
        onKeyDownCapture={(event) => event.preventDefault()}
      />
      <output aria-label="Slider changes">{changes}</output>
    </>
  );
}

const zonedRows = [
  {
    id: 1,
    joined: inTimeZone(new Date("2026-09-25T03:00:00Z"), "America/New_York"),
  },
];

function ZonedDateEditing() {
  const [saved, setSaved] = useState("");
  return (
    <>
      <DataTable
        columns={[{ key: "joined", label: "Joined", editable: true }]}
        data={zonedRows}
        onCellEdit={(_row, _column, value) => {
          if (!(value instanceof Date)) throw new Error("Expected a Date");
          setSaved(`${value.toISOString()}|${dateTimeZone(value)}`);
        }}
      />
      <output aria-label="Saved date">{saved}</output>
    </>
  );
}

export default function FocusRegressions({ kind }: { kind: string | null }) {
  if (kind === "hidden-dialog") return <HiddenDialog />;
  if (kind === "hidden-popover") return <HiddenPopover />;
  if (kind === "slider") return <CanceledSlider />;
  if (kind === "zoned-date") return <ZonedDateEditing />;
  return (
    <ShadowApp>
      {kind === "tabs" ? (
        <ClosableTabs />
      ) : kind === "stepper" ? (
        <ChangingSteps />
      ) : kind === "field" ? (
        <Field label="Volume">
          {(props) => (
            <div
              {...props}
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={50}
            >
              Custom control
            </div>
          )}
        </Field>
      ) : kind === "tags" ? (
        <TagsInput
          label="Suggested tags"
          suggestions={Array.from(
            { length: 50 },
            (_, index) => `Suggestion ${String(index).padStart(2, "0")}`,
          )}
        />
      ) : (
        <Input defaultValue="12345" label="Masked value" mask="### ##" />
      )}
    </ShadowApp>
  );
}
