# ADR-20250904: Current Implementation State

## Context
Frontend has basic chat UI with Expo Router instead of reference's direct App.tsx approach.

## Options
1. Keep Expo Router for navigation scalability
2. Match reference exactly with single App.tsx

## Decision
Keep Expo Router as it provides better navigation structure for future screens.

## Consequences
- Slight deviation from reference but better architectural foundation
- Will need to adapt reference patterns to router structure

## Revisit
When adding authentication/PIN screens in Session 4.