export type Language = 'om' | 'en';

export type ChatChannel = 'general' | 'tech' | 'qa';

export interface SiteProfile {
  ownerName: string;
  roleTitleOm: string;
  roleTitleEn: string;
  headlineOm: string;
  headlineEn: string;
  bioOm: string;
  bioEn: string;
  location: string;
  email: string;
  phone?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  telegramUrl?: string;
  avatarUrl?: string;
  yearsExperience?: string;
  projectsCompleted?: string;
}

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  level: number;
  years?: string;
  description?: string;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  isPublished: boolean;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublic: boolean;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedFileItem {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  category: string;
  isPublic: boolean;
  hasBlob: boolean;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CommunityChatMessage {
  id: string;
  channel: ChatChannel;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  isPinned: boolean;
  createdAt?: unknown;
}

export interface ContactMessageItem {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  senderKey?: string;
  deviceKey?: string;
  trackingCode?: string;
  attachmentName?: string;
  attachmentStoredName?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  attachmentUrl?: string;
  attachmentBase64?: string;
  hasReply?: boolean;
  createdAt?: unknown;
}

export interface ContactExchangeItem {
  trackingCode: string;
  subject: string;
  adminReply: string;
  replyFileName?: string;
  replyStoredName?: string;
  replyMimeType?: string;
  replySizeBytes?: number;
  replyDownloadUrl?: string;
  replyFileBase64?: string;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BlockedUserRecordItem {
  id: string;
  targetName: string;
  targetEmail?: string;
  reason?: string;
  source: 'contact' | 'live_chat' | 'community' | 'manual';
  emailBlockId?: string;
  deviceBlockId?: string;
  uidBlockId?: string;
  authorId: string;
  createdAt?: unknown;
}

export interface LiveChatRoomItem {
  id: string;
  roomId: string;
  visitorName: string;
  senderKey?: string;
  deviceKey: string;
  visitorActive: boolean;
  adminNote?: string;
  lastMessagePreview?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LiveChatMessageItem {
  id: string;
  roomId: string;
  senderRole: 'visitor' | 'admin';
  senderName: string;
  text: string;
  visitorVisible: boolean;
  isEdited: boolean;
  mediaName?: string;
  mediaStoredName?: string;
  mediaMimeType?: string;
  mediaSizeBytes?: number;
  mediaUrl?: string;
  mediaBase64?: string;
  authorId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}
