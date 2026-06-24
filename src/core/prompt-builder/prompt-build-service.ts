import { LegacyCompilerAdapter } from "./legacy-compiler-adapter";
import type {
  PromptBuildInput,
  PromptBuildOutput,
  PromptCompilerPort,
} from "./prompt-build-types";

export class PromptBuildService {
  constructor(
    private readonly compiler: PromptCompilerPort = new LegacyCompilerAdapter()
  ) {}

  build(input: PromptBuildInput): PromptBuildOutput {
    return this.compiler.compile(input);
  }
}
