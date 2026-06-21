// storageState file paths shared by the auth setup and the authed specs.
// Kept in a plain module so specs don't import the setup test file (Playwright
// forbids test→test imports).
export const BUYER_STATE = "e2e/.auth/buyer.json";
export const EMPTY_STATE = "e2e/.auth/empty.json";
