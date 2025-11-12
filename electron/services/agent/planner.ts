/**
 * Multi-step Planner - Generates step-by-step plans from user goals
 */

import { getOllamaAdapter } from './ollama-adapter';
import { registry } from './skills/registry';

export interface PlanStep {
  id: string;
  action: string;
  args: Record<string, unknown>;
  dependsOn?: string[];
  expectedOutput?: string;
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  estimatedDuration?: number;
  createdAt: number;
}

export class Planner {
  /**
   * Generate a plan from a user goal
   */
  async generatePlan(goal: string, context?: { mode?: string; constraints?: string[] }): Promise<Plan> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Check if Ollama is available for LLM-based planning
    const ollama = getOllamaAdapter();
    const isAvailable = await ollama.checkAvailable();

    if (isAvailable) {
      return await this.generatePlanWithLLM(goal, planId, context);
    } else {
      return await this.generatePlanHeuristic(goal, planId, context);
    }
  }

  /**
   * Generate plan using LLM (Ollama)
   */
  private async generatePlanWithLLM(goal: string, planId: string, context?: { mode?: string; constraints?: string[] }): Promise<Plan> {
    const prompt = `Generate a step-by-step plan to achieve this goal: "${goal}"
${context?.mode ? `Mode: ${context.mode}` : ''}
${context?.constraints?.length ? `Constraints: ${context.constraints.join(', ')}` : ''}

Available actions:
- search: Search the web for information
- navigate: Open a URL
- extract: Extract content from a webpage
- summarize: Summarize text content
- pdf:parse: Parse a PDF document
- yt:transcript: Extract YouTube transcript
- extract_table: Extract table data

Format as JSON array of steps:
[
  {
    "action": "search",
    "args": {"query": "..."},
    "expectedOutput": "..."
  },
  ...
]`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        throw new Error('LLM planning failed');
      }

      const data = await response.json() as { response: string };
      const stepsJson = JSON.parse(data.response) as Array<{ action: string; args: Record<string, unknown>; expectedOutput?: string }>;

      const steps: PlanStep[] = stepsJson.map((step, index) => ({
        id: `step_${index}`,
        action: step.action,
        args: step.args,
        expectedOutput: step.expectedOutput,
        dependsOn: index > 0 ? [`step_${index - 1}`] : undefined,
      }));

      return {
        id: planId,
        goal,
        steps,
        estimatedDuration: this.estimateDuration(steps),
        createdAt: Date.now(),
      };
    } catch (error) {
      console.error('[Planner] LLM planning failed, falling back to heuristic:', error);
      return await this.generatePlanHeuristic(goal, planId, context);
    }
  }

  /**
   * Generate plan using heuristic patterns
   */
  private async generatePlanHeuristic(goal: string, planId: string, _context?: { mode?: string; constraints?: string[] }): Promise<Plan> {
    const steps: PlanStep[] = [];
    
    // Detect goal type and generate appropriate steps
    const goalLower = goal.toLowerCase();

    // Research-style goals
    if (goalLower.includes('research') || goalLower.includes('find') || goalLower.includes('search')) {
      steps.push({
        id: 'step_0',
        action: 'search',
        args: { query: goal },
        expectedOutput: 'Search results with relevant information',
      });
      
      steps.push({
        id: 'step_1',
        action: 'extract',
        args: {},
        dependsOn: ['step_0'],
        expectedOutput: 'Extracted content from top results',
      });

      steps.push({
        id: 'step_2',
        action: 'summarize',
        args: { citations: true },
        dependsOn: ['step_1'],
        expectedOutput: 'Summary with citations',
      });
    }
    // PDF analysis goals
    else if (goalLower.includes('pdf') || goalLower.includes('document')) {
      steps.push({
        id: 'step_0',
        action: 'pdf:parse',
        args: {},
        expectedOutput: 'Parsed PDF content and metadata',
      });
      
      steps.push({
        id: 'step_1',
        action: 'summarize',
        args: {},
        dependsOn: ['step_0'],
        expectedOutput: 'PDF summary',
      });
    }
    // YouTube goals
    else if (goalLower.includes('youtube') || goalLower.includes('video') || goalLower.includes('transcript')) {
      steps.push({
        id: 'step_0',
        action: 'yt:transcript',
        args: {},
        expectedOutput: 'Video transcript',
      });

      steps.push({
        id: 'step_1',
        action: 'summarize',
        args: {},
        dependsOn: ['step_0'],
        expectedOutput: 'Transcript summary',
      });
    }
    // Table extraction goals
    else if (goalLower.includes('table') || goalLower.includes('data')) {
      steps.push({
        id: 'step_0',
        action: 'extract_all_tables',
        args: {},
        expectedOutput: 'Extracted table data',
      });
    }
    // Default: generic plan
    else {
      steps.push({
        id: 'step_0',
        action: 'search',
        args: { query: goal },
        expectedOutput: 'Search results',
      });
    }

    return {
      id: planId,
      goal,
      steps,
      estimatedDuration: this.estimateDuration(steps),
      createdAt: Date.now(),
    };
  }

  /**
   * Estimate plan duration (in seconds)
   */
  private estimateDuration(steps: PlanStep[]): number {
    // Rough estimates per action type (in seconds)
    const actionDurations: Record<string, number> = {
      search: 3,
      navigate: 2,
      extract: 5,
      summarize: 10,
      'pdf:parse': 15,
      'yt:transcript': 20,
      extract_table: 5,
      extract_all_tables: 10,
    };

    let total = 0;
    for (const step of steps) {
      total += actionDurations[step.action] || 5;
    }

    return total;
  }

  /**
   * Validate plan (check if actions exist in registry)
   */
  validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const step of plan.steps) {
      const skill = registry.get(step.action);
      if (!skill) {
        errors.push(`Unknown action: ${step.action} (step ${step.id})`);
      }

      // Check dependencies
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          const depStep = plan.steps.find(s => s.id === depId);
          if (!depStep) {
            errors.push(`Missing dependency: ${depId} (step ${step.id})`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let plannerInstance: Planner | null = null;

export function getPlanner(): Planner {
  if (!plannerInstance) {
    plannerInstance = new Planner();
  }
  return plannerInstance;
}

