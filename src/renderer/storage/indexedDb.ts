import { openDB, IDBPDatabase } from 'idb';

export interface StoredConversation { id: string; model: string; created_at: number; }
export interface StoredMessage { id: string; conversationId: string; role: 'user' | 'assistant'; content: string; created_at: number; }

const DB_NAME = 'openrouter_client';
const DB_VERSION = 1;
const CONV_STORE = 'conversations';
const MSG_STORE = 'messages';

let dbPromise: Promise<IDBPDatabase> | null = null;

async function openWithRetry(attempt = 1): Promise<IDBPDatabase> {
  try {
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CONV_STORE)) {
          const conv = db.createObjectStore(CONV_STORE, { keyPath: 'id' });
          conv.createIndex('created_at', 'created_at', { unique: false });
        }
        if (!db.objectStoreNames.contains(MSG_STORE)) {
          const msgs = db.createObjectStore(MSG_STORE, { keyPath: 'id' });
          msgs.createIndex('conversationId', 'conversationId', { unique: false });
          msgs.createIndex('conversationTime', ['conversationId','created_at']);
        }
      }
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    // Chromium sometimes leaves a stale LOCK when multiple dev instances run; retry a few times.
    if (/LOCK|busy|temporarily unavailable/i.test(msg) && attempt < 8) {
      await new Promise(r => setTimeout(r, 150 * attempt));
      return openWithRetry(attempt + 1);
    }
    throw e;
  }
}

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openWithRetry();
  }
  return dbPromise;
}

export async function createConversation(id: string, model: string): Promise<StoredConversation> {
  try {
    const db = await getDB();
    const conv: StoredConversation = { id, model, created_at: Date.now() };
    await db.put(CONV_STORE, conv);
    return conv;
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (/LOCK/i.test(msg)) {
      throw new Error('Database is locked by another running instance. Close other windows and try again.');
    }
    throw e;
  }
}

export async function listConversations(): Promise<StoredConversation[]> {
  const db = await getDB();
  const all = await db.getAll(CONV_STORE);
  return all.sort((a,b) => b.created_at - a.created_at);
}

export async function addMessage(message: StoredMessage): Promise<void> {
  const db = await getDB();
  await db.put(MSG_STORE, message);
}

