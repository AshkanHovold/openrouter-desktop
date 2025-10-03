import React from 'react';
import { StoredConversation } from '../storage/indexedDb';

interface ThreadSidebarProps {
  conversations: StoredConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({ conversations, activeId, onSelect, onNew, onDelete }) => {
  return (
    <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-950">
      <div className="p-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <button onClick={onNew} className="ml-auto text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700">New</button>
      </div>
      <div className="flex-1 overflow-auto text-sm">
        {conversations.length === 0 && <div className="p-3 text-xs text-gray-500">No conversations yet</div>}
        {conversations.map(c => (
          <div key={c.id} className={`group flex items-stretch border-b border-gray-100 dark:border-gray-800 ${c.id===activeId ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}> 
            <button
              onClick={() => onSelect(c.id)}
              className="flex-1 text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <div className="truncate font-medium text-[11px] text-gray-700 dark:text-gray-200">{c.model}</div>
              <div className="truncate text-[10px] text-gray-500">{c.id.slice(0,12)}</div>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(c.id)}
                title="Delete conversation"
                className="opacity-0 group-hover:opacity-100 px-2 text-[10px] text-red-600 hover:text-white hover:bg-red-600 transition"
              >✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
