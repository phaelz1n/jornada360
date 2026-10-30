# AGENTS Guidelines for This Repository

This repository contains a Next.js application located in the root of this repository. When
working on the project interactively with an agent (e.g. the Codex CLI) please follow
the guidelines below so that the development experience – in particular Hot Module
Replacement (HMR) – continues to work smoothly.

## 1. Use the Development Server, **not** `npm run build`

* **Always use `npm run dev` (or `pnpm dev`, `yarn dev`, etc.)** while iterating on the
  application. This starts Next.js in development mode with hot-reload enabled.
* **Do _not_ run `npm run build` inside the agent session.** Running the production
  build command switches the `.next` folder to production assets which disables hot
  reload and can leave the development server in an inconsistent state.

## 2. Keep Dependencies in Sync

If dependencies are added or updated, update the appropriate lockfile and restart the development server.

## 3. Coding Conventions

* Prefer TypeScript (`.tsx`/`.ts`) for new components and utilities.
* Co-locate component-specific styles with the component when practical.

## 4. Useful Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server with HMR |
| `npm run lint` | Run lint checks |
| `npm run test` | Execute the test suite, if present |
| `npm run build` | Production build; avoid during interactive sessions |
