import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  NumberInput,
  PinInput,
  Slider,
  UIProvider,
  useRouter,
  type SliderValue,
} from "../../src";
import shadowStyles from "./fixture.css?inline";

function ShadowApp({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((host: HTMLDivElement | null) => {
    if (!host || host.shadowRoot) return;
    const root = host.attachShadow({ mode: "open" });
    const app = document.createElement("div");
    const style = document.createElement("style");
    style.textContent = shadowStyles;
    root.append(style, app);
    setContainer(app);
  }, []);
  return (
    <>
      <div ref={attach} />
      {container && createPortal(children, container)}
    </>
  );
}

function ShadowNumber() {
  const [changed, setChanged] = useState<number | null>(null);
  return (
    <ShadowApp>
      <NumberInput
        changeOnWheel
        defaultValue={5}
        label="Quantity"
        onChange={setChanged}
      />
      <output aria-label="Changed quantity">{changed}</output>
    </ShadowApp>
  );
}

function ShadowPin() {
  const [value, setValue] = useState("1234");
  return (
    <ShadowApp>
      <PinInput
        label="Verification code"
        length={4}
        onChange={setValue}
        onKeyDownCapture={(event) => {
          if (event.key === "F2") {
            event.preventDefault();
            setValue("");
          }
        }}
        value={value}
      />
    </ShadowApp>
  );
}

function CanceledPin() {
  const [changes, setChanges] = useState(0);
  return (
    <>
      <PinInput
        label="Verification code"
        length={4}
        onChange={() => setChanges((count) => count + 1)}
        onKeyDownCapture={(event) => event.preventDefault()}
      />
      <output aria-label="PIN changes">{changes}</output>
    </>
  );
}

function ChangingSlider({ range }: { range: boolean }) {
  const [defaultValue, setDefaultValue] = useState<SliderValue>(
    range ? [10, 50] : 10,
  );
  const [changed, setChanged] = useState("");
  const [submitted, setSubmitted] = useState("");
  return (
    <form
      aria-label="Changing slider"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(
          JSON.stringify(new FormData(event.currentTarget).getAll("price")),
        );
      }}
    >
      <Slider<SliderValue>
        defaultValue={defaultValue}
        label="Price"
        name="price"
        onChange={(value) => setChanged(JSON.stringify(value))}
        showValue
      />
      <Button
        onClick={() =>
          setDefaultValue((current) => (Array.isArray(current) ? 10 : [10, 50]))
        }
      >
        Switch slider mode
      </Button>
      <Button type="submit">Save slider</Button>
      <output aria-label="Changed slider">{changed}</output>
      <output aria-label="Submitted slider">{submitted}</output>
    </form>
  );
}

function RouterLocation() {
  const router = useRouter();
  return (
    <>
      <Button onClick={() => router.navigate("/orders?page=2")}>
        Navigate after delay
      </Button>
      <output aria-label="Router location">
        {router.pathname + router.search}
      </output>
    </>
  );
}

function DelayedRouter({ replace }: { replace: boolean }) {
  return (
    <UIProvider
      router={{
        navigate: (href) => {
          setTimeout(() => {
            if (replace) window.history.replaceState(null, "", href);
            else window.history.pushState(null, "", href);
          }, 25);
        },
      }}
    >
      <RouterLocation />
    </UIProvider>
  );
}

export default function AuditFixes({ kind }: { kind: string | null }) {
  if (kind === "number") return <ShadowNumber />;
  if (kind === "pin-focus") return <ShadowPin />;
  if (kind === "pin-cancel") return <CanceledPin />;
  if (kind === "delayed-push" || kind === "delayed-replace") {
    return <DelayedRouter replace={kind === "delayed-replace"} />;
  }
  return <ChangingSlider range={kind === "slider-range"} />;
}
