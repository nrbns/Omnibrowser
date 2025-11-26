import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

interface BrowserTabProps {
  url?: string;
}

export function BrowserTab({ url }: BrowserTabProps) {
  const webviewRef = useRef<any>(null);
  const loadingToastId = useRef<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    setIsLoading(true);
    setError(false);
    loadingToastId.current = toast.loading('Opening site...');

    const handleLoad = () => {
      setIsLoading(false);
      setError(false);
      if (loadingToastId.current) {
        toast.dismiss(loadingToastId.current);
        loadingToastId.current = undefined;
      }
      toast.success('Site loaded');
    };

    const handleFail = () => {
      setIsLoading(false);
      setError(true);
      if (loadingToastId.current) {
        toast.dismiss(loadingToastId.current);
        loadingToastId.current = undefined;
      }
      toast.error('Failed to load site');
    };

    webview.addEventListener('did-finish-load', handleLoad);
    webview.addEventListener('did-fail-load', handleFail);

    return () => {
      webview.removeEventListener('did-finish-load', handleLoad);
      webview.removeEventListener('did-fail-load', handleFail);
    };
  }, [url]);

  return (
    <div className="relative h-full w-full bg-slate-950">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90">
          <div className="text-2xl font-semibold text-white animate-pulse">Loading...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950 text-white">
          <p className="text-3xl font-semibold">Site refused to connect</p>
          <button
            type="button"
            onClick={() => webviewRef.current?.reload()}
            className="rounded-xl bg-blue-600 px-8 py-3 text-xl font-bold transition hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      )}

      <webview
        ref={webviewRef}
        src={url || 'https://google.com'}
        className="h-full w-full"
        allowpopups
        webpreferences="context-isolation=yes, native-window-open=yes"
        style={{ display: isLoading || error ? 'none' : 'block' }}
      />
    </div>
  );
}
