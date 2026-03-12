# Vibes

This project is turning from a simple stack of generated content blocks into a reactive learning canvas.

The intended feel:

- Pages should behave more like small apps than documents.
- Course flows should be able to guide learners through intro, practice, and review states without feeling brittle.
- Blocks should be composable, resilient, and safe: one broken block should not take the page down.
- Learning interactions should feel alive: assessments update progress, state changes respond to events, and memory accumulates across a course/workspace.
- Agent blocks should feel like embedded collaborators, not separate chat windows.

Implementation bias for this feature set:

- Keep old saved pages working automatically.
- Prefer declarative JSON configuration over hardcoded page-specific logic.
- Make advanced behavior visible in the UI when something is wrong instead of silently failing.
