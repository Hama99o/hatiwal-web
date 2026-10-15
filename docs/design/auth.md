# Auth pages (`/login`, `/signup`) — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
- Without a Google client id the login card ended in an "OR" divider with nothing under it.
- The header showed a **Login** button on the login and sign-up pages themselves.
- (Prod) the Google button was labelled in the browser's language ("Continuer avec Google" on /en) —
  fixed earlier in b2789e1 (page locale passed to GIS). Prod Google origin rejection: owner config.

## References (Mobbin, web)
- **Etsy — Sign in** — https://mobbin.com/screens/fa8fc983-b057-48da-b5a3-fdca88a38c92
  Email + password + Sign in, then "OR" and "Continue with Google": the divider separates two real
  options. The card offers "Register"; the chrome does not repeat "Sign in".
- **Airbnb — Log in or sign up** — https://mobbin.com/screens/e0a010cf-5be7-4690-a5bd-0ac5dab3d658
  One primary action, "or", then the provider buttons.
- **Etsy — Create your account** — https://mobbin.com/screens/57ade99e-8c4b-4b90-8152-80dd41f32a69
  Same structure for sign-up; inline field errors.

## Decisions
1. The "or" divider moved **inside** `GoogleSignInButton`: both render, or neither.
2. The header's guest **Login** button is hidden on `/login` and `/signup` (each page already links
   to the other).
Proposal (not built — needs new copy in 4 locales): a show/hide toggle on password fields.
