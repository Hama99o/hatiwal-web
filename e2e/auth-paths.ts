// storageState file paths shared by the auth setup and the authed specs.
// Kept in a plain module so specs don't import the setup test file (Playwright
// forbids test→test imports).
// A storageState's localStorage is keyed by ORIGIN, so a suite running on an
// overridden port (E2E_WEB_PORT) needs its own files — otherwise two concurrent
// runs clobber each other's state and the loser loses its localStorage (e.g. the
// "onboarding seen" flag, whose modal then covers the page).
const SUFFIX = process.env.E2E_WEB_PORT ? `-${process.env.E2E_WEB_PORT}` : "";

export const BUYER_STATE = `e2e/.auth/buyer${SUFFIX}.json`;
export const EMPTY_STATE = `e2e/.auth/empty${SUFFIX}.json`;
