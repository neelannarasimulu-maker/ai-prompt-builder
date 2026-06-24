import { brandGuardianAgent } from "./built-in/brand-guardian-agent";
import { outputContractAgent } from "./built-in/output-contract-agent";
import { promptClarityAgent } from "./built-in/prompt-clarity-agent";
import { remediationAdvisorAgent } from "./built-in/remediation-advisor-agent";
import { sourceFidelityAgent } from "./built-in/source-fidelity-agent";
import type {
  PromptAgent,
  PromptAgentInput,
  PromptAgentRun,
} from "./agent-types";

export const builtInAgents: PromptAgent[] = [
  sourceFidelityAgent,
  brandGuardianAgent,
  outputContractAgent,
  promptClarityAgent,
  remediationAdvisorAgent,
];

export class AgentRegistry {
  private readonly agents = new Map<string, PromptAgent>();

  constructor(initialAgents: PromptAgent[] = []) {
    for (const agent of initialAgents) this.register(agent);
  }

  register(agent: PromptAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ID is already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, agent);
  }

  list(): PromptAgent[] {
    return Array.from(this.agents.values());
  }

  runAll(input: PromptAgentInput): PromptAgentRun[] {
    return this.list().map((agent) => agent.run(input));
  }
}

export function createBuiltInAgentRegistry(): AgentRegistry {
  return new AgentRegistry(builtInAgents);
}
