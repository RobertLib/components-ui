import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import isPromiseLike from "./is-promise-like";

describe("isPromiseLike", () => {
  it("takes a promise and the thenable of another library or realm", () => {
    // A promise of an iframe, or a Bluebird one - not `instanceof Promise`
    const otherRealm: unknown = runInNewContext("Promise.resolve(1)");
    const thenable = { then: (resolve: (value: number) => void) => resolve(1) };

    expect(otherRealm instanceof Promise).toBe(false);
    expect(isPromiseLike(otherRealm)).toBe(true);
    expect(isPromiseLike(thenable)).toBe(true);
    expect(isPromiseLike(Promise.resolve())).toBe(true);
  });

  it("takes no other value for one", () => {
    for (const value of [undefined, null, false, true, 0, "then", {}, []]) {
      expect(isPromiseLike(value)).toBe(false);
    }
    expect(isPromiseLike({ then: true })).toBe(false);
  });
});
