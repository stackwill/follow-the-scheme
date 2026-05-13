# Project Instructions

- User's name is Will.
- Use `bun` over `npm`.
- Verification before completion and test-driven development are not required unless the change is particularly risky, complicated, or explicitly requested.
- Do not make breaking device changes without Will's permission.
- Always use the openrouter image generation skill over `imagegen`; do not use `imagegen` unless very explicitly requested.

## Production Server

- The live self-hosted server is reachable externally at `176.20.179.79`.
- SSH user: `will`.
- SSH port: `42143`.
- Updated on 2026-05-13 after the home IP changed. Verify with:

```bash
ssh -p 42143 will@176.20.179.79
```

- The host responded as `deployme`.
- Use this host/port for future data-release upload commands unless Will provides newer deployment details.

## Adding New Papers

- When Will asks to add new papers, follow `docs/start-to-finish.md`.
- The import flow must stop before any production data push until the manual crop review site has been generated, hosted, reviewed by Will, and approved.
- Host only the review site for the papers Will needs to check.
- After Will approves the hosted review site, wait for Will to tell Codex to continue before creating or deploying the data release.
