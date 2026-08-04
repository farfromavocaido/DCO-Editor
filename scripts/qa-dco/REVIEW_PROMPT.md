# DEPRECATED — use the Cursor skill

Visual review instructions live in the project skill:

**[`.cursor/skills/dco-qa-review/SKILL.md`](../../.cursor/skills/dco-qa-review/SKILL.md)**

After `npm run qa:dco`, ask Cursor to run `/dco-qa-review` on `qa-output/latest` (or the newest stamp). The skill reads `hold-samples.json` (settled times derived from creative JSON) and reviews those **native full-res** frames — not spritesheets alone — then writes `visual-review.md` in that run folder. Older runs live under `qa-output/archive/`.

Human scan: open `qa-output/<run>/settled/{size}/` (settled-hold spritesheets grouped by size). Rebuild without re-capturing:

```bash
npm run qa:dco:holds -- --output qa-output/<run>
npm run qa:dco:settled -- --output qa-output/<run>
```
