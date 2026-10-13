import { Activity, useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Dialog,
  Dropdown,
  OverlayScope,
  UIProvider,
  useOverlay,
} from "../../src";
import shadowStyles from "./fixture.css?inline";

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #ccc",
  left: 16,
  maxWidth: "calc(100vw - 32px)",
  padding: 16,
  position: "fixed",
  top: 80,
  width: 360,
  zIndex: 50,
};

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

export function FieldsetDropdownFixture({
  inLegend = false,
}: {
  inLegend?: boolean;
}) {
  const [disabled, setDisabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState(0);
  const dropdown = (
    <Dropdown
      buttonTrigger
      items={[
        {
          keepOpen: true,
          label: "Disable actions",
          onClick: () => setDisabled(true),
        },
        { label: "Delete", onClick: () => setActions((count) => count + 1) },
      ]}
      onOpenChange={setOpen}
      trigger={<Button>Actions</Button>}
    />
  );
  return (
    <>
      <fieldset disabled={disabled}>
        {inLegend ? <legend>{dropdown}</legend> : dropdown}
      </fieldset>
      <Button onClick={() => setDisabled(false)}>Enable actions</Button>
      <output aria-label="Menu open">{String(open)}</output>
      <output aria-label="Delete count">{actions}</output>
    </>
  );
}

function RetainedCustomModal({
  autoFocus,
  close,
}: {
  autoFocus: boolean;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scope } = useOverlay({
    modal: true,
    onEscape: close,
    open: true,
    ref,
  });
  return (
    <div
      aria-label="Custom filters"
      aria-modal="true"
      ref={ref}
      role="dialog"
      style={panelStyle}
      tabIndex={-1}
    >
      <OverlayScope value={scope}>
        <input aria-label="Custom search" autoFocus={autoFocus} />
      </OverlayScope>
    </div>
  );
}

export function HiddenCustomModalFixture({
  autoFocus = false,
}: {
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button onClick={() => setVisible(true)}>Show filters</Button>
      <Button onClick={() => setVisible(true)}>Show other filters</Button>
      <Activity mode={visible ? "visible" : "hidden"}>
        <span data-testid="retained-overlay-commit" />
        <RetainedCustomModal
          autoFocus={autoFocus}
          close={() => setVisible(false)}
        />
      </Activity>
    </>
  );
}

export function NestedCustomModalFixture() {
  const [open, setOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { scope } = useOverlay({ modal: true, open, ref });
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open filters</Button>
      <OverlayScope value={scope}>
        {open &&
          createPortal(
            <div
              aria-label="Filters"
              aria-modal="true"
              ref={ref}
              role="dialog"
              style={panelStyle}
              tabIndex={-1}
            >
              <Button onClick={() => setChildOpen(true)}>Confirm action</Button>
            </div>,
            document.body,
          )}
        <Dialog
          open={childOpen}
          onClose={() => setChildOpen(false)}
          title="Confirm"
        >
          <input aria-label="Child field" autoFocus />
          <Button onClick={() => setOpen(false)}>Close parent</Button>
        </Dialog>
      </OverlayScope>
    </>
  );
}

export default function OverlayAuditFixes({ kind }: { kind: string | null }) {
  if (kind === "fieldset") return <FieldsetDropdownFixture />;
  if (kind === "fieldset-legend") return <FieldsetDropdownFixture inLegend />;
  if (kind === "nested-modal") return <NestedCustomModalFixture />;
  if (kind === "shadow-hidden")
    return (
      <ShadowApp>
        <HiddenCustomModalFixture autoFocus />
      </ShadowApp>
    );
  return <HiddenCustomModalFixture autoFocus={kind === "hidden-autofocus"} />;
}
