import React, { useEffect, useState, useCallback } from 'react';
import { MarkdownView } from './components/MarkdownView';
import { ThreadSidebar } from './components/ThreadSidebar';
import { ChatMessages } from './components/ChatMessages';
import { Modal } from './components/Modal';

const SettingsMenu: React.FC<{ onOpenKey: () => void; onToggleTheme: () => void; dark: boolean; onExport: () => void; onImport: () => void; }> = ({ onOpenKey, onToggleTheme, dark, onExport, onImport }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Preferences"
        aria-label="Preferences menu"
      >
        <span className="inline-block w-4 h-4">⚙️</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 text-sm overflow-hidden">
          <div className="py-1">
            <button
              onClick={() => { onToggleTheme(); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>{dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Theme</span>
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              onClick={() => { onExport(); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >Export conversations</button>
            <button
              onClick={() => { onImport(); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >Import conversations</button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              onClick={() => { onOpenKey(); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >Handle API key</button>
          </div>
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
};
import {
  createConversation,
  listConversations,
  listMessages,
  addMessage,
  buildCompositePrompt,
  buildMessageWindow,
  deleteConversation,
  estimateTokens,
  StoredConversation,
  StoredMessage,
  exportAll,
  importData
} from './storage/indexedDb';

export const App: React.FC = () => {
  const [dark, setDark] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [pendingModel, setPendingModel] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false); // indicates we attempted to load existing key
  const [keyAccepted, setKeyAccepted] = useState(false); // user confirmed key gate
  const [model, setModel] = useState('');
  const [models, setModels] = useState<any[]>([]);
  const textModels = models.filter(m => (m.modalities||['text']).includes('text') && !(m.modalities||[]).includes('image'));
  const imageModels = models.filter(m => (m.modalities||[]).includes('image'));
  const [loadingModels, setLoadingModels] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [mode, setMode] = useState<'chat' | 'image'>('chat');
  const [conversationId, setConversationId] = useState<string>('');
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  // derived helper to find currently selected conversation
  const currentConversation = conversations.find(c => c.id === conversationId) || null;
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageResults, setImageResults] = useState<Array<{url?: string; b64_json?: string}>>([]);
  const [imageModel, setImageModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [tokenCap, setTokenCap] = useState<number>(4000); // fixed cap (could be dynamic if fetched)
  const [lastWindowInfo, setLastWindowInfo] = useState<{usedTokens:number; trimmed:boolean; cap:number; kept:number} | null>(null);
  const [failedMessageIds, setFailedMessageIds] = useState<string[]>([]);

  // Token cap no longer user-editable; if future dynamic fetch needed, update setTokenCap here.

  useEffect(() => {
    window.electronAPI.currentTheme().then(isDark => setDark(isDark));
    // Attempt to load previously stored API key (securely decrypted in main)
    window.electronAPI.getApiKey().then(stored => {
      if (stored) {
        setApiKey(stored);
        setKeyAccepted(true); // auto-enter if key already stored
      }
    }).finally(() => setKeyLoaded(true));
  }, []);

  const refreshConversations = useCallback(async () => {
    const list = await listConversations();
    setConversations(list);
    if (!conversationId && list.length) setConversationId(list[0].id);
  }, [conversationId]);

  const refreshMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }
    const list = await listMessages(conversationId);
    setMessages(list);
  }, [conversationId]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  // When selecting a conversation, ensure the UI model matches the conversation's locked model
  useEffect(() => {
    if (currentConversation && currentConversation.model !== model) {
      setModel(currentConversation.model);
    }
  }, [currentConversation, model]);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
  }, [dark]);

  const toggleTheme = async () => {
    const newVal = await window.electronAPI.toggleTheme();
    setDark(newVal);
  };

  const loadModels = useCallback(async () => {
    if (!apiKey) return;
    setLoadingModels(true);
    setError(null);
    try {
      const list = await window.electronAPI.fetchModels(apiKey);
      const free = list.filter((m: any) => m.free);
      setModels(free);
      if (!model) {
        const firstText = free.find((m: any) => (m.modalities||['text']).includes('text'));
        if (firstText) setModel(firstText.id);
      }
      if (!imageModel) {
        const firstImage = free.find((m: any) => (m.modalities||[]).includes('image'));
        if (firstImage) setImageModel(firstImage.id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load models');
    } finally {
      setLoadingModels(false);
    }
  }, [apiKey, model]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const sendStreaming = async (opts?: { content?: string; reuseUserMessageId?: string }) => {
    setError(null);
    setResponse('');
    if (!apiKey) { setError('API key required'); return; }
    if (!model) { setError('Select a model'); return; }
    if (streaming) return; // prevent overlapping streams
    const content = (opts?.content ?? prompt).trim();
    if (!content) return;
    if (!conversationId) {
      const newId = Math.random().toString(36).slice(2);
      await createConversation(newId, model);
      setConversationId(newId);
      await refreshConversations();
    }
    const requestId = Math.random().toString(36).slice(2);
    setActiveRequestId(requestId);
    const userMessageId = opts?.reuseUserMessageId || ('u_' + Math.random().toString(36).slice(2));
    const assistantMessageId = 'a_' + Math.random().toString(36).slice(2);
    setStreaming(true);
    let assistantBuffer = '';
    const unsubscribe = window.electronAPI.onStreamEvent((evt) => {
      if (evt.requestId !== requestId) return;
      if (evt.type === 'start') {
        // no-op
      } else if (evt.type === 'delta') {
        try {
          const choice = evt.data.choices?.[0];
          const delta = choice?.delta?.content || choice?.message?.content || '';
          if (delta) {
            assistantBuffer += delta;
            setResponse(prev => (prev || '') + delta);
          }
        } catch { /* ignore */ }
      } else if (evt.type === 'error') {
        setError(evt.error || 'Stream error');
      } else if (evt.type === 'done' || evt.type === 'end') {
        setStreaming(false);
        setActiveRequestId(null);
        unsubscribe();
        // persist assistant message after completion
        if (conversationId && assistantBuffer) {
          addMessage({ id: assistantMessageId, conversationId, role: 'assistant', content: assistantBuffer, created_at: Date.now() }).then(() => {
            refreshMessages();
            // clear transient response buffer now that it's persisted
            setResponse(null);
          });
        }
      }
    });
    try {
      // Build trimmed message window (excluding the new user message until after window calc)
      const fullHistory = conversationId ? await listMessages(conversationId) : [];
      let historyForWindow = fullHistory;
      if (opts?.reuseUserMessageId) {
        // Exclude the existing user message so buildMessageWindow treats content as the latest
        historyForWindow = fullHistory.filter(m => m.id !== opts.reuseUserMessageId);
        // remove failure marker preemptively
        setFailedMessageIds(ids => ids.filter(id => id !== opts.reuseUserMessageId));
      }
      const windowResult = buildMessageWindow(historyForWindow, content, tokenCap);
      setLastWindowInfo({ usedTokens: windowResult.usedTokens, trimmed: windowResult.trimmed, cap: tokenCap, kept: windowResult.kept });
      if (!opts?.reuseUserMessageId) {
        await addMessage({ id: userMessageId, conversationId: conversationId!, role: 'user', content, created_at: Date.now() });
      }
      refreshMessages();
      const body = { model, messages: windowResult.messages, stream: true };
      await window.electronAPI.startStream({ requestId, apiKey, body });
    } catch (e: any) {
      setError(e.message || 'Failed to start stream');
      setStreaming(false);
      setActiveRequestId(null);
      unsubscribe();
      if (!opts?.reuseUserMessageId) {
        setFailedMessageIds(ids => ids.includes(userMessageId) ? ids : [...ids, userMessageId]);
      } else {
        setFailedMessageIds(ids => ids.includes(opts.reuseUserMessageId!) ? ids : [...ids, opts.reuseUserMessageId!]);
      }
    }
  };

  const cancelStreaming = async () => {
    if (!activeRequestId) return;
    try { await window.electronAPI.cancelStream(activeRequestId); } catch { /* ignore */ }
  };

  if (keyLoaded && !keyAccepted) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-950 p-6">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <div>
            <h1 className="text-lg font-semibold mb-1">OpenRouter Desktop</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              This app uses the OpenRouter API. Enter your OpenRouter API key to continue.
              Your key is stored securely on your machine using OS-level encryption.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wide text-gray-500">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => { if (!apiKey) return; try { await window.electronAPI.setApiKey(apiKey); setKeyAccepted(true); } catch { setError('Failed to save key'); } }}
                disabled={!apiKey}
                className="flex-1 px-3 py-2 rounded bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-indigo-500 transition"
              >Continue</button>
              {apiKey && <button
                onClick={() => setApiKey('')}
                className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              >Clear</button>}
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <p className="text-[10px] text-gray-500 mt-2">Need a key? Visit <a href="https://openrouter.ai/" className="text-indigo-600 dark:text-indigo-400 hover:underline" rel="noreferrer" target="_blank">openrouter.ai</a>.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <h1 className="font-semibold text-lg">OpenRouter Desktop</h1>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setMode('chat')} className={`px-2 py-1 rounded border text-xs ${mode==='chat' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>Chat</button>
          <button onClick={() => setMode('image')} className={`px-2 py-1 rounded border text-xs ${mode==='image' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>Image</button>
        </div>
        <div className="ml-auto flex items-center gap-2 relative">
          <SettingsMenu
            onOpenKey={() => setShowKeyModal(true)}
            onToggleTheme={toggleTheme}
            dark={dark}
            onExport={async () => {
              try {
                const data = await exportAll();
                const json = JSON.stringify(data, null, 2);
                await window.electronAPI.saveFile({ defaultPath: 'openrouter-conversations.json', content: json });
              } catch (e: any) { setError(e.message || 'Export failed'); }
            }}
            onImport={async () => {
              try {
                const result = await window.electronAPI.openFile();
                if (!result.opened || !result.content) return;
                const parsed = JSON.parse(result.content);
                const summary = await importData(parsed);
                await refreshConversations();
                if (conversationId) await refreshMessages();
                setError(null);
                // Provide a lightweight toast via error slot temporarily
                setTimeout(() => { setError(null); }, 4000);
                setError(`Imported conv:${summary.importedConversations} msg:${summary.importedMessages} (skipped conv:${summary.skippedConversations} msg:${summary.skippedMessages})`);
              } catch (e: any) { setError(e.message || 'Import failed'); }
            }}
          />
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        {mode === 'chat' && (
          <ThreadSidebar
            conversations={conversations}
            activeId={conversationId || null}
            onSelect={(id) => setConversationId(id)}
            onNew={() => {
              // Open modal & preselect currently active model (or first text model) for convenience
              const preselect = model || (textModels[0]?.id || '');
              setPendingModel(preselect);
              setShowNewConvModal(true);
            }}
            onDelete={async (id) => {
              // If deleting active conversation, we'll clear selection after
              await deleteConversation(id);
              await refreshConversations();
              if (conversationId === id) {
                setConversationId('');
                setMessages([]);
              }
            }}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex gap-4 items-start min-h-[52px]">
            {mode === 'chat' && currentConversation && (
              <div className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 px-3 py-1 rounded">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">Model:</span>
                <span className="text-indigo-800 dark:text-indigo-200">{currentConversation.model}</span>
                {lastWindowInfo && <span className="ml-2 text-[10px] text-gray-500">{lastWindowInfo.usedTokens}/{lastWindowInfo.cap}{lastWindowInfo.trimmed ? ' (trimmed)' : ''}</span>}
              </div>
            )}
            {mode === 'image' && (
              <div className="flex items-center gap-2 text-xs">
                <label className="text-sm">Image Model</label>
                <select value={imageModel} onChange={e => setImageModel(e.target.value)} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs">
                  <option value="" disabled>{loadingModels ? 'Loading...' : 'Select image model'}</option>
                  {imageModels.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                </select>
                <select value={imageSize} onChange={e => setImageSize(e.target.value)} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs">
                  {['512x512','768x768','1024x1024'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button disabled={loading} onClick={async () => {
                  setError(null); setLoading(true); setImageResults([]); setResponse(null);
                  try {
                    if (!apiKey) throw new Error('API key required');
                    if (!imageModel) throw new Error('Image model required');
                    if (!prompt) throw new Error('Prompt required');
                    const resp = await window.electronAPI.generateImage({ apiKey, model: imageModel, prompt, size: imageSize, n: 1 });
                    if (resp.format === 'json') {
                      const data = resp.data || [];
                      setImageResults(data);
                    } else if (resp.format === 'html') {
                      if (resp.images && resp.images.length) {
                        setImageResults(resp.images.map((src: string) => ({ url: src })));
                      } else {
                        setResponse(resp.html);
                      }
                    }
                  } catch (e: any) { setError(e.message || 'Image error'); }
                  finally { setLoading(false); }
                }} className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50 hover:bg-indigo-500 transition">
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            )}
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            {mode === 'chat' && (
              <>
                <ChatMessages
                  messages={messages}
                  streamingAssistantContent={streaming ? response : null}
                  failedUserMessageIds={failedMessageIds}
                  onRetry={(id) => {
                    if (streaming) return;
                    const msg = messages.find(m => m.id === id);
                    if (!msg) return;
                    sendStreaming({ content: msg.content, reuseUserMessageId: id });
                  }}
                />
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2 bg-white dark:bg-gray-950">
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!streaming && prompt.trim()) {
                          const toSend = prompt;
                          setPrompt(''); // clear immediately
                          // fire and forget
                          sendStreaming({ content: toSend });
                        }
                      }
                    }}
                    placeholder="Message..."
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    {!streaming && <button disabled={streaming || !prompt.trim()} onClick={() => { const toSend = prompt; setPrompt(''); sendStreaming({ content: toSend }); }} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-indigo-500 transition">Send</button>}
                    {streaming && <>
                      <button disabled className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium opacity-70">Streaming...</button>
                      <button onClick={cancelStreaming} className="px-4 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition">Cancel</button>
                    </>}
                  </div>
                </div>
              </>
            )}
            {mode === 'image' && <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                {imageResults.length > 0 ? (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {imageResults.map((img, idx) => {
                      const src = img.url ? img.url : (img.b64_json ? `data:image/png;base64,${img.b64_json}` : undefined);
                      if (!src) return <div key={idx} className="text-xs text-red-500">Invalid image data</div>;
                      return (
                        <div key={idx} className="relative group border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                          <img src={src} className="w-full h-full object-cover" />
                          <a href={src} target="_blank" rel="noopener noreferrer" className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/50 text-white text-xs transition">Open</a>
                        </div>
                      );
                    })}
                  </div>
                ) : response ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-xs">{response}</div>
                ) : (!loading && <div className="text-xs text-gray-500">No images yet</div>)}
              </div>}
          </div>
        </div>
      </main>
      <footer className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">Powered by OpenRouter API</footer>
      <Modal
        open={showKeyModal}
        title="API Key"
        onClose={() => setShowKeyModal(false)}
        footer={<>
          <button onClick={() => setShowKeyModal(false)} className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Close</button>
          <button
            onClick={async () => { try { if (apiKey) await window.electronAPI.setApiKey(apiKey); setShowKeyModal(false); } catch { setError('Failed to save key'); } }}
            disabled={!apiKey}
            className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50 hover:bg-indigo-500"
          >Save</button>
          {apiKey && <button
            onClick={async () => { try { await window.electronAPI.clearApiKey(); setApiKey(''); } catch { setError('Failed to clear'); } }}
            className="px-3 py-1.5 text-xs rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
          >Clear</button>}
        </>}
      >
        <p className="text-xs text-gray-500 mb-2">Your key is encrypted locally via OS secure storage.</p>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-or-..."
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
        />
      </Modal>
      <Modal
        open={showNewConvModal}
        title="New Conversation"
        onClose={() => { setShowNewConvModal(false); setPendingModel(''); }}
        footer={<>
          <button onClick={() => { setShowNewConvModal(false); setPendingModel(''); }} className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          <button
            onClick={async () => {
              if (!pendingModel) return;
              try {
                const id = Math.random().toString(36).slice(2);
                await createConversation(id, pendingModel);
                setConversationId(id);
                setModel(pendingModel);
                setShowNewConvModal(false);
                setPendingModel('');
                await refreshConversations();
                await refreshMessages();
              } catch (e: any) {
                setError('Failed to create conversation: ' + (e?.message || 'unknown error'));
              }
            }}
            disabled={!pendingModel}
            className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50 hover:bg-indigo-500"
          >Create</button>
        </>}
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Select a model for this conversation. It will be locked thereafter.</p>
          <div>
            <label className="block text-xs mb-1 text-gray-600 dark:text-gray-400">Model</label>
            <select
              value={pendingModel}
              onChange={e => setPendingModel(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
            >
              <option value="">{loadingModels ? 'Loading models...' : 'Select model'}</option>
              {textModels.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
