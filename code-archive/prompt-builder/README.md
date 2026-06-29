Archived prompt-builder modules

These files were moved out of the live prompt-builder module graph because they are no longer referenced by the app, server routes, or tests.

Archived items:
- `artifact-store.ts`: legacy localStorage artifact persistence helpers
- `project-file-api.ts`: superseded by `project-generated-content-api.ts`
- `document-output.ts`: older wrapper around `document-prompt-template.ts`
- `document-output-profiles.ts`: legacy document profile constants not used by the current output registry
- `registry-rainfin-additions.ts`: migration note / manual registry patch helper
- `registry-bma-additions.ts`: migration note / manual registry patch helper

If any of these need to return to production code, move them back into `src/lib/prompt-builder` and restore the required exports/imports explicitly.
