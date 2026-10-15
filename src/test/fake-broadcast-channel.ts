/**
 * A `BroadcastChannel` for the tests - it delivers a message at once to the
 * other channels of the same name, as if they were in other tabs. Stub it
 * with `vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel)`.
 */
export default class FakeBroadcastChannel {
  static open = new Set<FakeBroadcastChannel>();

  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  /** What this channel has posted. */
  posted: unknown[] = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.open.add(this);
  }

  /** The open channels of `name`. */
  static named(name: string) {
    return [...FakeBroadcastChannel.open].filter(
      (channel) => channel.name === name,
    );
  }

  close() {
    FakeBroadcastChannel.open.delete(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
    for (const other of FakeBroadcastChannel.named(this.name)) {
      if (other !== this) other.onmessage?.({ data } as MessageEvent);
    }
  }
}
