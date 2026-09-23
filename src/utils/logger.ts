/**
 * Console output of the library. Silent in production builds - bundlers
 * replace `process.env.NODE_ENV` - so failures (a rejected `loadOptions`, an
 * unreadable `localStorage`) reach the developer but not the live app.
 */
const enabled = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    // `process` is not defined and nothing replaced it
    return true;
  }
})();

const logger = {
  error: (...args: unknown[]) => {
    if (enabled) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled) console.warn(...args);
  },
};

export default logger;
