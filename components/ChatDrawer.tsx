'use client'

import { useState, useEffect, useRef } from 'react'
import { markMessagesRead } from '@/lib/message-reads'

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
  sender_name: string
}

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectTitle: string
  currentUserId: string
  onSend: (projectId: string, body: string) => Promise<{ error?: string; success?: boolean }>
  onFetchMessages: (projectId: string) => Promise<{ messages: Message[] }>
  tenantPlan: string
  onRead?: () => void
}

export default function ChatDrawer({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  currentUserId,
  onSend,
  onFetchMessages,
  tenantPlan,
  onRead,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isFreePlan = tenantPlan === 'free'

  useEffect(() => {
    if (isOpen && projectId) {
      setLoading(true)
      setError(null)
      onFetchMessages(projectId)
        .then((result) => {
          setMessages(result?.messages ?? [])
          setLoading(false)
        })
        .catch(() => {
          setError('Failed to load messages.')
          setLoading(false)
        })
      markMessagesRead(currentUserId, projectId).catch(() => {})
      onRead?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!messageText.trim() || sending) return
    setSending(true)
    setError(null)
    const result = await onSend(projectId, messageText.trim())
    if (result?.error) {
      setError(result.error)
    } else {
      setMessageText('')
      const refreshed = await onFetchMessages(projectId)
      setMessages(refreshed.messages ?? [])
    }
    setSending(false)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">Messages</h3>
            <p className="text-xs text-gray-500 truncate">{projectTitle}</p>
          </div>
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {isFreePlan ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-gray-400">In-app messaging requires the Growth plan.</p>
                <a href="/admin/billing" className="text-sm text-ember font-medium hover:underline">Upgrade</a>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-ember border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">No messages yet. Start the conversation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isMe ? 'bg-ember/10 text-gray-900' : 'bg-gray-100 text-gray-900'}`}>
                      <p className="text-xs font-medium text-gray-500 mb-0.5">
                        {msg.sender_name} &middot; {new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Input */}
        {!isFreePlan && (
          <div className="border-t border-gray-200 px-4 py-3">
            {error && <p className="text-xs text-amber-600 mb-2">{error}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
              />
              <button
                onClick={handleSend}
                disabled={sending || !messageText.trim()}
                className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
