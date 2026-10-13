import { Activity, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DateTimePicker, NumberInput, TagsInput, UIProvider } from "../../src";
import shadowStyles from "./fixture.css?inline";

function Form({ kind }: { kind: string | null }) {
  const [valid, setValid] = useState(false);
  const [submits, setSubmits] = useState(0);
  const [result, setResult] = useState("");
  return (
    <>
      <button onClick={() => setValid(true)} type="button">
        Correct value
      </button>
      <form
        aria-label="Initially hidden fields"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmits((count) => count + 1);
        }}
      >
        <Activity mode="hidden">
          {kind === "tags" ? (
            <TagsInput
              label="Tags"
              name="value"
              required
              value={valid ? ["tag"] : []}
            />
          ) : kind === "date" ? (
            <DateTimePicker
              label="Date"
              max="2026-09-24"
              name="value"
              value={valid ? "2026-09-24" : "2026-09-25"}
            />
          ) : (
            <NumberInput
              label="Quantity"
              max={5}
              name="value"
              value={valid ? 5 : 10}
            />
          )}
        </Activity>
        <button
          onClick={(event) => {
            const form = event.currentTarget.form!;
            setResult(String(form.checkValidity()));
            form.requestSubmit();
          }}
          type="button"
        >
          Check and submit
        </button>
      </form>
      <output aria-label="Validity">{result}</output>
      <output aria-label="Submissions">{submits}</output>
    </>
  );
}

function ShadowApp({ children }: { children: ReactNode }) {
  const [roots, setRoots] = useState<{
    app: HTMLElement;
    portal: HTMLElement;
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

export default function HiddenValidity({
  kind,
  shadow,
}: {
  kind: string | null;
  shadow: boolean;
}) {
  const form = <Form kind={kind} />;
  return shadow ? <ShadowApp>{form}</ShadowApp> : form;
}
