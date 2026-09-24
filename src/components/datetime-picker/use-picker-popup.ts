import { useRef, useState } from "react";

/**
 * The open state of a picker's popup, with the refs `PickerField` needs.
 * `canOpen` is false for a disabled or read-only picker.
 */
export default function usePickerPopup(canOpen: boolean) {
  const [isOpen, setIsOpen] = useState(false);
  // Opened with a key, not a click - the time picker then moves the focus
  // into its lists
  const [openedByKeyboard, setOpenedByKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // A picker that turns disabled or read-only closes its popup - which does
  // not open again by itself once it can
  if (isOpen && !canOpen) setIsOpen(false);

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
    isOpen: isOpen && canOpen,
    onOpenChange,
    openedByKeyboard,
  };
}
