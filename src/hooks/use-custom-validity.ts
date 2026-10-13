import { useId, useInsertionEffect, useLayoutEffect, useRef } from "react";
import { usePortalContainer } from "../providers/ui-context";

/**
 * Tracks which custom error belongs to the component. `validationMessage`
 * hides even custom errors while an input is disabled or read-only, so it
 * cannot tell whether the component's old message is still there.
 */
function trackValidity(input: HTMLInputElement) {
  const own = Object.getOwnPropertyDescriptor(input, "setCustomValidity");
  const original = input.setCustomValidity;
  let ownsError = false;
  let previousMessage: string | undefined;
  let previousPreserveAppError: boolean | undefined;

  // A later call from the app replaces our error, even while the browser
  // hides its message. As with the property watchers of useFormControl,
  // pass the call through and restore the method when the field goes.
  const setCustomValidity = function (this: HTMLInputElement, message: string) {
    original.call(this, message);
    if (this !== input) return;
    ownsError = false;
    // An app clearing its error leaves the constraint of the component in
    // place - React Hook Form's native validation clears every field its
    // own rules pass, and then reports it
    if (!message && previousMessage) {
      original.call(input, previousMessage);
      ownsError = true;
    }
  };
  Object.defineProperty(input, "setCustomValidity", {
    configurable: true,
    writable: true,
    value: setCustomValidity,
  });

  return {
    input,
    update(message: string, preserveAppError: boolean) {
      // A render with the same constraint leaves the app's error alone.
      if (
        message === previousMessage &&
        preserveAppError === previousPreserveAppError
      )
        return;
      previousMessage = message;
      previousPreserveAppError = preserveAppError;

      if (message) {
        // Draft validation can change on every keystroke. An error supplied
        // by the app must survive those temporary component errors too;
        // customError stays observable while disabled or read-only.
        if (preserveAppError && !ownsError && input.validity.customError)
          return;
        original.call(input, message);
        ownsError = true;
      } else if (ownsError) {
        original.call(input, "");
        ownsError = false;
      }
    },
    detach() {
      if (ownsError) {
        original.call(input, "");
        ownsError = false;
      }
      if (input.setCustomValidity !== setCustomValidity) return;
      if (own) Object.defineProperty(input, "setCustomValidity", own);
      else Reflect.deleteProperty(input, "setCustomValidity");
    },
  };
}

/** Sets a field's custom error and clears only errors it set itself. */
export default function useCustomValidity(
  ref: React.RefObject<HTMLInputElement | null>,
  message: string,
  // A draft may temporarily fail constraints without committing a change.
  preserveAppError = false,
) {
  // Activity detaches refs and layout effects while its connected form
  // controls still submit. Keep the last input, also before it needs a
  // custom error, so a constraint changing while hidden follows it too.
  const retainedInput = useRef<HTMLInputElement | null>(null);
  const tracked = useRef<ReturnType<typeof trackValidity> | null>(null);
  const getPortalContainer = usePortalContainer();
  // A distinct attribute per hook also survives nested Input wrappers.
  // Public ids may repeat in separate shadow roots; they are not ownership.
  const marker = `data-ui-validity-${Array.from(useId(), (character) => character.codePointAt(0)!.toString(16)).join("-")}`;

  const update = (input: HTMLInputElement | null) => {
    if (tracked.current?.input !== input) {
      tracked.current?.detach();
      tracked.current = null;
    }
    // Plain inputs need no wrapper until the component sets an error.
    if (!tracked.current && input && message) {
      tracked.current = trackValidity(input);
    }
    tracked.current?.update(message, preserveAppError);
  };

  // Hidden commits still run insertion effects. A removed input no longer
  // needs watching; a hidden one keeps its error and accepts new constraints.
  useInsertionEffect(() => {
    let canceled = false;
    const sync = () => {
      const retained = retainedInput.current;
      let input = ref.current ?? (retained?.isConnected ? retained : null);
      if (!input && message) {
        const roots = [getPortalContainer().getRootNode(), document];
        const visited = new Set<Node>();
        for (const root of roots) {
          if (visited.has(root)) continue;
          visited.add(root);
          if (!(root instanceof Document || root instanceof ShadowRoot))
            continue;
          const element = root.querySelector<HTMLInputElement>(
            `input[${marker}]`,
          );
          if (element) {
            input = element;
            break;
          }
          // Inline fields can live outside the overlay's target root.
          // Search open roots only when a hidden field has no attached ref.
          for (const host of root.querySelectorAll("*")) {
            if (host.shadowRoot) roots.push(host.shadowRoot);
          }
        }
      }
      retainedInput.current = input;
      update(input);
    };
    sync();
    // A hidden subtree's insertion effect can run before its DOM is placed.
    // Finish the lookup after the commit, using only this live revision.
    queueMicrotask(() => {
      if (!canceled) sync();
    });
    return () => {
      canceled = true;
    };
  });

  // Refs attach after insertion effects. Every visible commit also notices
  // a replaced input, e.g. changing a date picker between native and custom.
  useLayoutEffect(() => {
    retainedInput.current = ref.current;
    update(ref.current);
  });

  // Unlike layout cleanups, this follows the actual component lifetime.
  useInsertionEffect(
    () => () => {
      tracked.current?.detach();
      tracked.current = null;
      retainedInput.current = null;
    },
    [],
  );

  // Spread on the actual input, including when rendered through InputBase.
  return { [marker]: "" };
}
