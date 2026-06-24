import type { BrandAssetItem } from "../../lib/prompt-builder/registry";

export type BrandItem = {
  id: string;
  label: string;
  folder: string;
  logoPath?: string;
  logoPreviewPath?: string;
  logoAsset?: string;
  logoAssets: BrandAssetItem[];
};

export type ProjectItem = {
  id: string;
  label: string;
  brandId: string;
  folder: string;
};

export type ContentEntry = {
  path: string;
  type: string;
  contentSet: string;
  filename: string;
  label: string;
  raw: string;
};
