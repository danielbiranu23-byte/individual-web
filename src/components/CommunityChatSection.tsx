import type { User } from 'firebase/auth';
import { LogOut, MessageSquare, Pin, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { UI_TEXT } from '../i18n';
import type { ChatChannel, CommunityChatMessage, Language } from '../types';
import { formatTimestamp } from '../utils/format';

interface CommunityChatSectionProps {
  lang: Language;
  user: User | null;
  isAdmin: boolean;
  adminSessionToken: string | null;
  messages: CommunityChatMessage[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function CommunityChatSection({
  lang,
  user,
  isAdmin,
  adminSessionToken,
  messages,
  onSignIn,
  onSignOut,
  onRefresh,
}: CommunityChatSectionProps) {
  const t = UI_TEXT[lang].community;
  const [channel, setChannel] = useState<ChatChannel>('general');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canModerate = isAdmin || Boolean(adminSessionToken);

  const channelMessages = useMemo(
    () => messages.filter((m) => m.channel === channel),
    [messages, channel]
  );

  const pinnedMessages = useMemo(
    () => channelMessages.filter((m) => m.isPinned),
    [channelMessages]
  );

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !draft.trim() || sending) return;
    setSending(true);
    setErrorMsg(null);
    const cleanText = draft.trim().slice(0, 1500);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/community/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          channel,
          text: cleanText,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 403 && data.error?.toLowerCase().includes('blocked')) {
          throw new Error(UI_TEXT[lang].contact.blockedMsg);
        }
        throw new Error(data.error || 'Failed to send message.');
      }
      setDraft('');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : UI_TEXT[lang].contact.blockedMsg);
    } finally {
      setSending(false);
    }
  }

  async function handleTogglePin(msg: CommunityChatMessage) {
    if (!adminSessionToken) return;
    try {
      const res = await fetch(`/api/community/messages/${encodeURIComponent(msg.id)}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSessionToken}`,
        },
        body: JSON.stringify({ isPinned: !msg.isPinned }),
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch {
      // Ignore transient error
    }
  }

  async function handleDelete(msg: CommunityChatMessage) {
    const isOwn = user?.uid === msg.senderId;
    if (!isOwn && !adminSessionToken) return;
    try {
      const token = adminSessionToken || (user ? await user.getIdToken() : '');
      if (!token) return;
      const res = await fetch(`/api/community/messages/${encodeURIComponent(msg.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch {
      // Ignore transient error
    }
  }

  return (
    <section id="community" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B111E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 dark:from-white dark:via-sky-200 dark:to-blue-300 bg-clip-text text-transparent text-balance">
              {t.sectionTitle}
            </h2>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-300 max-w-2xl">
              {t.subtitle}
            </p>
          </div>

          {user && (
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">{user.displayName || user.email}</span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                {UI_TEXT[lang].nav.signOut}
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-50/70 dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          {/* Channel Switcher */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-[#090E1A] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-lg">
              {(['general', 'tech', 'qa'] as ChatChannel[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    channel === ch
                      ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {t.channels[ch]}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium text-blue-700 dark:text-sky-400 tabular-nums">
              {channelMessages.length} {lang === 'om' ? 'ergaa' : 'messages'}
            </span>
          </div>

          {/* Pinned banner */}
          {pinnedMessages.length > 0 && (
            <div className="px-6 py-3 bg-blue-50/90 dark:bg-blue-950/35 border-b border-blue-200/80 dark:border-blue-900/60 flex items-start gap-2.5">
              <Pin className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-800 dark:text-slate-200 min-w-0">
                <span className="font-semibold text-blue-700 dark:text-sky-400 mr-2">
                  {t.pinnedLabel}:
                </span>
                <span>{pinnedMessages[0].text}</span>
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="h-[380px] overflow-y-auto p-4 sm:p-6 space-y-4 bg-white dark:bg-[#0D1322]">
            {channelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare className="w-8 h-8 text-blue-400/70 dark:text-sky-500/60 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400">{t.empty}</p>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isOwn = user?.uid === msg.senderId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {msg.senderName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatTimestamp(msg.createdAt, lang)}</span>
                    </div>
                    <div
                      className={`max-w-xl rounded-xl px-4 py-2.5 text-sm leading-relaxed border ${
                        isOwn
                          ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white border-blue-700'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                    {(canModerate || isOwn) && (
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {adminSessionToken && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(msg)}
                            className="hover:text-blue-700 dark:hover:text-sky-400 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Pin className="w-3 h-3" />
                            {msg.isPinned ? t.unpin : t.pin}
                          </button>
                        )}
                        {(isOwn || adminSessionToken) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(msg)}
                            className="hover:text-red-600 dark:hover:text-red-400 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            {t.deleteMsg}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Input / Auth bar */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090E1A]">
            {errorMsg && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">{errorMsg}</p>
            )}
            {user ? (
              <form onSubmit={handleSend} className="flex items-center gap-3">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={1500}
                  placeholder={t.inputPlaceholder}
                  className="flex-1 px-4 py-2.5 text-sm bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 disabled:opacity-50 text-white rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {t.send}
                </button>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">{t.signInPrompt}</p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 text-white rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.signInBtn}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
