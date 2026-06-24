export function containRect(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(input.targetWidth / input.sourceWidth, input.targetHeight / input.sourceHeight);
  const width = input.sourceWidth * scale;
  const height = input.sourceHeight * scale;
  return { x: (input.targetWidth - width) / 2, y: (input.targetHeight - height) / 2, width, height };
}
