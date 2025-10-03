import React, { useEffect, useRef } from 'react';
import { StoredMessage } from '../storage/indexedDb';
import { MarkdownView } from './MarkdownView';

interface ChatMessagesProps {
  messages: StoredMessage[];
  streamingAssistantContent: string | null;
  autoscroll?: boolean;
  failedUserMessageIds?: string[];
  onRetry?: (id: string) => void;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, streamingAssistantContent, autoscroll = true, failedUserMessageIds = [], onRetry }) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoscroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, streamingAssistantContent, autoscroll]);

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {messages.map(m => {
        const failed = m.role === 'user' && failedUserMessageIds.includes(m.id);
        return (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}> 
            <div className={`relative group max-w-[70%] rounded px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${m.role==='user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}>
              {m.role === 'assistant' ? <MarkdownView content={m.content} /> : m.content}
              {failed && (
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <span className="opacity-75">Failed</span>
                  {onRetry && <button
                    onClick={() => onRetry(m.id)}
                    className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-500 text-[10px]"
                    title="Retry sending this message"
                  >Retry</button>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {streamingAssistantContent && (
        <div className="flex justify-start">
          <div className="max-w-[70%] rounded px-3 py-2 text-sm shadow-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-dashed border-gray-300 dark:border-gray-700">
            <MarkdownView content={streamingAssistantContent || ''} />
            <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">Streaming...</div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};
