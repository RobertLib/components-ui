import { Fragment, use, useId, useState } from "react";
import Dialog, { type DialogSize } from "./dialog";
import Kbd from "./kbd";
import { OverlayContext } from "./overlay-stack";
import useHotkeys from "../../hooks/use-hotkeys";
import { useRegisteredHotkeys } from "../../hooks/hotkey-registry";
import { useMessages } from "../../providers/ui-context";
import { matchesShortcut, parseShortcut } from "../../utils/shortcut";

/** A shortcut the app lists in `KeyboardShortcutsDialog` itself. */
export interface KeyboardShortcut {
  /** What the shortcut does, e.g. "Move between the cells". */
  description: string;
  /**
   * The heading it is listed under - the localized "General" without one.
   * The groups come in the order of their first shortcut.
   */
  group?: string;
  /**
   * The shortcut in the syntax of `Kbd` - several for one action, e.g.
   * `["mod+k", "/"]`.
   */
  shortcut: string | string[];
}

export interface KeyboardShortcutsDialogProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "role" | "title"
> {
  /** Classes of the dialog. */
  className?: string;
  /** Uncontrolled: whether the dialog starts open. */
  defaultOpen?: boolean;
  /** Called when the dialog opens or closes - the shortcut, Escape. */
  onOpenChange?: (open: boolean) => void;
  /** Controls whether the dialog is open. */
  open?: boolean;
  /**
   * Opens the dialog from anywhere in the page (and closes it) - see the
   * shortcut syntax on the Kbd page. `null` for none.
   * @default "?"
   */
  shortcut?: string | null;
  /**
   * Shortcuts listed besides those of `useHotkeys` - e.g. the keys of a
   * component that handles them itself (the arrows of a table). They come
   * first in their group.
   */
  shortcuts?: KeyboardShortcut[];
  /** Maximum width of the dialog. */
  size?: DialogSize;
  /** Heading of the dialog - the localized "Keyboard shortcuts" by default. */
  title?: React.ReactNode;
}

/** One line of the list - an action and its shortcuts. */
interface ShortcutRow {
  description: string;
  shortcuts: string[];
}

interface ShortcutGroup {
  /** `undefined` - the shortcuts without a group. */
  name?: string;
  rows: ShortcutRow[];
}

/** Whether a shortcut has a modifier - then it may work in text fields too. */
function hasModifier(shortcut: string) {
  const { alt, ctrl, meta } = parseShortcut(shortcut);
  return alt || ctrl || meta;
}

/**
 * The shortcuts in their groups - the ones without a group first, then the
 * others in the order of their first shortcut. Shortcuts of the same action
 * (description) in a group share a line.
 */
function groupShortcuts(
  entries: { description: string; group?: string; shortcuts: string[] }[],
) {
  const groups = new Map<string | undefined, ShortcutGroup>([
    [undefined, { rows: [] }],
  ]);

  for (const { description, group: name, shortcuts } of entries) {
    const group = groups.get(name) ?? { name, rows: [] };
    groups.set(name, group);

    let row = group.rows.find((other) => other.description === description);
    if (!row) {
      row = { description, shortcuts: [] };
      group.rows.push(row);
    }
    for (const shortcut of shortcuts) {
      // "Mod+K" and "mod+k" are one shortcut
      const known = row.shortcuts.some(
        (other) => other.toLowerCase() === shortcut.toLowerCase(),
      );
      if (!known) row.shortcuts.push(shortcut);
    }
  }

  return [...groups.values()].filter((group) => group.rows.length > 0);
}

interface ShortcutListProps {
  shortcuts: KeyboardShortcut[];
}

/**
 * The shortcuts of the page that work now - rendered in the dialog, whose
 * overlay it leaves out: the shortcuts under it are the ones of the page.
 */
function ShortcutList({ shortcuts }: ShortcutListProps) {
  const messages = useMessages().ui.keyboardShortcuts;
  const overlays = use(OverlayContext);
  const registered = useRegisteredHotkeys(overlays.at(-1));
  const baseId = useId();

  const groups = groupShortcuts([
    ...shortcuts.map((entry) => ({
      ...entry,
      shortcuts: Array.isArray(entry.shortcut)
        ? entry.shortcut
        : [entry.shortcut],
    })),
    ...registered.map((entry) => ({ ...entry, shortcuts: [entry.shortcut] })),
  ]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {messages.empty}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group, groupIndex) => {
        const headingId = `${baseId}-group-${groupIndex}`;
        return (
          <section aria-labelledby={headingId} key={group.name ?? ""}>
            <h3
              className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
              id={headingId}
            >
              {group.name ?? messages.general}
            </h3>
            <dl className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {group.rows.map((row) => (
                <div
                  className="flex items-center justify-between gap-4 py-2"
                  key={row.description}
                >
                  <dt className="min-w-0 text-sm text-neutral-800 dark:text-neutral-200">
                    {row.description}
                  </dt>
                  <dd className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {row.shortcuts.map((shortcut, index) => (
                      <Fragment key={shortcut}>
                        {/* "or" is a word with the spaces around it */}
                        {index > 0 && (
                          <span className="whitespace-pre">{messages.or}</span>
                        )}
                        <Kbd shortcut={shortcut} />
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Lists the keyboard shortcuts of the page in a dialog opened with `?` -
 * those of `useHotkeys` with a `description`, while they work (mounted,
 * enabled, not under a modal dialog), and the `shortcuts` given, in their
 * groups and in the notation of the platform. Render it once, near the root
 * of the app. `ref` and the other props go to the dialog window, as in
 * `Dialog`.
 */
export default function KeyboardShortcutsDialog({
  className,
  defaultOpen = false,
  onKeyDown,
  onOpenChange,
  open,
  shortcut = "?",
  shortcuts = [],
  size = "lg",
  title,
  ...props
}: KeyboardShortcutsDialogProps) {
  const messages = useMessages().ui.keyboardShortcuts;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const changeOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Opens it - and lists itself. In the dialog, the focus is in a modal
  // dialog the page's shortcuts do not reach; the key handler below closes
  // it there.
  useHotkeys(
    shortcut
      ? [
          [
            shortcut,
            // A held key repeats - the dialog opens once
            (event) => {
              if (!event.repeat) changeOpen(!isOpen);
            },
            {
              allowInFields: hasModifier(shortcut),
              description: messages.show,
            },
          ],
        ]
      : [],
    { enabled: !!shortcut },
  );

  return (
    <Dialog
      {...props}
      className={className}
      onClose={() => changeOpen(false)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !shortcut) return;
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          if (!event.repeat) changeOpen(false);
        }
      }}
      open={isOpen}
      size={size}
      title={title ?? messages.title}
    >
      <ShortcutList shortcuts={shortcuts} />
    </Dialog>
  );
}
