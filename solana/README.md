# Solana

On-chain programs and their application integrations. This directory replaces the
former `anchor/` workspace and blockchain modules previously mixed into `lib/`.

| Path | Purpose |
| --- | --- |
| `programs/challenge_escrow/` | Challenge funding, publication, reviewer roles, awards, claims and remaining-fund refunds |
| `programs/opportunity_gate/` | Employer policies and immutable access receipts |
| `idl/` | Checked-in program interface |
| `client/` | Escrow instructions, deterministic addresses and account decoding |
| `server/` | RPC verification, credential issuance and legacy vault journal |

## Build

The pinned Anchor toolchain is recorded in [Anchor.toml](Anchor.toml).
From this directory in an environment with Rust, Solana and Anchor installed:

```bash
cargo test -p challenge-escrow --lib
cargo build-sbf --manifest-path programs/challenge_escrow/Cargo.toml
anchor idl build -p challenge_escrow -o target/idl/challenge_escrow.json
```

Live checks are explicit commands from the repository root. They are not run in
ordinary CI. See [testing](../docs/testing/README.md).

## Network and authority

The product targets Devnet. Program IDs are pinned in the client and Anchor config.
A signed transaction is not proof of finalization; verification reads chain state.
The escrow program remains upgradeable.

[Escrow runbook](../docs/solana/escrow-runbook.md) ·
[Stored Devnet evidence](../docs/solana/evidence/escrow-devnet-proof.json)
