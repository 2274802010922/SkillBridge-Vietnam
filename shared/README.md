# Shared code

Pure modules imported by the frontend, backend or tests.

- `validation/`: assessment contracts, manual rubric handling, challenge content
  and access rules, SIWS input construction and sandbox workflow rules.
- `data/`: bank directory data.

Keep this layer free of environment secrets, database connections, file-system
operations and runtime imports from backend or Solana server modules.
