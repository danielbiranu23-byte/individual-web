import crypto from 'crypto';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import {
  formatSupabaseError,
  getSupabaseClient,
  getSupabaseConfig,
  mapAnnouncementRow,
  mapBlockedRecordRow,
  mapChatMessageRow,
  mapContactExchangeRow,
  mapContactMessageRow,
  mapLiveChatMessageRow,
  mapLiveChatRoomRow,
  mapNoteRow,
  mapSavedFileRow,
  mapSiteProfileRow,
  mapSkillRow,
} from './supabaseDb.ts';

function loadFirebaseProjectId(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
      if (parsed.projectId) return parsed.projectId;
    }
  } catch {
    // Fall back to default project ID if config file is outside cwd in serverless bundle
  }
  return process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0105354277';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();

let cachedFirebaseCerts: Record<string, string> = {};
let cachedFirebaseCertsExpiry = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (Date.now() < cachedFirebaseCertsExpiry && Object.keys(cachedFirebaseCerts).length > 0) {
    return cachedFirebaseCerts;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Firebase public certificates.');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedFirebaseCerts = (await resp.json()) as Record<string, string>;
  cachedFirebaseCertsExpiry = Date.now() + Math.max(60, maxAgeSec) * 1000;
  return cachedFirebaseCerts;
}

async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  name?: string;
  email?: string;
  picture?: string;
}> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Firebase token format.');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid Firebase token header.');
  }
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
    name?: string;
    email?: string;
    picture?: string;
  };
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== FIREBASE_PROJECT_ID ||
    payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
    !payload.sub ||
    typeof payload.sub !== 'string' ||
    payload.sub.length > 128 ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSec ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSec + 300
  ) {
    throw new Error('Firebase token claims rejected.');
  }

  const certs = await getFirebasePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Unknown Firebase signing key.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const valid = verifier.verify(certPem, Buffer.from(sigB64, 'base64url'));
  if (!valid) {
    throw new Error('Invalid Firebase token signature.');
  }

  return {
    uid: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
  };
}

const IS_VERCEL = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NOW_REGION ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
);
const BASE_WRITABLE_DIR = IS_VERCEL ? os.tmpdir() : process.cwd();
const UPLOAD_DIR = path.resolve(BASE_WRITABLE_DIR, 'uploads');
const ADMIN_CREDS_FILE = path.resolve(BASE_WRITABLE_DIR, '.admin-credentials.json');
const SESSION_SIGNING_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`${process.env.SUPABASE_URL || 'local'}:${FIREBASE_PROJECT_ID}:biranu_session_v2`)
    .digest('hex');

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch {
  // Ignore if filesystem is restricted
}

