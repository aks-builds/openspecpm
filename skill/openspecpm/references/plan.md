# Plan — Authoring a proposal

**When to use this:** the user wants to define a new feature, capture requirements, or write a spec — phrases like "let's plan X", "write a proposal for X", "spec out X", "what should X do".

## Outcome

A fully-formed OpenSpec change at `openspec/changes/<feature>/` containing:

- `proposal.md` — what we're building and why
- `design.md` — technical approach
- `tasks.md` — implementation checklist
- `specs/*.md` — BDD scenarios (Given/When/Then)

## Flow

1. **Clarify the feature.** Ask 1–3 sharp questions to nail down the user-visible behavior. Avoid asking about implementation yet. Examples:
   - "Who triggers this and from where?"
   - "What's the success outcome the user sees?"
   - "What edge cases matter?"

2. **Run the CLI** to scaffold OpenSpec artifacts:

   ```
   openspecpm propose <feature> --prompt "<one-line description>"
   ```

   This shells out to `openspec propose`. If OpenSpec is missing, the user will be guided to install it.

3. **Open the generated files** and refine. For each scenario in `specs/*.md`:
   - Confirm one `Given`/`When`/`Then` per scenario (chained `And` lines OK).
   - Replace vague `Then` predicates ("it works") with observable verbs.
   - Add the edge-case scenarios surfaced in step 1.

4. **Set `status: draft → in_review`** in `proposal.md` frontmatter when the human is ready for review.

## What to avoid

- Don't write code at this stage. The proposal is requirements, not implementation.
- Don't fill in `external:` frontmatter yourself — `openspecpm sync` does that.
- Don't invent paths outside `openspec/changes/<feature>/`. OpenSpec owns the layout.
- Don't enforce strict Gherkin grammar on non-technical authors. The point is intent shape, not syntax.

## After this phase

- If the user is ready to push to their PM tool: route to `references/sync.md`.
- If the user wants to decompose into tasks first: route to `references/structure.md`.
- If the user wants to check what other changes exist: run `openspecpm status`.
