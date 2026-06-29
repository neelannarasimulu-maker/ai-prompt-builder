/** Phase 15D: Source version detection and selection for content with multiple MD versions */

export type SourceVersionInfo = {
  path: string;
  label: string;
  folderName: string;
  version?: string;
  filename: string;
  isNewest?: boolean;
};

/**
 * Detects if multiple source versions exist for the same brand/project/content set.
 * Looks for version folders (V001, V002, v1, v2, etc.) and groups markdown files by folder.
 * Only includes content sets that have multiple version folders.
 */
export function detectSourceVersions(contentFiles: Array<{ path: string; label: string; filename: string; contentSet: string }>): Map<string, SourceVersionInfo[]> {
  const groupedBySrc = new Map<string, SourceVersionInfo[]>();

  // Group by content set to find multiple sources
  const byContentSet = new Map<string, typeof contentFiles>();
  for (const file of contentFiles) {
    if (!byContentSet.has(file.contentSet)) {
      byContentSet.set(file.contentSet, []);
    }
    byContentSet.get(file.contentSet)!.push(file);
  }

  // For each content set, check if there are multiple version folders
  for (const [contentSet, files] of byContentSet) {
    // Extract folder names from paths (e.g., "V001" from "...visuals/V001/source.md")
    const folderVersions = new Map<string, SourceVersionInfo[]>();
    
    for (const file of files) {
      // Parse path to extract folder name: look for patterns like V001, v1, _v2, etc.
      const pathParts = file.path.replace(/\\/g, '/').split('/');
      let folderName = '';
      let version: string | undefined;
      
      // Find a folder that looks like a version folder (V\d+, v\d+, _v\d+, etc.)
      for (let i = pathParts.length - 2; i >= 0; i--) {
        const part = pathParts[i];
        const folderMatch = part.match(/^[_-]?v?(\d+)$/i);
        if (folderMatch) {
          folderName = part;
          version = folderMatch[1];
          break;
        }
      }
      
      // If found a version folder, group by it
      if (folderName) {
        if (!folderVersions.has(folderName)) {
          folderVersions.set(folderName, []);
        }
        folderVersions.get(folderName)!.push({
          ...file,
          folderName,
          version,
          isNewest: false,
        } as SourceVersionInfo);
      }
    }

    // Only include if there are multiple version folders
    if (folderVersions.size > 1) {
      const allVersioned: SourceVersionInfo[] = [];
      for (const [, versions] of folderVersions) {
        allVersioned.push(...versions);
      }

      // Sort by version number descending, then by filename
      allVersioned.sort((a, b) => {
        if (a.version && b.version) {
          const aNum = parseInt(a.version, 10);
          const bNum = parseInt(b.version, 10);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return bNum - aNum;
          }
        }
        return a.filename.localeCompare(b.filename);
      });

      // Mark newest (highest version number)
      if (allVersioned.length > 0 && allVersioned[0].version) {
        allVersioned[0].isNewest = true;
      }

      groupedBySrc.set(contentSet, allVersioned);
    }
  }

  return groupedBySrc;
}

/**
 * Formats a version label for display, showing only folder name.
 */
export function formatVersionLabel(info: SourceVersionInfo): string {
  return info.folderName;
}

/**
 * Extracts unique version folder names from multiple source versions.
 */
export function getUniqueFolderNames(versions: SourceVersionInfo[]): Array<{ folderName: string; isNewest?: boolean }> {
  const seen = new Set<string>();
  const result: Array<{ folderName: string; isNewest?: boolean }> = [];
  for (const v of versions) {
    if (!seen.has(v.folderName)) {
      seen.add(v.folderName);
      result.push({ folderName: v.folderName, isNewest: v.isNewest });
    }
  }
  return result;
}
