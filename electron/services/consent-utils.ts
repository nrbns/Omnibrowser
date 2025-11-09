// @ts-nocheck

import { BrowserWindow } from 'electron';
import { ConsentAction, ConsentLedger } from './consent-ledger';
import { waitForConsent } from './consent-ipc';

const ledger = new ConsentLedger();

export interface ConsentRequestOptions extends ConsentAction {
  risk?: 'low' | 'medium' | 'high';
}

export async function ensureConsent(
  win: BrowserWindow | null,
  action: ConsentRequestOptions,
): Promise<boolean> {
  const consentAction: ConsentAction = {
    type: action.type,
    description: action.description,
    target: action.target,
    metadata: action.metadata,
    risk: action.risk ?? 'medium',
  };

  if (ledger.hasValidConsent(consentAction)) {
    return true;
  }

  const consentId = ledger.createRequest(consentAction);

  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('agent:consent:request', {
        id: consentId,
        action: {
          type: consentAction.type,
          description: consentAction.description,
          risk: consentAction.risk ?? 'medium',
        },
      });
    } catch (error) {
      console.warn('[Consent] Failed to send consent request to renderer', error);
    }
  }

  const approved = await waitForConsent(consentId);
  if (!approved) {
    ledger.revoke(consentId);
  }
  return approved;
}

