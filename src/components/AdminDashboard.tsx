import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderUp,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Reply,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  User as UserIcon,
  Video,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { UI_TEXT } from '../i18n';
import type {
  AnnouncementItem,
  BlockedUserRecordItem,
  CommunityChatMessage,
  ContactExchangeItem,
  ContactMessageItem,
  Language,
  LiveChatMessageItem,
  LiveChatRoomItem,
  NoteItem,
  SavedFileItem,
  SiteProfile,
  SkillItem,
} from '../types';
import {
  downloadUrlOrBase64File,
  formatBytes,
  formatTimestamp,
  getEmailBlockKey,
  resolveStreamOrBlobUrl,
  triggerFileDownload,
} from '../utils/format';

type AdminTab =
  | 'overview'
  | 'profile'
  | 'skills'
  | 'announcements'
  | 'notes'
  | 'files'
  | 'inbox'
  | 'livechat'
  | 'blocked'
  | 'chat';

interface AdminDashboardProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  user: User | null;
  adminAuthenticated: boolean;
  adminSessionToken: string | null;
  adminUsername: string | null;
  onAdminCredentialSuccess: (token: string, username: string) => void;
  onRefreshData: () => Promise<void>;
  profile: SiteProfile;
  skills: SkillItem[];
  announcements: AnnouncementItem[];
  notes: NoteItem[];
  files: SavedFileItem[];
  contactMessages: ContactMessageItem[];
  chatMessages: CommunityChatMessage[];
  blockedUsers: BlockedUserRecordItem[];
  liveChatRooms: LiveChatRoomItem[];
  onSignOut: () => Promise<void>;
  onBackToSite: () => void;
}

