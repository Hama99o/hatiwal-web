import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server HTML and during hydration, true once React has hydrated.
 *
 * A form's submit button uses it to stay disabled until its onSubmit is wired:
 * a tap before that (a slow 2G/3G link) made the browser submit natively, and
 * the auth forms' named inputs put the email and password in the URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
