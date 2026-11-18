import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedKeySignature = '';

export function getSupabaseConfig(): {
  url: string;
  key: string;
  hasSecretKey: boolean;
} {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  return {
    url,
    key: secretKey || publishableKey,
    hasSecretKey: Boolean(secretKey),
  };
}

export function getSupabaseClient(): SupabaseClient {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error('Supabase URL or API key is not configured.');
  }
  const signature = `${url}:${key.slice(0, 24)}`;
  if (!cachedClient || cachedKeySignature !== signature) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedKeySignature = signature;
  }
  return cachedClient;
}

export function isRlsOrPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  const msg = 'message' in err ? String((err as { message?: unknown }).message || '') : '';
  return (
    code === '42501' ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('permission denied')
  );
}

export function formatSupabaseError(err: unknown, fallback: string): { status: number; message: string } {
  if (isRlsOrPermissionError(err)) {
    return {
      status: 403,
      message:
        'Supabase RLS blocked this write. Add SUPABASE_SECRET_KEY (sb_secret_...) in AI Studio Secrets or enable write policies in Supabase SQL Editor.',
    };
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message?: unknown }).message || '').trim();
    if (msg) return { status: 500, message: msg };
  }
  return { status: 500, message: fallback };
}

export function mapSiteProfileRow(row: Record<string, unknown>) {
  return {
    ownerName: String(row.owner_name || 'Daniel Biranu'),
    roleTitleOm: String(row.role_title_om || 'College of Computing Department of Information system for 2026 Gc'),
    roleTitleEn: String(row.role_title_en || 'College of Computing Department of Information system for 2026 Gc'),
    headlineOm: String(row.headline_om || ''),
    headlineEn: String(row.headline_en || ''),
    bioOm: String(row.bio_om || ''),
    bioEn: String(row.bio_en || ''),
    location: row.location ? String(row.location) : 'Finfinnee, Oromia',
    email: row.email ? String(row.email) : 'danielbiranu142@gmail.com',
    phone: row.phone ? String(row.phone) : '',
    githubUrl: row.github_url ? String(row.github_url) : '',
    linkedinUrl: row.linkedin_url ? String(row.linkedin_url) : '',
    telegramUrl: row.telegram_url ? String(row.telegram_url) : '',
    avatarUrl: row.avatar_url ? String(row.avatar_url) : '/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg',
    yearsExperience: row.years_experience ? String(row.years_experience) : '5+ Waggaa',
    projectsCompleted: row.projects_completed ? String(row.projects_completed) : '28+ Pirojektii',
  };
}

export function mapSkillRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    level: Number(row.level) || 0,
    years: row.years ? String(row.years) : '',
    description: row.description ? String(row.description) : '',
    authorId: String(row.author_id || 'admin'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAnnouncementRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: String(row.category),
    isPinned: Boolean(row.is_pinned),
    isPublished: Boolean(row.is_published),
    authorId: String(row.author_id || 'admin'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNoteRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: String(row.category),
    isPublic: Boolean(row.is_public),
    authorId: String(row.author_id || 'admin'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSavedFileRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : '',
    fileName: String(row.file_name),
    storedName: String(row.stored_name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes) || 0,
    downloadUrl: String(row.download_url),
    category: String(row.category),
    isPublic: Boolean(row.is_public),
    hasBlob: false,
    authorId: String(row.author_id || 'admin'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChatMessageRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    channel: String(row.channel) as 'general' | 'tech' | 'qa',
    text: String(row.text),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderPhoto: row.sender_photo ? String(row.sender_photo) : '',
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
  };
}

export function mapContactMessageRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    senderName: String(row.sender_name),
    senderEmail: String(row.sender_email),
    subject: String(row.subject),
    message: String(row.message),
    status: String(row.status) as 'unread' | 'read' | 'archived',
    senderKey: row.sender_key ? String(row.sender_key) : undefined,
    deviceKey: row.device_key ? String(row.device_key) : undefined,
    trackingCode: row.tracking_code ? String(row.tracking_code) : undefined,
    attachmentName: row.attachment_name ? String(row.attachment_name) : undefined,
    attachmentStoredName: row.attachment_stored_name ? String(row.attachment_stored_name) : undefined,
    attachmentMimeType: row.attachment_mime_type ? String(row.attachment_mime_type) : undefined,
    attachmentSizeBytes:
      row.attachment_size_bytes !== null && row.attachment_size_bytes !== undefined
        ? Number(row.attachment_size_bytes)
        : undefined,
    attachmentUrl: row.attachment_url ? String(row.attachment_url) : undefined,
    hasReply: Boolean(row.has_reply),
    createdAt: row.created_at,
  };
}

export function mapContactExchangeRow(row: Record<string, unknown>) {
  return {
    trackingCode: String(row.tracking_code),
    subject: String(row.subject),
    adminReply: String(row.admin_reply),
    replyFileName: row.reply_file_name ? String(row.reply_file_name) : undefined,
    replyStoredName: row.reply_stored_name ? String(row.reply_stored_name) : undefined,
    replyMimeType: row.reply_mime_type ? String(row.reply_mime_type) : undefined,
    replySizeBytes:
      row.reply_size_bytes !== null && row.reply_size_bytes !== undefined
        ? Number(row.reply_size_bytes)
        : undefined,
    replyDownloadUrl: row.reply_download_url ? String(row.reply_download_url) : undefined,
    authorId: String(row.author_id || 'admin'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBlockedRecordRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    targetName: String(row.target_name),
    targetEmail: row.target_email ? String(row.target_email) : undefined,
    reason: row.reason ? String(row.reason) : undefined,
    source: String(row.source) as 'contact' | 'live_chat' | 'community' | 'manual',
    emailBlockId: row.email_block_id ? String(row.email_block_id) : undefined,
    deviceBlockId: row.device_block_id ? String(row.device_block_id) : undefined,
    uidBlockId: row.uid_block_id ? String(row.uid_block_id) : undefined,
    authorId: String(row.author_id || 'admin'),
    createdAt: row.created_at,
  };
}

export function mapLiveChatRoomRow(row: Record<string, unknown>) {
  const roomId = String(row.room_id);
  return {
    id: roomId,
    roomId,
    visitorName: String(row.visitor_name),
    senderKey: row.sender_key ? String(row.sender_key) : undefined,
    deviceKey: String(row.device_key),
    visitorActive: Boolean(row.visitor_active),
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLiveChatMessageRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    senderRole: String(row.sender_role) as 'visitor' | 'admin',
    senderName: String(row.sender_name),
    text: String(row.text || ''),
    visitorVisible: Boolean(row.visitor_visible),
    isEdited: Boolean(row.is_edited),
    mediaName: row.media_name ? String(row.media_name) : undefined,
    mediaStoredName: row.media_stored_name ? String(row.media_stored_name) : undefined,
    mediaMimeType: row.media_mime_type ? String(row.media_mime_type) : undefined,
    mediaSizeBytes:
      row.media_size_bytes !== null && row.media_size_bytes !== undefined
        ? Number(row.media_size_bytes)
        : undefined,
    mediaUrl: row.media_url ? String(row.media_url) : undefined,
    authorId: row.author_id ? String(row.author_id) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
