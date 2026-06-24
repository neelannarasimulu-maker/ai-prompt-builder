import type {
  CompilePromptByIdInput,
} from "../../lib/prompt-builder/compile-from-ids";
import type {
  CompiledPromptResult,
} from "../../lib/prompt-builder/prompt-compiler";

export type PromptBuildInput = CompilePromptByIdInput;
export type PromptBuildOutput = CompiledPromptResult;

export interface PromptCompilerPort {
  compile(input: PromptBuildInput): PromptBuildOutput;
}
