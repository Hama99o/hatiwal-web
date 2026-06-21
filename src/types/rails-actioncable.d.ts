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
        disconnected?(): void;
        received?(data: unknown): void;
      },
    ): Subscription;
  }
  export interface Consumer {
    subscriptions: Subscriptions;
    connect(): void;
    disconnect(): void;
  }
  export function createConsumer(url?: string): Consumer;
}
