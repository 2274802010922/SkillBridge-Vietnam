# Architecture

SkillBridge is one Next.js application deployed on Vercel. The folders describe responsibility; they are not separately deployed services.

## System map

```mermaid
flowchart TB
    subgraph Browser["Browser / Trình duyệt"]
      UI["frontend React UI · VI / EN"]
      Wallet["Wallet Standard\nuser signatures"]
      Client["solana/client\nmessage builders + inspection"]
      UI --> Wallet
      UI --> Client
    end
    subgraph Vercel["One Next.js deployment · Vercel"]
      Routes["app/ route adapters"]
      API["backend/http handlers"]
      Auth["SIWS session + RBAC"]
      Services["AI · review · portfolios · payments · recovery"]
      Issuer["Authorized issuer / verifier services"]
      Routes --> API --> Auth --> Services --> Issuer
    end
    UI -->|"HTTPS"| Routes
    Services --> DB[("Turso / local SQLite")]
    Services --> Blob["Private Vercel Blob / local evidence"]
    UI -->|"authorized client upload"| Blob
    Services -->|"selected evidence only"| AI["OpenRouter / configured AI provider"]
    Client --> RPC["Solana Devnet RPC"]
    Wallet -->|"signed transactions"| RPC
    Issuer -->|"authorized transactions + observations"| RPC
    subgraph Chain["Solana Devnet"]
      Escrow["Challenge Escrow\nfunding · roles · allocation · claims"]
      SAS["Solana Attestation Service\ncredentials · expiry · revocation"]
      Gate["Opportunity Gate\npolicies · access receipts"]
    end
    RPC --> Escrow
    RPC --> SAS
    RPC --> Gate
    Rules["shared/ pure contracts"] -.-> UI
    Rules -.-> Services
```

## Product proof flow

```mermaid
sequenceDiagram
    actor Business
    actor Student
    actor Reviewer
    participant App as SkillBridge / Vercel
    participant DB as Turso
    participant Chain as Solana Devnet
    Business->>App: Create brief, rubric, slots and reviewer roles
    App->>DB: Persist draft terms and permissions
    Business->>Chain: Fund and publish escrow
    Chain-->>App: Finalized funding state
    Student->>App: Upload files, notes and fixed submission version
    App->>DB: Store private evidence and content hashes
    Reviewer->>App: Open evidence and score manually
    Reviewer->>App: Optionally request a grounded AI draft
    App->>DB: Store citations, result and audit trail
    Reviewer->>Chain: Commit official result and allocation
    Student->>Chain: Claim allocated reward to fixed wallet
    Business->>App: Verify credential and apply its own opportunity policy
```

## AI and human review

```mermaid
flowchart LR
    Files["Private file bytes"] --> Extract["Extract locally"]
    Extract --> Chunks["Cache chunks by file hash"]
    Chunks --> Retrieve["Retrieve top evidence per rubric"]
    Retrieve --> Cache{"Assessment cache hit?"}
    Cache -->|"yes"| Draft["Stored validated draft"]
    Cache -->|"no"| Provider["One explicit provider request"]
    Provider --> Schema["Strict JSON schema"]
    Schema --> Citation["Citation and evidence validation"]
    Citation --> Draft
    Draft --> Review["Human edits and approves"]
    Files -->|"manual path"| Review
    Review --> Official["Official score and result"]
```

AI receives selected evidence text, not an unrestricted database or private application profile. Provider and model are recorded with the result. A valid AI response remains a proposal until the reviewer acts.

## Credential, opportunity and independent claim

```mermaid
flowchart LR
    Official["Human-approved result"] --> Credential["SAS credential\nissuer · wallet · score · status"]
    Credential --> Passport["Student Skill Passport"]
    Credential --> Policy["Business B policy\nissuer · score · wallet"]
    Policy --> Verify["Fresh verifier check"]
    Verify --> Receipt["Opportunity access receipt"]
    Allocation["Escrow allocation"] --> Independent["Static verifier"]
    Independent -->|"public RPC + recipient signature"| Claim["Claim-once program instruction"]
```

The independent verifier can read the public state and submit an already allocated claim without calling SkillBridge API routes. The backend remains involved in the earlier submission registration, review and authorized issuance steps.

## Recovery and idempotency

```mermaid
sequenceDiagram
    participant Request as Authenticated request
    participant Journal as DB operation journal
    participant RPC as Solana RPC
    Request->>Journal: Reserve operation and freeze payload
    Request->>Journal: Persist signed bytes / idempotency key
    Request->>RPC: Broadcast persisted transaction
    RPC--xRequest: Timeout or response lost
    Request->>Journal: Resume same operation
    Request->>RPC: Inspect signature and finalized accounts
    alt Matching finalized state
      Request->>Journal: Commit state, event and audit atomically
    else Pending or unavailable
      Request->>Journal: Retain recoverable state
    else Mismatch
      Request->>Journal: Mark review state; never resend blindly
    end
```

Credential issuance and off-ramp payout use durable operation/inbox journals with idempotency keys and fenced leases. A lost response is reconciled using the same operation; it does not create a second transaction or payout.

## Data boundaries

| Data | System of record | Visibility |
| --- | --- | --- |
| Submission files and notes | Private Blob/local evidence storage | Owner and explicitly authorized reviewers |
| Workflow, permissions and audit | Turso/libSQL | Server-authorized users |
| Evidence hashes and result snapshots | Database plus signed/on-chain commitments | Verifiable according to product policy |
| Credential, allocation and access receipt | Solana Devnet | Public chain state with minimum disclosure |
| AI draft provenance | Database assessment record | Reviewer and authorized audit views |
| VND cashout receipt | Sandbox adapter journal | Test state; not a bank settlement |

## Module boundaries

- `app/` stays thin and exports supported Next.js route/page adapters.
- `frontend/` contains React UI, i18n, styles and Wallet Standard interactions.
- `backend/http/` authenticates requests and preserves API response contracts.
- `backend/services/` owns orchestration, audit, AI, portfolios, cashout and recovery.
- `backend/database/` contains Drizzle definitions, runtime schema, migrations and the libSQL adapter.
- `solana/client/` builds and inspects client messages; `solana/server/` verifies chain observations and authorized server actions.
- `solana/programs/` contains the deployed Devnet programs and checked-in IDL.
- `shared/` contains pure validation and data contracts without server runtime dependencies.

## Trust boundaries and known limitations

- Wallet connection authenticates ownership through SIWS; it does not grant organization permissions by itself.
- Only finalized chain observations synchronize money, credential or access state.
- AI never approves work or signs money movement.
- Private evidence is never treated as an on-chain backup; hashes are commitments.
- The escrow program remains upgradeable and is not presented as an audited mainnet custody system.
- New cashout orders use a dedicated settlement address; the VND leg remains sandbox-only.

[Proof-to-payout contract](../product/proof-to-payout.md) · [Off-ramp architecture](offramp.md) · [Solana rules](../../solana/AGENTS.md) · [Judge walkthrough](../judging/README.md)
