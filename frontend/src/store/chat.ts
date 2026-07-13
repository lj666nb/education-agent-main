import { create } from 'zustand'
import type { Message } from '../components/MessageList'

const LS_THINKING = 'chat_enable_thinking'
const LS_WEBSEARCH = 'chat_enable_websearch'

interface ChatState {
  /* ── Stream cache — survives component unmount ── */
  /** messages keyed by chatId, for the currently active streaming chat */
  messagesByChat: Record<string, Message[]>
  currentChatId: string | null
  isLoading: boolean

  /* ── Settings — persisted to localStorage ── */
  enableThinking: boolean
  enableWebsearch: boolean

  /* ── Actions ── */
  setCurrentChatId: (id: string | null) => void
  getMessages: (chatId: string | null) => Message[]
  setMessagesForChat: (chatId: string, messages: Message[]) => void
  /** Append new messages (user + assistant placeholders) */
  appendMessages: (chatId: string, msgs: Message[]) => void
  /** Update the last assistant message content during streaming */
  updateLastAssistant: (chatId: string, updater: (prev: Message) => Message) => void
  /** Update a specific message by ID */
  updateMessage: (chatId: string, messageId: string, updater: (prev: Message) => Message) => void
  setIsLoading: (v: boolean) => void
  setEnableThinking: (v: boolean) => void
  setEnableWebsearch: (v: boolean) => void
  /** Clear cache for a chat */
  resetChat: (chatId: string) => void
  /** Clear everything */
  resetAll: () => void
}

function loadBool(key: string, fallback = false): boolean {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === 'true' }
  catch { return fallback }
}

function saveBool(key: string, val: boolean) {
  try { localStorage.setItem(key, String(val)) } catch {}
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByChat: {},
  currentChatId: null,
  isLoading: false,
  enableThinking: loadBool(LS_THINKING),
  enableWebsearch: loadBool(LS_WEBSEARCH),

  setCurrentChatId: (id) => set({ currentChatId: id }),

  getMessages: (chatId) => {
    if (!chatId) return []
    return get().messagesByChat[chatId] || []
  },

  setMessagesForChat: (chatId, messages) =>
    set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: messages } })),

  appendMessages: (chatId, msgs) =>
    set((s) => {
      const existing = s.messagesByChat[chatId] || []
      return { messagesByChat: { ...s.messagesByChat, [chatId]: [...existing, ...msgs] } }
    }),

  updateLastAssistant: (chatId, updater) =>
    set((s) => {
      const msgs = s.messagesByChat[chatId]
      if (!msgs || msgs.length === 0) return s
      const idx = msgs.length - 1
      // Only update if last message is assistant
      if (msgs[idx].role !== 'assistant') return s
      const updated = [...msgs]
      updated[idx] = updater(msgs[idx])
      return { messagesByChat: { ...s.messagesByChat, [chatId]: updated } }
    }),

  updateMessage: (chatId, messageId, updater) =>
    set((s) => {
      const msgs = s.messagesByChat[chatId]
      if (!msgs || msgs.length === 0) return s
      const idx = msgs.findIndex(m => m.id === messageId)
      if (idx === -1) return s
      const updated = [...msgs]
      updated[idx] = updater(msgs[idx])
      return { messagesByChat: { ...s.messagesByChat, [chatId]: updated } }
    }),

  setIsLoading: (v) => set({ isLoading: v }),

  setEnableThinking: (v) => {
    saveBool(LS_THINKING, v)
    set({ enableThinking: v })
  },

  setEnableWebsearch: (v) => {
    saveBool(LS_WEBSEARCH, v)
    set({ enableWebsearch: v })
  },

  resetChat: (chatId) =>
    set((s) => {
      const { [chatId]: _, ...rest } = s.messagesByChat
      return { messagesByChat: rest }
    }),

  resetAll: () => set({ messagesByChat: {}, currentChatId: null, isLoading: false }),
}))
