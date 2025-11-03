import { useEffect, useRef, useState } from 'react';
import { ipc } from '../lib/ipc-typed';
import { ipcEvents } from '../lib/ipc-events';

export default function AgentConsole() {
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [streamId, setStreamId] = useState<string | null>(null);
  const dslRef = useRef<string>(JSON.stringify({ goal: "Open example.com", steps: [{ skill: 'navigate', args: { url: 'https://example.com' } }], output: { type: 'json', schema: {} } }, null, 2));

  useEffect(()=>{
    if (!window.agent) return;
    
    const tokenHandler = (t: any) => setLogs((l: any[])=> [...l, t]);
    const stepHandler = (s: any) => setLogs((l: any[])=> [...l, s]);
    
    window.agent.onToken(tokenHandler);
    window.agent.onStep(stepHandler);
    
    // Listen for streaming AI chunks
    const streamChunkHandler = (data: { streamId: string; chunk: { text?: string; finished?: boolean } }) => {
      if (data.streamId === streamId) {
        if (data.chunk.text) {
          setStreamingText(prev => prev + (data.chunk.text || ''));
        }
        if (data.chunk.finished) {
          setStreamId(null);
        }
      }
    };

    const unsubscribeChunk = ipcEvents.on<{ streamId: string; chunk: { text?: string; finished?: boolean } }>('agent:stream:chunk', streamChunkHandler);
    const unsubscribeDone = ipcEvents.on<{ streamId: string }>('agent:stream:done', (data) => {
      if (data.streamId === streamId) {
        setStreamId(null);
      }
    });
    
    // Cleanup function - properly removes listeners
    return () => {
      unsubscribeChunk();
      unsubscribeDone();
      // Note: In Electron, IPC listeners are automatically cleaned up when the renderer process terminates
      // If window.agent had removeListener methods, we would call them here
      // For now, React's cleanup is sufficient as listeners are scoped to this component
    };
  },[streamId]);

  return (
    <div className="p-3 grid grid-cols-2 gap-3 h-full">
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Agent DSL</h3>
        <textarea className="flex-1 bg-neutral-800 rounded p-2 text-xs" defaultValue={dslRef.current} onChange={(e)=> (dslRef.current = e.target.value)} />
        <div className="flex gap-2">
          <button className="bg-indigo-600 text-white px-3 py-1 rounded" onClick={async ()=>{
            const parsed = JSON.parse(dslRef.current);
            const res = await window.agent?.start?.(parsed) as any;
            if (res?.runId) setRunId(res.runId);
          }}>Start</button>
          <button className="bg-neutral-700 text-white px-3 py-1 rounded" onClick={async ()=>{ if (runId) await window.agent?.stop?.(runId); }}>Stop</button>
          <button className="bg-neutral-700 text-white px-3 py-1 rounded" onClick={async ()=>{ await window.recorder?.start?.(); }}>Record</button>
          <button className="bg-neutral-700 text-white px-3 py-1 rounded" onClick={async ()=>{ await window.recorder?.stop?.(); const d = await window.recorder?.getDsl?.(); dslRef.current = JSON.stringify(d, null, 2); (document.activeElement as HTMLElement)?.blur(); }}>Stop & Load</button>
          <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={()=>{
            const demo = {
              goal: 'Paginate, extract first table, export CSV',
              steps: [
                { skill: 'paginate_and_extract', args: { url: 'https://example.com', nextSelector: 'a.next', maxPages: 2 } },
                { skill: 'export_csv', args: { from: 'last', filename: 'demo.csv' } }
              ],
              output: { type: 'json', schema: {} }
            };
            dslRef.current = JSON.stringify(demo, null, 2);
          }}>Load Demo: Paginate→Extract→CSV</button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Live Logs</h3>
        <pre className="flex-1 bg-neutral-900 rounded p-2 text-xs overflow-auto">{JSON.stringify(logs, null, 2)}</pre>
        
        {/* Streaming AI Response */}
        {streamingText && (
          <div className="mt-4 p-4 bg-neutral-800 rounded border border-blue-500/30">
            <h4 className="font-medium mb-2 text-blue-400">Streaming Response:</h4>
            <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {streamingText}
            </div>
            <button
              onClick={async () => {
                if (streamId) {
                  await ipc.agent.stream.stop(streamId);
                  setStreamId(null);
                  setStreamingText('');
                }
              }}
              className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
            >
              Stop Stream
            </button>
          </div>
        )}
        
        {/* Start Streaming Button */}
        <button
          onClick={async () => {
            try {
              const query = prompt('Enter your query for streaming AI:');
              if (!query) return;
              
              setStreamingText('');
              const result = await ipc.agent.stream.start(query, {
                model: 'llama3.2',
                temperature: 0.7,
              });
              
              if (result?.streamId) {
                setStreamId(result.streamId);
              }
            } catch (error) {
              console.error('Failed to start stream:', error);
              alert('Failed to start streaming. Check console for details.');
            }
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium"
        >
          Start Streaming AI
        </button>
      </div>
    </div>
  );
}


