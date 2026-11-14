# TypeScript everywhere: npm CLI plus a single Next.js app for both website and API

The blueprint (BLUEPRINT.md §11) proposes three applications: a TypeScript CLI, a Python FastAPI backend and a React website. For a 24-hour hackathon, we instead build two TypeScript applications in one monorepo: the npm CLI, and one Next.js app that serves both the website and the API. Shared packages hold the Universal Context Format types, the core logic and the Agent adapters. The point is to spend the hackathon on session portability, merging and memory rather than on maintaining three stacks and keeping their schemas in sync across languages. Python stays out unless a Python-only dependency turns out to matter.

## Considered Options

- **CLI + FastAPI + React (the blueprint):** rejected for the MVP. It means two languages and the schemas defined twice.
- **CLI + separate TypeScript API + Next.js website:** rejected. A third app adds no value at hackathon scale.
