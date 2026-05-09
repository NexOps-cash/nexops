# Chipnet live-test examples

Run from the repository root:

```bash
npm run chipnet:live-test -- \
  --cash scripts/examples/hello-lock.cash \
  --manifest scripts/examples/hello-lock.manifest.json \
  --generate-wallet \
  --inject-pubkey owner
```

- **`--generate-wallet`** creates an ephemeral Chipnet WIF, logs it as JSON (`wallet_generated`), funds it via the public faucet, then runs deploy + spend.
- Faucet funding targets the **CashScript burner payment address** (`burnerPaymentAddress` in logs — typically token-aware `bchtest:r…`). That matches how CashScript builds P2PKH spends; it may differ from the legacy `q…` encoding from some wallet helpers for the same key material.
- **`--inject-pubkey owner`** fills the `owner` constructor argument with the burner’s pubkey hex so deployment matches the same key used for `unlock(sig s)`.

Reproduce later with a saved key:

```bash
npm run chipnet:live-test -- \
  --cash scripts/examples/hello-lock.cash \
  --manifest scripts/examples/hello-lock.manifest.json \
  --wif "$CHIPNET_TEST_WIF" \
  --inject-pubkey owner
```

Stdout is JSON Lines by default (`phase`, `ok`, optional `error`). Failed broadcasts often include strings such as `mandatory-script-verify-flag-failed` and `(code 16)` on the `fatal` / `summary` lines. Use `--no-jsonl` for indented blocks.

Increase waits if the faucet or mempool is slow:

```bash
npm run chipnet:live-test -- ... --poll-timeout-ms 300000
```

This harness can also be imported from TypeScript:

```ts
import { runChipnetLiveTest } from '../../services/chipnetLiveTest/index.ts';
```

(A future in-app “Chipnet labs” panel should call the same `runChipnetLiveTest`.)