export function AdminDashboard({
  lang,
  onChangeLang,
  user,
  adminAuthenticated,
  adminSessionToken,
  adminUsername,
  onAdminCredentialSuccess,
  onRefreshData,
  profile,
  skills,
  announcements,
  notes,
  files,
  contactMessages,
  chatMessages,
  blockedUsers,
  liveChatRooms,
  onSignOut,
  onBackToSite,
}: AdminDashboardProps) {
  const t = UI_TEXT[lang].admin;
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Admin credential login & reset state
  const [authView, setAuthView] = useState<'login' | 'reset_verify' | 'reset_password'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [resetUsername, setResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile form state
  const [profileForm, setProfileForm] = useState<SiteProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  // Skill form state
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('Frontend');
  const [skillLevel, setSkillLevel] = useState(85);
  const [skillYears, setSkillYears] = useState('3+ Waggaa');
  const [skillDesc, setSkillDesc] = useState('');

  // Announcement form state
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState('Oduu Haaraa');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [annPublished, setAnnPublished] = useState(true);

  // Note form state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('Barnoota');
  const [noteContent, setNoteContent] = useState('');
  const [noteIsPublic, setNoteIsPublic] = useState(true);

  // File upload state
  const [fileTitle, setFileTitle] = useState('');
  const [fileDesc, setFileDesc] = useState('');
  const [fileCategory, setFileCategory] = useState('Suuraa / Photos');
  const [fileIsPublic, setFileIsPublic] = useState(true);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadFileInputKey, setUploadFileInputKey] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Inbox reply, attachment preview & return file state
  const [replyingMsgId, setReplyingMsgId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyFileInputKey, setReplyFileInputKey] = useState(0);
  const [sendingReply, setSendingReply] = useState(false);
  const [existingExchange, setExistingExchange] = useState<ContactExchangeItem | null>(null);
  const [inboxPreview, setInboxPreview] = useState<{
    msgId: string;
    src: string;
    mimeType?: string;
    fileName?: string;
    revokeOnClose: boolean;
  } | null>(null);

  // Blocked users manual form state
  const [blockEmailInput, setBlockEmailInput] = useState('');
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [blockingUser, setBlockingUser] = useState(false);

  // Saved Admin Live Chat Archive state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [archiveMessages, setArchiveMessages] = useState<LiveChatMessageItem[]>([]);
  const [archiveMediaUrls, setArchiveMediaUrls] = useState<Record<string, { src: string; revokeOnClose: boolean }>>({});
  const [adminLiveReplyText, setAdminLiveReplyText] = useState('');
  const [adminLiveMediaFile, setAdminLiveMediaFile] = useState<File | null>(null);
  const [adminLiveMediaKey, setAdminLiveMediaKey] = useState(0);
  const [sendingAdminLive, setSendingAdminLive] = useState(false);
  const [editingLiveMsgId, setEditingLiveMsgId] = useState<string | null>(null);
  const [editingLiveMsgText, setEditingLiveMsgText] = useState('');
  const [editingLiveMsgVisible, setEditingLiveMsgVisible] = useState(true);
  const [roomNoteDraft, setRoomNoteDraft] = useState('');
  const [savingRoomNote, setSavingRoomNote] = useState(false);

  const selectedRoom = liveChatRooms.find((r) => r.id === selectedRoomId) || null;

  useEffect(() => {
    if (liveChatRooms.length > 0 && (!selectedRoomId || !liveChatRooms.some((r) => r.id === selectedRoomId))) {
      setSelectedRoomId(liveChatRooms[0].id);
    } else if (liveChatRooms.length === 0) {
      setSelectedRoomId(null);
    }
  }, [liveChatRooms, selectedRoomId]);

  useEffect(() => {
    setRoomNoteDraft(selectedRoom?.adminNote || '');
    setEditingLiveMsgId(null);
  }, [selectedRoomId, selectedRoom?.adminNote]);

  const loadArchiveMessages = useCallback(async () => {
    if (!adminSessionToken || !selectedRoomId) {
      setArchiveMessages([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/live-chat/rooms/${encodeURIComponent(selectedRoomId)}/messages`,
        {
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: LiveChatMessageItem[] };
      if (Array.isArray(data.messages)) {
        setArchiveMessages(data.messages);
      }
    } catch {
      // Ignore transient poll error
    }
  }, [adminSessionToken, selectedRoomId]);

  useEffect(() => {
    if (!adminAuthenticated || activeTab !== 'livechat' || !selectedRoomId) {
      setArchiveMessages([]);
      return;
    }
    loadArchiveMessages();
    const timer = setInterval(loadArchiveMessages, 2500);
    return () => clearInterval(timer);
  }, [adminAuthenticated, activeTab, selectedRoomId, loadArchiveMessages]);

  useEffect(() => {
    let cancelled = false;
    async function resolveMedia() {
      for (const msg of archiveMessages) {
        if (!msg.mediaName || archiveMediaUrls[msg.id]) continue;
        const mime = msg.mediaMimeType || '';
        if (!mime.startsWith('image/') && !mime.startsWith('video/')) continue;
        try {
          const resolved = await resolveStreamOrBlobUrl(
            msg.mediaUrl,
            msg.mediaBase64,
            msg.mediaMimeType,
            msg.mediaName
          );
          if (!cancelled) {
            setArchiveMediaUrls((prev) => ({ ...prev, [msg.id]: resolved }));
          } else if (resolved.revokeOnClose) {
            URL.revokeObjectURL(resolved.src);
          }
        } catch {
          // Download button stays functional
        }
      }
    }
    resolveMedia();
    return () => {
      cancelled = true;
    };
  }, [archiveMessages, archiveMediaUrls]);

  function notify(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  }

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) return;
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        sessionToken?: string;
        username?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionToken || !data.username) {
        throw new Error(data.error || 'Invalid credentials.');
      }
      setLoginPassword('');
      onAdminCredentialSuccess(data.sessionToken, data.username);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleVerifyResetUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUsername.trim()) return;
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const res = await fetch('/api/admin/verify-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername.trim() }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        resetToken?: string;
        error?: string;
      };
      if (!res.ok || !data.verified || !data.resetToken) {
        throw new Error(data.error || 'Username verification failed.');
      }
      setResetToken(data.resetToken);
      setAuthView('reset_password');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setAuthError(t.passwordMinLen);
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError(t.passwordMismatch);
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername.trim(),
          resetToken,
          newPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Password reset failed.');
      }
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
      setLoginUsername(resetUsername.trim());
      setAuthView('login');
      setAuthNotice(t.resetSuccess);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  if (!adminAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            {authView === 'login' ? (
              <div className="w-14 h-14 rounded-full overflow-hidden p-0.5 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 shadow-sm shrink-0">
                <img
                  src="/assets/aistudio/image_2df75c9c.png"
                  alt="Admin"
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover bg-white"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-blue-700 dark:text-sky-400" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onChangeLang(lang === 'om' ? 'en' : 'om')}
              className="px-2.5 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {lang.toUpperCase()}
            </button>
          </div>

          {authView === 'login' && (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">
                {t.loginTitle}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                {t.loginDesc}
              </p>

              {authNotice && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {authNotice}
                </div>
              )}
              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300">
                  {authError}
                </div>
              )}

              <form onSubmit={handleCredentialLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t.usernameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder={t.usernamePlaceholder}
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder={t.passwordPlaceholder}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label="Toggle password visibility"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setAuthNotice(null);
                      setResetUsername('');
                      setAuthView('reset_verify');
                    }}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {t.forgotPassword}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {authBusy ? t.loggingIn : t.loginBtn}
                  </button>
                  <button
                    type="button"
                    onClick={onBackToSite}
                    className="px-4 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {t.backToSite}
                  </button>
                </div>
              </form>
            </>
          )}

          {authView === 'reset_verify' && (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">
                {t.resetTitle}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                {t.resetVerifyDesc}
              </p>
              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300">
                  {authError}
                </div>
              )}
              <form onSubmit={handleVerifyResetUsername} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t.usernameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.usernamePlaceholder}
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {t.verifyUsernameBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setAuthView('login');
                    }}
                    className="px-4 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {t.backToLogin}
                  </button>
                </div>
              </form>
            </>
          )}

          {authView === 'reset_password' && (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">
                {t.resetTitle}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                {t.usernameLabel}: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{resetUsername}</span>
              </p>
              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300">
                  {authError}
                </div>
              )}
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t.newPasswordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder={t.passwordPlaceholder}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t.confirmPasswordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder={t.passwordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {t.resetPasswordBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setAuthView('login');
                    }}
                    className="px-4 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {t.backToLogin}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  async function adminFetch<T = Record<string, unknown>>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!adminSessionToken) {
      throw new Error('Admin session expired. Please sign in again.');
    }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${adminSessionToken}`);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...options, headers });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setErrorMessage(null);
    try {
      await adminFetch('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!skillName.trim()) return;
    setErrorMessage(null);
    try {
      const payload = {
        name: skillName.trim().slice(0, 80),
        category: skillCategory.trim().slice(0, 60),
        level: Math.min(100, Math.max(1, Number(skillLevel) || 80)),
        years: skillYears.trim().slice(0, 30),
        description: skillDesc.trim().slice(0, 400),
      };
      if (editingSkillId) {
        await adminFetch(`/api/admin/skills/${encodeURIComponent(editingSkillId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch('/api/admin/skills', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingSkillId(null);
      setSkillName('');
      setSkillDesc('');
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save skill.');
    }
  }

  async function handleDeleteSkill(id: string) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await onRefreshData();
      notify(t.delete);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete skill.');
    }
  }

  async function handleSaveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setErrorMessage(null);
    try {
      const payload = {
        title: annTitle.trim().slice(0, 160),
        content: annContent.trim().slice(0, 5000),
        category: annCategory.trim().slice(0, 60) || 'General',
        isPinned: annPinned,
        isPublished: annPublished,
      };
      if (editingAnnId) {
        await adminFetch(`/api/admin/announcements/${encodeURIComponent(editingAnnId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingAnnId(null);
      setAnnTitle('');
      setAnnContent('');
      setAnnPinned(false);
      setAnnPublished(true);
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save announcement.');
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await onRefreshData();
      notify(t.delete);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete announcement.');
    }
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setErrorMessage(null);
    try {
      const payload = {
        title: noteTitle.trim().slice(0, 160),
        content: noteContent.trim().slice(0, 20000),
        category: noteCategory.trim().slice(0, 60) || 'Notes',
        isPublic: noteIsPublic,
      };
      if (editingNoteId) {
        await adminFetch(`/api/admin/notes/${encodeURIComponent(editingNoteId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch('/api/admin/notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save note.');
    }
  }

  async function handleDeleteNote(id: string) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await onRefreshData();
      notify(t.delete);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete note.');
    }
  }

  async function handleUploadFile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUploadFile) return;
    if (selectedUploadFile.size > 104857600) {
      setErrorMessage('File exceeds maximum size of 100 MB.');
      return;
    }
    setUploadingFile(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedUploadFile);
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const uploaded = (await res.json()) as {
        fileName: string;
        storedName: string;
        mimeType: string;
        sizeBytes: number;
        downloadUrl: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(uploaded.error || 'Upload failed.');
      }

      await adminFetch('/api/admin/files', {
        method: 'POST',
        body: JSON.stringify({
          title: (fileTitle.trim() || uploaded.fileName).slice(0, 160),
          description: fileDesc.trim().slice(0, 1000),
          fileName: uploaded.fileName.slice(0, 255),
          storedName: uploaded.storedName.slice(0, 255),
          mimeType: uploaded.mimeType.slice(0, 120),
          sizeBytes: uploaded.sizeBytes,
          downloadUrl: uploaded.downloadUrl.slice(0, 500),
          category: (fileCategory.trim() || 'Documents').slice(0, 60),
          isPublic: fileIsPublic,
        }),
      });

      setFileTitle('');
      setFileDesc('');
      setSelectedUploadFile(null);
      setUploadFileInputKey((k) => k + 1);
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleToggleFileVisibility(file: SavedFileItem) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/files/${encodeURIComponent(file.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: !file.isPublic }),
      });
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update visibility.');
    }
  }

  async function handleDeleteFile(file: SavedFileItem) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
      await onRefreshData();
      notify(t.delete);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete file.');
    }
  }

  async function handleUpdateContactStatus(msg: ContactMessageItem, status: 'unread' | 'read' | 'archived') {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/contact/messages/${encodeURIComponent(msg.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefreshData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update status.');
    }
  }

  async function handleDeleteContactMessage(id: string) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/contact/messages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await onRefreshData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete contact message.');
    }
  }

  async function handleOpenReplyDrawer(msg: ContactMessageItem) {
    if (replyingMsgId === msg.id) {
      setReplyingMsgId(null);
      setReplyText('');
      setReplyFile(null);
      setExistingExchange(null);
      return;
    }
    setReplyingMsgId(msg.id);
    setReplyText('');
    setReplyFile(null);
    setExistingExchange(null);
    if (msg.trackingCode) {
      try {
        const res = await fetch(`/api/contact/exchanges/${encodeURIComponent(msg.trackingCode)}`);
        if (res.ok) {
          const data = (await res.json()) as { exchange?: ContactExchangeItem | null };
          if (data.exchange) {
            setExistingExchange(data.exchange);
            setReplyText(data.exchange.adminReply || '');
          }
        }
      } catch {
        // Ignore if not found yet
      }
    }
  }

  async function handleSendAdminReply(e: React.FormEvent, msg: ContactMessageItem) {
    e.preventDefault();
    if (!msg.trackingCode || !replyText.trim()) return;
    setSendingReply(true);
    setErrorMessage(null);
    try {
      const payload: Record<string, unknown> = {
        messageId: msg.id,
        trackingCode: msg.trackingCode,
        subject: msg.subject.trim().slice(0, 160),
        adminReply: replyText.trim().slice(0, 3000),
      };

      if (replyFile) {
        if (replyFile.size > 104857600) {
          throw new Error('Reply file exceeds maximum size of 100 MB.');
        }
        const formData = new FormData();
        formData.append('file', replyFile);
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        const uploaded = (await res.json()) as {
          fileName: string;
          storedName: string;
          mimeType: string;
          sizeBytes: number;
          downloadUrl: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(uploaded.error || 'Upload failed.');
        }
        payload.replyFileName = uploaded.fileName.slice(0, 255);
        payload.replyStoredName = uploaded.storedName.slice(0, 255);
        payload.replyMimeType = uploaded.mimeType.slice(0, 120);
        payload.replySizeBytes = uploaded.sizeBytes;
        payload.replyDownloadUrl = uploaded.downloadUrl.slice(0, 500);
      } else if (existingExchange?.replyFileName) {
        payload.replyFileName = existingExchange.replyFileName;
        payload.replyStoredName = existingExchange.replyStoredName;
        payload.replyMimeType = existingExchange.replyMimeType;
        payload.replySizeBytes = existingExchange.replySizeBytes;
        payload.replyDownloadUrl = existingExchange.replyDownloadUrl;
      }

      await adminFetch('/api/admin/contact/reply', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setReplyingMsgId(null);
      setReplyText('');
      setReplyFile(null);
      setReplyFileInputKey((k) => k + 1);
      setExistingExchange(null);
      await onRefreshData();
      notify(t.replySaved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleToggleInboxPreview(msg: ContactMessageItem) {
    if (inboxPreview?.msgId === msg.id) {
      if (inboxPreview.revokeOnClose) URL.revokeObjectURL(inboxPreview.src);
      setInboxPreview(null);
      return;
    }
    if (inboxPreview?.revokeOnClose) {
      URL.revokeObjectURL(inboxPreview.src);
    }
    try {
      const resolved = await resolveStreamOrBlobUrl(
        msg.attachmentUrl,
        msg.attachmentBase64,
        msg.attachmentMimeType,
        msg.attachmentName
      );
      setInboxPreview({
        msgId: msg.id,
        src: resolved.src,
        mimeType: msg.attachmentMimeType,
        fileName: msg.attachmentName,
        revokeOnClose: resolved.revokeOnClose,
      });
    } catch {
      setErrorMessage('Could not preview attachment.');
    }
  }

  async function handleBlockFromContact(msg: ContactMessageItem) {
    setErrorMessage(null);
    try {
      const emailBlockId = msg.senderKey || (await getEmailBlockKey(msg.senderEmail));
      const deviceBlockId = msg.deviceKey;
      await adminFetch('/api/admin/blocked', {
        method: 'POST',
        body: JSON.stringify({
          targetName: msg.senderName.slice(0, 120),
          targetEmail: msg.senderEmail.slice(0, 160),
          reason: `Contact: ${msg.subject}`.slice(0, 400),
          source: 'contact',
          emailBlockId,
          deviceBlockId,
        }),
      });
      await onRefreshData();
      notify(t.blockedSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to block user.');
    }
  }

  async function handleBlockFromCommunity(msg: CommunityChatMessage) {
    setErrorMessage(null);
    try {
      await adminFetch('/api/admin/blocked', {
        method: 'POST',
        body: JSON.stringify({
          targetName: msg.senderName.slice(0, 120),
          reason: `Community chat (${msg.channel})`.slice(0, 400),
          source: 'community',
          uidBlockId: `uid_${msg.senderId}`,
        }),
      });
      await onRefreshData();
      notify(t.blockedSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to block user.');
    }
  }

  async function handleBlockFromLiveRoom(room: LiveChatRoomItem) {
    setErrorMessage(null);
    try {
      await adminFetch('/api/admin/blocked', {
        method: 'POST',
        body: JSON.stringify({
          targetName: room.visitorName.slice(0, 120),
          reason: 'Live chat harassment/spam'.slice(0, 400),
          source: 'live_chat',
          deviceBlockId: room.deviceKey,
          emailBlockId: room.senderKey,
        }),
      });
      await onRefreshData();
      notify(t.blockedSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to block visitor.');
    }
  }

  async function handleManualBlockEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!blockEmailInput.trim()) return;
    setBlockingUser(true);
    setErrorMessage(null);
    try {
      const cleanEmail = blockEmailInput.trim().slice(0, 160);
      const emailBlockId = await getEmailBlockKey(cleanEmail);
      await adminFetch('/api/admin/blocked', {
        method: 'POST',
        body: JSON.stringify({
          targetName: cleanEmail.slice(0, 120),
          targetEmail: cleanEmail,
          reason: (blockReasonInput.trim() || 'Blocked manually by Admin').slice(0, 400),
          source: 'manual',
          emailBlockId,
        }),
      });
      setBlockEmailInput('');
      setBlockReasonInput('');
      await onRefreshData();
      notify(t.blockedSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to block email.');
    } finally {
      setBlockingUser(false);
    }
  }

  async function handleUnblockUser(record: BlockedUserRecordItem) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/blocked/${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
      });
      await onRefreshData();
      notify(t.unblockedSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to unblock user.');
    }
  }

  async function handleSaveRoomNote() {
    if (!selectedRoom) return;
    setSavingRoomNote(true);
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/live-chat/rooms/${encodeURIComponent(selectedRoom.roomId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ adminNote: roomNoteDraft.trim().slice(0, 500) }),
      });
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setSavingRoomNote(false);
    }
  }

  async function handleSendAdminLiveReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom || (!adminLiveReplyText.trim() && !adminLiveMediaFile)) return;
    if (adminLiveMediaFile && adminLiveMediaFile.size > 104857600) {
      setErrorMessage('File exceeds maximum size of 100 MB.');
      return;
    }
    setSendingAdminLive(true);
    setErrorMessage(null);
    try {
      const msgPayload: Record<string, unknown> = {
        senderName: (profile.ownerName || 'Daniel Biranu').slice(0, 100),
        text: adminLiveReplyText.trim().slice(0, 3000),
        visitorVisible: Boolean(selectedRoom.visitorActive),
      };

      if (adminLiveMediaFile) {
        const formData = new FormData();
        formData.append('file', adminLiveMediaFile);
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        const uploaded = (await res.json()) as {
          fileName: string;
          storedName: string;
          mimeType: string;
          sizeBytes: number;
          downloadUrl: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(uploaded.error || 'Upload failed.');
        }
        msgPayload.mediaName = uploaded.fileName.slice(0, 255);
        msgPayload.mediaStoredName = uploaded.storedName.slice(0, 255);
        msgPayload.mediaMimeType = uploaded.mimeType.slice(0, 120);
        msgPayload.mediaSizeBytes = uploaded.sizeBytes;
        msgPayload.mediaUrl = uploaded.downloadUrl.slice(0, 500);
      }

      await adminFetch(
        `/api/admin/live-chat/rooms/${encodeURIComponent(selectedRoom.roomId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(msgPayload),
        }
      );

      setAdminLiveReplyText('');
      setAdminLiveMediaFile(null);
      setAdminLiveMediaKey((k) => k + 1);
      await loadArchiveMessages();
      await onRefreshData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setSendingAdminLive(false);
    }
  }

  async function handleSaveEditedLiveMessage(msg: LiveChatMessageItem) {
    if (!selectedRoom) return;
    const cleanText = editingLiveMsgText.trim().slice(0, 3000);
    if (!cleanText && !msg.mediaName) return;
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/live-chat/messages/${encodeURIComponent(msg.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          text: cleanText,
          visitorVisible: editingLiveMsgVisible,
        }),
      });
      setEditingLiveMsgId(null);
      await loadArchiveMessages();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update message.');
    }
  }

  async function handleDeleteLiveMessage(msgId: string) {
    if (!selectedRoom) return;
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/live-chat/messages/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
      });
      await loadArchiveMessages();
      notify(t.delete);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete message.');
    }
  }

  async function handleDeleteLiveRoom(roomId: string) {
    setErrorMessage(null);
    try {
      await adminFetch(`/api/admin/live-chat/rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
      });
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
      }
      await onRefreshData();
      notify(t.delete);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete chat thread.');
    }
  }

  async function handleSeedSampleContent() {
    if (seeding) return;
    setSeeding(true);
    setErrorMessage(null);
    try {
      await adminFetch('/api/admin/seed', {
        method: 'POST',
        body: JSON.stringify({ profile: profileForm }),
      });
      await onRefreshData();
      notify(t.saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to seed content.');
    } finally {
      setSeeding(false);
    }
  }

  const unreadCount = contactMessages.filter((m) => m.status === 'unread').length;

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'overview', label: t.tabs.overview, icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'profile', label: t.tabs.profile, icon: <UserIcon className="w-4 h-4" /> },
    { id: 'skills', label: t.tabs.skills, icon: <Wrench className="w-4 h-4" />, count: skills.length },
    { id: 'announcements', label: t.tabs.announcements, icon: <Bell className="w-4 h-4" />, count: announcements.length },
    { id: 'notes', label: t.tabs.notes, icon: <FileText className="w-4 h-4" />, count: notes.length },
    { id: 'files', label: t.tabs.files, icon: <FolderUp className="w-4 h-4" />, count: files.length },
    { id: 'inbox', label: t.tabs.inbox, icon: <Inbox className="w-4 h-4" />, count: unreadCount },
    { id: 'livechat', label: t.tabs.livechat, icon: <MessagesSquare className="w-4 h-4" />, count: liveChatRooms.length },
    { id: 'blocked', label: t.tabs.blocked, icon: <Ban className="w-4 h-4" />, count: blockedUsers.length },
    { id: 'chat', label: t.tabs.chat, icon: <MessageSquare className="w-4 h-4" />, count: chatMessages.length },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white dark:bg-zinc-900 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 shrink-0 flex flex-col">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold truncate">{t.title}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {adminUsername || user?.email || 'Admin'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeLang(lang === 'om' ? 'en' : 'om')}
            className="px-2.5 py-1 text-xs font-mono border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {lang.toUpperCase()}
          </button>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'bg-zinc-900 dark:bg-blue-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {typeof item.count === 'number' && (
                <span className="text-xs font-mono tabular-nums opacity-75">{item.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex lg:flex-col gap-2">
          <button
            type="button"
            onClick={onBackToSite}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.backToSite}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            {UI_TEXT[lang].nav.signOut}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            <span>{t.title}</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {statusMessage && (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {statusMessage}
              </span>
            )}
            {errorMessage && (
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                {errorMessage}
              </span>
            )}
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.tabs.skills}</p>
                <p className="font-display text-3xl font-semibold tabular-nums mt-1">{skills.length}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.tabs.announcements}</p>
                <p className="font-display text-3xl font-semibold tabular-nums mt-1">{announcements.length}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.tabs.notes} &amp; {t.tabs.files}
                </p>
                <p className="font-display text-3xl font-semibold tabular-nums mt-1">
                  {notes.length + files.length}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.tabs.inbox}</p>
                <p className="font-display text-3xl font-semibold tabular-nums mt-1">
                  {unreadCount} <span className="text-sm font-normal text-zinc-400">/ {contactMessages.length}</span>
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  {lang === 'om' ? 'Jalqaba Daataa Qopheessi' : 'Quick Content Bootstrap'}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {lang === 'om'
                    ? 'Yoo websaayitiin duwwaa ta’e, ogummaa, beeksisa fi yaadannoo fakkeenyaa Supabase irratti galchi.'
                    : 'Populate starter skills, announcement, and note into Supabase with one click.'}
                </p>
              </div>
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedSampleContent}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {seeding ? t.seeding : t.seedDemo}
              </button>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.ownerName}
                  onChange={(e) => setProfileForm({ ...profileForm, ownerName: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={profileForm.location}
                  onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Role Title (Afaan Oromo)
                </label>
                <input
                  type="text"
                  value={profileForm.roleTitleOm}
                  onChange={(e) => setProfileForm({ ...profileForm, roleTitleOm: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Role Title (English)
                </label>
                <input
                  type="text"
                  value={profileForm.roleTitleEn}
                  onChange={(e) => setProfileForm({ ...profileForm, roleTitleEn: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Headline (Afaan Oromo)
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.headlineOm}
                  onChange={(e) => setProfileForm({ ...profileForm, headlineOm: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Headline (English)
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.headlineEn}
                  onChange={(e) => setProfileForm({ ...profileForm, headlineEn: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Bio (Afaan Oromo)
                </label>
                <textarea
                  rows={5}
                  required
                  value={profileForm.bioOm}
                  onChange={(e) => setProfileForm({ ...profileForm, bioOm: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Bio (English)
                </label>
                <textarea
                  rows={5}
                  required
                  value={profileForm.bioEn}
                  onChange={(e) => setProfileForm({ ...profileForm, bioEn: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileForm.phone || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+2519323875"
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Years Experience
                </label>
                <input
                  type="text"
                  value={profileForm.yearsExperience || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, yearsExperience: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Projects Completed
                </label>
                <input
                  type="text"
                  value={profileForm.projectsCompleted || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, projectsCompleted: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  GitHub URL
                </label>
                <input
                  type="url"
                  value={profileForm.githubUrl || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={profileForm.linkedinUrl || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Telegram URL
                </label>
                <input
                  type="url"
                  value={profileForm.telegramUrl || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, telegramUrl: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white rounded-lg cursor-pointer"
              >
                {savingProfile ? t.saving : t.save}
              </button>
            </div>
          </form>
        )}

        {/* SKILLS TAB */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <form
              onSubmit={handleSaveSkill}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold">
                {editingSkillId ? t.edit : t.add}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Skill Name (e.g. React)"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="sm:col-span-2 px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Category (e.g. Frontend)"
                  value={skillCategory}
                  onChange={(e) => setSkillCategory(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(Number(e.target.value))}
                  className="px-3.5 py-2 text-sm font-mono bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Years (e.g. 4+ Waggaa)"
                  value={skillYears}
                  onChange={(e) => setSkillYears(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Short description..."
                  value={skillDesc}
                  onChange={(e) => setSkillDesc(e.target.value)}
                  className="sm:col-span-2 px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 text-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {editingSkillId ? t.save : t.add}
                </button>
                {editingSkillId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSkillId(null);
                      setSkillName('');
                      setSkillDesc('');
                    }}
                    className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
              {skills.map((skill) => (
                <div key={skill.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{skill.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{skill.level}%</span>
                      {skill.years && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{skill.years}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{skill.name}</h3>
                    {skill.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{skill.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSkillId(skill.id);
                        setSkillName(skill.name);
                        setSkillCategory(skill.category);
                        setSkillLevel(skill.level);
                        setSkillYears(skill.years || '');
                        setSkillDesc(skill.description || '');
                      }}
                      className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <form
              onSubmit={handleSaveAnnouncement}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold">
                {editingAnnId ? t.edit : t.add}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Title"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="sm:col-span-2 px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Category"
                  value={annCategory}
                  onChange={(e) => setAnnCategory(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <textarea
                rows={4}
                required
                placeholder="Announcement details..."
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                  />
                  <span>Pinned</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPublished}
                    onChange={(e) => setAnnPublished(e.target.checked)}
                  />
                  <span>Published</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 text-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {editingAnnId ? t.save : t.add}
                </button>
                {editingAnnId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAnnId(null);
                      setAnnTitle('');
                      setAnnContent('');
                    }}
                    className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <span>{ann.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ann.isPublished ? 'Published' : 'Draft'}</span>
                      {ann.isPinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Pinned</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{ann.title}</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">{ann.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAnnId(ann.id);
                        setAnnTitle(ann.title);
                        setAnnCategory(ann.category);
                        setAnnContent(ann.content);
                        setAnnPinned(ann.isPinned);
                        setAnnPublished(ann.isPublished);
                      }}
                      className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            <form
              onSubmit={handleSaveNote}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold">
                {editingNoteId ? t.edit : t.add}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Note Title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="sm:col-span-2 px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Category"
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <textarea
                rows={7}
                required
                placeholder="Write your note content here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg font-sans"
              />
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={noteIsPublic}
                  onChange={(e) => setNoteIsPublic(e.target.checked)}
                />
                <span>
                  {noteIsPublic ? UI_TEXT[lang].vault.publicLabel : UI_TEXT[lang].vault.privateLabel}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 text-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {editingNoteId ? t.save : t.add}
                </button>
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteTitle('');
                      setNoteContent('');
                    }}
                    className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
              {notes.map((note) => (
                <div key={note.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <span>{note.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {note.isPublic ? UI_TEXT[lang].vault.publicLabel : UI_TEXT[lang].vault.privateLabel}
                      </span>
                    </div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{note.title}</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {note.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteId(note.id);
                        setNoteTitle(note.title);
                        setNoteCategory(note.category);
                        setNoteContent(note.content);
                        setNoteIsPublic(note.isPublic);
                      }}
                      className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILES TAB (Photos, Videos & Documents up to 100MB) */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            <form
              onSubmit={handleUploadFile}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">
                  {lang === 'om' ? 'Suuraa, Viidiyoo & Faayilii Olkaa’i (Max 100MB)' : 'Upload Photo, Video, or File (Max 100MB)'}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['Suuraa / Photos', 'Viidiyoo / Videos', 'Sanadoota / Docs'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFileCategory(preset)}
                      className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer ${
                        fileCategory === preset
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder={lang === 'om' ? 'Mata duree (dirqama miti)' : 'Title (optional)'}
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Category (e.g. Suuraa / Viidiyoo / PDF)"
                  value={fileCategory}
                  onChange={(e) => setFileCategory(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <input
                type="text"
                placeholder={lang === 'om' ? 'Ibsa gabaabaa (dirqama miti)' : 'Description (optional)'}
                value={fileDesc}
                onChange={(e) => setFileDesc(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <input
                  key={uploadFileInputKey}
                  type="file"
                  required
                  accept="image/*,video/*,*/*"
                  onChange={(e) => setSelectedUploadFile(e.target.files?.[0] || null)}
                  className="text-sm text-zinc-600 dark:text-zinc-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-white dark:file:bg-blue-600 cursor-pointer"
                />
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fileIsPublic}
                    onChange={(e) => setFileIsPublic(e.target.checked)}
                  />
                  <span>
                    {fileIsPublic ? UI_TEXT[lang].vault.publicLabel : UI_TEXT[lang].vault.privateLabel}
                  </span>
                </label>
              </div>
              {selectedUploadFile && (
                <p className="text-xs font-mono text-zinc-500">
                  {selectedUploadFile.name} ({formatBytes(selectedUploadFile.size)})
                </p>
              )}
              <button
                type="submit"
                disabled={!selectedUploadFile || uploadingFile}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-zinc-900 dark:bg-blue-600 disabled:opacity-50 text-white rounded-lg cursor-pointer"
              >
                <FolderUp className="w-4 h-4" />
                {uploadingFile ? t.saving : t.save}
              </button>
            </form>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
              {files.map((file) => {
                const isImg = file.mimeType?.startsWith('image/');
                const isVid = file.mimeType?.startsWith('video/');
                return (
                  <div key={file.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 p-2 rounded-lg bg-stone-100 dark:bg-zinc-800 text-blue-700 dark:text-sky-400 shrink-0">
                        {isImg ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : isVid ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{file.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatBytes(file.sizeBytes)}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {file.isPublic ? UI_TEXT[lang].vault.publicLabel : UI_TEXT[lang].vault.privateLabel}
                          </span>
                        </div>
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{file.title}</h3>
                        <p className="text-xs font-mono text-zinc-500 truncate">{file.fileName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => triggerFileDownload(file)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {UI_TEXT[lang].vault.download}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFileVisibility(file)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                      >
                        {file.isPublic ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        {file.isPublic ? 'Make Private' : 'Make Public'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INBOX TAB */}
        {activeTab === 'inbox' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
            {contactMessages.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No contact messages yet.
              </div>
            ) : (
              contactMessages.map((msg) => (
                <div key={msg.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{msg.senderName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{msg.senderEmail}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatTimestamp(msg.createdAt, lang)}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          msg.status === 'unread'
                            ? 'font-semibold text-blue-700 dark:text-blue-400'
                            : 'text-zinc-500'
                        }
                      >
                        {msg.status.toUpperCase()}
                      </span>
                      {msg.trackingCode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-indigo-700 dark:text-sky-400">
                            {t.trackingCodePrefix}: {msg.trackingCode}
                          </span>
                        </>
                      )}
                      {msg.hasReply && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t.replySentBadge}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {msg.trackingCode && (
                        <button
                          type="button"
                          onClick={() => handleOpenReplyDrawer(msg)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          {msg.hasReply ? t.editReplyBtn : t.replyBtn}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleBlockFromContact(msg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {t.blockSenderBtn}
                      </button>
                      {msg.status !== 'read' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateContactStatus(msg, 'read')}
                          className="px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                      {msg.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateContactStatus(msg, 'archived')}
                          className="px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteContactMessage(msg.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{msg.subject}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{msg.message}</p>

                  {msg.attachmentName && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 text-xs">
                          <Paperclip className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {t.visitorAttachment}:
                          </span>
                          <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                            {msg.attachmentName}
                          </span>
                          <span className="text-zinc-500 shrink-0">
                            ({formatBytes(msg.attachmentSizeBytes || 0)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleInboxPreview(msg)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                          >
                            {inboxPreview?.msgId === msg.id ? <X className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {inboxPreview?.msgId === msg.id ? UI_TEXT[lang].vault.close : UI_TEXT[lang].vault.preview}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadUrlOrBase64File(
                                msg.attachmentUrl,
                                msg.attachmentBase64,
                                msg.attachmentMimeType,
                                msg.attachmentName
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 text-white rounded-md cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {t.downloadAttachment}
                          </button>
                        </div>
                      </div>

                      {inboxPreview?.msgId === msg.id && (
                        <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950">
                          {inboxPreview.mimeType?.startsWith('image/') ? (
                            <img
                              src={inboxPreview.src}
                              alt={inboxPreview.fileName}
                              className="max-h-80 mx-auto rounded-md object-contain"
                            />
                          ) : inboxPreview.mimeType?.startsWith('video/') ? (
                            <video
                              src={inboxPreview.src}
                              controls
                              playsInline
                              className="w-full max-h-80 rounded-md bg-black"
                            />
                          ) : (
                            <iframe
                              src={inboxPreview.src}
                              title={inboxPreview.fileName}
                              className="w-full h-80 rounded-md bg-white"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!msg.trackingCode && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.noTrackingCode}</p>
                  )}

                  {replyingMsgId === msg.id && msg.trackingCode && (
                    <form
                      onSubmit={(e) => handleSendAdminReply(e, msg)}
                      className="mt-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-sky-800/70 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-blue-800 dark:text-sky-300">
                          {t.replyFormTitle} ({msg.trackingCode})
                        </h4>
                        <button
                          type="button"
                          onClick={() => setReplyingMsgId(null)}
                          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                        >
                          {t.cancel}
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          {t.replyMessageLabel}
                        </label>
                        <textarea
                          rows={3}
                          required
                          maxLength={3000}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {t.replyFileLabel}
                        </label>
                        {existingExchange?.replyFileName && !replyFile && (
                          <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                            Current file: {existingExchange.replyFileName} ({formatBytes(existingExchange.replySizeBytes || 0)})
                          </p>
                        )}
                        <input
                          key={replyFileInputKey}
                          type="file"
                          accept="image/*,video/*,*/*"
                          onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                          className="text-xs text-zinc-600 dark:text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-700 file:text-white cursor-pointer"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingReply}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sendingReply ? t.saving : t.sendReplyBtn}
                      </button>
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* LIVE CHAT ARCHIVE TAB (Saved Permanently for Admin; Edit/Delete/Reply) */}
        {activeTab === 'livechat' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h2 className="font-display text-lg font-semibold">{t.liveArchiveTitle}</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {t.liveArchiveDesc}
              </p>
            </div>

            {liveChatRooms.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t.noLiveThreads}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Saved Thread List */}
                <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[640px] overflow-y-auto">
                  {liveChatRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedRoomId === room.id
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-stone-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {room.visitorName}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md shrink-0 ${
                            room.visitorActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {room.visitorActive ? t.liveActiveBadge : t.liveEndedBadge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {room.lastMessagePreview || '—'}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">
                        {formatTimestamp(room.updatedAt, lang)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Selected Saved Thread Detail */}
                <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                  {!selectedRoom ? (
                    <p className="text-sm text-zinc-500 text-center py-10">{t.selectThreadPrompt}</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                              {selectedRoom.visitorName}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                                selectedRoom.visitorActive
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}
                            >
                              {selectedRoom.visitorActive ? t.liveActiveBadge : t.liveEndedBadge}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-zinc-500 mt-0.5">{selectedRoom.roomId}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBlockFromLiveRoom(selectedRoom)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-md cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {t.blockSenderBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLiveRoom(selectedRoom.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t.deleteThreadBtn}
                          </button>
                        </div>
                      </div>

                      {/* Admin Note Editor for Saved Archive */}
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end bg-stone-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                            {t.adminNoteLabel}
                          </label>
                          <input
                            type="text"
                            maxLength={500}
                            value={roomNoteDraft}
                            onChange={(e) => setRoomNoteDraft(e.target.value)}
                            placeholder="..."
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={savingRoomNote}
                          onClick={handleSaveRoomNote}
                          className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 dark:bg-blue-600 text-white rounded-md cursor-pointer shrink-0"
                        >
                          {savingRoomNote ? t.saving : t.save}
                        </button>
                      </div>

                      {/* Messages List with Edit & Delete */}
                      <div className="max-h-96 overflow-y-auto space-y-3 p-3 rounded-lg bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                        {archiveMessages.map((m) => {
                          const isAdm = m.senderRole === 'admin';
                          const mediaEntry = archiveMediaUrls[m.id];
                          const isEditing = editingLiveMsgId === m.id;
                          return (
                            <div
                              key={m.id}
                              className={`p-3 rounded-lg border text-sm space-y-2 ${
                                isAdm
                                  ? 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-200 dark:border-sky-900'
                                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {m.senderName} ({isAdm ? 'Admin' : 'Visitor'})
                                  </span>
                                  <span className="text-zinc-400 tabular-nums">
                                    {formatTimestamp(m.createdAt, lang)}
                                  </span>
                                  {m.isEdited && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded">
                                      {t.editedBadge}
                                    </span>
                                  )}
                                  {!m.visitorVisible && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                                      Hidden from visitor
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLiveMsgId(m.id);
                                      setEditingLiveMsgText(m.text || '');
                                      setEditingLiveMsgVisible(m.visitorVisible);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    {t.editMessageBtn}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLiveMessage(m.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="space-y-2 pt-1">
                                  <textarea
                                    rows={2}
                                    maxLength={3000}
                                    value={editingLiveMsgText}
                                    onChange={(e) => setEditingLiveMsgText(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md"
                                  />
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editingLiveMsgVisible}
                                        onChange={(e) => setEditingLiveMsgVisible(e.target.checked)}
                                      />
                                      <span>Visible to visitor (while live)</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingLiveMsgId(null)}
                                        className="px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded cursor-pointer"
                                      >
                                        {t.cancel}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditedLiveMessage(m)}
                                        className="px-3 py-1 text-xs font-semibold bg-blue-700 text-white rounded cursor-pointer"
                                      >
                                        {t.saveMessageBtn}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {m.text && (
                                    <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                                      {m.text}
                                    </p>
                                  )}
                                </>
                              )}

                              {m.mediaName && (
                                <div className="space-y-2 pt-1">
                                  {mediaEntry && m.mediaMimeType?.startsWith('image/') && (
                                    <img
                                      src={mediaEntry.src}
                                      alt={m.mediaName}
                                      className="max-h-56 rounded-md object-contain bg-black/5"
                                    />
                                  )}
                                  {mediaEntry && m.mediaMimeType?.startsWith('video/') && (
                                    <video
                                      src={mediaEntry.src}
                                      controls
                                      playsInline
                                      className="w-full max-h-56 rounded-md bg-black"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadUrlOrBase64File(
                                        m.mediaUrl,
                                        m.mediaBase64,
                                        m.mediaMimeType,
                                        m.mediaName
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-zinc-200 dark:bg-zinc-800 rounded cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    {m.mediaName} ({formatBytes(m.mediaSizeBytes || 0)})
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Admin Live Reply Composer */}
                      <form onSubmit={handleSendAdminLiveReply} className="space-y-2.5 pt-1">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={3000}
                            placeholder={lang === 'om' ? 'Deebii admin asitti barreessi...' : 'Write admin reply...'}
                            value={adminLiveReplyText}
                            onChange={(e) => setAdminLiveReplyText(e.target.value)}
                            className="flex-1 px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                          />
                          <button
                            type="submit"
                            disabled={sendingAdminLive || (!adminLiveReplyText.trim() && !adminLiveMediaFile)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg cursor-pointer shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {sendingAdminLive ? t.saving : t.sendReplyBtn}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <input
                            key={adminLiveMediaKey}
                            type="file"
                            accept="image/*,video/*,*/*"
                            onChange={(e) => setAdminLiveMediaFile(e.target.files?.[0] || null)}
                            className="text-xs text-zinc-600 dark:text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-white dark:file:bg-blue-600 cursor-pointer"
                          />
                          {adminLiveMediaFile && (
                            <span className="font-mono text-zinc-500">
                              {adminLiveMediaFile.name} ({formatBytes(adminLiveMediaFile.size)})
                            </span>
                          )}
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BLOCKED USERS TAB */}
        {activeTab === 'blocked' && (
          <div className="space-y-6">
            <form
              onSubmit={handleManualBlockEmail}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-600" />
                  {t.blockedTitle}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {t.blockedDesc}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  required
                  placeholder={t.blockEmailPlaceholder}
                  value={blockEmailInput}
                  onChange={(e) => setBlockEmailInput(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
                <input
                  type="text"
                  maxLength={400}
                  placeholder={t.blockReasonPlaceholder}
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={blockingUser}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                {t.addBlockBtn}
              </button>
            </form>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
              {blockedUsers.length === 0 ? (
                <div className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {t.noBlockedUsers}
                </div>
              ) : (
                blockedUsers.map((rec) => (
                  <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{rec.targetName}</span>
                        {rec.targetEmail && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{rec.targetEmail}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="uppercase font-mono text-[11px]">{rec.source}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatTimestamp(rec.createdAt, lang)}</span>
                      </div>
                      {rec.reason && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{rec.reason}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(rec)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md cursor-pointer shrink-0"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t.unblockBtn}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CHAT MODERATION TAB */}
        {activeTab === 'chat' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
            {chatMessages.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No community chat messages yet.
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{msg.senderName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{msg.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatTimestamp(msg.createdAt, lang)}</span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 break-words">{msg.text}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBlockFromCommunity(msg)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-md cursor-pointer"
                    >
                      <Ban className="w-3 h-3" />
                      {t.blockSenderBtn}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await adminFetch(`/api/community/messages/${encodeURIComponent(msg.id)}/pin`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isPinned: !msg.isPinned }),
                          });
                          await onRefreshData();
                        } catch (err) {
                          setErrorMessage(err instanceof Error ? err.message : 'Failed to pin.');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer"
                    >
                      <Pin className="w-3 h-3" />
                      {msg.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await adminFetch(`/api/community/messages/${encodeURIComponent(msg.id)}`, {
                            method: 'DELETE',
                          });
                          await onRefreshData();
                        } catch (err) {
                          setErrorMessage(err instanceof Error ? err.message : 'Failed to delete message.');
                        }
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
