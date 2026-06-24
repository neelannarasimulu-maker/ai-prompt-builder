import { compilePromptFromIds as compilePrompt } from "../../lib/prompt-builder/compile-from-ids";
import type {
  PromptBuildInput,
  PromptBuildOutput,
  PromptCompilerPort,
} from "./prompt-build-types";

export class LegacyCompilerAdapter implements PromptCompilerPort {
  compile(input: PromptBuildInput): PromptBuildOutput {
    return compilePrompt(input);
  }
}
