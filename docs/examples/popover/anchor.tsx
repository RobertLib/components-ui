import { Copy, Quote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton, Popover, Tooltip, useSnackbar } from "components-ui";

export default function SelectionToolbar() {
  const textRef = useRef<HTMLParagraphElement>(null);
  // The selected text of the paragraph - the toolbar is placed over it
  const [range, setRange] = useState<Range | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  // Read once the selection is made - with the mouse or Shift + arrows
  const readSelection = () => {
    const selection = document.getSelection();
    const selected =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? selection.getRangeAt(0)
        : null;
    setRange(
      selected && textRef.current?.contains(selected.commonAncestorContainer)
        ? selected
        : null,
    );
  };

  // Gone once the selection is - a click elsewhere
  useEffect(() => {
    const handleChange = () => {
      if (document.getSelection()?.isCollapsed) setRange(null);
    };
    document.addEventListener("selectionchange", handleChange);
    return () => document.removeEventListener("selectionchange", handleChange);
  }, []);

  const act = (message: string) => {
    enqueueSnackbar(`${message}: “${range?.toString()}”`, "success");
    setRange(null);
  };

  return (
    <>
      <p
        className="max-w-prose text-sm leading-relaxed"
        onKeyUp={readSelection}
        onMouseUp={readSelection}
        ref={textRef}
      >
        Select a few words of this paragraph. A toolbar shows over the
        selection, its arrow pointing at the middle of it, and it follows the
        text as the page scrolls. It flips below the selection at the top of the
        screen and hides once the text is scrolled out of view.
      </p>

      <Popover
        align="center"
        anchor={range ? () => range.getBoundingClientRect() : undefined}
        arrow
        contentClassName="max-h-none overflow-visible p-1.5"
        onOpenChange={(open) => {
          if (!open) setRange(null);
        }}
        open={range !== null}
        // A toolbar, not a dialog
        popupRole="none"
        position="top"
        width="auto"
      >
        {/* The buttons keep the selection - a press does not take it */}
        <div
          aria-label="Selected text"
          className="flex gap-1"
          onMouseDown={(event) => event.preventDefault()}
          role="toolbar"
        >
          <Tooltip delay={400} position="bottom" title="Copy">
            <IconButton aria-label="Copy" onClick={() => act("Copied")}>
              <Copy size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip delay={400} position="bottom" title="Quote">
            <IconButton aria-label="Quote" onClick={() => act("Quoted")}>
              <Quote size={16} />
            </IconButton>
          </Tooltip>
        </div>
      </Popover>
    </>
  );
}
