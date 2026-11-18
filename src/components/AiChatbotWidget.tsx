import { Bot, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UI_TEXT } from '../i18n';
import type { AiChatMessage, AnnouncementItem, Language, SiteProfile, SkillItem } from '../types';
import { safeReadJson } from '../utils/format';

interface AiChatbotWidgetProps {
  lang: Language;
  profile: SiteProfile;
  skills: SkillItem[];
  announcements: AnnouncementItem[];
  publicNotesCount: number;
  publicFilesCount: number;
}

export function AiChatbotWidget({
  lang,
  profile,
  skills,
  announcements,
  publicNotesCount,
  publicFilesCount,
}: AiChatbotWidgetProps) {
  const t = UI_TEXT[lang].chatbot;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: t.greeting,
      timestamp: '',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'welcome'
        ? [{ ...prev[0], text: t.greeting }]
        : prev
    );
  }, [t.greeting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: AiChatMessage = {
      id: `${Date.now()}_u`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          messages: nextHistory
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, text: m.text })),
          siteContext: {
            ownerName: profile.ownerName,
            roleTitle: lang === 'om' ? profile.roleTitleOm : profile.roleTitleEn,
            bio: lang === 'om' ? profile.bioOm : profile.bioEn,
            location: profile.location,
            email: profile.email,
            skills: skills.map((s) => ({ name: s.name, category: s.category, level: s.level })),
            announcements: announcements
              .filter((a) => a.isPublished)
              .slice(0, 5)
              .map((a) => ({ title: a.title, content: a.content })),
            publicNotesCount,
            publicFilesCount,
          },
        }),
      });

      const data = await safeReadJson<{ reply?: string; error?: string }>(res);
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'AI service returned an error.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_m`,
          role: 'model',
          text: data.reply!,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach AI assistant.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 text-white text-sm font-semibold rounded-xl shadow-lg border border-blue-600/40 dark:border-sky-400/40 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="whitespace-nowrap">{t.buttonLabel}</span>
        </button>
      )}

      {/* Chatbot Drawer */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[540px] max-h-[82vh] bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3.5 border-b border-blue-800/40 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Bot className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold truncate text-white">{t.title}</h3>
                <p className="text-[11px] text-sky-200/80 truncate">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMessages([{ id: 'welcome', role: 'model', text: t.greeting, timestamp: '' }]);
                  setErrorMsg(null);
                }}
                title={t.clear}
                aria-label={t.clear}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chatbot"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/90 dark:bg-[#070B14]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white'
                      : 'bg-white dark:bg-[#0D1322] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="pt-2 space-y-1.5">
                {t.quickQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendQuestion(q)}
                    className="block w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-lg hover:border-blue-500 hover:text-blue-700 dark:hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="text-xs font-medium text-blue-700 dark:text-sky-400 px-1">
                {t.thinking}
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label={t.send}
              className="p-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 disabled:opacity-50 text-white rounded-lg transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
