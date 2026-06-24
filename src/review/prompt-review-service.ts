import { PromptBuildService } from "../core/prompt-builder/prompt-build-service";
import type {
  PromptBuildInput,
  PromptBuildOutput,
} from "../core/prompt-builder/prompt-build-types";
import { PromptReviewOrchestrator } from "./prompt-review-orchestrator";
import type {
  PromptBuildAndReviewResult,
  PromptReviewResult,
} from "./prompt-review-types";

export class PromptReviewService {
  constructor(
    private readonly promptBuildService: PromptBuildService = new PromptBuildService(),
    private readonly orchestrator: PromptReviewOrchestrator = new PromptReviewOrchestrator()
  ) {}

  review(buildInput: PromptBuildInput, buildOutput: PromptBuildOutput): PromptReviewResult {
    return this.orchestrator.review({ buildInput, buildOutput });
  }

  buildAndReview(buildInput: PromptBuildInput): PromptBuildAndReviewResult {
    const buildOutput = this.promptBuildService.build(buildInput);
    return {
      buildOutput,
      review: this.review(buildInput, buildOutput),
    };
  }
}
