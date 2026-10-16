import type { InputProps } from "./input";
import { toLatinDigit, type MaskTokens } from "./input-mask";

/** The props of a mask of `CZ_MASKS` - spread them onto an `Input`. */
export interface CzMaskPreset {
  /** The kind of value the browser may fill in - `postal-code`. */
  autoComplete?: InputProps["autoComplete"];
  /**
   * `numeric` - the digit keyboard of phones also for a mask with
   * placeholders of its own.
   */
  inputMode?: InputProps["inputMode"];
  /** The `mask` of the field. */
  mask: string;
  /** The placeholders of the mask beyond `#` - an optional digit. */
  maskTokens?: MaskTokens;
}

/** The masks of Czech identifiers - see `CZ_MASKS`. */
export interface CzMasks {
  /**
   * Rodné číslo - `780123/4562`, or the 9 digits of one given before 1954
   * (`530101/123`): the last digit is optional.
   */
  birthNumber: CzMaskPreset;
  /**
   * DIČ - `CZ` and 8 to 10 digits: the IČO of a company, the birth number
   * of a person.
   */
  dic: CzMaskPreset;
  /** A Czech IBAN - `CZ65 0800 0000 1920 0014 5399`. */
  iban: CzMaskPreset;
  /** IČO - 8 digits. */
  ico: CzMaskPreset;
  /** PSČ - `110 00`. */
  postalCode: CzMaskPreset;
}

// A digit the value may end without - of any script, as `#` takes them
const optionalDigit: MaskTokens = {
  "?": {
    optional: true,
    pattern: /^\d$/,
    transform: (char) => toLatinDigit(char) ?? char,
  },
};

/**
 * Masks of Czech identifiers for `Input` - spread one onto the field:
 * `<Input {...CZ_MASKS.ico} label="IČO" validate={cz.ico} />`. A mask
 * checks the shape only - `useCzValidators` checks the value. A bank
 * account number has no mask: its parts are of a varying length.
 * `birthNumber` and `dic` hold functions (their optional digit), which a
 * React Server Component cannot pass on - spread them in a client
 * component.
 */
export const CZ_MASKS: CzMasks = {
  birthNumber: {
    inputMode: "numeric",
    mask: "######/###?",
    maskTokens: optionalDigit,
  },
  dic: {
    inputMode: "numeric",
    mask: "CZ########??",
    maskTokens: optionalDigit,
  },
  iban: { mask: "CZ## #### #### #### #### ####" },
  ico: { mask: "########" },
  postalCode: { autoComplete: "postal-code", mask: "### ##" },
};
