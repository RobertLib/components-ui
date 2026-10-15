import { useMemo } from "react";
import { useMessages } from "../providers/ui-context";
import {
  isValidBankAccount,
  isValidBirthNumber,
  isValidDic,
  isValidIban,
  isValidIco,
  isValidPostalCode,
} from "../utils/cz-validators";

/**
 * A check of `useCzValidators`: the message of the locale for an invalid
 * value, `undefined` for a valid or an empty one - an empty string would be
 * an error to React Hook Form.
 */
export type CzValidator = (
  value: string | null | undefined,
) => string | undefined;

/** The checks `useCzValidators` returns - one per identifier. */
export interface UseCzValidatorsResult {
  /** A bank account number - `19-2000145399/0800`. */
  bankAccount: CzValidator;
  /** Rodné číslo - `780123/4562`. */
  birthNumber: CzValidator;
  /** DIČ - `CZ45274649`. */
  dic: CzValidator;
  /** An IBAN of any country - `CZ65 0800 0000 1920 0014 5399`. */
  iban: CzValidator;
  /** IČO - `45274649`. */
  ico: CzValidator;
  /** PSČ - `110 00`. */
  postalCode: CzValidator;
}

const toValidator =
  (isValid: (value: string) => boolean, message: string): CzValidator =>
  (value) => {
    // An empty field is up to `required`
    const text = value == null ? "" : String(value);
    return text.trim() === "" || isValid(text) ? undefined : message;
  };

/**
 * Checks of Czech identifiers with the messages of the locale ("Zadejte
 * platné IČO.") - for `validate` of `Input` (`validate={cz.ico}`) and for
 * `rules.validate` of React Hook Form. The checks stay the same while the
 * locale does. See `isValidIco` and the others for the rules.
 */
export default function useCzValidators(): UseCzValidatorsResult {
  const messages = useMessages().ui.czValidators;

  return useMemo(
    () => ({
      bankAccount: toValidator(isValidBankAccount, messages.bankAccount),
      birthNumber: toValidator(isValidBirthNumber, messages.birthNumber),
      dic: toValidator(isValidDic, messages.dic),
      iban: toValidator(isValidIban, messages.iban),
      ico: toValidator(isValidIco, messages.ico),
      postalCode: toValidator(isValidPostalCode, messages.postalCode),
    }),
    [messages],
  );
}
