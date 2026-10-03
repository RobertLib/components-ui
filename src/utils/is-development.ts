// A module-local declaration keeps source copies independent of Node types.
// Keep the expression below intact so bundlers can replace it at build time.
declare const process: { env: { NODE_ENV?: string } };

/** Whether development diagnostics should be shown. */
export default function isDevelopment() {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    // An environment without `process` or a bundler replacement.
    return true;
  }
}
