# Portfolio Demo Access Design

## Goal

Allow portfolio visitors to enter IHateGCSE immediately and use the complete site without weakening or changing the existing school-name access path.

## Design

- `GET /demo/portfolio` is a public entry route that creates a separately named, signed demo-session cookie and redirects to `/?demo=portfolio`.
- The homepage shows a one-time notice explaining that this is a demo of a private site.
- Middleware accepts either the existing normal session cookie or the new demo session cookie.
- If both cookies exist, the normal session always takes precedence.
- Written-answer grading resolves the session type server-side. Normal sessions use `OPENROUTER_API_KEY`; demo-only sessions use `OPENROUTER_DEMO_API_KEY`.
- Selection-question marking remains deterministic and unchanged.
- The demo uses the same pages, database, and browser-local progress as the normal site.

## Configuration And Deployment

- Add `OPENROUTER_DEMO_API_KEY` as a server-only environment variable.
- The demo entry can operate without the key, but written-answer marking returns a clear configuration error until it is set.
- The production `.env` remains outside Git and is preserved by the existing deployment workflow.
- The separate OpenRouter key must have a provider-side hard spending limit.

## Safety

- No existing secret is read, displayed, replaced, or copied.
- The existing login route, normal auth cookie, and normal OpenRouter key behavior remain unchanged.
- The public demo URL is intentionally shareable; financial exposure is bounded by the separate key's provider-side hard limit.
