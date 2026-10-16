import { Bookmark, ChevronDown, Plus } from "lucide-react";
import { useId, useState } from "react";
import Button from "../button";
import ConfirmDialog from "../confirm-dialog";
import Dialog, { DialogFooter } from "../dialog";
import Dropdown from "../dropdown";
import Input from "../input";
import { formatMessage } from "../../../i18n/ui/format";
import { useMessages } from "../../../providers/ui-context";
import useSavedViews, {
  createViewId,
  getViewQuery,
  isViewModified,
} from "./use-saved-views";
import type { DataTableColumnState, DataTableView } from "./types";
import type { DataTableQuery } from "./query";
import type { DropdownEntry } from "../menu/types";

interface ViewNameDialogProps {
  /** The name the field starts with. */
  initialName: string;
  /** Closes the dialog. */
  onClose: () => void;
  /** Called with the name - trimmed, not empty. */
  onSubmit: (name: string) => void;
  /** Shows the dialog. */
  open: boolean;
  /** Heading of the dialog. */
  title: string;
}

/** A small dialog asking for the name of a view - a new one, or another. */
function ViewNameDialog({
  initialName,
  onClose,
  onSubmit,
  open,
  title,
}: ViewNameDialogProps) {
  const messages = useMessages().ui;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  // Each opening starts from the name it is given
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialName);
      setError(undefined);
    }
  }

  return (
    <Dialog onClose={onClose} open={open} title={title}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // A submit of a form around the table would leave the page
          event.stopPropagation();
          const trimmed = name.trim();
          if (!trimmed) {
            setError(messages.dataTable.views.nameRequired);
            return;
          }
          onSubmit(trimmed);
          onClose();
        }}
      >
        <Input
          autoComplete="off"
          error={error}
          label={messages.dataTable.views.name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          required
          value={name}
        />
        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="outline">
              {messages.common.cancel}
            </Button>
            <Button type="submit">{messages.dataTable.views.save}</Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

interface SavedViewsProps {
  /** Id of the applied view - controlled; `null` for none. */
  activeViewId?: string | null;
  /** The column settings the table shows. */
  columnState: DataTableColumnState;
  /** The query of the last change - a parent may still be about to show it. */
  getLatestQuery: () => DataTableQuery;
  /** Whether two column settings show the columns alike. */
  isSameColumnState: (
    a: DataTableColumnState,
    b: DataTableColumnState,
  ) => boolean;
  /** Called with the id of the view applied, saved or deleted. */
  onActiveViewChange?: (viewId: string | null) => void;
  /** Applies the query and the column settings of a view. */
  onApply: (view: DataTableView) => void;
  /** Called with the user's views whenever they change. */
  onViewsChange?: (views: DataTableView[]) => void;
  /** Views of the app, listed first - they cannot be changed. */
  presetViews?: DataTableView[];
  /** The query the table shows. */
  query: DataTableQuery;
  /** Where the user's uncontrolled views are remembered. */
  tableId?: string;
  /** The user's views - controlled. */
  views?: DataTableView[];
}

/**
 * The views menu of the toolbar (`enableViews`): the presets and the
 * user's views to apply, "Save as a new view…", and updating, renaming and
 * deleting the applied view of the user. Its button names the applied
 * view, with a dot while the table shows other settings - its item is
 * unchecked then, so that picking it again brings them back. Rendered only
 * with views, so that a table without them reads no `localStorage`.
 */
export function SavedViews({
  activeViewId: activeViewIdProp,
  columnState,
  getLatestQuery,
  isSameColumnState,
  onActiveViewChange,
  onApply,
  onViewsChange,
  presetViews,
  query,
  tableId,
  views,
}: SavedViewsProps) {
  const messages = useMessages().ui.dataTable.views;
  const buttonId = useId();

  const [userViews, setUserViews] = useSavedViews(
    tableId,
    views,
    onViewsChange,
  );
  const [internalActiveViewId, setInternalActiveViewId] = useState<
    string | null
  >(null);
  const activeViewId =
    activeViewIdProp === undefined ? internalActiveViewId : activeViewIdProp;
  const allViews = [...(presetViews ?? []), ...userViews];
  const activeView = allViews.find((view) => view.id === activeViewId) ?? null;
  // Only the user's views can be changed - not the presets
  const canEdit =
    activeView !== null &&
    !presetViews?.some((view) => view.id === activeView.id);
  const isModified =
    activeView !== null &&
    isViewModified(activeView, query, columnState, isSameColumnState);

  const changeActiveView = (viewId: string | null) => {
    if (activeViewIdProp === undefined) setInternalActiveViewId(viewId);
    onActiveViewChange?.(viewId);
  };

  /** What the table shows - its settings, as a view keeps them. */
  const captureView = () => ({
    columnState,
    query: getViewQuery(getLatestQuery()),
  });

  /** Replaces the applied view of the user - `null` deletes it. */
  const changeActiveUserView = (
    change: (view: DataTableView) => DataTableView | null,
  ) => {
    if (!activeView || !canEdit) return;
    setUserViews(
      userViews.flatMap((view) => {
        if (view.id !== activeView.id) return [view];
        const changed = change(view);
        return changed ? [changed] : [];
      }),
    );
  };

  // The dialog shown, kept while it animates out - with the name it was
  // opened for, which the deletion takes away
  const [dialog, setDialog] = useState<{
    mode: "create" | "delete" | "rename";
    name: string;
    open: boolean;
  }>({ mode: "create", name: "", open: false });

  const openDialog = (mode: "create" | "delete" | "rename") =>
    setDialog({ mode, name: activeView?.name ?? "", open: true });
  const closeDialog = () =>
    setDialog((current) => ({ ...current, open: false }));

  const items: DropdownEntry[] = [
    allViews.length > 0 && {
      label: messages.label,
      onChange: (id: string) => {
        const view = allViews.find((candidate) => candidate.id === id);
        if (!view) return;
        onApply(view);
        changeActiveView(view.id);
      },
      options: allViews.map((view) => ({ label: view.name, value: view.id })),
      type: "radio",
      // Checked while the table shows it - modified, picking it again
      // brings its settings back
      value: isModified ? undefined : activeView?.id,
    },
    allViews.length > 0 && { type: "separator" },
    {
      icon: <Plus aria-hidden="true" size={16} />,
      label: messages.saveAsNew,
      onClick: () => openDialog("create"),
    },
    canEdit && {
      disabled: !isModified,
      label: formatMessage(messages.update, { name: activeView.name }),
      onClick: () =>
        changeActiveUserView((view) => ({ ...view, ...captureView() })),
    },
    canEdit && { label: messages.rename, onClick: () => openDialog("rename") },
    canEdit && {
      danger: true,
      label: messages.delete,
      onClick: () => openDialog("delete"),
    },
  ];

  const triggerLabel = activeView
    ? formatMessage(isModified ? messages.activeModified : messages.active, {
        name: activeView.name,
      })
    : undefined;

  return (
    <>
      <Dropdown
        buttonTrigger
        items={items}
        trigger={
          <button
            aria-label={triggerLabel}
            className="flex max-w-48 cursor-pointer items-center gap-1 rounded-md border border-neutral-300 px-2 py-0.5 text-sm whitespace-nowrap hover:bg-neutral-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:hover:bg-neutral-900"
            id={buttonId}
            title={triggerLabel}
            type="button"
          >
            <Bookmark aria-hidden="true" className="shrink-0" size={16} />
            <span className="truncate">
              {activeView?.name ?? messages.label}
            </span>
            {isModified && (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-primary-500 forced-colors:bg-[CanvasText]"
              />
            )}
            <ChevronDown aria-hidden="true" className="shrink-0" size={14} />
          </button>
        }
      />
      <ViewNameDialog
        initialName={dialog.mode === "rename" ? dialog.name : ""}
        onClose={closeDialog}
        onSubmit={(name) => {
          if (dialog.mode === "rename") {
            changeActiveUserView((view) => ({ ...view, name }));
            return;
          }
          const view: DataTableView = {
            ...captureView(),
            id: createViewId(),
            name,
          };
          setUserViews([...userViews, view]);
          changeActiveView(view.id);
        }}
        open={dialog.open && dialog.mode !== "delete"}
        title={
          dialog.mode === "rename" ? messages.renameTitle : messages.saveTitle
        }
      />
      <ConfirmDialog
        confirmColor="danger"
        confirmLabel={messages.delete}
        message={formatMessage(messages.deleteMessage, { name: dialog.name })}
        onClose={closeDialog}
        onConfirm={() => {
          changeActiveUserView(() => null);
          changeActiveView(null);
          closeDialog();
        }}
        open={dialog.open && dialog.mode === "delete"}
        title={messages.deleteTitle}
      />
    </>
  );
}
