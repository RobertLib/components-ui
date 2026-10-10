import { createRoot } from "react-dom/client";
import { UIProvider, en } from "../../src";
import {
  CalendarMoveFixture,
  CalendarKeyboardFixture,
  CalendarSlotFixture,
  ChoiceResetActivityFixture,
  ConfirmCompositionFixture,
  CursorPaginationFixture,
  CursorRouterFixture,
  EditorDialogFixture,
  EditorResetActivityFixture,
  EmptyCheckboxGroupFixture,
  DrawerMenuFixture,
  FilterActivityFixture,
  FooterFormFixture,
  FormResetActivityFixture,
  FormValidityActivityFixture,
  LargePercentNumberFixture,
  LoadedPickerValueFixture,
  MenuFixture,
  NewComponentsFixture,
  NamedZoneFixture,
  PinCompositionFixture,
  RowLinksFixture,
  ShadowPopoverFixture,
  ShadowKeyboardFixture,
  SliderDragFixture,
  SplitterDragFixture,
  TableFixture,
  TableResizeFixture,
  UploadActivityFixture,
  UpdatingMenuFixture,
} from "./fixtures";
import "./fixture.css";
import FeatureExpansion, {
  InputValidationFixture,
  PrefilledInputsFixture,
} from "./feature-expansion";

const params = new URLSearchParams(window.location.search);
const container = document.getElementById("root");
if (!container) throw new Error("The browser fixture root is missing.");

createRoot(container).render(
  <UIProvider locale={en}>
    <main>
      {params.get("scenario") === "prefilled-inputs" ? (
        <PrefilledInputsFixture
          controlled={params.get("controlled") === "true"}
        />
      ) : params.get("scenario") === "input-validation" ? (
        <InputValidationFixture />
      ) : params.get("scenario") === "feature-expansion" ? (
        <FeatureExpansion />
      ) : params.get("scenario") === "new-components" ? (
        <NewComponentsFixture />
      ) : params.get("scenario") === "named-zone" ? (
        <NamedZoneFixture />
      ) : params.get("scenario") === "loaded-picker-value" ? (
        <LoadedPickerValueFixture
          type={
            params.get("kind") === "time"
              ? "time"
              : params.get("kind") === "datetime-local"
                ? "datetime-local"
                : params.get("kind") === "month"
                  ? "month"
                  : params.get("kind") === "week"
                    ? "week"
                    : "date"
          }
        />
      ) : params.get("scenario") === "drawer-menu" ? (
        <DrawerMenuFixture />
      ) : params.get("scenario") === "shadow-popover" ? (
        <ShadowPopoverFixture />
      ) : params.get("scenario") === "shadow-keyboard" ? (
        <ShadowKeyboardFixture />
      ) : params.get("scenario") === "calendar-keyboard" ? (
        <CalendarKeyboardFixture timeline={params.get("timeline") === "true"} />
      ) : params.get("scenario") === "pin-composition" ? (
        <PinCompositionFixture
          controlled={params.get("controlled") === "true"}
        />
      ) : params.get("scenario") === "confirm-composition" ? (
        <ConfirmCompositionFixture />
      ) : params.get("scenario") === "footer-form" ? (
        <FooterFormFixture />
      ) : params.get("scenario") === "editor-dialog" ? (
        <EditorDialogFixture />
      ) : params.get("scenario") === "empty-checkbox-group" ? (
        <EmptyCheckboxGroupFixture
          allDisabled={params.get("allDisabled") === "true"}
        />
      ) : params.get("scenario") === "large-percent-number" ? (
        <LargePercentNumberFixture />
      ) : params.get("scenario") === "splitter-drag" ? (
        <SplitterDragFixture />
      ) : params.get("scenario") === "filter-activity" ? (
        <FilterActivityFixture />
      ) : params.get("scenario") === "form-reset-activity" ? (
        <FormResetActivityFixture />
      ) : params.get("scenario") === "form-validity-activity" ? (
        <FormValidityActivityFixture kind={params.get("kind")} />
      ) : params.get("scenario") === "editor-reset-activity" ? (
        <EditorResetActivityFixture
          controlled={params.get("controlled") === "true"}
        />
      ) : params.get("scenario") === "choice-reset-activity" ? (
        <ChoiceResetActivityFixture
          controlled={params.get("controlled") === "true"}
        />
      ) : params.get("scenario") === "upload-activity" ? (
        <UploadActivityFixture />
      ) : params.get("scenario") === "calendar-move" ? (
        <CalendarMoveFixture />
      ) : params.get("scenario") === "calendar-slots" ? (
        <CalendarSlotFixture />
      ) : params.get("scenario") === "slider-drag" ? (
        <SliderDragFixture />
      ) : params.get("scenario") === "table" ? (
        <TableFixture />
      ) : params.get("scenario") === "row-links" ? (
        <RowLinksFixture />
      ) : params.get("scenario") === "table-resize" ? (
        <TableResizeFixture />
      ) : params.get("scenario") === "cursor-pagination" ? (
        <CursorPaginationFixture />
      ) : params.get("scenario") === "cursor-router" ? (
        <CursorRouterFixture />
      ) : params.get("scenario") === "updating-menu" ? (
        <UpdatingMenuFixture kind={params.get("kind")} />
      ) : (
        <MenuFixture kind={params.get("kind")} />
      )}
    </main>
  </UIProvider>,
);
