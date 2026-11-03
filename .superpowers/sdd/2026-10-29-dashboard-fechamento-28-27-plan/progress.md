# SDD ledger — plan: docs/superpowers/plans/2026-10-29-dashboard-fechamento-28-27-plan.md

Pre-flight: Task 1 produces competênciaParaData/listarDatas; Task 2 consumes the competence boundaries and uses them to aggregate snapshots. Task 3 consumes Task 2 ReportResult and filters it. Task 4 consumes Task 3 state and Task 2 results. Task 5 consumes the full query path and persistence snapshots.

Task 1: complete (commit 508e915, tests: `node --test src/relatorios/competencia.test.js` → 4 passed)
Task 2: complete (tests: `node --test src/relatorios/relatorio-query.test.js` → 4 passed; includes feriado/DSR as HE.3 and period aggregation)
Ruling: The daily visibility requirement adds `metaDiaMin`, `excedenteVsMetaMin`, `heDentroPadraoMin`, `heAcimaPadraoMin`, `motoristasComHE` and `motoristasSemPadrao` to ReportResult — these fields are needed to reproduce the supplied daily cards without changing the underlying HE buckets.
Task 3: complete (tests: `node --test src/relatorios/relatorio-state.test.js` → 2 passed)
Task 4: implementation committed in 6d3fc44; domain regression verification: 45 tests passed excluding the pre-existing broken Firebase package-resolution test.
Ruling: Tracker-stop analysis uses structured `paradas` data when available and leaves raw source rows preserved for the importer to map later — this avoids inventing stop locations from positional spreadsheet columns, at the cost of unknown stops remaining “sem paradas detalhadas” until their export columns are mapped.
Tracker comparison extension: commit 22ac38a; tests `node --test` excluding the pre-existing Firebase package-resolution test → 49 passed.

