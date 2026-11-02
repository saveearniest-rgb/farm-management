# Farm platform: agent project kit

This folder is the starting point for an AI coding agent (such as Claude Code) to build version 1 (1a then 1b) of the farm management platform. It holds the instructions, scope, decisions, starter database schema and test data. There is no application code yet.

## How to start

1. Create a new empty Git repository and copy everything in this folder into it.
2. `docs/spec.md` is already included. If you change the spec doc later, export it as Markdown again and replace this file.
3. Open the repository with your agent. It reads `CLAUDE.md` automatically.
4. Paste the **Kickoff** prompt from `docs/slice-prompts.md`. Read the agent's answer, correct anything wrong, then approve.
5. Paste slice prompts one at a time, in order. After each slice, run the demo steps yourself before moving on.

## Files

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Permanent instructions: stack, rules, how to work |
| `docs/v1-scope.md` | What is in and out of version 1 |
| `docs/decisions.md` | Decisions already made, plus a log for new ones |
| `docs/slice-prompts.md` | Kickoff prompt and one prompt per slice |
| `docs/plan-vs-actual.md` | The bell pepper model as formulas and expected outputs, for slice 8 |
| `docs/spec.md` | The full product spec, including the animal farming division. Exported from the doc on the date the kit was zipped; re-export it if the doc changes |
| `prisma/schema.prisma` | Starter schema for slices 1 to 3 (now including the crop SOP), to be extended. Its syntax was checked, but it has not been run against a database |
| `prisma.config.example.ts` | Example Prisma config holding the database URL. Rename to `prisma.config.ts` and check it against the docs for the installed Prisma version |
| `fixtures/bell_pepper_1acre_model_tzs.xlsx` | The original workbook |

## Parallel work that is not for the agent

- Register the company under Tanzania's data protection law and decide where the data is hosted.
- Book a lawyer for document templates, interest and lending licence questions (needed before version 2).
- Pick the first real farm, crop and region, and replace placeholder crop numbers with local quotes.
