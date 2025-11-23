import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  containerId?: string;
}

export function Portal({ children, containerId = 'portal-root' }: PortalProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    let container = document.getElementById(containerId) as HTMLElement | null;
    let created = false;

    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
      created = true;
    }

    setElement(container);

    return () => {
      if (created && container?.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [containerId]);

  if (!element) {
    return null;
  }

  return createPortal(children, element);
}
