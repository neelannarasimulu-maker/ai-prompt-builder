export type ProjectWorkflow = "presentation" | "document_pack" | "linkedin_campaign" | "mixed";

export type CreateProjectInput = {
  brandId: string;
  brandName: string;
  projectName: string;
  projectSlug: string;
  workflow: ProjectWorkflow;
  audience: string;
  purpose: string;
  tone: string;
  headerText: string;
  footerText: string;
  logoAsset: string;
  enabledOptionalFiles: string[];
};

export type ProjectScaffoldFile = {
  path: string;
  content: string;
  required: boolean;
  label: string;
};

export type ProjectScaffoldPreview = {
  targetFolder: string;
  requiredFiles: ProjectScaffoldFile[];
  optionalFiles: ProjectScaffoldFile[];
  generatedFolders: string[];
  errors: string[];
};

export type RuntimeProject = {
  id: string;
  label: string;
  brandId: string;
  folder: string;
  workflow?: ProjectWorkflow;
};

export type RuntimeContentFile = {
  path: string;
  type: string;
  contentSet?: string;
  filename: string;
  label: string;
  raw: string;
};

export function slugifyProjectName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function validateCreateProjectInput(input: CreateProjectInput): string[] {
  const errors: string[] = [];
  if (!input.brandId.trim()) errors.push("Brand is required.");
  if (!input.projectName.trim()) errors.push("Project name is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.projectSlug)) errors.push("Project slug must contain lowercase letters, numbers and single hyphens only.");
  if (!input.audience.trim()) errors.push("Audience is required.");
  if (!input.purpose.trim()) errors.push("Purpose is required.");
  if (!input.tone.trim()) errors.push("Tone is required.");
  if (!(["presentation", "document_pack", "linkedin_campaign", "mixed"] as string[]).includes(input.workflow)) errors.push("Choose a valid project workflow.");
  return errors;
}

function commonFiles(input: CreateProjectInput): ProjectScaffoldFile[] {
  return [
    {
      path: "project.md",
      label: "Project context",
      required: true,
      content: `# ${input.projectName}\n\nBrand: ${input.brandName}\nProject: ${input.projectName}\nWorkflow: ${input.workflow}\nAudience: ${input.audience}\nPurpose: ${input.purpose}\nTone: ${input.tone}\n`,
    },
    { path: "header.md", label: "Project header", required: true, content: `# Project Header\n\n${input.headerText}\n` },
    { path: "footer.md", label: "Project footer", required: true, content: `# Project Footer\n\n${input.footerText}\n` },
    {
      path: "logo.md",
      label: "Project logo",
      required: true,
      content: `# Project Logo\n\nLogo asset: ${input.logoAsset}\n\nUse the selected official ${input.brandName} logo without redrawing, recolouring, cropping, stretching or replacing it.\n`,
    },
    { path: "distribution.json", label: "Distribution history", required: true, content: `{\n  "version": 1,\n  "records": []\n}\n` },
  ];
}

function visualRules(input: CreateProjectInput): ProjectScaffoldFile {
  return {
    path: "visual-rules.md",
    label: "Project visual rules",
    required: true,
    content: `# ${input.projectName} Visual Rules\n\nUse the selected ${input.brandName} brand system.\nAudience: ${input.audience}\nPurpose: ${input.purpose}\nTone: ${input.tone}\n\nUse each content file's Intent and Image Brief as guidance. Use only Visible Text as on-image text.\n`,
  };
}

function documentRules(input: CreateProjectInput): ProjectScaffoldFile {
  return {
    path: "document-rules.md",
    label: "Project document rules",
    required: true,
    content: `# ${input.projectName} Document Rules\n\nApply the selected ${input.brandName} document system for ${input.audience}.\nKeep the tone ${input.tone}. Preserve source wording, headings, numbering and tables exactly.\n`,
  };
}

function visualFile(input: CreateProjectInput, path: string, title: string, intent: string): ProjectScaffoldFile {
  return {
    path,
    label: title,
    required: path.endsWith("01-project-overview.md"),
    content: `## Intent\n${intent}\n\n## Layout Hint\nauto\n\n## Background Hint\nauto\n\n## Visible Text\nTitle: ${title}\nSubtitle: [Add the exact audience-facing message]\nBody: [Add concise exact wording]\n\n## Image Brief\nCreate a ${input.tone} ${input.brandName} visual for ${input.audience}. Support this purpose: ${input.purpose}\n`,
  };
}

function documentFile(input: CreateProjectInput, path: string, title: string): ProjectScaffoldFile {
  return {
    path,
    label: title,
    required: path.endsWith("01-main-document.md"),
    content: `## Intent\nCreate a ${input.tone} document for ${input.audience}. ${input.purpose}\n\n## Cover Page Content\nTitle: ${title}\nSubtitle: ${input.projectName}\nDate: [Insert date]\n\n## Body Content\n# ${title}\n\n## Executive Summary\n[Add the approved executive summary.]\n\n## Context\n[Add the source business or legal context.]\n\n## Recommendations and Next Steps\n[Add approved recommendations and next steps.]\n`,
  };
}

function linkedInPost(input: CreateProjectInput): ProjectScaffoldFile {
  return {
    path: "linkedin/01-linkedin-post.md",
    label: "LinkedIn post",
    required: true,
    content: `## Intent\nCreate a ${input.tone} LinkedIn image and accompanying post for ${input.audience}.\n\n## Visible Text\nTitle: [Add the exact on-image headline]\nBody: [Add concise exact on-image wording]\n\n## LinkedIn Post Text\n[Add the complete caption/post copy to paste into LinkedIn.]\n\n## Image Brief\nCreate a clear 4:5 social visual supporting this purpose: ${input.purpose}\n`,
  };
}

function linkedInImage(input: CreateProjectInput): ProjectScaffoldFile {
  return {
    path: "linkedin/02-linkedin-image.md",
    label: "LinkedIn image",
    required: false,
    content: `## Intent\nCreate a mobile-readable ${input.brandName} LinkedIn visual supporting ${input.purpose}\n\n## Visible Text\nTitle: [Add the exact headline]\nBody: [Add one concise supporting statement]\n\n## LinkedIn Post Text\n[Add the complete caption/post copy to paste into LinkedIn.]\n\n## Image Brief\nCreate a clear 4:5 social visual for ${input.audience} in a ${input.tone} style.\n`,
  };
}

export function buildProjectScaffold(input: CreateProjectInput): ProjectScaffoldPreview {
  const requiredFiles = commonFiles(input);
  const optionalFiles: ProjectScaffoldFile[] = [];
  const folders = new Set<string>([
    "documents/default-document-pack/_generated",
    "visuals/default-visual-set/_generated",
    "linkedin/default-campaign/_generated",
  ]);
  const hasVisuals = input.workflow === "presentation" || input.workflow === "mixed";
  const hasDocuments = input.workflow === "document_pack" || input.workflow === "mixed";
  const hasLinkedIn = input.workflow === "linkedin_campaign" || input.workflow === "mixed";

  if (hasVisuals || hasLinkedIn) requiredFiles.push(visualRules(input));
  if (hasDocuments) requiredFiles.push(documentRules(input));
  requiredFiles.push(
    {
      path: "documents/default-document-pack/pack.md",
      label: "Default document pack",
      required: true,
      content: `# Default Document Pack\n\nProject: ${input.projectName}\n`,
    },
    {
      path: "visuals/default-visual-set/set.md",
      label: "Default visual set",
      required: true,
      content: `# Default Visual Set\n\nProject: ${input.projectName}\n`,
    },
    {
      path: "linkedin/default-campaign/campaign.md",
      label: "Default LinkedIn campaign",
      required: true,
      content: `# Default LinkedIn Campaign\n\nProject: ${input.projectName}\n`,
    },
  );

  return {
    targetFolder: `content/projects/${input.brandId}/${input.projectSlug}`,
    requiredFiles,
    optionalFiles,
    generatedFolders: Array.from(folders),
    errors: validateCreateProjectInput(input),
  };
}

export function selectedScaffoldFiles(input: CreateProjectInput): ProjectScaffoldFile[] {
  const preview = buildProjectScaffold(input);
  const enabled = new Set(input.enabledOptionalFiles);
  return [...preview.requiredFiles, ...preview.optionalFiles.filter((file) => enabled.has(file.path))];
}
