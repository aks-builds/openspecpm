# Diagrams

The **primary diagrams are Mermaid blocks embedded directly in the main [`README.md`](../../README.md)** under the *Architecture* and *Lifecycle* sections. GitHub renders Mermaid natively, so they show up wherever you read the README — no export step, no PNGs to maintain.

## When to edit the Mermaid source

Open `../../README.md` and edit the `mermaid` fenced code blocks directly. The Mermaid playground at <https://mermaid.live> is useful for previewing changes before committing.

## When to use the .drawio files

The `.drawio` files in this folder mirror the same content as the Mermaid diagrams but are kept for:

- **Slide decks / PDFs / non-GitHub docs** where Mermaid won't render.
- **Custom logo work** — easier to drop in real brand SVGs in draw.io than in Mermaid.
- **Print-quality PNG exports** at high DPI.

To render: open at <https://app.diagrams.net> (drag-and-drop), polish if needed, **File → Export as → PNG** with 200% zoom, 8px border, transparent background, "Include a copy of my diagram" on.

| File | Mirrors |
|---|---|
| [`openspecpm-architecture.drawio`](openspecpm-architecture.drawio) | README *Architecture* Mermaid block |
| [`openspecpm-lifecycle.drawio`](openspecpm-lifecycle.drawio) | README *Lifecycle* Mermaid block |

**If you update one, update the other** — or just delete the .drawio file you don't need. They're not auto-synced.