interface StoredAdminCredentials {
  username: string;
  salt: string;
  passwordHash: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function loadLocalAdminCredentials(): StoredAdminCredentials {
  try {
    if (fs.existsSync(ADMIN_CREDS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_CREDS_FILE, 'utf8')) as StoredAdminCredentials;
      if (parsed.username && parsed.salt && parsed.passwordHash) {
        return parsed;
      }
    }
  } catch {
    // Re-initialize if malformed or unreadable
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const initial: StoredAdminCredentials = {
    username: 'Daniel',
    salt,
    passwordHash: hashPassword('d@niel123', salt),
  };
  try {
    fs.writeFileSync(ADMIN_CREDS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  } catch {
    // Ignore read-only fs errors
  }
  return initial;
}

function saveLocalAdminCredentials(creds: StoredAdminCredentials): void {
  try {
    fs.writeFileSync(ADMIN_CREDS_FILE, JSON.stringify(creds, null, 2), 'utf8');
  } catch {
    // Ignore read-only fs errors
  }
}

async function loadAdminCredentialsAsync(): Promise<StoredAdminCredentials> {
  const localCreds = loadLocalAdminCredentials();
  try {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return localCreds;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('username, salt, password_hash')
      .eq('id', 'main')
      .maybeSingle();

    if (!error && data && data.username && data.salt && data.password_hash) {
      const synced: StoredAdminCredentials = {
        username: String(data.username),
        salt: String(data.salt),
        passwordHash: String(data.password_hash),
      };
      saveLocalAdminCredentials(synced);
      return synced;
    }

    if (!error && !data) {
      await supabase.from('admin_accounts').upsert({
        id: 'main',
        username: localCreds.username,
        salt: localCreds.salt,
        password_hash: localCreds.passwordHash,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // Fall back gracefully to local credentials
  }
  return localCreds;
}

async function saveAdminCredentialsAsync(creds: StoredAdminCredentials): Promise<void> {
  saveLocalAdminCredentials(creds);
  try {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return;
    const supabase = getSupabaseClient();
    await supabase.from('admin_accounts').upsert({
      id: 'main',
      username: creds.username,
      salt: creds.salt,
      password_hash: creds.passwordHash,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Local file already saved
  }
}

function signAdminToken(creds: StoredAdminCredentials): string {
  const payload = {
    u: creds.username,
    v: creds.passwordHash.slice(0, 16),
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

async function verifyAdminToken(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      u?: string;
      v?: string;
      exp?: number;
    };
    if (!payload.u || !payload.v || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    const creds = await loadAdminCredentialsAsync();
    if (payload.u !== creds.username || payload.v !== creds.passwordHash.slice(0, 16)) {
      return null;
    }
    return creds.username;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    const username = await verifyAdminToken(token);
    if (!username) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }
    (req as Request & { adminUsername?: string }).adminUsername = username;
    next();
  } catch {
    res.status(401).json({ error: 'Admin authentication required.' });
  }
}

const passwordResetTokens = new Map<string, { username: string; expiresAt: number }>();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      }
    } catch {
      // Ignore
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base || 'file'}_${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

function resolveGeminiApiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.API_KEY,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.trim().replace(/^["']|["']$/g, '');
    if (cleaned && cleaned !== 'MY_GEMINI_API_KEY') {
      return cleaned;
    }
  }
  return '';
}

async function getGeminiClientAndTypes() {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return { ai, ThinkingLevel };
}

async function isAnyKeyBlocked(keys: Array<string | undefined | null>): Promise<boolean> {
  const cleanKeys = keys
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter((k) => k.length >= 10);
  if (cleanKeys.length === 0) return false;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('blocked_users')
      .select('block_id')
      .in('block_id', cleanKeys)
      .eq('active', true)
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function deleteStoredMedia(storedName?: string | null): Promise<void> {
  if (!storedName) return;
  const safeName = path.basename(storedName);
  if (!safeName) return;
  const filePath = path.join(UPLOAD_DIR, safeName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore unlink error
    }
  }
  try {
    const supabase = getSupabaseClient();
    await supabase.storage.from('media').remove([safeName]);
  } catch {
    // Ignore storage delete errors
  }
}

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface SiteContextPayload {
  ownerName?: string;
  roleTitle?: string;
  bio?: string;
  location?: string;
  email?: string;
  phone?: string;
  yearsExperience?: string;
  projectsCompleted?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  telegramUrl?: string;
  skills?: Array<{ name: string; category: string; level: number; years?: string }>;
  announcements?: Array<{ title: string; content: string; category?: string }>;
  notes?: Array<{ title: string; category: string; contentSnippet?: string }>;
  files?: Array<{ title: string; fileName: string; category: string; mimeType?: string }>;
  publicNotesCount?: number;
  publicFilesCount?: number;
}

export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get(['/api', '/api/index', '/api/health'], (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/supabase/status', async (_req: Request, res: Response) => {
    const cfg = getSupabaseConfig();
    if (!cfg.url || !cfg.key) {
      res.json({ connected: false, hasSecretKey: false, storageReady: false });
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [dbCheck, bucketCheck] = await Promise.all([
        supabase.from('site_profile').select('id').limit(1),
        supabase.storage.from('media').list('', { limit: 1 }),
      ]);
      res.json({
        connected: !dbCheck.error,
        hasSecretKey: cfg.hasSecretKey,
        storageReady: !bucketCheck.error,
      });
    } catch {
      res.json({ connected: false, hasSecretKey: cfg.hasSecretKey, storageReady: false });
    }
  });

  // ==========================================
  // ADMIN AUTHENTICATION & PASSWORD RESET
  // ==========================================
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as { username?: string; password?: string };
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required.' });
        return;
      }

      const creds = await loadAdminCredentialsAsync();
      const candidateHash = hashPassword(password, creds.salt);
      const storedBuf = Buffer.from(creds.passwordHash, 'hex');
      const candidateBuf = Buffer.from(candidateHash, 'hex');
      const passwordMatch =
        storedBuf.length === candidateBuf.length && crypto.timingSafeEqual(storedBuf, candidateBuf);

      if (username !== creds.username || !passwordMatch) {
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }

      const sessionToken = signAdminToken(creds);
      res.json({ ok: true, sessionToken, username: creds.username });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Login failed.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/admin/session', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      const username = await verifyAdminToken(token);
      if (!username) {
        res.json({ authenticated: false });
        return;
      }
      res.json({ authenticated: true, username });
    } catch {
      res.json({ authenticated: false });
    }
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/admin/verify-username', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as { username?: string };
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      if (!username) {
        res.status(400).json({ error: 'Username is required.' });
        return;
      }

      const creds = await loadAdminCredentialsAsync();
      if (username !== creds.username) {
        res.status(404).json({ error: 'Username not recognized.' });
        return;
      }

      const resetToken = crypto.randomBytes(24).toString('hex');
      passwordResetTokens.set(resetToken, {
        username: creds.username,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      res.json({ verified: true, resetToken });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Verification failed.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/reset-password', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as { username?: string; resetToken?: string; newPassword?: string };
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const resetToken = typeof body.resetToken === 'string' ? body.resetToken.trim() : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

      if (!username || !resetToken || newPassword.length < 6) {
        res.status(400).json({ error: 'Valid username, reset token, and password (min 6 chars) are required.' });
        return;
      }

      const tokenEntry = passwordResetTokens.get(resetToken);
      if (!tokenEntry || tokenEntry.expiresAt < Date.now() || tokenEntry.username !== username) {
        passwordResetTokens.delete(resetToken);
        res.status(403).json({ error: 'Reset verification expired or invalid.' });
        return;
      }

      const salt = crypto.randomBytes(16).toString('hex');
      await saveAdminCredentialsAsync({
        username: tokenEntry.username,
        salt,
        passwordHash: hashPassword(newPassword, salt),
      });

      passwordResetTokens.delete(resetToken);
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Password reset failed.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // PUBLIC & ADMIN BOOTSTRAP QUERIES
  // ==========================================
  app.get('/api/site/bootstrap', async (req: Request, res: Response) => {
    try {
      const adminUser = await verifyAdminToken(extractBearerToken(req));
      const isAdminSession = Boolean(adminUser);
      const supabase = getSupabaseClient();

      const announcementsQuery = isAdminSession
        ? supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
        : supabase
            .from('announcements')
            .select('*')
            .eq('is_published', true)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

      const notesQuery = isAdminSession
        ? supabase.from('notes').select('*').order('created_at', { ascending: false })
        : supabase.from('notes').select('*').eq('is_public', true).order('created_at', { ascending: false });

      const filesQuery = isAdminSession
        ? supabase.from('saved_files').select('*').order('created_at', { ascending: false })
        : supabase.from('saved_files').select('*').eq('is_public', true).order('created_at', { ascending: false });

      const [profileRes, skillsRes, annRes, notesRes, filesRes, chatRes] = await Promise.all([
        supabase.from('site_profile').select('*').eq('id', 'main').maybeSingle(),
        supabase.from('skills').select('*').order('level', { ascending: false }),
        announcementsQuery,
        notesQuery,
        filesQuery,
        supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(120),
      ]);

      const firstErr =
        profileRes.error || skillsRes.error || annRes.error || notesRes.error || filesRes.error || chatRes.error;
      if (firstErr) {
        const formatted = formatSupabaseError(firstErr, 'Failed to load site data from Supabase.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      res.json({
        profile: profileRes.data ? mapSiteProfileRow(profileRes.data as Record<string, unknown>) : null,
        skills: (skillsRes.data || []).map((r) => mapSkillRow(r as Record<string, unknown>)),
        announcements: (annRes.data || []).map((r) => mapAnnouncementRow(r as Record<string, unknown>)),
        notes: (notesRes.data || []).map((r) => mapNoteRow(r as Record<string, unknown>)),
        files: (filesRes.data || []).map((r) => mapSavedFileRow(r as Record<string, unknown>)),
        chatMessages: (chatRes.data || []).map((r) => mapChatMessageRow(r as Record<string, unknown>)),
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to load site data.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/admin/bootstrap', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabaseClient();
      const [contactsRes, blockedRes, roomsRes] = await Promise.all([
        supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(150),
        supabase.from('blocked_user_records').select('*').order('created_at', { ascending: false }).limit(150),
        supabase.from('live_chat_rooms').select('*').order('updated_at', { ascending: false }).limit(150),
      ]);

      const firstErr = contactsRes.error || blockedRes.error || roomsRes.error;
      if (firstErr) {
        const formatted = formatSupabaseError(firstErr, 'Failed to load admin records.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      res.json({
        contactMessages: (contactsRes.data || []).map((r) => mapContactMessageRow(r as Record<string, unknown>)),
        blockedUsers: (blockedRes.data || []).map((r) => mapBlockedRecordRow(r as Record<string, unknown>)),
        liveChatRooms: (roomsRes.data || []).map((r) => mapLiveChatRoomRow(r as Record<string, unknown>)),
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to load admin records.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // ADMIN CONTENT CRUD (SUPABASE TABLES)
  // ==========================================
  app.put('/api/admin/profile', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('site_profile')
        .upsert({
          id: 'main',
          owner_name: String(b.ownerName || 'Daniel Biranu').trim().slice(0, 120),
          role_title_om: String(b.roleTitleOm || '').trim().slice(0, 300),
          role_title_en: String(b.roleTitleEn || '').trim().slice(0, 300),
          headline_om: String(b.headlineOm || '').trim().slice(0, 300),
          headline_en: String(b.headlineEn || '').trim().slice(0, 300),
          bio_om: String(b.bioOm || '').trim().slice(0, 5000),
          bio_en: String(b.bioEn || '').trim().slice(0, 5000),
          location: String(b.location || '').trim().slice(0, 120),
          email: String(b.email || '').trim().slice(0, 160),
          phone: String(b.phone || '').trim().slice(0, 60),
          github_url: String(b.githubUrl || '').trim().slice(0, 300),
          linkedin_url: String(b.linkedinUrl || '').trim().slice(0, 300),
          telegram_url: String(b.telegramUrl || '').trim().slice(0, 300),
          avatar_url: String(b.avatarUrl || '/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg').trim().slice(0, 500),
          years_experience: String(b.yearsExperience || '').trim().slice(0, 60),
          projects_completed: String(b.projectsCompleted || '').trim().slice(0, 60),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to save profile.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ profile: mapSiteProfileRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to save profile.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/skills', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('skills')
        .insert({
          name: String(b.name || '').trim().slice(0, 80),
          category: String(b.category || 'General').trim().slice(0, 60),
          level: Math.min(100, Math.max(1, Number(b.level) || 80)),
          years: String(b.years || '').trim().slice(0, 30),
          description: String(b.description || '').trim().slice(0, 400),
          author_id: 'admin',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to add skill.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ skill: mapSkillRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to add skill.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.put('/api/admin/skills/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('skills')
        .update({
          name: String(b.name || '').trim().slice(0, 80),
          category: String(b.category || 'General').trim().slice(0, 60),
          level: Math.min(100, Math.max(1, Number(b.level) || 80)),
          years: String(b.years || '').trim().slice(0, 30),
          description: String(b.description || '').trim().slice(0, 400),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update skill.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ skill: mapSkillRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update skill.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/skills/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('skills').delete().eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete skill.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete skill.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/announcements', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: String(b.title || '').trim().slice(0, 160),
          content: String(b.content || '').trim().slice(0, 5000),
          category: String(b.category || 'General').trim().slice(0, 60) || 'General',
          is_pinned: Boolean(b.isPinned),
          is_published: b.isPublished !== false,
          author_id: 'admin',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to save announcement.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ announcement: mapAnnouncementRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to save announcement.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.put('/api/admin/announcements/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('announcements')
        .update({
          title: String(b.title || '').trim().slice(0, 160),
          content: String(b.content || '').trim().slice(0, 5000),
          category: String(b.category || 'General').trim().slice(0, 60) || 'General',
          is_pinned: Boolean(b.isPinned),
          is_published: b.isPublished !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update announcement.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ announcement: mapAnnouncementRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update announcement.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/announcements/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete announcement.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete announcement.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/notes', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: String(b.title || '').trim().slice(0, 160),
          content: String(b.content || '').trim().slice(0, 20000),
          category: String(b.category || 'Notes').trim().slice(0, 60) || 'Notes',
          is_public: b.isPublic !== false,
          author_id: 'admin',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to save note.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ note: mapNoteRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to save note.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.put('/api/admin/notes/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: String(b.title || '').trim().slice(0, 160),
          content: String(b.content || '').trim().slice(0, 20000),
          category: String(b.category || 'Notes').trim().slice(0, 60) || 'Notes',
          is_public: b.isPublic !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update note.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ note: mapNoteRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update note.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/notes/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete note.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete note.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/files', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('saved_files')
        .insert({
          title: String(b.title || b.fileName || 'Untitled').trim().slice(0, 160),
          description: String(b.description || '').trim().slice(0, 1000),
          file_name: String(b.fileName || '').trim().slice(0, 255),
          stored_name: String(b.storedName || '').trim().slice(0, 255),
          mime_type: String(b.mimeType || 'application/octet-stream').trim().slice(0, 120),
          size_bytes: Math.max(0, Number(b.sizeBytes) || 0),
          download_url: String(b.downloadUrl || '').trim().slice(0, 500),
          category: String(b.category || 'Documents').trim().slice(0, 60),
          is_public: b.isPublic !== false,
          author_id: 'admin',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to save file record.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ file: mapSavedFileRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to save file record.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/admin/files/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body as Record<string, unknown>;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('saved_files')
        .update({
          is_public: Boolean(b.isPublic),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update file visibility.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ file: mapSavedFileRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update file visibility.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/files/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase
        .from('saved_files')
        .select('stored_name')
        .eq('id', id)
        .maybeSingle();

      const { error } = await supabase.from('saved_files').delete().eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete file.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      if (existing && (existing as { stored_name?: string }).stored_name) {
        await deleteStoredMedia((existing as { stored_name: string }).stored_name);
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete file.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/seed', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = (req.body || {}) as { profile?: Record<string, unknown> };
      const p = b.profile || {};
      const supabase = getSupabaseClient();

      const { error: profileErr } = await supabase.from('site_profile').upsert({
        id: 'main',
        owner_name: String(p.ownerName || 'Daniel Biranu'),
        role_title_om: String(p.roleTitleOm || 'College of Computing Department of Information system for 2026 Gc'),
        role_title_en: String(p.roleTitleEn || 'College of Computing Department of Information system for 2026 Gc'),
        headline_om: String(p.headlineOm || 'Teeknoloojii ammayyaa, yaadannoo fi kuusaa hojii kootii bakka tokkotti.'),
        headline_en: String(p.headlineEn || 'Building modern software, sharing knowledge, and connecting ideas in one personal hub.'),
        bio_om: String(p.bioOm || ''),
        bio_en: String(p.bioEn || ''),
        location: String(p.location || 'Finfinnee, Oromia'),
        email: String(p.email || 'danielbiranu142@gmail.com'),
        phone: String(p.phone || '+251932387559'),
        github_url: String(p.githubUrl || 'https://github.com'),
        linkedin_url: String(p.linkedinUrl || 'https://linkedin.com'),
        telegram_url: String(p.telegramUrl || 'https://t.me'),
        avatar_url: String(p.avatarUrl || '/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg'),
        years_experience: String(p.yearsExperience || '5+ Waggaa'),
        projects_completed: String(p.projectsCompleted || '28+ Pirojektii'),
        updated_at: new Date().toISOString(),
      });

      if (profileErr) {
        const formatted = formatSupabaseError(profileErr, 'Failed to seed profile.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      const [skillsCount, annCount, notesCount] = await Promise.all([
        supabase.from('skills').select('id', { count: 'exact', head: true }),
        supabase.from('announcements').select('id', { count: 'exact', head: true }),
        supabase.from('notes').select('id', { count: 'exact', head: true }),
      ]);

      if ((skillsCount.count || 0) === 0) {
        await supabase.from('skills').insert([
          {
            name: 'TypeScript & React',
            category: 'Frontend',
            level: 95,
            years: '5+ Waggaa',
            description: 'Websaayitii saffisaa fi ammayyaa ijaaruu.',
            author_id: 'admin',
          },
          {
            name: 'Node.js & Express',
            category: 'Backend',
            level: 90,
            years: '4+ Waggaa',
            description: 'API nageenya qabuu fi server hojjechuu.',
            author_id: 'admin',
          },
          {
            name: 'Supabase & PostgreSQL',
            category: 'Cloud & Data',
            level: 90,
            years: '3+ Waggaa',
            description: 'Database cimaa fi cloud storage qindeessuu.',
            author_id: 'admin',
          },
          {
            name: 'AI Integration (Gemini)',
            category: 'AI & Automation',
            level: 85,
            years: '2+ Waggaa',
            description: 'Chatbot fi tajaajila hubannoo namtolchee ijaaruu.',
            author_id: 'admin',
          },
        ]);
      }

      if ((annCount.count || 0) === 0) {
        await supabase.from('announcements').insert({
          title: 'Websaayitii Dhuunfaa Haaraan Banameera!',
          content:
            'Baga nagaan dhuftan! Websaayitii kana irratti yaadannoo, faayiloota, beeksisa haaraa fi bakka waliin haasa’uu argachuu dandeessu. Gaaffii yoo qabaattan AI Chatbot ykn Contact fayyadamaa.',
          category: 'Beeksisa Waliigalaa',
          is_pinned: true,
          is_published: true,
          author_id: 'admin',
        });
      }

      if ((notesCount.count || 0) === 0) {
        await supabase.from('notes').insert({
          title: 'Qajeelfama Jalqabaa: React, TypeScript & Supabase',
          content:
            '1. Component xixiqqoo fi qulqulluu ijaari.\n2. Type safety (TypeScript) yeroo hunda fayyadami.\n3. Daataa Supabase PostgreSQL irratti nageenyaan olkaa’i.\n4. Vault keenya keessaa barruu fi viidiyoo dubbisi.',
          category: 'Teeknoloojii',
          is_public: true,
          author_id: 'admin',
        });
      }

      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to seed demo content.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // MEDIA UPLOAD / DOWNLOAD (SUPABASE STORAGE + DISK FALLBACK)
  // ==========================================
  app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const storedName = req.file.filename;
    const filePath = path.join(UPLOAD_DIR, storedName);
    const mimeType = req.file.mimetype || 'application/octet-stream';
    let storageUploaded = false;

    try {
      const { url, key } = getSupabaseConfig();
      if (url && key) {
        const supabase = getSupabaseClient();
        const fileBuffer = fs.readFileSync(filePath);
        const { error: uploadErr } = await supabase.storage
          .from('media')
          .upload(storedName, fileBuffer, {
            contentType: mimeType,
            upsert: false,
          });
        if (!uploadErr) {
          storageUploaded = true;
          if (IS_VERCEL) {
            try {
              fs.unlinkSync(filePath);
            } catch {
              // Ignore temp cleanup failure
            }
          }
        }
      }
    } catch {
      storageUploaded = false;
    }

    res.json({
      fileName: req.file.originalname,
      storedName,
      mimeType,
      sizeBytes: req.file.size,
      downloadUrl: `/api/files/download/${encodeURIComponent(storedName)}`,
      storageUploaded,
    });
  });

  app.get('/api/files/download/:storedName', async (req: Request, res: Response) => {
    const rawName = String(req.params.storedName || '');
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      res.status(400).json({ error: 'Invalid file name.' });
      return;
    }

    const originalName =
      typeof req.query.name === 'string' && req.query.name.trim()
        ? path.basename(req.query.name)
        : safeName;

    const filePath = path.join(UPLOAD_DIR, safeName);
    if (!IS_VERCEL && fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', `inline; filename="${originalName.replace(/"/g, '')}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(filePath);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from('media').download(safeName);
      if (error || !data) {
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Disposition', `inline; filename="${originalName.replace(/"/g, '')}"`);
          res.setHeader('Cache-Control', 'no-store');
          res.sendFile(filePath);
          return;
        }
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      const arrayBuf = await data.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (data.type) {
        res.setHeader('Content-Type', data.type);
      }
      res.setHeader('Content-Disposition', `inline; filename="${originalName.replace(/"/g, '')}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buf);
    } catch {
      res.status(404).json({ error: 'File not found.' });
    }
  });

  app.delete('/api/files/:storedName', async (req: Request, res: Response) => {
    const rawName = String(req.params.storedName || '');
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      res.status(400).json({ error: 'Invalid file name.' });
      return;
    }

    await deleteStoredMedia(safeName);
    res.json({ deleted: true });
  });

  // ==========================================
  // COMMUNITY CHAT (FIREBASE GOOGLE SIGN-IN + SUPABASE DB)
  // ==========================================
  app.post('/api/community/messages', async (req: Request, res: Response) => {
    try {
      const idToken = extractBearerToken(req);
      if (!idToken) {
        res.status(401).json({ error: 'Google sign-in token required.' });
        return;
      }
      const decoded = await verifyFirebaseIdToken(idToken);
      const blocked = await isAnyKeyBlocked([`uid_${decoded.uid}`]);
      if (blocked) {
        res.status(403).json({ error: 'You are blocked from posting messages.' });
        return;
      }

      const b = req.body as { channel?: string; text?: string };
      const channel = b.channel === 'tech' || b.channel === 'qa' ? b.channel : 'general';
      const cleanText = typeof b.text === 'string' ? b.text.trim().slice(0, 1500) : '';
      if (!cleanText) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          channel,
          text: cleanText,
          sender_id: decoded.uid,
          sender_name: String(decoded.name || decoded.email || 'Member').slice(0, 100),
          sender_photo: String(decoded.picture || '').slice(0, 500),
          is_pinned: false,
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to post message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ message: mapChatMessageRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to post message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/community/messages/:id/pin', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body as { isPinned?: boolean };
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('chat_messages')
        .update({ is_pinned: Boolean(b.isPinned) })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update pin.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ message: mapChatMessageRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update pin.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/community/messages/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const token = extractBearerToken(req);
      const adminUsername = await verifyAdminToken(token);
      let firebaseUid: string | null = null;
      if (!adminUsername && token) {
        try {
          const decoded = await verifyFirebaseIdToken(token);
          firebaseUid = decoded.uid;
        } catch {
          firebaseUid = null;
        }
      }

      if (!adminUsername && !firebaseUid) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const supabase = getSupabaseClient();
      if (!adminUsername && firebaseUid) {
        const { data: existing } = await supabase
          .from('chat_messages')
          .select('sender_id')
          .eq('id', id)
          .maybeSingle();
        if (!existing || String((existing as { sender_id?: string }).sender_id) !== firebaseUid) {
          res.status(403).json({ error: 'Not allowed to delete this message.' });
          return;
        }
      }

      const { error } = await supabase.from('chat_messages').delete().eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // CONTACT & TWO-WAY FILE EXCHANGE
  // ==========================================
  app.post('/api/contact/messages', async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const senderKey = typeof b.senderKey === 'string' ? b.senderKey : '';
      const deviceKey = typeof b.deviceKey === 'string' ? b.deviceKey : '';
      const uidKey = typeof b.uidKey === 'string' ? b.uidKey : '';

      const blocked = await isAnyKeyBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        res.status(403).json({ blocked: true, error: 'Blocked from sending messages.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('contact_messages')
        .insert({
          sender_name: String(b.senderName || '').trim().slice(0, 100),
          sender_email: String(b.senderEmail || '').trim().slice(0, 160),
          subject: String(b.subject || '').trim().slice(0, 160),
          message: String(b.message || '').trim().slice(0, 3000),
          status: 'unread',
          sender_key: senderKey || null,
          device_key: deviceKey || null,
          tracking_code: String(b.trackingCode || '').trim().slice(0, 64) || null,
          attachment_name: b.attachmentName ? String(b.attachmentName).slice(0, 255) : null,
          attachment_stored_name: b.attachmentStoredName ? String(b.attachmentStoredName).slice(0, 255) : null,
          attachment_mime_type: b.attachmentMimeType ? String(b.attachmentMimeType).slice(0, 120) : null,
          attachment_size_bytes: typeof b.attachmentSizeBytes === 'number' ? b.attachmentSizeBytes : null,
          attachment_url: b.attachmentUrl ? String(b.attachmentUrl).slice(0, 500) : null,
          has_reply: false,
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to submit contact message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ message: mapContactMessageRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to submit contact message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/contact/exchanges/:trackingCode', async (req: Request, res: Response) => {
    try {
      const trackingCode = String(req.params.trackingCode || '').trim();
      if (!/^[a-zA-Z0-9_\-]{12,64}$/.test(trackingCode)) {
        res.status(400).json({ error: 'Invalid tracking code.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('contact_exchanges')
        .select('*')
        .eq('tracking_code', trackingCode)
        .maybeSingle();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to look up reply.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        exchange: data ? mapContactExchangeRow(data as Record<string, unknown>) : null,
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to look up reply.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/admin/contact/messages/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const b = req.body as { status?: string };
      const status = b.status === 'read' || b.status === 'archived' ? b.status : 'unread';
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update message status.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update message status.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/contact/messages/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase
        .from('contact_messages')
        .select('attachment_stored_name')
        .eq('id', id)
        .maybeSingle();

      const { error } = await supabase.from('contact_messages').delete().eq('id', id);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete contact message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      if (existing && (existing as { attachment_stored_name?: string }).attachment_stored_name) {
        await deleteStoredMedia((existing as { attachment_stored_name: string }).attachment_stored_name);
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete contact message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/contact/reply', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const messageId = String(b.messageId || '');
      const trackingCode = String(b.trackingCode || '').trim();
      const subject = String(b.subject || '').trim().slice(0, 160);
      const adminReply = String(b.adminReply || '').trim().slice(0, 3000);

      if (!trackingCode || !adminReply) {
        res.status(400).json({ error: 'Tracking code and reply text are required.' });
        return;
      }

      const supabase = getSupabaseClient();
      const exchangeRow: Record<string, unknown> = {
        tracking_code: trackingCode,
        subject,
        admin_reply: adminReply,
        author_id: 'admin',
        updated_at: new Date().toISOString(),
      };

      if (b.replyFileName) {
        exchangeRow.reply_file_name = String(b.replyFileName).slice(0, 255);
        exchangeRow.reply_stored_name = b.replyStoredName ? String(b.replyStoredName).slice(0, 255) : null;
        exchangeRow.reply_mime_type = b.replyMimeType ? String(b.replyMimeType).slice(0, 120) : null;
        exchangeRow.reply_size_bytes = typeof b.replySizeBytes === 'number' ? b.replySizeBytes : null;
        exchangeRow.reply_download_url = b.replyDownloadUrl ? String(b.replyDownloadUrl).slice(0, 500) : null;
      }

      const { data, error } = await supabase
        .from('contact_exchanges')
        .upsert(exchangeRow)
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to save reply.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      if (messageId) {
        await supabase
          .from('contact_messages')
          .update({ status: 'read', has_reply: true })
          .eq('id', messageId);
      }

      res.json({ exchange: mapContactExchangeRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to save reply.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // EPHEMERAL VISITOR LIVE CHAT & ADMIN ARCHIVE
  // ==========================================
  app.post('/api/live-chat/rooms', async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const roomId = String(b.roomId || '').trim();
      const visitorName = String(b.visitorName || '').trim().slice(0, 100);
      const deviceKey = String(b.deviceKey || '').trim();
      const senderKey = typeof b.senderKey === 'string' ? b.senderKey.trim() : '';
      const uidKey = typeof b.uidKey === 'string' ? b.uidKey.trim() : '';

      if (!roomId || !visitorName || !deviceKey) {
        res.status(400).json({ error: 'Room ID, visitor name, and device key are required.' });
        return;
      }

      const blocked = await isAnyKeyBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        res.status(403).json({ blocked: true, error: 'Blocked from starting live chat.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('live_chat_rooms')
        .insert({
          room_id: roomId,
          visitor_name: visitorName,
          sender_key: senderKey || null,
          device_key: deviceKey,
          visitor_active: true,
          last_message_preview: '',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to start live chat room.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ room: mapLiveChatRoomRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to start live chat.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/live-chat/rooms/:roomId/messages', async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const supabase = getSupabaseClient();
      const { data: room, error: roomErr } = await supabase
        .from('live_chat_rooms')
        .select('visitor_active')
        .eq('room_id', roomId)
        .maybeSingle();

      if (roomErr || !room || !(room as { visitor_active?: boolean }).visitor_active) {
        res.json({ active: false, messages: [] });
        return;
      }

      const { data, error } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .eq('visitor_visible', true)
        .order('created_at', { ascending: true });

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to fetch live chat messages.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      res.json({
        active: true,
        messages: (data || []).map((r) => mapLiveChatMessageRow(r as Record<string, unknown>)),
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to fetch live chat messages.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/live-chat/rooms/:roomId/messages', async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const b = req.body as Record<string, unknown>;
      const deviceKey = typeof b.deviceKey === 'string' ? b.deviceKey : '';
      const senderKey = typeof b.senderKey === 'string' ? b.senderKey : '';
      const uidKey = typeof b.uidKey === 'string' ? b.uidKey : '';

      const blocked = await isAnyKeyBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        res.status(403).json({ blocked: true, error: 'Blocked from sending live messages.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: room } = await supabase
        .from('live_chat_rooms')
        .select('visitor_active')
        .eq('room_id', roomId)
        .maybeSingle();

      if (!room || !(room as { visitor_active?: boolean }).visitor_active) {
        res.status(410).json({ ended: true, error: 'Live chat session has ended.' });
        return;
      }

      const cleanText = String(b.text || '').trim().slice(0, 3000);
      const mediaName = b.mediaName ? String(b.mediaName).slice(0, 255) : null;
      if (!cleanText && !mediaName) {
        res.status(400).json({ error: 'Message text or media is required.' });
        return;
      }

      const { data, error } = await supabase
        .from('live_chat_messages')
        .insert({
          room_id: roomId,
          sender_role: 'visitor',
          sender_name: String(b.senderName || 'Visitor').trim().slice(0, 100),
          text: cleanText,
          visitor_visible: true,
          is_edited: false,
          media_name: mediaName,
          media_stored_name: b.mediaStoredName ? String(b.mediaStoredName).slice(0, 255) : null,
          media_mime_type: b.mediaMimeType ? String(b.mediaMimeType).slice(0, 120) : null,
          media_size_bytes: typeof b.mediaSizeBytes === 'number' ? b.mediaSizeBytes : null,
          media_url: b.mediaUrl ? String(b.mediaUrl).slice(0, 500) : null,
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to send live message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      const preview = (cleanText || mediaName || '').slice(0, 180);
      await supabase
        .from('live_chat_rooms')
        .update({
          last_message_preview: preview,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId);

      res.json({ message: mapLiveChatMessageRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to send live message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/live-chat/rooms/:roomId/end', async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const supabase = getSupabaseClient();
      await supabase
        .from('live_chat_rooms')
        .update({
          visitor_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId);
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  app.get('/api/admin/live-chat/rooms/:roomId/messages', requireAdmin, async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to fetch archive messages.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        messages: (data || []).map((r) => mapLiveChatMessageRow(r as Record<string, unknown>)),
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to fetch archive messages.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/admin/live-chat/rooms/:roomId/messages', requireAdmin, async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const b = req.body as Record<string, unknown>;
      const cleanText = String(b.text || '').trim().slice(0, 3000);
      const mediaName = b.mediaName ? String(b.mediaName).slice(0, 255) : null;
      if (!cleanText && !mediaName) {
        res.status(400).json({ error: 'Message text or media is required.' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('live_chat_messages')
        .insert({
          room_id: roomId,
          sender_role: 'admin',
          sender_name: String(b.senderName || 'Daniel Biranu').trim().slice(0, 100),
          text: cleanText,
          visitor_visible: b.visitorVisible !== false,
          is_edited: false,
          media_name: mediaName,
          media_stored_name: b.mediaStoredName ? String(b.mediaStoredName).slice(0, 255) : null,
          media_mime_type: b.mediaMimeType ? String(b.mediaMimeType).slice(0, 120) : null,
          media_size_bytes: typeof b.mediaSizeBytes === 'number' ? b.mediaSizeBytes : null,
          media_url: b.mediaUrl ? String(b.mediaUrl).slice(0, 500) : null,
          author_id: 'admin',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to send admin reply.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      const preview = (cleanText || mediaName || '').slice(0, 180);
      await supabase
        .from('live_chat_rooms')
        .update({
          last_message_preview: preview,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId);

      res.json({ message: mapLiveChatMessageRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to send admin reply.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/admin/live-chat/rooms/:roomId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const b = req.body as { adminNote?: string };
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('live_chat_rooms')
        .update({
          admin_note: String(b.adminNote || '').trim().slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId);

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update admin note.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update admin note.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/live-chat/rooms/:roomId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const supabase = getSupabaseClient();
      const { data: msgs } = await supabase
        .from('live_chat_messages')
        .select('media_stored_name')
        .eq('room_id', roomId);

      const { error } = await supabase.from('live_chat_rooms').delete().eq('room_id', roomId);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete chat thread.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          const sn = (m as { media_stored_name?: string }).media_stored_name;
          if (sn) await deleteStoredMedia(sn);
        }
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete chat thread.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/admin/live-chat/messages/:msgId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const msgId = String(req.params.msgId || '');
      const b = req.body as { text?: string; visitorVisible?: boolean };
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('live_chat_messages')
        .update({
          text: String(b.text || '').trim().slice(0, 3000),
          visitor_visible: b.visitorVisible !== false,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', msgId);

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to update live message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to update live message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/live-chat/messages/:msgId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const msgId = String(req.params.msgId || '');
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase
        .from('live_chat_messages')
        .select('media_stored_name')
        .eq('id', msgId)
        .maybeSingle();

      const { error } = await supabase.from('live_chat_messages').delete().eq('id', msgId);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to delete live message.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      if (existing && (existing as { media_stored_name?: string }).media_stored_name) {
        await deleteStoredMedia((existing as { media_stored_name: string }).media_stored_name);
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to delete live message.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // BLOCKED USERS (ACROSS ALL FORMS & CHATS)
  // ==========================================
  app.post('/api/blocked/check', async (req: Request, res: Response) => {
    const b = req.body as { keys?: Array<string | null | undefined> };
    const blocked = await isAnyKeyBlocked(Array.isArray(b.keys) ? b.keys : []);
    res.json({ blocked });
  });

  app.post('/api/admin/blocked', requireAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as {
        targetName?: string;
        targetEmail?: string;
        reason?: string;
        source?: 'contact' | 'live_chat' | 'community' | 'manual';
        emailBlockId?: string;
        deviceBlockId?: string;
        uidBlockId?: string;
      };
      const supabase = getSupabaseClient();
      const blockRows: Array<{ block_id: string; block_type: string; active: boolean; author_id: string }> = [];

      if (b.emailBlockId) {
        blockRows.push({
          block_id: b.emailBlockId,
          block_type: 'email',
          active: true,
          author_id: 'admin',
        });
      }
      if (b.deviceBlockId) {
        blockRows.push({
          block_id: b.deviceBlockId,
          block_type: 'device',
          active: true,
          author_id: 'admin',
        });
      }
      if (b.uidBlockId) {
        blockRows.push({
          block_id: b.uidBlockId,
          block_type: 'uid',
          active: true,
          author_id: 'admin',
        });
      }

      if (blockRows.length > 0) {
        const { error: blockErr } = await supabase.from('blocked_users').upsert(blockRows);
        if (blockErr) {
          const formatted = formatSupabaseError(blockErr, 'Failed to block user.');
          res.status(formatted.status).json({ error: formatted.message });
          return;
        }
      }

      const { data, error } = await supabase
        .from('blocked_user_records')
        .insert({
          target_name: String(b.targetName || 'Unknown').trim().slice(0, 120),
          target_email: b.targetEmail ? String(b.targetEmail).trim().slice(0, 160) : null,
          reason: b.reason ? String(b.reason).trim().slice(0, 400) : null,
          source: b.source || 'manual',
          email_block_id: b.emailBlockId || null,
          device_block_id: b.deviceBlockId || null,
          uid_block_id: b.uidBlockId || null,
          author_id: 'admin',
        })
        .select('*')
        .single();

      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to create block record.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }

      res.json({ record: mapBlockedRecordRow(data as Record<string, unknown>) });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to block user.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/admin/blocked/:recordId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const recordId = String(req.params.recordId || '');
      const supabase = getSupabaseClient();
      const { data: rec } = await supabase
        .from('blocked_user_records')
        .select('email_block_id, device_block_id, uid_block_id')
        .eq('id', recordId)
        .maybeSingle();

      if (rec) {
        const r = rec as {
          email_block_id?: string | null;
          device_block_id?: string | null;
          uid_block_id?: string | null;
        };
        const keysToRemove = [r.email_block_id, r.device_block_id, r.uid_block_id].filter(
          (v): v is string => Boolean(v)
        );
        if (keysToRemove.length > 0) {
          await supabase.from('blocked_users').delete().in('block_id', keysToRemove);
        }
      }

      const { error } = await supabase.from('blocked_user_records').delete().eq('id', recordId);
      if (error) {
        const formatted = formatSupabaseError(error, 'Failed to unblock user.');
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, 'Failed to unblock user.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // ==========================================
  // AI CHATBOT WIDGET (GEMINI SERVER PROXY)
  // ==========================================
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const gemini = await getGeminiClientAndTypes();
      if (!gemini) {
        res.status(503).json({
          error: IS_VERCEL
            ? 'GEMINI_API_KEY is not configured in Vercel. Add GEMINI_API_KEY under Vercel Project Settings > Environment Variables and redeploy.'
            : 'GEMINI_API_KEY is not configured. Please check Settings > Secrets.',
        });
        return;
      }

      const body = req.body as {
        messages?: ChatTurn[];
        language?: 'om' | 'en';
        siteContext?: SiteContextPayload;
      };

      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required.' });
        return;
      }

      const lang = body.language === 'en' ? 'English' : 'Afaan Oromo';
      const ctx: SiteContextPayload = { ...(body.siteContext || {}) };

      // Enrich with live public Supabase records so answers are always complete & up to date
      try {
        const { url, key } = getSupabaseConfig();
        if (url && key) {
          const supabase = getSupabaseClient();
          const dbPromise = Promise.allSettled([
            supabase.from('site_profile').select('*').eq('id', 'main').maybeSingle(),
            supabase.from('skills').select('name, category, level, years').order('level', { ascending: false }).limit(25),
            supabase
              .from('announcements')
              .select('title, content, category')
              .eq('is_published', true)
              .order('is_pinned', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(8),
            supabase
              .from('notes')
              .select('title, category, content')
              .eq('is_public', true)
              .order('updated_at', { ascending: false })
              .limit(12),
            supabase
              .from('saved_files')
              .select('title, file_name, category, mime_type')
              .eq('is_public', true)
              .order('created_at', { ascending: false })
              .limit(12),
          ]);
          let dbTimeoutId: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<null>((resolve) => {
            dbTimeoutId = setTimeout(() => resolve(null), 1800);
          });
          const dbResults = await Promise.race([dbPromise, timeoutPromise]).finally(() => {
            if (dbTimeoutId) clearTimeout(dbTimeoutId);
          });
          if (dbResults) {
            const [profRes, skillRes, annRes, noteRes, fileRes] = dbResults;
            if (profRes.status === 'fulfilled' && profRes.value.data) {
              const p = mapSiteProfileRow(profRes.value.data as Record<string, unknown>);
              ctx.ownerName = String(p.ownerName || ctx.ownerName || 'Daniel Biranu');
              ctx.roleTitle = String(
                (body.language === 'en' ? p.roleTitleEn : p.roleTitleOm) || ctx.roleTitle || ''
              );
              ctx.bio = String((body.language === 'en' ? p.bioEn : p.bioOm) || ctx.bio || '');
              ctx.location = String(p.location || ctx.location || 'Finfinnee, Oromia');
              ctx.email = String(p.email || ctx.email || 'danielbiranu142@gmail.com');
              ctx.phone = String(p.phone || ctx.phone || '+251932387559');
              ctx.yearsExperience = String(p.yearsExperience || ctx.yearsExperience || '5+ Waggaa');
              ctx.projectsCompleted = String(p.projectsCompleted || ctx.projectsCompleted || '28+ Pirojektii');
              ctx.githubUrl = String(p.githubUrl || ctx.githubUrl || '');
              ctx.linkedinUrl = String(p.linkedinUrl || ctx.linkedinUrl || '');
              ctx.telegramUrl = String(p.telegramUrl || ctx.telegramUrl || '');
            }
            if (skillRes.status === 'fulfilled' && Array.isArray(skillRes.value.data) && skillRes.value.data.length > 0) {
              ctx.skills = skillRes.value.data.map((r: Record<string, unknown>) => ({
                name: String(r.name || ''),
                category: String(r.category || ''),
                level: Number(r.level || 0),
                years: r.years ? String(r.years) : undefined,
              }));
            }
            if (annRes.status === 'fulfilled' && Array.isArray(annRes.value.data) && annRes.value.data.length > 0) {
              ctx.announcements = annRes.value.data.map((r: Record<string, unknown>) => ({
                title: String(r.title || ''),
                content: String(r.content || ''),
                category: r.category ? String(r.category) : undefined,
              }));
            }
            if (noteRes.status === 'fulfilled' && Array.isArray(noteRes.value.data)) {
              ctx.notes = noteRes.value.data.map((r: Record<string, unknown>) => ({
                title: String(r.title || ''),
                category: String(r.category || ''),
                contentSnippet: String(r.content || '').slice(0, 140),
              }));
              ctx.publicNotesCount = noteRes.value.data.length;
            }
            if (fileRes.status === 'fulfilled' && Array.isArray(fileRes.value.data)) {
              ctx.files = fileRes.value.data.map((r: Record<string, unknown>) => ({
                title: String(r.title || ''),
                fileName: String(r.file_name || ''),
                category: String(r.category || ''),
                mimeType: r.mime_type ? String(r.mime_type) : undefined,
              }));
              ctx.publicFilesCount = fileRes.value.data.length;
            }
          }
        }
      } catch {
        // Proceed smoothly with client-supplied siteContext if Supabase is momentarily busy
      }

      const skillsText = (ctx.skills || [])
        .slice(0, 25)
        .map((s) => `- ${s.name} (${s.category}, ${s.level}%${s.years ? `, ${s.years}` : ''})`)
        .join('\n');
      const announcementsText = (ctx.announcements || [])
        .slice(0, 8)
        .map((a) => `- [${a.category || 'Update'}] ${a.title}: ${a.content.slice(0, 220)}`)
        .join('\n');
      const notesText = (ctx.notes || [])
        .slice(0, 12)
        .map((n) => `- [${n.category}] ${n.title}${n.contentSnippet ? `: ${n.contentSnippet}` : ''}`)
        .join('\n');
      const filesText = (ctx.files || [])
        .slice(0, 12)
        .map((f) => `- [${f.category}] ${f.title} (${f.fileName})`)
        .join('\n');

      const ownerDisplay = ctx.ownerName || 'Daniel Biranu';
      const systemInstruction = [
        `You are the intelligent, friendly, conversational AI assistant built into the ${ownerDisplay} website. Always refer to this site as "${ownerDisplay} website" (or "websaayitii ${ownerDisplay}" in Afaan Oromoo) — never call it "Biranu Personal Hub".`,
        `Your primary role is to talk naturally and helpfully with visitors about EVERYTHING on this website: the owner, skills, announcements, public study notes & view-only files, community chat, contact & file exchange system, and the 3D waterfall visual experience.`,
        `Language rule: Default to ${lang}, and always respond fluently in whatever language the visitor writes (Afaan Oromoo or English). When speaking Afaan Oromoo, use natural, polite, clear Afaan Oromoo.`,
        `NEVER invent fake admin passwords, secret tokens, or non-existent pages. Only state facts from the live website context below.`,
        ``,
        `=== WEBSITE OWNER & PROFILE ===`,
        `- Name: ${ownerDisplay}`,
        `- Role / Department: ${ctx.roleTitle || 'College of Computing Department of Information system for 2026 Gc'}`,
        `- Bio: ${ctx.bio || 'Software engineer and creator sharing technical notes, files, updates, and community discussions.'}`,
        `- Experience: ${ctx.yearsExperience || '5+ Waggaa'} | Projects: ${ctx.projectsCompleted || '28+ Pirojektii'}`,
        `- Location: ${ctx.location || 'Finfinnee, Oromia'}`,
        `- Phone ("Kallattiin Quunnamuuf"): ${ctx.phone || '+251932387559'}`,
        `- Email: ${ctx.email || 'danielbiranu142@gmail.com'}`,
        ctx.githubUrl ? `- GitHub: ${ctx.githubUrl}` : '',
        ctx.linkedinUrl ? `- LinkedIn: ${ctx.linkedinUrl}` : '',
        ctx.telegramUrl ? `- Telegram: ${ctx.telegramUrl}` : '',
        ``,
        `=== WEBSITE SECTIONS & HOW VISITORS USE THEM ===`,
        `1. Interactive 3D Design & Waterfall Background: The entire website features 3D extruded typography, 3D tactile cards/buttons, interactive 3D medallion admin logo & portrait (tilts with cursor and spins 360° on click), a Light/Dark theme toggle, and an Afaan Oromoo/English language toggle. Behind the site is a live 3D cascading waterfall canyon with flying articulated 3D birds and colorful 3D fish in the plunge pool—moving the mouse across the page causes the fish to race and leap out of the water toward the cursor with real 3D splash droplets and water ripples.`,
        `2. About (#about): Shows Daniel's interactive 3D portrait, bio, location, email, and social links.`,
        `3. Skills (#skills): Filterable showcase of technical skills with category buttons and mastery bars.`,
        skillsText ? `   Current Skills:\n${skillsText}` : '   (No skills listed yet in database.)',
        `4. Announcements (#announcements): News and pinned updates from Daniel.`,
        announcementsText ? `   Current Published Announcements:\n${announcementsText}` : '   (No published announcements yet.)',
        `5. Notes & File Vault (#vault): Public study notes (${ctx.publicNotesCount ?? (ctx.notes?.length || 0)}) can be searched, filtered, and read in full. Public files (${ctx.publicFilesCount ?? (ctx.files?.length || 0)}) are view-only inline (PDFs, images, videos, text/markdown)—downloading is disabled in the Vault.`,
        notesText ? `   Public Notes:\n${notesText}` : '',
        filesText ? `   Public View-Only Files:\n${filesText}` : '',
        `6. Community Chat (#community): Real-time public chat across 3 channels (General/Waliigalaa, Tech & Builds/Teeknoloojii, Q & A/Gaaffii fi Deebii). Visitors sign in with Google to post.`,
        `7. Contact & File Exchange (#contact): Three tabs—(a) "Send Message, Photo & Video" (attachments up to 100MB, generates a private Tracking Code like CON_... for two-way replies), (b) "Receive Reply & File" (enter a CON_... tracking code to read Admin replies and preview/download return media/files), and (c) "Live Chat with Admin" (ephemeral real-time chat supporting text, photos, videos, and files). Direct phone: ${ctx.phone || '+251932387559'}.`,
        `8. Admin Console: Private owner dashboard ("Bulchiinsa" / "Admin") used by Daniel to manage site content, reply to inbox tracking codes, and moderate chat.`,
        ``,
        `Keep replies well-structured, conversational, concise yet thorough, and end with a helpful follow-up suggestion when relevant.`,
      ]
        .filter(Boolean)
        .join('\n');

      const contents = messages
        .slice(-14)
        .map((m) => {
          const raw =
            typeof m.text === 'string'
              ? m.text
              : typeof (m as unknown as { content?: unknown }).content === 'string'
                ? String((m as unknown as { content: string }).content)
                : '';
          return {
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: raw.trim().slice(0, 4000) }],
          };
        })
        .filter((turn) => turn.parts[0].text.length > 0);

      if (contents.length === 0) {
        res.status(400).json({ error: 'Message text cannot be empty.' });
        return;
      }

      const callModel = async (modelName: string, useLowThinking: boolean, timeoutMs: number) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`AI request to ${modelName} timed out after ${timeoutMs}ms`)),
            timeoutMs
          );
        });
        try {
          return await Promise.race([
            gemini.ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                ...(useLowThinking ? { thinkingConfig: { thinkingLevel: gemini.ThinkingLevel.LOW } } : {}),
              },
            }),
            timeoutPromise,
          ]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      };

      const attempts: Array<{ model: string; lowThinking: boolean; timeoutMs: number; delayMs: number }> = [
        { model: 'gemini-4-hydrogen', lowThinking: true, timeoutMs: 8500, delayMs: 0 },
        { model: 'gemini-3.1-flash-lite', lowThinking: false, timeoutMs: 9000, delayMs: 250 },
        { model: 'gemini-4-hydrogen', lowThinking: false, timeoutMs: 8000, delayMs: 400 },
      ];

      let response: Awaited<ReturnType<typeof callModel>> | undefined;
      let lastErr: unknown;

      for (const attempt of attempts) {
        if (attempt.delayMs > 0) {
          await new Promise((r) => setTimeout(r, attempt.delayMs));
        }
        try {
          response = await callModel(attempt.model, attempt.lowThinking, attempt.timeoutMs);
          break;
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          const isTransient = /503|429|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|overloaded|timed out|timeout|404|NOT_FOUND/i.test(
            msg
          );
          if (!isTransient) {
            throw err;
          }
        }
      }

      if (!response) {
        throw lastErr ?? new Error('AI service is temporarily busy. Please try again shortly.');
      }

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'Empty response received from AI service.' });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'AI request failed.';
      let statusCode = 500;
      try {
        const parsed = JSON.parse(message) as { error?: { code?: number; message?: string } };
        if (parsed?.error?.message) {
          message = parsed.error.message;
        }
        if (typeof parsed?.error?.code === 'number' && parsed.error.code >= 400) {
          statusCode = parsed.error.code;
        }
      } catch {
        if (/503|UNAVAILABLE|high demand|timed out/i.test(message)) statusCode = 503;
        else if (/429|RESOURCE_EXHAUSTED/i.test(message)) statusCode = 429;
        else if (/403|PERMISSION_DENIED/i.test(message)) statusCode = 403;
      }
      console.error('Gemini chat error:', err);
      res.status(statusCode).json({ error: message });
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const message = err instanceof Error ? err.message : 'Internal server error.';
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    res.status(status).json({ error: message });
  });

  return app;
}
