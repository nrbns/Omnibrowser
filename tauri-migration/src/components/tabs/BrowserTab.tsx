import { memo, useEffect, useRef } from 'react';
import { isTauriRuntime } from '../../lib/env';

type LoadState = 'start' | 'finish' | 'error';

export interface BrowserTabProps {
  url: string;
  title?: string;
  className?: string;
  onLoadStateChange?: (state: LoadState) => void;
}

type NativeWebviewElement = HTMLElement & {
  src?: string;
  setAttribute: (name: string, value: string) => void;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: string;
        useragent?: string;
        partition?: string;
      };
    }
  }
}

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) OmniBrowser/0.1 Safari/537.36';

const cx = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

export const BrowserTab = memo(function BrowserTab({
  url,
  title,
  className,
  onLoadStateChange,
}: BrowserTabProps) {
  const elementRef = useRef<NativeWebviewElement | HTMLIFrameElement | null>(null);
  const useNativeWebview = isTauriRuntime();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleLoad = () => onLoadStateChange?.('finish');
    const handleError = () => onLoadStateChange?.('error');

    element.addEventListener('load', handleLoad as EventListener);
    element.addEventListener('error', handleError as EventListener);

    onLoadStateChange?.('start');

    if ('src' in element && element.src !== url) {
      element.src = url;
    } else {
      element.setAttribute('src', url);
    }

    return () => {
      element.removeEventListener('load', handleLoad as EventListener);
      element.removeEventListener('error', handleError as EventListener);
    };
  }, [url, onLoadStateChange]);

  if (useNativeWebview) {
    return (
      <webview
        ref={elementRef as React.MutableRefObject<NativeWebviewElement | null>}
        src={url}
        allowpopups="true"
        useragent={USER_AGENT}
        partition="persist:omnibrowser"
        data-tauri-drag-region="true"
        className={cx('h-full w-full border-0', className)}
      />
    );
  }

  return (
    <iframe
      ref={elementRef as React.MutableRefObject<HTMLIFrameElement | null>}
      src={url}
      title={title ?? 'OmniBrowser tab'}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      allow="accelerometer; camera; fullscreen; geolocation; microphone; clipboard-read; clipboard-write; autoplay"
      className={cx('h-full w-full border-0', className)}
    />
  );
});
