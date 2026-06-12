# BMA / Open Client Management Project Files

This pack adds a new brand and project to the prompt-builder app.

## What is included

- Brand: Block Markets Africa / Open
- Project: Client Management
- First A4 Word-style document content:
  - New Client Business Case Template
- Extracted logo assets from the supplied office-wall image:
  - `bma-logo.png/svg`
  - `open-logo.png/svg`
  - `bma-open-logo.png/svg`
- Public logo previews for the app
- Document-specific light background presets
- Updated compiler and UI files to support document backgrounds separately from slide backgrounds
- Registry additions and a full replacement `registry.ts`

## Files to copy

Copy these folders/files into your project root:

```txt
content/brands/bma-open/
content/projects/bma-open/client-management/
public/brands/bma-open/
src/lib/prompt-builder/document-background-presets.ts
src/lib/prompt-builder/prompt-compiler.ts
src/main.tsx
src/styles.css
```

Then either:

1. Replace your existing `src/lib/prompt-builder/registry.ts` with the one in this pack, or
2. Manually add the objects from `src/lib/prompt-builder/registry-bma-additions.ts` to your current registry.

## Test in the app

```bash
npm run dev
```

Select:

```txt
Brand: Block Markets Africa / Open
Project: Client Management
Content Type: documents
Content File: New Client Business Case Template
Output Profile: A4 Document Portrait
Document Background Style: Clean White Form or Soft Mint Business Template
```

## Notes

The logo assets were extracted from the supplied image. Replace them with official vector assets later if available, keeping the same filenames.
