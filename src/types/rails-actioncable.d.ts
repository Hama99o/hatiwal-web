// Minimal types for @rails/actioncable (ships no .d.ts) — just what we use.
declare module "@rails/actioncable" {
  export interface Subscription {
    unsubscribe(): void;
    perform(action: string, data?: object): void;
  }
  export interface Subscriptions {
    create(
      params: { channel: string } & Record<string, unknown>,
      mixin: {
        connected?(): void;
        disconnected?(data?: { willAttemptReconnect?: boolean }): void;
        received?(data: unknown): void;
      },
    ): Subscription;
  }
  export interface Consumer {
    subscriptions: Subscriptions;
    connect(): void;
    disconnect(): void;
  }
  /** A function is read on every (re)open — a fresh single-use ticket each time. */
  export function createConsumer(url?: string | (() => string)): Consumer;
}
