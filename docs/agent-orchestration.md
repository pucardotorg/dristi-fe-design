# Maintaining Dristi's agent team

The owner’s intent is a thinking partner, a DS-based builder, and an independent reviewer.
Current task decisions travel in a concise agreement; historical feature documents are
maintained for the owner and are not automatically loaded as build instructions.

## Owner-controlled agents — decision, 2026-09-15

The owner invokes an agent only by explicitly tagging its name in the active task,
for example `@ux-designer`, `@ui-designer`, or `@ui-reviewer`. The tag authorizes that
named role for the task, including focused follow-ups to an existing spawned agent.
One tag never authorizes another role or an automatic UX → build → review chain.
The coordinator performs untagged stages and a separate review pass when needed;
it identifies that pass as non-independent. Skills may still guide the coordinator
without spawning an agent.

This is an instruction boundary in `.agents/policies/`, not a tool-level conditional
spawn lock. Rails checks confirm generated configuration, not whether a live agent
obeyed the tag rule. Do not disable subagents globally: that would also prevent the
owner from invoking a tagged agent.

## Human decision between UX and implementation — decision, 2026-09-15

A request to brainstorm with `ux-designer` ends with a recommendation for the owner.
The coordinator marks proposed choices separately from behavior the owner finalized;
the UX agent's completion does not start `ui-designer` or authorize app edits. A build
starts only after an explicit owner implementation request, with `@ui-designer` needed
if the owner wants that agent to do it. An initial request that already asks for design
and implementation is sufficient build authorization; do not ask for another approval
solely because UX planning happened.

A later build uses the owner-finalized agreement in the current task or the single
final brief/task the owner points to. The coordinator passes only that behavior,
decisions, criteria, and relevant source paths to the builder. If the final decision
cannot be identified, ask for it instead of reading a whole prior thread or treating
archived proposals as approval. A proposed UX direction never becomes a build
requirement merely because it was handed over.

## Bounded starts and UI review evidence — decision, 2026-09-15

The coordinator sends a tagged agent the current agreement, bounded responsibility,
exact relevant paths, and checked revision. In Codex `spawn_agent`, set
`fork_turns: "none"` when the prompt and artifact paths suffice; use the smallest
positive turn count only for essential inline evidence that cannot be passed by path.
The omitted default forwards the full conversation. Agents start at supplied paths
and open the docs map only when they need to locate a missing current source. This
avoids repeated repository inventories and stale history shaping a new task.

For Dristi UI work, resolve and verify the pinned DS, then read applicable sections of
its `AGENTS.md`. DS-repository Precedence, Commands, Recipes, and Definition of done
do not become app tasks or mandatory Figma reads. Every build and UI review reads the
full DS `ACCESSIBILITY.md`, Laws, and design principles, plus affected primitives and
foundations. This keeps the DS authoritative while limiting unrelated DS-repository
reading. Unchanged guidance may be reused within the same task and DS version.

The reviewer checks whether the chosen DS role fits the content, not just whether its
token exists. It derives the expected role from the owner-finalized design or direct
request and current DS, then cites the implemented class, rendered computed value, and
consequence when they disagree. When the DS does not map a region clearly, the reviewer
reports a governance gap instead of asserting a guessed size violation. If owner intent
conflicts with a pinned DS rule, the reviewer reports the conflict for resolution. A
screenshot alone is too imprecise for a precise size finding. The
existing `check:typography` catches raw type sizes and missing heading weight; it cannot
know whether a valid named token was assigned to the wrong screen region. Repeated,
source-backed role mistakes should later become component contracts or targeted
automated checks, rather than guessed global font-size rules. An illustrative example
does not itself set a new size requirement.

Before a tagged UI reviewer starts, check whether its runtime has read-only browser
and screenshot access and whether the server serves the checked checkout. A reviewer
with access captures its own labeled screens. Otherwise the coordinator supplies
actual screenshots with absolute paths or inline images, route/state/width/theme/time,
and checkout revision before handoff. The reviewer independently judges code and
screens; a builder's summary or a screenshot from another checkout cannot substitute.
Missing render or interaction evidence remains **verification pending** for that
criterion. See [verification](../.agents/policies/verification.md) for the packet.