export async function listMessages(conversationId: string): Promise<StoredMessage[]> {
  const db = await getDB();
  const idx = db.transaction(MSG_STORE).store.index('conversationTime');
  const range = IDBKeyRange.bound([conversationId, 0],[conversationId, Date.now()]);
  const results: StoredMessage[] = [];
  let cursor = await idx.openCursor(range);
  while (cursor) {
    results.push(cursor.value as StoredMessage);
    cursor = await cursor.continue();
  }
  return results;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([CONV_STORE, MSG_STORE], 'readwrite');
  await tx.objectStore(CONV_STORE).delete(conversationId);
  const msgStore = tx.objectStore(MSG_STORE);
  const idx = msgStore.index('conversationId');
  let cursor = await idx.openCursor(IDBKeyRange.only(conversationId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Export all conversations/messages to structured JSON
export async function exportAll(): Promise<any> {
  const db = await getDB();
  const conversations = await db.getAll(CONV_STORE) as StoredConversation[];
  const messages = await db.getAll(MSG_STORE) as StoredMessage[];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations,
    messages,
  };
}

// Import payload (merge). Skips conversations that already exist unless force flag later.
export async function importData(payload: any): Promise<{ importedConversations: number; importedMessages: number; skippedConversations: number; skippedMessages: number; }>{
  if (!payload || typeof payload !== 'object') throw new Error('Invalid import payload');
  if (payload.version !== 1) throw new Error('Unsupported export version');
  const db = await getDB();
  const existing = await db.getAllKeys(CONV_STORE) as string[];
  const conversations: StoredConversation[] = Array.isArray(payload.conversations) ? payload.conversations : [];
  const messages: StoredMessage[] = Array.isArray(payload.messages) ? payload.messages : [];
  const tx = db.transaction([CONV_STORE, MSG_STORE], 'readwrite');
  let importedConversations = 0, skippedConversations = 0;
  for (const c of conversations) {
    if (!c || !c.id || !c.model) { skippedConversations++; continue; }
    if (existing.includes(c.id)) { skippedConversations++; continue; }
    await tx.objectStore(CONV_STORE).put(c);
    importedConversations++;
  }
  // Build set of allowed conversation IDs after merge
  const allConvIds = new Set((await tx.objectStore(CONV_STORE).getAllKeys()) as string[]);
  let importedMessages = 0, skippedMessages = 0;
  for (const m of messages) {
    if (!m || !m.id || !m.conversationId || !m.role || typeof m.content !== 'string') { skippedMessages++; continue; }
    if (!allConvIds.has(m.conversationId)) { skippedMessages++; continue; }
    try { await tx.objectStore(MSG_STORE).put(m); importedMessages++; } catch { skippedMessages++; }
  }
  await tx.done;
  return { importedConversations, importedMessages, skippedConversations, skippedMessages };
}

// Simple approximate token counter (rough heuristic ~4 chars per token for English)
// Lightweight tokenizer (pure JS): approximates GPT-style tokens by splitting on common boundaries
// Strategy:
// 1. Normalize to NFC
// 2. Split on whitespace
// 3. Further split chunks by punctuation & camelCase boundaries
// 4. Count resulting subunits, adjusting for very short sequences
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const normalized = text.normalize('NFC');
  const whitespaceSplit = normalized.split(/\s+/).filter(Boolean);
  let count = 0;
  for (const part of whitespaceSplit) {
    // split camelCase and snake/dash boundaries and punctuation clusters
    const segments = part
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase
      .split(/([,.;:!?"'`\-_/\\(){}\[\]])/)
      .filter(s => s && !/^[\s]+$/.test(s));
    for (const seg of segments) {
      if (/^[,.;:!?"'`\-_/\\(){}\[\]]$/.test(seg)) {
        count += 1; // punctuation token
      } else if (seg.length <= 4) {
        count += 1; // short chunk ~ single token
      } else if (seg.length <= 12) {
        count += 2; // medium length maybe ~2 tokens
      } else {
        // long chunk: approximate 4 chars per token after first 8 chars
        count += Math.ceil(seg.length / 4);
      }
    }
  }
  return Math.max(1, count);
}

export interface BuildCompositeOptions {
  maxTokens: number; // hard cap for combined history + latest
}

export function buildCompositePrompt(history: StoredMessage[], latest: string, opts: BuildCompositeOptions): { prompt: string; usedTokens: number; trimmed: boolean; kept: number; } {
  // Build lines oldest->newest; we'll trim from the start if over limit.
  const lines = history.map(m => `${m.role === 'assistant' ? 'ai answer' : 'user msg'} ${m.content}`);
  const latestLine = latest;
  // Start from full and trim oldest until within token cap.
  let trimmed = false;
  let keptStartIndex = 0;
  while (keptStartIndex < lines.length) {
    const slice = lines.slice(keptStartIndex);
    const candidate = `This is the previous messages in this conversation:\n${slice.join('\n')}\nEnd of previous messages. This is the latest message:\n${latestLine}`;
    const tokens = estimateTokens(candidate);
    if (tokens <= opts.maxTokens) {
      return { prompt: candidate, usedTokens: tokens, trimmed, kept: slice.length };
    }
    keptStartIndex++; // drop one more oldest message
    trimmed = true;
  }
  // If even with no history it's too large, fall back to latest only
  const base = `This is the previous messages in this conversation:\n(omitted)\nEnd of previous messages. This is the latest message:\n${latestLine}`;
  const tokens = estimateTokens(base);
  return { prompt: base, usedTokens: tokens, trimmed: true, kept: 0 };
}

export interface MessageWindowResult {
  messages: { role: 'user' | 'assistant'; content: string }[];
  usedTokens: number;
  trimmed: boolean;
  kept: number; // number of original history messages kept (excluding latest new user message)
}

export function buildMessageWindow(history: StoredMessage[], latestUser: string, maxTokens: number): MessageWindowResult {
  // We'll include messages oldest -> newest and ensure the final array (including new latest user) is within maxTokens
  const baseMessages = history.map(m => ({ role: m.role, content: m.content }));
  const latest = { role: 'user' as const, content: latestUser };
  let start = 0;
  let trimmed = false;
  while (start < baseMessages.length) {
    const slice = baseMessages.slice(start); // oldest after trimming
    const candidate = [...slice, latest];
    const totalTokens = candidate.reduce((acc, m) => acc + estimateTokens(m.content), 0);
    if (totalTokens <= maxTokens) {
      return { messages: candidate, usedTokens: totalTokens, trimmed, kept: slice.length };
    }
    start++;
    trimmed = true;
  }
  // If even with no history it's too large, just use latest
  const tokens = estimateTokens(latest.content);
  return { messages: [latest], usedTokens: tokens, trimmed: true, kept: 0 };
}
