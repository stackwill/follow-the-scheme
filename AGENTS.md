# Project Instructions

- User's name is Will.
- Use `bun` over `npm`.
- Verification before completion and test-driven development are not required unless the change is particularly risky, complicated, or explicitly requested.
- Do not make breaking device changes without Will's permission.
- Always use the openrouter image generation skill over `imagegen`; do not use `imagegen` unless very explicitly requested.

## Production Server

- The live self-hosted server is reachable externally at `91.151.248.184`.
- SSH user: `will`.
- SSH port: `42143`.
- Verified on 2026-05-11 with:

```bash
ssh -p 42143 will@91.151.248.184
```

- The host responded as `deployme`.
- Use this host/port for future data-release upload commands unless Will provides newer deployment details.
