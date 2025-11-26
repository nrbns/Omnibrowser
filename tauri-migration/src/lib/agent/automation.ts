export type AutomationAction = 'navigate' | 'click' | 'type' | 'wait' | 'screenshot';

export interface AutomationStep {
  action: AutomationAction;
  selector?: string;
  value?: string;
  url?: string;
  tabId?: string;
}

type SequenceHooks = {
  onStepStart?: (step: AutomationStep, index: number) => void;
  onStepComplete?: (step: AutomationStep, index: number) => void;
  onError?: (step: AutomationStep, error: unknown) => void;
};

const AGENT_EVENT = 'agent-log-event';

declare global {
  interface Window {
    __agent_log?: (message: string) => void;
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

export function emitAutomationLog(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(AGENT_EVENT, { detail: message }));
}

const hasTauriInvoke = () =>
  typeof window !== 'undefined' && typeof window.__TAURI__?.invoke === 'function';

const sleep = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

function describeStep(step: AutomationStep) {
  switch (step.action) {
    case 'navigate':
      return `Navigate → ${step.url ?? 'about:blank'}`;
    case 'click':
      return `Click → ${step.selector ?? '(selector missing)'}`;
    case 'type':
      return `Type → ${step.selector ?? '(selector missing)'}`;
    case 'wait':
      return `Wait → ${step.value ?? '500'}ms`;
    case 'screenshot':
      return 'Screenshot current tab';
    default:
      return step.action;
  }
}

export async function runAutomationTask(step: AutomationStep) {
  const payload = {
    action: step.action,
    selector: step.selector,
    value: step.value,
    url: step.url,
    tabId: step.tabId,
  };

  if (step.action === 'wait' && !payload.value) {
    payload.value = '1000';
  }

  if (hasTauriInvoke()) {
    await window.__TAURI__!.invoke('run_agent_task', { task: payload }).catch(error => {
      throw new Error(
        typeof error === 'string' ? error : error?.message || 'run_agent_task failed'
      );
    });
    return;
  }

  // Browser fallback: best-effort simulation
  switch (step.action) {
    case 'navigate':
      emitAutomationLog(`[WEB] navigate → ${step.url ?? 'about:blank'}`);
      if (step.url) window.open(step.url, '_blank');
      break;
    case 'wait':
      await sleep(Number(payload.value ?? '1000'));
      break;
    default:
      emitAutomationLog(`[WEB] ${step.action} → ${step.selector ?? 'n/a'}`);
      await sleep(350);
  }
}

export async function runAutomationSequence(steps: AutomationStep[], hooks?: SequenceHooks) {
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    hooks?.onStepStart?.(step, index);
    emitAutomationLog(describeStep(step));
    try {
      await runAutomationTask(step);
      hooks?.onStepComplete?.(step, index);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      hooks?.onError?.(step, error);
      emitAutomationLog(`⚠️ ${describeStep(step)} failed: ${message}`);
      throw error;
    }
  }
}

if (typeof window !== 'undefined') {
  window.__agent_log = message => emitAutomationLog(message);
}
