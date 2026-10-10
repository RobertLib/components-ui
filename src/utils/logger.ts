import isDevelopment from "./is-development";

/**
 * Console output of the library. Silent in production builds - bundlers
 * replace `process.env.NODE_ENV` - so failures (a rejected `loadOptions`, an
 * unreadable `localStorage`) reach the developer but not the live app.
 */
const enabled = /* @__PURE__ */ isDevelopment();

const logger = {
  error: (...args: unknown[]) => {
    if (enabled) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled) console.warn(...args);
  },
};

export default logger;