## Sources and generated files

| Edit here | Generated or consumed there |
|---|---|
| `.agents/policies/project.md` | `AGENTS.md`, `CLAUDE.md`, Cursor project rule |
| `.agents/roles/*.md` and `.agents/rails.json` | Codex TOML, Claude agents, Cursor role rules |
| DS/server policies declared in `.agents/rails.json` | Claude and Cursor rules |
| `.agents/skills/` | Codex discovery; complete Claude/Cursor mirrors including references |
| `.agents/verification.json` | Executable verification profiles |

All instruction paths are repository-relative unless marked skill-relative. Skill-relative
Markdown links work in all mirrors. The old `propose-ui-brief` name is retained as a short
compatibility route to `design-ui` or `document-ui-feature`.

```bash
npm run sync:rails
npm run verify:agents
```

Generation is explicit: no install hook, background watcher, or automatic edits to another
checkout. Unmatched managed files cause a failure rather than being silently deleted.
The Agent rails GitHub workflow runs verification on PRs and pushes to long-lived
branches, without installing dependencies or starting the app. Making this check required
for merging remains a repository branch-protection setting; this change does not alter it.
When adding a skill, create its `SKILL.md` under `.agents/skills/` and regenerate. When
adding a role, declare its metadata/adapters in `.agents/rails.json` and its body under
`.agents/roles/`. Canonical skill frontmatter uses `name` and a one-line JSON-quoted
`description` (a valid YAML subset); the checker rejects unsupported metadata instead
of silently stripping it. Extend the parser deliberately if more metadata becomes needed.

The checker validates all expected files, unexpected files, resource mirrors, local
references, root command names, and adapter boundaries. Its regression suite changes
fixtures in temporary directories only. Byte equality proves configuration consistency,
not reasoning quality. Human review of source changes remains necessary.

## Runtime boundaries

- Codex UX/reviewer adapters request `sandbox_mode = "read-only"`; live permission
  overrides may change effective behavior. This migration validates configuration, not
  a running session's sandbox. The builder inherits existing session permissions.
- Claude UX/reviewer adapters omit Bash, Write, and Edit. The current Claude reviewer
  tool list has no browser/screenshot tool, so the coordinator must supply images for
  that adapter. Codex and other runtimes may expose read-only computer-use tools, but
  role instructions alone do not grant them; check the live tool inventory. Commands
  and unavailable render states go to the coordinator. Do not weaken read-only access
  to make a screenshot path work.
- Cursor role rules are advisory and do not enforce filesystem isolation.
- Existing model choices are preserved: Claude roles use their previous `opus` choice;
  Codex roles inherit the session. No model or global permission settings are changed.

See [verification](../.agents/policies/verification.md) for criteria, evidence reuse, and
pending status when an environment is unavailable.

## Rollout and rollback

Land the cleanup through a PR into `main` with owner approval. Existing Cursor work
continues on its own branch until the owner chooses to integrate the change. Do not
switch an active checkout or restart its server to adopt the new configuration.

After integration, start a fresh task in the intended checkout and confirm the tool
lists the three roles and canonical skills. Reload the tool if discovery is stale; do
not interrupt an ongoing task. Configuration checks do not prove live discovery.

Rollback is a revert of the cleanup commit through a PR. Product code, the DS pin,
dependency versions, launch configuration, and historical feature records are unchanged.
No performance percentage is claimed: extended feature/latency trials were intentionally
excluded; validation covers configuration, generation, and regression detection. These
bounded-start and evidence instructions still need a real tagged UI task to measure
reading, screenshot availability, and end-to-end elapsed time.

## Decisions behind this change — owner, 2026-09-13

- Preserve the three roles, but separate brainstorming from archive writing.
- Keep owner-facing history without automatically adding it to future agent context.
- Use concise handoffs and independent review for substantial/consequential changes;
  avoid compulsory three-agent execution for small, fully specified corrections.
- Centralize shared instructions while preserving tool-specific capability differences.
- Implement in an isolated worktree so ongoing Cursor work and the server are unaffected.
- Skip an extended benchmark pilot; retain quick configuration/regression checks.
