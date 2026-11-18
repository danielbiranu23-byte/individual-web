import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  ArrowRight,
  Bell,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Paperclip,
  Phone,
  Pin,
  Search,
  Send,
  ShieldBan,
  Sun,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AiChatbotWidget } from './components/AiChatbotWidget';
import { CommunityChatSection } from './components/CommunityChatSection';
import { Header } from './components/Header';
import { VaultSection } from './components/VaultSection';
import { ADMIN_EMAIL, auth, googleProvider } from './firebase';
import { DEFAULT_PROFILE, UI_TEXT } from './i18n';
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
} from './types';
import {
  checkIfBlocked,
  downloadUrlOrBase64File,
  formatBytes,
  formatTimestamp,
  getDeviceBlockKey,
  getEmailBlockKey,
  resolveStreamOrBlobUrl,
  safeReadJson,
} from './utils/format';

function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let token = 'CON_';
  for (let i = 0; i < bytes.length; i += 1) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

function generateLiveRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let id = 'LCR_';
  for (let i = 0; i < bytes.length; i += 1) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

export default function App() {
  const [lang, setLang] = useState<Language>('om');
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'site' | 'admin'>('site');

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('admin_session_token');
    } catch {
      return null;
    }
  });
  const [adminUsername, setAdminUsername] = useState<string | null>(null);

  const [profile, setProfile] = useState<SiteProfile>(DEFAULT_PROFILE);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [files, setFiles] = useState<SavedFileItem[]>([]);
  const [chatMessages, setChatMessages] = useState<CommunityChatMessage[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecordItem[]>([]);
  const [liveChatRooms, setLiveChatRooms] = useState<LiveChatRoomItem[]>([]);

  const [selectedSkillCategory, setSelectedSkillCategory] = useState('ALL');

  // Contact form, two-way file exchange & ephemeral visitor live chat state
  const [contactTab, setContactTab] = useState<'send' | 'receive' | 'live'>('send');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [contactFileInputKey, setContactFileInputKey] = useState(0);
  const [contactSending, setContactSending] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<'idle' | 'success' | 'error' | 'blocked'>('idle');
  const [lastTrackingCode, setLastTrackingCode] = useState<string | null>(null);
  const [copiedTrackingCode, setCopiedTrackingCode] = useState(false);
  const [savedTrackingCodes, setSavedTrackingCodes] = useState<Array<{ code: string; subject: string }>>(() => {
    try {
      const raw = localStorage.getItem('biranu_contact_codes');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [lookupCode, setLookupCode] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupChecked, setLookupChecked] = useState(false);
  const [lookupExchange, setLookupExchange] = useState<ContactExchangeItem | null>(null);
  const [replyPreview, setReplyPreview] = useState<{ src: string; revokeOnClose: boolean } | null>(null);
  const [replyPreviewLoading, setReplyPreviewLoading] = useState(false);

  // Ephemeral visitor live chat state (kept in memory only; disappears on close/reload)
  const [liveVisitorName, setLiveVisitorName] = useState('');
  const [liveVisitorEmail, setLiveVisitorEmail] = useState('');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveChatMessageItem[]>([]);
  const [liveText, setLiveText] = useState('');
  const [liveMediaFile, setLiveMediaFile] = useState<File | null>(null);
  const [liveMediaInputKey, setLiveMediaInputKey] = useState(0);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveStatusMsg, setLiveStatusMsg] = useState<'idle' | 'blocked' | 'ended' | 'error'>('idle');
  const [liveMediaUrls, setLiveMediaUrls] = useState<Record<string, { src: string; revokeOnClose: boolean }>>({});

  const t = UI_TEXT[lang];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!adminSessionToken) {
      setAdminUsername(null);
      return;
    }
    fetch('/api/admin/session', {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    })
      .then((res) => (res.ok ? safeReadJson<{ authenticated?: boolean; username?: string }>(res) : { authenticated: false }))
      .then((data: { authenticated?: boolean; username?: string }) => {
        if (data.authenticated && data.username) {
          setAdminUsername(data.username);
        } else {
          setAdminSessionToken(null);
          setAdminUsername(null);
          sessionStorage.removeItem('admin_session_token');
        }
      })
      .catch(() => {
        // Keep current state on transient network errors
      });
  }, [adminSessionToken]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIsAdmin(false);
        return;
      }
      const emailMatch =
        nextUser.emailVerified && nextUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setIsAdmin(Boolean(emailMatch));
    });
    return () => unsub();
  }, []);

  const refreshSiteData = useCallback(async () => {
    try {
      const headers: HeadersInit = adminSessionToken
        ? { Authorization: `Bearer ${adminSessionToken}` }
        : {};
      const res = await fetch('/api/site/bootstrap', { headers });
      if (res.ok) {
        const data = await safeReadJson<{
          profile?: Partial<SiteProfile> | null;
          skills?: SkillItem[];
          announcements?: AnnouncementItem[];
          notes?: NoteItem[];
          files?: SavedFileItem[];
          chatMessages?: CommunityChatMessage[];
        }>(res);
        if (data.profile) {
          const p = data.profile;
          setProfile({
            ...DEFAULT_PROFILE,
            ...p,
            roleTitleOm:
              !p.roleTitleOm || p.roleTitleOm === 'Injinarii Sooftiweerii fi Qopheessaa Websaayitii'
                ? DEFAULT_PROFILE.roleTitleOm
                : p.roleTitleOm,
            roleTitleEn:
              !p.roleTitleEn || p.roleTitleEn === 'Software Engineer & Digital Creator'
                ? DEFAULT_PROFILE.roleTitleEn
                : p.roleTitleEn,
            avatarUrl:
              !p.avatarUrl || p.avatarUrl === '/src/assets/images/owner_portrait_1794987971658.jpg'
                ? DEFAULT_PROFILE.avatarUrl
                : p.avatarUrl,
            phone:
              !p.phone || p.phone === '+251 900 000 000' || p.phone === '+2519323875'
                ? DEFAULT_PROFILE.phone
                : p.phone,
          });
        }
        if (Array.isArray(data.skills)) setSkills(data.skills);
        if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
        if (Array.isArray(data.notes)) setNotes(data.notes);
        if (Array.isArray(data.files)) setFiles(data.files);
        if (Array.isArray(data.chatMessages)) setChatMessages(data.chatMessages);
      }

      if (adminSessionToken && adminUsername) {
        const adminRes = await fetch('/api/admin/bootstrap', {
          headers: { Authorization: `Bearer ${adminSessionToken}` },
        });
        if (adminRes.ok) {
          const adminData = await safeReadJson<{
            contactMessages?: ContactMessageItem[];
            blockedUsers?: BlockedUserRecordItem[];
            liveChatRooms?: LiveChatRoomItem[];
          }>(adminRes);
          if (Array.isArray(adminData.contactMessages)) setContactMessages(adminData.contactMessages);
          if (Array.isArray(adminData.blockedUsers)) setBlockedUsers(adminData.blockedUsers);
          if (Array.isArray(adminData.liveChatRooms)) setLiveChatRooms(adminData.liveChatRooms);
        }
      } else {
        setContactMessages([]);
        setBlockedUsers([]);
        setLiveChatRooms([]);
      }
    } catch {
      // Ignore transient network errors during poll
    }
  }, [adminSessionToken, adminUsername]);

  useEffect(() => {
    refreshSiteData();
    const timer = setInterval(refreshSiteData, 5000);
    return () => clearInterval(timer);
  }, [refreshSiteData]);

  const fetchActiveLiveMessages = useCallback(async () => {
    if (!activeRoomId) {
      setLiveMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/live-chat/rooms/${encodeURIComponent(activeRoomId)}/messages`);
      if (!res.ok) return;
      const data = await safeReadJson<{
        active?: boolean;
        messages?: LiveChatMessageItem[];
      }>(res);
      if (data.active === false) {
        setActiveRoomId(null);
        setLiveMessages([]);
        setLiveStatusMsg('ended');
        return;
      }
      if (Array.isArray(data.messages)) {
        setLiveMessages(data.messages);
      }
    } catch {
      // Ignore transient poll error
    }
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) {
      setLiveMessages([]);
      return;
    }
    fetchActiveLiveMessages();
    const timer = setInterval(fetchActiveLiveMessages, 2500);
    return () => clearInterval(timer);
  }, [activeRoomId, fetchActiveLiveMessages]);

  // Resolve inline photo/video stream URLs for active visitor live chat
  useEffect(() => {
    let cancelled = false;
    async function loadMedia() {
      for (const msg of liveMessages) {
        if (!msg.mediaName || liveMediaUrls[msg.id]) continue;
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
            setLiveMediaUrls((prev) => ({ ...prev, [msg.id]: resolved }));
          } else if (resolved.revokeOnClose) {
            URL.revokeObjectURL(resolved.src);
          }
        } catch {
          // Download button still works if inline preview fails
        }
      }
    }
    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [liveMessages, liveMediaUrls]);

  async function handleSignIn() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleSignOut() {
    if (adminSessionToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      }).catch(() => {});
      sessionStorage.removeItem('admin_session_token');
      setAdminSessionToken(null);
      setAdminUsername(null);
    }
    if (auth.currentUser) {
      await signOut(auth);
    }
  }

  function handleAdminCredentialSuccess(token: string, username: string) {
    sessionStorage.setItem('admin_session_token', token);
    setAdminSessionToken(token);
    setAdminUsername(username);
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      return;
    }
    if (contactFile && contactFile.size > 104857600) {
      setContactFeedback('error');
      return;
    }
    setContactSending(true);
    setContactFeedback('idle');
    try {
      const senderKey = await getEmailBlockKey(contactEmail);
      const deviceKey = await getDeviceBlockKey();
      const uidKey = user ? `uid_${user.uid}` : null;
      const blocked = await checkIfBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        setContactFeedback('blocked');
        return;
      }

      const trackingCode = generateTrackingCode();
      const payload: Record<string, unknown> = {
        senderName: contactName.trim().slice(0, 100),
        senderEmail: contactEmail.trim().slice(0, 160),
        subject: contactSubject.trim().slice(0, 160),
        message: contactMessage.trim().slice(0, 3000),
        senderKey,
        deviceKey,
        uidKey,
        trackingCode,
      };

      if (contactFile) {
        const formData = new FormData();
        formData.append('file', contactFile);
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        const uploaded = await safeReadJson<{
          fileName: string;
          storedName: string;
          mimeType: string;
          sizeBytes: number;
          downloadUrl: string;
          error?: string;
        }>(res);
        if (!res.ok) {
          throw new Error(uploaded.error || 'Upload failed.');
        }
        payload.attachmentName = uploaded.fileName.slice(0, 255);
        payload.attachmentStoredName = uploaded.storedName.slice(0, 255);
        payload.attachmentMimeType = uploaded.mimeType.slice(0, 120);
        payload.attachmentSizeBytes = uploaded.sizeBytes;
        payload.attachmentUrl = uploaded.downloadUrl.slice(0, 500);
      }

      const submitRes = await fetch('/api/contact/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const submitData = await safeReadJson<{ blocked?: boolean; error?: string }>(submitRes).catch(() => ({} as { blocked?: boolean; error?: string }));
      if (!submitRes.ok) {
        if (submitRes.status === 403 && submitData.blocked) {
          setContactFeedback('blocked');
          return;
        }
        throw new Error(submitData.error || 'Submit failed.');
      }

      const nextEntry = { code: trackingCode, subject: contactSubject.trim().slice(0, 60) };
      const updatedCodes = [nextEntry, ...savedTrackingCodes.filter((c) => c.code !== trackingCode)].slice(0, 8);
      setSavedTrackingCodes(updatedCodes);
      try {
        localStorage.setItem('biranu_contact_codes', JSON.stringify(updatedCodes));
      } catch {
        // Ignore storage errors
      }

      setLastTrackingCode(trackingCode);
      setLookupCode(trackingCode);
      setCopiedTrackingCode(false);
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
      setContactFile(null);
      setContactFileInputKey((k) => k + 1);
      setContactFeedback('success');
      await refreshSiteData();
    } catch {
      setContactFeedback('error');
    } finally {
      setContactSending(false);
    }
  }

  async function handleStartLiveChat(e: React.FormEvent) {
    e.preventDefault();
    if (!liveVisitorName.trim() || liveBusy) return;
    setLiveBusy(true);
    setLiveStatusMsg('idle');
    try {
      const deviceKey = await getDeviceBlockKey();
      const senderKey = liveVisitorEmail.trim()
        ? await getEmailBlockKey(liveVisitorEmail)
        : undefined;
      const uidKey = user ? `uid_${user.uid}` : null;
      const blocked = await checkIfBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        setLiveStatusMsg('blocked');
        return;
      }

      const roomId = generateLiveRoomId();
      const res = await fetch('/api/live-chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          visitorName: liveVisitorName.trim().slice(0, 100),
          deviceKey,
          senderKey,
          uidKey,
        }),
      });
      const data = await safeReadJson<{ blocked?: boolean; error?: string }>(res).catch(() => ({} as { blocked?: boolean; error?: string }));
      if (!res.ok) {
        setLiveStatusMsg(res.status === 403 && data.blocked ? 'blocked' : 'error');
        return;
      }

      setLiveMessages([]);
      setLiveMediaUrls({});
      setActiveRoomId(roomId);
      await refreshSiteData();
    } catch {
      setLiveStatusMsg('error');
    } finally {
      setLiveBusy(false);
    }
  }

  async function handleSendLiveMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRoomId || liveBusy || (!liveText.trim() && !liveMediaFile)) return;
    if (liveMediaFile && liveMediaFile.size > 104857600) {
      setLiveStatusMsg('error');
      return;
    }
    setLiveBusy(true);
    setLiveStatusMsg('idle');
    try {
      const deviceKey = await getDeviceBlockKey();
      const senderKey = liveVisitorEmail.trim()
        ? await getEmailBlockKey(liveVisitorEmail)
        : undefined;
      const uidKey = user ? `uid_${user.uid}` : null;
      const blocked = await checkIfBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        setLiveStatusMsg('blocked');
        return;
      }

      const msgPayload: Record<string, unknown> = {
        senderName: (liveVisitorName.trim() || 'Visitor').slice(0, 100),
        text: liveText.trim().slice(0, 3000),
        deviceKey,
        senderKey,
        uidKey,
      };

      if (liveMediaFile) {
        const formData = new FormData();
        formData.append('file', liveMediaFile);
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        const uploaded = await safeReadJson<{
          fileName: string;
          storedName: string;
          mimeType: string;
          sizeBytes: number;
          downloadUrl: string;
          error?: string;
        }>(res);
        if (!res.ok) {
          throw new Error(uploaded.error || 'Upload failed.');
        }
        msgPayload.mediaName = uploaded.fileName.slice(0, 255);
        msgPayload.mediaStoredName = uploaded.storedName.slice(0, 255);
        msgPayload.mediaMimeType = uploaded.mimeType.slice(0, 120);
        msgPayload.mediaSizeBytes = uploaded.sizeBytes;
        msgPayload.mediaUrl = uploaded.downloadUrl.slice(0, 500);
      }

      const sendRes = await fetch(
        `/api/live-chat/rooms/${encodeURIComponent(activeRoomId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgPayload),
        }
      );
      const sendData = await safeReadJson<{
        blocked?: boolean;
        ended?: boolean;
        error?: string;
      }>(sendRes).catch(() => ({} as { blocked?: boolean; ended?: boolean; error?: string }));
      if (!sendRes.ok) {
        if (sendData.blocked) {
          setLiveStatusMsg('blocked');
          return;
        }
        if (sendData.ended) {
          setActiveRoomId(null);
          setLiveMessages([]);
          setLiveStatusMsg('ended');
          return;
        }
        throw new Error(sendData.error || 'Send failed.');
      }

      setLiveText('');
      setLiveMediaFile(null);
      setLiveMediaInputKey((k) => k + 1);
      await fetchActiveLiveMessages();
      await refreshSiteData();
    } catch {
      const deviceKey = await getDeviceBlockKey();
      const stillBlocked = await checkIfBlocked([deviceKey, user ? `uid_${user.uid}` : null]);
      setLiveStatusMsg(stillBlocked ? 'blocked' : 'error');
    } finally {
      setLiveBusy(false);
    }
  }

  async function handleEndAndClearLiveChat() {
    const roomToClose = activeRoomId;
    Object.values(liveMediaUrls).forEach((entry) => {
      if (entry.revokeOnClose) URL.revokeObjectURL(entry.src);
    });
    setLiveMediaUrls({});
    setActiveRoomId(null);
    setLiveMessages([]);
    setLiveText('');
    setLiveMediaFile(null);
    setLiveStatusMsg('ended');
    if (roomToClose) {
      await fetch(`/api/live-chat/rooms/${encodeURIComponent(roomToClose)}/end`, {
        method: 'POST',
      }).catch(() => {});
    }
  }

  async function handleLookupExchange(codeOverride?: string) {
    const code = (codeOverride ?? lookupCode).trim();
    if (!/^[a-zA-Z0-9_\-]{12,64}$/.test(code)) {
      setLookupError(t.contact.invalidCode);
      setLookupExchange(null);
      setLookupChecked(false);
      return;
    }
    if (replyPreview) {
      if (replyPreview.revokeOnClose) URL.revokeObjectURL(replyPreview.src);
      setReplyPreview(null);
    }
    setLookupCode(code);
    setLookupBusy(true);
    setLookupError(null);
    setLookupChecked(false);
    try {
      const res = await fetch(`/api/contact/exchanges/${encodeURIComponent(code)}`);
      if (!res.ok) {
        throw new Error('Lookup failed');
      }
      const data = await safeReadJson<{ exchange?: ContactExchangeItem | null }>(res);
      setLookupExchange(data.exchange || null);
      setLookupChecked(true);
    } catch {
      setLookupError(t.contact.errorMsg);
      setLookupExchange(null);
    } finally {
      setLookupBusy(false);
    }
  }

  async function handlePreviewExchangeFile(exchange: ContactExchangeItem) {
    if (replyPreview) {
      if (replyPreview.revokeOnClose) URL.revokeObjectURL(replyPreview.src);
      setReplyPreview(null);
      return;
    }
    setReplyPreviewLoading(true);
    try {
      const resolved = await resolveStreamOrBlobUrl(
        exchange.replyDownloadUrl,
        exchange.replyFileBase64,
        exchange.replyMimeType,
        exchange.replyFileName
      );
      setReplyPreview(resolved);
    } catch {
      setLookupError(t.contact.errorMsg);
    } finally {
      setReplyPreviewLoading(false);
    }
  }

  const skillCategories = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [skills]);

  const visibleSkills = useMemo(() => {
    if (selectedSkillCategory === 'ALL') return skills;
    return skills.filter((s) => s.category === selectedSkillCategory);
  }, [skills, selectedSkillCategory]);

  const publicAnnouncements = useMemo(
    () => announcements.filter((a) => a.isPublished),
    [announcements]
  );

  const publicNotes = useMemo(() => notes.filter((n) => n.isPublic), [notes]);
  const publicFiles = useMemo(() => files.filter((f) => f.isPublic), [files]);

  if (viewMode === 'admin') {
    return (
      <AdminDashboard
        lang={lang}
        onChangeLang={setLang}
        user={user}
        adminAuthenticated={Boolean(adminSessionToken && adminUsername)}
        adminSessionToken={adminSessionToken}
        adminUsername={adminUsername}
        onAdminCredentialSuccess={handleAdminCredentialSuccess}
        onRefreshData={refreshSiteData}
        profile={profile}
        skills={skills}
        announcements={announcements}
        notes={notes}
        files={files}
        contactMessages={contactMessages}
        chatMessages={chatMessages}
        blockedUsers={blockedUsers}
        liveChatRooms={liveChatRooms}
        onSignOut={handleSignOut}
        onBackToSite={() => setViewMode('site')}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
      <Header
        ownerName={profile.ownerName}
        avatarUrl={profile.avatarUrl}
        lang={lang}
        isAdmin={isAdmin || Boolean(adminSessionToken && adminUsername)}
        onOpenAdmin={() => setViewMode('admin')}
      />

      {/* HERO SECTION */}
      <section className="hero-canvas-tint pt-10 pb-16 sm:pt-14 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Utility bar inside Hero (Department Title, Language & Theme) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-8 mb-8 border-b border-slate-200/80 dark:border-slate-800/80">
            <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] font-bold tracking-tight leading-snug bg-gradient-to-r from-blue-800 via-indigo-700 to-sky-600 dark:from-sky-300 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent text-balance max-w-4xl">
              {lang === 'om' ? profile.roleTitleOm : profile.roleTitleEn}
            </h2>
            <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
              <div className="inline-flex items-center p-0.5 bg-slate-200/80 dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLang('om')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    lang === 'om'
                      ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Afaan Oromoo
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    lang === 'en'
                      ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  English
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                aria-label="Toggle color theme"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] text-blue-700 dark:text-sky-400 hover:border-blue-300 dark:hover:border-sky-600 transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2-Column Split Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between py-2">
              <div>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.08] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-800 dark:from-white dark:via-slate-100 dark:to-sky-300 bg-clip-text text-transparent text-balance max-w-2xl">
                  {lang === 'om' ? profile.headlineOm : profile.headlineEn}
                </h1>
                <p className="mt-6 text-base sm:text-lg text-slate-700 dark:text-slate-300 leading-relaxed max-w-xl">
                  {lang === 'om' ? profile.bioOm : profile.bioEn}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 text-white rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0"
                >
                  {t.hero.contactCta}
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#vault"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 hover:text-blue-700 dark:hover:text-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {t.hero.vaultCta}
                </a>
                <a
                  href="#community"
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-sky-400 hover:text-indigo-800 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
                >
                  {t.hero.chatCta}
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-[#0D1322] shadow-sm ring-1 ring-blue-600/10 dark:ring-sky-400/10">
                <img
                  src="/src/assets/images/hero_workspace_1794987970609.jpg"
                  alt="Personal workspace studio"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Full-width 4-column stat strip below split */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700 rounded-xl p-5 transition-colors shadow-2xs">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.hero.statYears}</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1 text-blue-700 dark:text-sky-400">
                {profile.yearsExperience || '5+'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700 rounded-xl p-5 transition-colors shadow-2xs">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.hero.statProjects}</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1 text-indigo-700 dark:text-blue-400">
                {profile.projectsCompleted || '28+'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700 rounded-xl p-5 transition-colors shadow-2xs">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.hero.statNotes}</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1 text-sky-700 dark:text-cyan-300">
                {publicNotes.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700 rounded-xl p-5 transition-colors shadow-2xs">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.hero.statFiles}</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
                {publicFiles.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B111E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-4 flex justify-center">
              <div className="w-full max-w-[320px] aspect-square rounded-full overflow-hidden p-1.5 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 shadow-lg">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900">
                  <img
                    src={profile.avatarUrl || '/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg'}
                    alt={profile.ownerName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 dark:from-white dark:via-sky-200 dark:to-blue-300 bg-clip-text text-transparent">
                  {t.about.sectionTitle}
                </h2>
                <p className="mt-2 text-sm font-medium text-blue-700 dark:text-sky-400">{t.about.subtitle}</p>
              </div>
              <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-w-3xl">
                {lang === 'om' ? profile.bioOm : profile.bioEn}
              </p>
              <div className="pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.about.locationLabel}</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
                    <span>{profile.location}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.about.emailLabel}</p>
                  <a
                    href={`mailto:${profile.email}`}
                    className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 hover:text-blue-700 dark:hover:text-sky-400 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </a>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.about.linksLabel}</p>
                  <div className="flex items-center gap-4 font-semibold text-blue-700 dark:text-sky-400">
                    {profile.githubUrl && (
                      <a
                        href={profile.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-indigo-800 dark:hover:text-sky-300 hover:underline"
                      >
                        GitHub <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.linkedinUrl && (
                      <a
                        href={profile.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-indigo-800 dark:hover:text-sky-300 hover:underline"
                      >
                        LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.telegramUrl && (
                      <a
                        href={profile.telegramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-indigo-800 dark:hover:text-sky-300 hover:underline"
                      >
                        Telegram <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SKILLS SECTION */}
      <section id="skills" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 dark:from-white dark:via-sky-200 dark:to-blue-300 bg-clip-text text-transparent">
                {t.skills.sectionTitle}
              </h2>
              <p className="mt-2 text-base text-slate-700 dark:text-slate-300 max-w-2xl">
                {t.skills.subtitle}
              </p>
            </div>
            {skillCategories.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {skillCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedSkillCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedSkillCategory === cat
                        ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                        : 'bg-white dark:bg-[#0D1322] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700 hover:text-blue-700 dark:hover:text-sky-300'
                    }`}
                  >
                    {cat === 'ALL' ? t.skills.allCategories : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visibleSkills.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400">
              {t.skills.empty}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700/80 rounded-xl p-6 flex flex-col justify-between transition-colors shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <span className="font-medium text-blue-700 dark:text-sky-400">
                        {skill.category}
                        {skill.years ? ` · ${skill.years} ${t.skills.yearsSuffix}` : ''}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-indigo-700 dark:text-sky-300">
                        {skill.level}%
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                      {skill.name}
                    </h3>
                    {skill.description && (
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-5 h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-500 dark:from-blue-500 dark:via-sky-400 dark:to-cyan-300 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, skill.level))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ANNOUNCEMENTS SECTION */}
      <section
        id="announcements"
        className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B111E]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 dark:from-white dark:via-sky-200 dark:to-blue-300 bg-clip-text text-transparent">
              {t.announcements.sectionTitle}
            </h2>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-300 max-w-2xl">
              {t.announcements.subtitle}
            </p>
          </div>

          {publicAnnouncements.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl">
              <Bell className="w-7 h-7 text-blue-500/70 dark:text-sky-400/70 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">{t.announcements.empty}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publicAnnouncements.map((ann) => (
                <article
                  key={ann.id}
                  className={`rounded-xl p-6 border transition-colors ${
                    ann.isPinned
                      ? 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-200 dark:border-sky-800/70'
                      : 'bg-slate-50/75 dark:bg-[#0D1322] border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-sky-700/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-semibold text-blue-700 dark:text-sky-400">{ann.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatTimestamp(ann.createdAt, lang)}</span>
                    {ann.isPinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-sky-300">
                          <Pin className="w-3 h-3" />
                          {t.announcements.pinned}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                    {ann.title}
                  </h3>
                  <p className="mt-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {ann.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* NOTES & FILE VAULT */}
      <VaultSection lang={lang} notes={publicNotes} files={publicFiles} />

      {/* REAL-TIME COMMUNITY CHAT */}
      <CommunityChatSection
        lang={lang}
        user={user}
        isAdmin={isAdmin}
        adminSessionToken={adminSessionToken}
        messages={chatMessages}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onRefresh={refreshSiteData}
      />

      {/* CONTACT SECTION */}
      <section
        id="contact"
        className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-[#070B14]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 dark:from-white dark:via-sky-200 dark:to-blue-300 bg-clip-text text-transparent">
                  {t.contact.sectionTitle}
                </h2>
                <p className="mt-3 text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                  {t.contact.subtitle}
                </p>
              </div>
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 text-sm">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {t.contact.directTitle}
                </p>
                <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
                  <a
                    href={`tel:${(profile.phone || '+251932387559').replace(/\s+/g, '')}`}
                    className="hover:text-blue-700 dark:hover:text-sky-400 transition-colors"
                  >
                    {profile.phone || '+251932387559'}
                  </a>
                </p>
                <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
                  <a
                    href={`mailto:${profile.email}`}
                    className="hover:text-blue-700 dark:hover:text-sky-400 transition-colors"
                  >
                    {profile.email}
                  </a>
                </p>
                <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
                  <span>{profile.location}</span>
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-xs">
                {/* Send / Receive / Live Chat Mode Switcher */}
                <div className="flex flex-wrap gap-2 pb-5 mb-6 border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setContactTab('send')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                      contactTab === 'send'
                        ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t.contact.sendTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactTab('receive')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                      contactTab === 'receive'
                        ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.contact.receiveTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactTab('live')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                      contactTab === 'live'
                        ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {t.contact.liveChatTab}
                  </button>
                </div>

                {contactTab === 'send' && (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t.contact.nameLabel}
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t.contact.emailLabel}
                        </label>
                        <input
                          type="email"
                          required
                          maxLength={160}
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.contact.subjectLabel}
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={160}
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.contact.messageLabel}
                      </label>
                      <textarea
                        rows={4}
                        required
                        maxLength={3000}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                      />
                    </div>

                    {/* Optional Photo, Video or File Upload to Send to Admin */}
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <Paperclip className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
                        <span>{t.contact.attachFileLabel}</span>
                      </label>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <input
                          key={contactFileInputKey}
                          type="file"
                          accept="image/*,video/*,*/*"
                          onChange={(e) => setContactFile(e.target.files?.[0] || null)}
                          className="text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-700 file:text-white hover:file:bg-blue-800 cursor-pointer"
                        />
                        {contactFile && (
                          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-mono truncate max-w-[180px]">{contactFile.name}</span>
                            <span className="text-slate-500">({formatBytes(contactFile.size)})</span>
                            <button
                              type="button"
                              onClick={() => {
                                setContactFile(null);
                                setContactFileInputKey((k) => k + 1);
                              }}
                              className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                            >
                              {t.contact.removeFile}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {contactFeedback === 'success' && (
                      <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/70 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3 shadow-2xs">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white shrink-0 shadow-xs">
                            <Check className="w-4 h-4" />
                          </span>
                          <p className="font-display text-lg sm:text-xl font-bold leading-snug text-emerald-800 dark:text-emerald-200">
                            {t.contact.successMsg}
                          </p>
                        </div>
                        {lastTrackingCode && (
                          <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                {t.contact.trackingCodeLabel}
                              </p>
                              <p className="font-mono text-sm font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
                                {lastTrackingCode}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(lastTrackingCode);
                                  setCopiedTrackingCode(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-md cursor-pointer"
                              >
                                {copiedTrackingCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedTrackingCode ? t.contact.copiedCode : t.contact.copyCode}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setContactTab('receive');
                                  handleLookupExchange(lastTrackingCode);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md cursor-pointer"
                              >
                                {t.contact.lookupBtn}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {contactFeedback === 'blocked' && (
                      <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                        <ShieldBan className="w-4 h-4 shrink-0" />
                        <span>{t.contact.blockedMsg}</span>
                      </div>
                    )}
                    {contactFeedback === 'error' && (
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {t.contact.errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={contactSending}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 disabled:opacity-50 text-white rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {contactSending ? t.contact.sending : t.contact.sendBtn}
                    </button>
                  </form>
                )}

                {contactTab === 'receive' && (
                  <div className="space-y-5">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t.contact.lookupDesc}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={lookupCode}
                        onChange={(e) => setLookupCode(e.target.value)}
                        placeholder={t.contact.lookupPlaceholder}
                        className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        disabled={lookupBusy}
                        onClick={() => handleLookupExchange()}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        <Search className="w-4 h-4" />
                        {lookupBusy ? t.contact.checking : t.contact.lookupBtn}
                      </button>
                    </div>

                    {savedTrackingCodes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {t.contact.recentCodesLabel}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {savedTrackingCodes.map((entry) => (
                            <button
                              key={entry.code}
                              type="button"
                              onClick={() => handleLookupExchange(entry.code)}
                              className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                                lookupCode === entry.code
                                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-sky-600 text-blue-800 dark:text-sky-300'
                                  : 'bg-slate-50 dark:bg-[#070B14] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300'
                              }`}
                            >
                              {entry.code} · {entry.subject}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {lookupError && (
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">{lookupError}</p>
                    )}

                    {lookupChecked && !lookupExchange && !lookupError && (
                      <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                        {t.contact.noReplyYet}
                      </div>
                    )}

                    {lookupExchange && (
                      <div className="p-5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-sky-800/70 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-blue-700 dark:text-sky-400">
                            {t.contact.adminReplyTitle} · {lookupExchange.subject}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatTimestamp(lookupExchange.updatedAt, lang)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {lookupExchange.adminReply}
                        </p>

                        {lookupExchange.replyFileName && (
                          <div className="pt-3 border-t border-blue-200/70 dark:border-sky-800/60 space-y-3">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {t.contact.receivedFileTitle}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {lookupExchange.replyFileName}
                                </p>
                                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                  {formatBytes(lookupExchange.replySizeBytes || 0)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={replyPreviewLoading}
                                  onClick={() => handlePreviewExchangeFile(lookupExchange)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-400 cursor-pointer"
                                >
                                  {replyPreview ? <X className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  {replyPreview ? t.contact.closePreview : t.contact.previewFileBtn}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadUrlOrBase64File(
                                      lookupExchange.replyDownloadUrl,
                                      lookupExchange.replyFileBase64,
                                      lookupExchange.replyMimeType,
                                      lookupExchange.replyFileName
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 text-white rounded-lg cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {t.contact.receiveDownloadBtn}
                                </button>
                              </div>
                            </div>

                            {replyPreview && (
                              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070B14] p-2">
                                {lookupExchange.replyMimeType?.startsWith('image/') ? (
                                  <img
                                    src={replyPreview.src}
                                    alt={lookupExchange.replyFileName}
                                    className="max-h-96 mx-auto rounded-md object-contain"
                                  />
                                ) : lookupExchange.replyMimeType?.startsWith('video/') ? (
                                  <video
                                    src={replyPreview.src}
                                    controls
                                    playsInline
                                    className="w-full max-h-96 rounded-md bg-black"
                                  />
                                ) : (
                                  <iframe
                                    src={replyPreview.src}
                                    title={lookupExchange.replyFileName}
                                    className="w-full h-96 rounded-md bg-white"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {contactTab === 'live' && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                      {t.contact.liveEphemeralNote}
                    </div>

                    {liveStatusMsg === 'blocked' && (
                      <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                        <ShieldBan className="w-4 h-4 shrink-0" />
                        <span>{t.contact.blockedMsg}</span>
                      </div>
                    )}

                    {liveStatusMsg === 'ended' && !activeRoomId && (
                      <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        {t.contact.liveEndedNotice}
                      </div>
                    )}

                    {!activeRoomId ? (
                      <form onSubmit={handleStartLiveChat} className="space-y-4 pt-1">
                        <div>
                          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                            {t.contact.liveTitle}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {t.contact.liveDesc}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              {t.contact.nameLabel}
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={100}
                              value={liveVisitorName}
                              onChange={(e) => setLiveVisitorName(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                              {t.contact.liveOptionalEmail}
                            </label>
                            <input
                              type="email"
                              maxLength={160}
                              value={liveVisitorEmail}
                              onChange={(e) => setLiveVisitorEmail(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                            />
                          </div>
                        </div>
                        {liveStatusMsg === 'error' && (
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {t.contact.errorMsg}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={liveBusy}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {liveBusy ? t.contact.sending : t.contact.liveStartBtn}
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {liveVisitorName} · {t.contact.liveAdminLabel}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleEndAndClearLiveChat}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t.contact.liveEndClearBtn}
                          </button>
                        </div>

                        <div className="max-h-96 overflow-y-auto space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800">
                          {liveMessages.length === 0 ? (
                            <p className="text-xs text-center py-6 text-slate-500 dark:text-slate-400">
                              {t.contact.liveEmpty}
                            </p>
                          ) : (
                            liveMessages.map((m) => {
                              const isVisitor = m.senderRole === 'visitor';
                              const previewObj = liveMediaUrls[m.id];
                              return (
                                <div
                                  key={m.id}
                                  className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm space-y-2 ${
                                      isVisitor
                                        ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white'
                                        : 'bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3 text-[11px] opacity-80">
                                      <span className="font-semibold">
                                        {isVisitor ? t.contact.liveYouLabel : t.contact.liveAdminLabel}
                                      </span>
                                      <span className="tabular-nums">{formatTimestamp(m.createdAt, lang)}</span>
                                    </div>
                                    {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                                    {m.mediaName && (
                                      <div className="space-y-2 pt-1">
                                        {previewObj && m.mediaMimeType?.startsWith('image/') && (
                                          <img
                                            src={previewObj.src}
                                            alt={m.mediaName}
                                            className="max-h-56 rounded-lg object-contain bg-black/10"
                                          />
                                        )}
                                        {previewObj && m.mediaMimeType?.startsWith('video/') && (
                                          <video
                                            src={previewObj.src}
                                            controls
                                            playsInline
                                            className="w-full max-h-56 rounded-lg bg-black"
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
                                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                                            isVisitor
                                              ? 'bg-white/15 hover:bg-white/25 text-white'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                          }`}
                                        >
                                          <Download className="w-3 h-3" />
                                          <span className="truncate max-w-[180px]">{m.mediaName}</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <form onSubmit={handleSendLiveMessage} className="space-y-2.5">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              maxLength={3000}
                              placeholder={t.contact.livePlaceholder}
                              value={liveText}
                              onChange={(e) => setLiveText(e.target.value)}
                              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500"
                            />
                            <button
                              type="submit"
                              disabled={liveBusy || (!liveText.trim() && !liveMediaFile)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 disabled:opacity-50 text-white rounded-lg cursor-pointer shrink-0"
                            >
                              <Send className="w-4 h-4" />
                              {t.contact.sendBtn.split(' ')[0]}
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                              <Paperclip className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
                              <span>{t.contact.liveAttachMedia}:</span>
                              <input
                                key={liveMediaInputKey}
                                type="file"
                                accept="image/*,video/*,*/*"
                                onChange={(e) => setLiveMediaFile(e.target.files?.[0] || null)}
                                className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 cursor-pointer"
                              />
                            </label>
                            {liveMediaFile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLiveMediaFile(null);
                                  setLiveMediaInputKey((k) => k + 1);
                                }}
                                className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                              >
                                {liveMediaFile.name} ({formatBytes(liveMediaFile.size)}) · {t.contact.removeFile}
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B111E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            © {new Date().getFullYear()} {profile.ownerName}. {t.footer.rights}
          </p>
          <div className="flex items-center gap-5">
            <span>{t.footer.builtWith}</span>
            <button
              type="button"
              onClick={() => setViewMode('admin')}
              className="font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
            >
              {t.nav.admin}
            </button>
          </div>
        </div>
      </footer>

      {/* AI CHATBOT WIDGET */}
      <AiChatbotWidget
        lang={lang}
        profile={profile}
        skills={skills}
        announcements={publicAnnouncements}
        publicNotesCount={publicNotes.length}
        publicFilesCount={publicFiles.length}
      />
    </div>
  );
}
