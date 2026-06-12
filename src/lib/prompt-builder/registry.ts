export type BrandRegistryItem = {
  id: string;
  label: string;
  folder: string;
  logoAsset?: string;
  logoPreviewPath?: string;
};

export type ProjectRegistryItem = {
  id: string;
  label: string;
  brandId: string;
  folder: string;
};

export const brands: BrandRegistryItem[] = [
  {
    id: "supplysync360",
    label: "SupplySync360",
    folder: "content/brands/supplysync360",
    logoAsset: "content/brands/supplysync360/assets/supplysync360-logo.svg",
    logoPreviewPath: "/brands/supplysync360/supplysync360-logo.svg",
  },
  {
    id: "rainfin",
    label: "RainFin",
    folder: "content/brands/rainfin",
    logoAsset: "content/brands/rainfin/assets/rainfin-logo.svg",
    logoPreviewPath: "/brands/rainfin/rainfin-logo.svg",
  },
  {
    id: "bma-open",
    label: "Block Markets Africa / Open",
    folder: "content/brands/bma-open",
    logoAsset: "content/brands/bma-open/assets/bma-open-logo.svg",
    logoPreviewPath: "/brands/bma-open/bma-open-logo.svg",
  },
  {
    id: "thenga",
    label: "Thenga",
    folder: "content/brands/thenga",
    logoAsset: "content/brands/thenga/assets/thenga-logo.svg",
    logoPreviewPath: "/brands/thenga/thenga-logo.svg",
  },
];

export const projects: ProjectRegistryItem[] = [
  {
    id: "executive-overview",
    label: "Executive Overview",
    brandId: "supplysync360",
    folder: "content/projects/supplysync360/executive-overview",
  },
  {
    id: "advisory-forum",
    label: "Advisory Forum",
    brandId: "rainfin",
    folder: "content/projects/rainfin/advisory-forum",
  },
  {
    id: "client-management",
    label: "Client Management",
    brandId: "bma-open",
    folder: "content/projects/bma-open/client-management",
  },
  {
    id: "investor-canvas",
    label: "Investor Canvas",
    brandId: "thenga",
    folder: "content/projects/thenga/investor-canvas",
  },
];
