# Restore VERAX v0.4.9 (proof-pack locked)

This repo contains a preserved proof-pack snapshot for `v0.4.9`, plus the contracts/tests that validate it.

## Restore commands (copy/paste)

```bash
git fetch --tags
git checkout v0.4.9
npm ci
npm test
node scripts/verify-release.js 0.4.9
node bin/verax.js version
```

## Proof-pack location

- Preserved snapshot: `proof-pack/v0.4.9-final/`
- Regenerate (deterministic snapshot): `node scripts/generate-proof-pack.js 0.4.9 --force`

## Optional: pre-push guardrail (local only)

This repo ships a non-enforced helper hook that blocks pushes when:
- `package.json` version disagrees with a `vX.Y.Z` tag on `HEAD`, or
- `npm test` fails.

Install locally (optional):

```bash
cp scripts/hooks/pre-push.sample .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

