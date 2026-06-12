import supplyBrand from "../../../content/brands/supplysync360/brand.md?raw";
import supplyHeader from "../../../content/brands/supplysync360/header.md?raw";
import supplyFooter from "../../../content/brands/supplysync360/footer.md?raw";
import supplyLogoRules from "../../../content/brands/supplysync360/logo-rules.md?raw";
import supplyProject from "../../../content/projects/supplysync360/executive-overview/project.md?raw";
import supplyVisualRules from "../../../content/projects/supplysync360/executive-overview/visual-rules.md?raw";

import thengaBrand from "../../../content/brands/thenga/brand.md?raw";
import thengaHeader from "../../../content/brands/thenga/header.md?raw";
import thengaFooter from "../../../content/brands/thenga/footer.md?raw";
import thengaLogoRules from "../../../content/brands/thenga/logo-rules.md?raw";
import thengaProject from "../../../content/projects/thenga/investor-canvas/project.md?raw";
import thengaVisualRules from "../../../content/projects/thenga/investor-canvas/visual-rules.md?raw";

import ss360Slide01 from "../../../content/projects/supplysync360/executive-overview/slides/01-business-overview.md?raw";
import ss360Slide02 from "../../../content/projects/supplysync360/executive-overview/slides/02-operating-problem.md?raw";
import ss360Slide03 from "../../../content/projects/supplysync360/executive-overview/slides/03-control-loop.md?raw";
import ss360Slide04 from "../../../content/projects/supplysync360/executive-overview/slides/04-platform-role.md?raw";
import ss360Slide05 from "../../../content/projects/supplysync360/executive-overview/slides/05-core-capabilities.md?raw";
import ss360Slide06 from "../../../content/projects/supplysync360/executive-overview/slides/06-ai-assisted-action.md?raw";
import ss360Slide07 from "../../../content/projects/supplysync360/executive-overview/slides/07-inventory-control.md?raw";
import ss360Slide08 from "../../../content/projects/supplysync360/executive-overview/slides/08-supplier-coordination.md?raw";
import ss360Slide09 from "../../../content/projects/supplysync360/executive-overview/slides/09-forecasting-replenishment.md?raw";
import ss360Slide10 from "../../../content/projects/supplysync360/executive-overview/slides/10-use-cases.md?raw";
import ss360Slide11 from "../../../content/projects/supplysync360/executive-overview/slides/11-governance-accountability.md?raw";
import ss360Slide12 from "../../../content/projects/supplysync360/executive-overview/slides/12-business-outcomes.md?raw";
import ss360Slide13 from "../../../content/projects/supplysync360/executive-overview/slides/13-executive-call-to-action.md?raw";
import ss360Doc01 from "../../../content/projects/supplysync360/executive-overview/documents/01-word-client-opportunity-brief.md?raw";
import ss360Doc02 from "../../../content/projects/supplysync360/executive-overview/documents/02-a4-pdf-investor-one-pager.md?raw";
import ss360Linkedin01 from "../../../content/projects/supplysync360/executive-overview/linkedin/01-linkedin-launch-post.md?raw";
import ss360Linkedin02 from "../../../content/projects/supplysync360/executive-overview/linkedin/02-linkedin-image-visual.md?raw";
import thengaSlide01 from "../../../content/projects/thenga/investor-canvas/slides/01-investment-thesis.md?raw";

export interface BrandFiles {
  brand: string;
  header: string;
  footer: string;
  logoRules: string;
}

export interface ProjectFiles {
  project: string;
  visualRules: string;
}

const brandFiles: Record<string, BrandFiles> = {
  supplysync360: {
    brand: supplyBrand,
    header: supplyHeader,
    footer: supplyFooter,
    logoRules: supplyLogoRules,
  },
  thenga: {
    brand: thengaBrand,
    header: thengaHeader,
    footer: thengaFooter,
    logoRules: thengaLogoRules,
  },
};

const projectFiles: Record<string, ProjectFiles> = {
  "supplysync360/executive-overview": {
    project: supplyProject,
    visualRules: supplyVisualRules,
  },
  "thenga/investor-canvas": {
    project: thengaProject,
    visualRules: thengaVisualRules,
  },
};

const contentFiles: Record<string, string> = {
  "ss360-slide-01": ss360Slide01,
  "ss360-slide-02": ss360Slide02,
  "ss360-slide-03": ss360Slide03,
  "ss360-slide-04": ss360Slide04,
  "ss360-slide-05": ss360Slide05,
  "ss360-slide-06": ss360Slide06,
  "ss360-slide-07": ss360Slide07,
  "ss360-slide-08": ss360Slide08,
  "ss360-slide-09": ss360Slide09,
  "ss360-slide-10": ss360Slide10,
  "ss360-slide-11": ss360Slide11,
  "ss360-slide-12": ss360Slide12,
  "ss360-slide-13": ss360Slide13,
  "ss360-doc-01": ss360Doc01,
  "ss360-doc-02": ss360Doc02,
  "ss360-linkedin-01": ss360Linkedin01,
  "ss360-linkedin-02": ss360Linkedin02,
  "thenga-slide-01": thengaSlide01,
};

export function getBrandFiles(brandId: string): BrandFiles | undefined {
  return brandFiles[brandId];
}

export function getProjectFiles(brandId: string, projectId: string): ProjectFiles | undefined {
  return projectFiles[`${brandId}/${projectId}`];
}

export function getContentMarkdown(contentId: string): string | undefined {
  return contentFiles[contentId];
}
