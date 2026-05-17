# Diagrams

Editable [draw.io](https://app.diagrams.net) sources for the diagrams referenced from the main `README.md`.

| File | What it shows | Suggested PNG size |
|---|---|---|
| [`openspecpm-architecture.drawio`](openspecpm-architecture.drawio) | System architecture — user inputs, entry surfaces, command groups, core services, adapter contract, external systems, and the local filesystem layout. | 1700 × 1300 |
| [`openspecpm-lifecycle.drawio`](openspecpm-lifecycle.drawio) | End-to-end lifecycle — idea → propose → decompose → validate → sync → execute → track → ship. | 1700 × 1000 |

## How to render

1. Open the `.drawio` file at <https://app.diagrams.net> (drag-and-drop into the canvas, or **File → Open from → Device**).
2. Tidy/edit if you want — both files are skeletons; you can swap the placeholder brand boxes for real logos via **Shapes → search** ("GitHub", "Jira", "Slack", etc.).
3. Export as PNG: **File → Export as → PNG**. Recommended settings:
   - **Zoom:** 200% (sharper text in README embeds)
   - **Border width:** 8
   - **Transparent background:** on
   - **Include a copy of my diagram:** on (lets future-you re-edit the PNG in draw.io directly)
4. Save the PNGs alongside the source files as `openspecpm-architecture.png` / `openspecpm-lifecycle.png`.
5. Embed in the main `README.md`:

   ```markdown
   ![Architecture](docs/diagrams/openspecpm-architecture.png)
   ![Lifecycle](docs/diagrams/openspecpm-lifecycle.png)
   ```

## Editing notes

- **Colors are brand-accurate.** GitHub = `#222`, Azure DevOps = `#0078D7`, Jira = `#0052CC`, Linear = `#5E6AD2`, GitLab = `#FC6D26`, Slack = `#4A154B`, Teams = `#464EB8`. Keep these if you swap shapes.
- **Swimlanes** group layers — drag a cell out of one lane and it will move with that lane's offset. Edit lane titles via the lane header.
- **Arrows** are mostly straight; if you reposition cells, right-click → **Edit Geometry → Reset Geometry** on each affected edge to re-route.
- **Adding a new adapter?** Duplicate the GitLab cell, recolor it, and add a fresh arrow to a new external-systems box. Both diagrams need the addition.
