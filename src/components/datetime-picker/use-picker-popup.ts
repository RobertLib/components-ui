import { useRef, useState } from "react";

/** The open state of a picker's popup, with the refs `PickerField` needs. */
export default function usePickerPopup() {
  const [isOpen, setIsOpen] = useState(false);
  // Opened with a key, not a click - the time picker then moves the focus
  // into its lists
  const [openedByKeyboard, setOpenedByKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setIsOpen(false);
    // Back to the field from the popup - but not when the focus has moved
    // on already, e.g. Tab to the next field closed the popup
    if (contentRef.current?.contains(document.activeElement)) {
      inputRef.current?.focus();
    }
  };

  const onOpenChange = (open: boolean, byKeyboard: boolean) => {
    if (!open) {
      close();
      return;
    }

    setIsOpen(true);
    setOpenedByKeyboard(byKeyboard);
  };

  return {
    close,
    contentRef,
    inputRef,
    isOpen,
    onOpenChange,
    openedByKeyboard,
  };
}
