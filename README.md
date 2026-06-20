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

## Create Projects From The UI

Use the `+` button beside the Project selector to create a Presentation, Document pack, LinkedIn campaign or Mixed project. The three-step wizard creates the project context, header, footer, logo selection and workflow-specific Markdown sources beneath:

```txt
content/projects/<brand>/<project-slug>/
```

Required files are locked in the review step. Optional starter files can be selected before creation. Existing project folders are never overwritten.

## Local Storage

Start the local app:

```bash
npm run dev
```

Open `http://localhost:5177`. In **Local storage**, choose an absolute content root. This can be a OneDrive-synced folder or another hard-drive location. Use **Initialize root** for a new folder; missing brand seed files are copied without overwriting existing content.

The selected root must represent the complete content workspace:

```txt
<content-root>/brands/
<content-root>/projects/
```

The selected root is stored locally in `.local/app-settings.json`. Source editing, project creation, generated-output uploads, exports and ChatGPT automation are served by the same local Vite application.

### Generated Content

Sources remain unversioned inside a named content set. Generated files are stored flat inside versioned `_generated` folders:

```txt
content/projects/<brand>/<project>/documents/<pack>/_generated/v001/
content/projects/<brand>/<project>/visuals/<set>/_generated/v001/
content/projects/<brand>/<project>/linkedin/<campaign>/_generated/v001/
```

Version folders use `v001`, `v002`, `v003`, and so on. Images, PDFs, DOCX files and PPTX files sit directly in the version folder; prompt history, source snapshots and format-specific subfolders are not created by default.

A Vercel deployment is a read-only/demo interface. Browsers cannot write directly to a personal OneDrive or hard drive, so writable workflows require `npm run dev` on the machine that owns those files.
