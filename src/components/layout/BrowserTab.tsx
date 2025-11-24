import { useEffect, useRef } from 'react';

interface BrowserTabProps {
  url: string;
  title?: string;
  className?: string;
  onLoad?: (event: { blocked: boolean; title?: string }) => void;
  onError?: (message?: string) => void;
}

export function BrowserTab({ url, title, className, onLoad, onError }: BrowserTabProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      let blocked = false;
      let resolvedTitle: string | undefined;
      try {
        resolvedTitle = iframe.contentDocument?.title || undefined;
      } catch {
        blocked = true;
      }
      onLoad?.({ blocked, title: resolvedTitle });
    };

    const handleError = () => {
      onError?.('Failed to load this page. The site may block embedded tabs.');
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    iframe.src = url;

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
      iframe.src = 'about:blank';
    };
  }, [url, onLoad, onError]);

  return (
    <iframe
      ref={iframeRef}
      className={className}
      title={title || 'Browser tab'}
      aria-label={title || 'Browser tab'}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-pointer-lock allow-modals allow-downloads"
      allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; fullscreen; geolocation; microphone; midi; payment"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
