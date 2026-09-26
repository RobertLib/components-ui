import { X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Autocomplete,
  Button,
  IconButton,
  Overlay,
  OverlayScope,
  useOverlay,
} from "components-ui";

const cities = [
  { label: "Brno", value: "brno" },
  { label: "Ostrava", value: "ostrava" },
  { label: "Praha", value: "praha" },
];

// A side panel of your own, stacked with the library's overlays: Escape and
// a click on the backdrop close the list of the Autocomplete first, then the
// panel; the focus stays in the panel and the page does not scroll
export default function CustomOverlay() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => setOpen(false);
  const { isTopmost, scope } = useOverlay({
    modal: true,
    onEscape: close,
    open,
    ref: panelRef,
  });
  // Whether the panel was the topmost overlay as the press on the backdrop
  // began: a press that closes the list of the Autocomplete leaves it open
  const pressedOnTopRef = useRef(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Open the filters
      </Button>
      {open &&
        createPortal(
          <>
            <Overlay
              className="z-50"
              onClick={() => {
                if (pressedOnTopRef.current) close();
              }}
              onPointerDown={() => {
                pressedOnTopRef.current = isTopmost();
              }}
              portal={false}
            />
            <div
              aria-labelledby={titleId}
              aria-modal="true"
              className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-full flex-col gap-4 border-l border-neutral-200 bg-surface p-6 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-surface-dark"
              ref={panelRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold" id={titleId}>
                  Filters
                </h2>
                <IconButton aria-label="Close" onClick={close}>
                  <X size={18} />
                </IconButton>
              </div>
              {/* Overlays opened in the panel stack above it */}
              <OverlayScope value={scope}>
                <Autocomplete label="City" options={cities} />
              </OverlayScope>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
