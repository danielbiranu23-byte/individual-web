// src/server/createApp.ts
import "dotenv/config";
import crypto from "crypto";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// src/server/supabaseDb.ts
import { createClient } from "@supabase/supabase-js";
var cachedClient = null;
var cachedKeySignature = "";
function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  return {
    url,
    key: secretKey || publishableKey,
    hasSecretKey: Boolean(secretKey)
  };
}
function getSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error("Supabase URL or API key is not configured.");
  }
  const signature = `${url}:${key.slice(0, 24)}`;
  if (!cachedClient || cachedKeySignature !== signature) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    cachedKeySignature = signature;
  }
  return cachedClient;
}
function isRlsOrPermissionError(err) {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code || "") : "";
  const msg = "message" in err ? String(err.message || "") : "";
  return code === "42501" || msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("permission denied");
}
function formatSupabaseError(err, fallback) {
  if (isRlsOrPermissionError(err)) {
    return {
      status: 403,
      message: "Supabase RLS blocked this write. Add SUPABASE_SECRET_KEY (sb_secret_...) in AI Studio Secrets or enable write policies in Supabase SQL Editor."
    };
  }
  if (err && typeof err === "object" && "message" in err) {
    const msg = String(err.message || "").trim();
    if (msg) return { status: 500, message: msg };
  }
  return { status: 500, message: fallback };
}
function mapSiteProfileRow(row) {
  return {
    ownerName: String(row.owner_name || "Daniel Biranu"),
    roleTitleOm: String(row.role_title_om || "College of Computing Department of Information system for 2026 Gc"),
    roleTitleEn: String(row.role_title_en || "College of Computing Department of Information system for 2026 Gc"),
    headlineOm: String(row.headline_om || ""),
    headlineEn: String(row.headline_en || ""),
    bioOm: String(row.bio_om || ""),
    bioEn: String(row.bio_en || ""),
    location: row.location ? String(row.location) : "Finfinnee, Oromia",
    email: row.email ? String(row.email) : "danielbiranu142@gmail.com",
    phone: row.phone ? String(row.phone) : "",
    githubUrl: row.github_url ? String(row.github_url) : "",
    linkedinUrl: row.linkedin_url ? String(row.linkedin_url) : "",
    telegramUrl: row.telegram_url ? String(row.telegram_url) : "",
    avatarUrl: row.avatar_url ? String(row.avatar_url) : "/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg",
    yearsExperience: row.years_experience ? String(row.years_experience) : "5+ Waggaa",
    projectsCompleted: row.projects_completed ? String(row.projects_completed) : "28+ Pirojektii"
  };
}
function mapSkillRow(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    level: Number(row.level) || 0,
    years: row.years ? String(row.years) : "",
    description: row.description ? String(row.description) : "",
    authorId: String(row.author_id || "admin"),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapAnnouncementRow(row) {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: String(row.category),
    isPinned: Boolean(row.is_pinned),
    isPublished: Boolean(row.is_published),
    authorId: String(row.author_id || "admin"),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapNoteRow(row) {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: String(row.category),
    isPublic: Boolean(row.is_public),
    authorId: String(row.author_id || "admin"),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapSavedFileRow(row) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : "",
    fileName: String(row.file_name),
    storedName: String(row.stored_name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes) || 0,
    downloadUrl: String(row.download_url),
    category: String(row.category),
    isPublic: Boolean(row.is_public),
    hasBlob: false,
    authorId: String(row.author_id || "admin"),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapChatMessageRow(row) {
  return {
    id: String(row.id),
    channel: String(row.channel),
    text: String(row.text),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderPhoto: row.sender_photo ? String(row.sender_photo) : "",
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at
  };
}
function mapContactMessageRow(row) {
  return {
    id: String(row.id),
    senderName: String(row.sender_name),
    senderEmail: String(row.sender_email),
    subject: String(row.subject),
    message: String(row.message),
    status: String(row.status),
    senderKey: row.sender_key ? String(row.sender_key) : void 0,
    deviceKey: row.device_key ? String(row.device_key) : void 0,
    trackingCode: row.tracking_code ? String(row.tracking_code) : void 0,
    attachmentName: row.attachment_name ? String(row.attachment_name) : void 0,
    attachmentStoredName: row.attachment_stored_name ? String(row.attachment_stored_name) : void 0,
    attachmentMimeType: row.attachment_mime_type ? String(row.attachment_mime_type) : void 0,
    attachmentSizeBytes: row.attachment_size_bytes !== null && row.attachment_size_bytes !== void 0 ? Number(row.attachment_size_bytes) : void 0,
    attachmentUrl: row.attachment_url ? String(row.attachment_url) : void 0,
    hasReply: Boolean(row.has_reply),
    createdAt: row.created_at
  };
}
function mapContactExchangeRow(row) {
  return {
    trackingCode: String(row.tracking_code),
    subject: String(row.subject),
    adminReply: String(row.admin_reply),
    replyFileName: row.reply_file_name ? String(row.reply_file_name) : void 0,
    replyStoredName: row.reply_stored_name ? String(row.reply_stored_name) : void 0,
    replyMimeType: row.reply_mime_type ? String(row.reply_mime_type) : void 0,
    replySizeBytes: row.reply_size_bytes !== null && row.reply_size_bytes !== void 0 ? Number(row.reply_size_bytes) : void 0,
    replyDownloadUrl: row.reply_download_url ? String(row.reply_download_url) : void 0,
    authorId: String(row.author_id || "admin"),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapBlockedRecordRow(row) {
  return {
    id: String(row.id),
    targetName: String(row.target_name),
    targetEmail: row.target_email ? String(row.target_email) : void 0,
    reason: row.reason ? String(row.reason) : void 0,
    source: String(row.source),
    emailBlockId: row.email_block_id ? String(row.email_block_id) : void 0,
    deviceBlockId: row.device_block_id ? String(row.device_block_id) : void 0,
    uidBlockId: row.uid_block_id ? String(row.uid_block_id) : void 0,
    authorId: String(row.author_id || "admin"),
    createdAt: row.created_at
  };
}
function mapLiveChatRoomRow(row) {
  const roomId = String(row.room_id);
  return {
    id: roomId,
    roomId,
    visitorName: String(row.visitor_name),
    senderKey: row.sender_key ? String(row.sender_key) : void 0,
    deviceKey: String(row.device_key),
    visitorActive: Boolean(row.visitor_active),
    adminNote: row.admin_note ? String(row.admin_note) : void 0,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapLiveChatMessageRow(row) {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    senderRole: String(row.sender_role),
    senderName: String(row.sender_name),
    text: String(row.text || ""),
    visitorVisible: Boolean(row.visitor_visible),
    isEdited: Boolean(row.is_edited),
    mediaName: row.media_name ? String(row.media_name) : void 0,
    mediaStoredName: row.media_stored_name ? String(row.media_stored_name) : void 0,
    mediaMimeType: row.media_mime_type ? String(row.media_mime_type) : void 0,
    mediaSizeBytes: row.media_size_bytes !== null && row.media_size_bytes !== void 0 ? Number(row.media_size_bytes) : void 0,
    mediaUrl: row.media_url ? String(row.media_url) : void 0,
    authorId: row.author_id ? String(row.author_id) : void 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// src/server/createApp.ts
function loadFirebaseProjectId() {
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (parsed.projectId) return parsed.projectId;
    }
  } catch {
  }
  return process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0105354277";
}
var FIREBASE_PROJECT_ID = loadFirebaseProjectId();
try {
  if (!getApps().length) {
    initializeApp({ projectId: FIREBASE_PROJECT_ID });
  }
} catch {
}
var IS_VERCEL = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME
);
var BASE_WRITABLE_DIR = IS_VERCEL ? os.tmpdir() : process.cwd();
var UPLOAD_DIR = path.resolve(BASE_WRITABLE_DIR, "uploads");
var ADMIN_CREDS_FILE = path.resolve(BASE_WRITABLE_DIR, ".admin-credentials.json");
var SESSION_SIGNING_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.createHash("sha256").update(`${process.env.SUPABASE_URL || "local"}:${FIREBASE_PROJECT_ID}:biranu_session_v2`).digest("hex");
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch {
}
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function loadLocalAdminCredentials() {
  try {
    if (fs.existsSync(ADMIN_CREDS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_CREDS_FILE, "utf8"));
      if (parsed.username && parsed.salt && parsed.passwordHash) {
        return parsed;
      }
    }
  } catch {
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const initial = {
    username: "Daniel",
    salt,
    passwordHash: hashPassword("d@niel123", salt)
  };
  try {
    fs.writeFileSync(ADMIN_CREDS_FILE, JSON.stringify(initial, null, 2), "utf8");
  } catch {
  }
  return initial;
}
function saveLocalAdminCredentials(creds) {
  try {
    fs.writeFileSync(ADMIN_CREDS_FILE, JSON.stringify(creds, null, 2), "utf8");
  } catch {
  }
}
async function loadAdminCredentialsAsync() {
  const localCreds = loadLocalAdminCredentials();
  try {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return localCreds;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("admin_accounts").select("username, salt, password_hash").eq("id", "main").maybeSingle();
    if (!error && data && data.username && data.salt && data.password_hash) {
      const synced = {
        username: String(data.username),
        salt: String(data.salt),
        passwordHash: String(data.password_hash)
      };
      saveLocalAdminCredentials(synced);
      return synced;
    }
    if (!error && !data) {
      await supabase.from("admin_accounts").upsert({
        id: "main",
        username: localCreds.username,
        salt: localCreds.salt,
        password_hash: localCreds.passwordHash,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch {
  }
  return localCreds;
}
async function saveAdminCredentialsAsync(creds) {
  saveLocalAdminCredentials(creds);
  try {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return;
    const supabase = getSupabaseClient();
    await supabase.from("admin_accounts").upsert({
      id: "main",
      username: creds.username,
      salt: creds.salt,
      password_hash: creds.passwordHash,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch {
  }
}
function signAdminToken(creds) {
  const payload = {
    u: creds.username,
    v: creds.passwordHash.slice(0, 16),
    exp: Date.now() + 24 * 60 * 60 * 1e3
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SIGNING_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
async function verifyAdminToken(token) {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SIGNING_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
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
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}
async function requireAdmin(req, res, next) {
  const token = extractBearerToken(req);
  const username = await verifyAdminToken(token);
  if (!username) {
    res.status(401).json({ error: "Admin authentication required." });
    return;
  }
  req.adminUsername = username;
  next();
}
var passwordResetTokens = /* @__PURE__ */ new Map();
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      }
    } catch {
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "");
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base || "file"}_${unique}${ext}`);
  }
});
var upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function isAnyKeyBlocked(keys) {
  const cleanKeys = keys.map((k) => typeof k === "string" ? k.trim() : "").filter((k) => k.length >= 10);
  if (cleanKeys.length === 0) return false;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("blocked_users").select("block_id").in("block_id", cleanKeys).eq("active", true).limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
async function deleteStoredMedia(storedName) {
  if (!storedName) return;
  const safeName = path.basename(storedName);
  if (!safeName) return;
  const filePath = path.join(UPLOAD_DIR, safeName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
    }
  }
  try {
    const supabase = getSupabaseClient();
    await supabase.storage.from("media").remove([safeName]);
  } catch {
  }
}
function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/supabase/status", async (_req, res) => {
    const cfg = getSupabaseConfig();
    if (!cfg.url || !cfg.key) {
      res.json({ connected: false, hasSecretKey: false, storageReady: false });
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [dbCheck, bucketCheck] = await Promise.all([
        supabase.from("site_profile").select("id").limit(1),
        supabase.storage.from("media").list("", { limit: 1 })
      ]);
      res.json({
        connected: !dbCheck.error,
        hasSecretKey: cfg.hasSecretKey,
        storageReady: !bucketCheck.error
      });
    } catch {
      res.json({ connected: false, hasSecretKey: cfg.hasSecretKey, storageReady: false });
    }
  });
  app.post("/api/admin/login", async (req, res) => {
    const body = req.body;
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }
    const creds = await loadAdminCredentialsAsync();
    const candidateHash = hashPassword(password, creds.salt);
    const storedBuf = Buffer.from(creds.passwordHash, "hex");
    const candidateBuf = Buffer.from(candidateHash, "hex");
    const passwordMatch = storedBuf.length === candidateBuf.length && crypto.timingSafeEqual(storedBuf, candidateBuf);
    if (username !== creds.username || !passwordMatch) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }
    const sessionToken = signAdminToken(creds);
    res.json({ ok: true, sessionToken, username: creds.username });
  });
  app.get("/api/admin/session", async (req, res) => {
    const token = extractBearerToken(req);
    const username = await verifyAdminToken(token);
    if (!username) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, username });
  });
  app.post("/api/admin/logout", (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/api/admin/verify-username", async (req, res) => {
    const body = req.body;
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) {
      res.status(400).json({ error: "Username is required." });
      return;
    }
    const creds = await loadAdminCredentialsAsync();
    if (username !== creds.username) {
      res.status(404).json({ error: "Username not recognized." });
      return;
    }
    const resetToken = crypto.randomBytes(24).toString("hex");
    passwordResetTokens.set(resetToken, {
      username: creds.username,
      expiresAt: Date.now() + 10 * 60 * 1e3
    });
    res.json({ verified: true, resetToken });
  });
  app.post("/api/admin/reset-password", async (req, res) => {
    const body = req.body;
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const resetToken = typeof body.resetToken === "string" ? body.resetToken.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!username || !resetToken || newPassword.length < 6) {
      res.status(400).json({ error: "Valid username, reset token, and password (min 6 chars) are required." });
      return;
    }
    const tokenEntry = passwordResetTokens.get(resetToken);
    if (!tokenEntry || tokenEntry.expiresAt < Date.now() || tokenEntry.username !== username) {
      passwordResetTokens.delete(resetToken);
      res.status(403).json({ error: "Reset verification expired or invalid." });
      return;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    await saveAdminCredentialsAsync({
      username: tokenEntry.username,
      salt,
      passwordHash: hashPassword(newPassword, salt)
    });
    passwordResetTokens.delete(resetToken);
    res.json({ ok: true });
  });
  app.get("/api/site/bootstrap", async (req, res) => {
    try {
      const adminUser = await verifyAdminToken(extractBearerToken(req));
      const isAdminSession = Boolean(adminUser);
      const supabase = getSupabaseClient();
      const announcementsQuery = isAdminSession ? supabase.from("announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }) : supabase.from("announcements").select("*").eq("is_published", true).order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      const notesQuery = isAdminSession ? supabase.from("notes").select("*").order("created_at", { ascending: false }) : supabase.from("notes").select("*").eq("is_public", true).order("created_at", { ascending: false });
      const filesQuery = isAdminSession ? supabase.from("saved_files").select("*").order("created_at", { ascending: false }) : supabase.from("saved_files").select("*").eq("is_public", true).order("created_at", { ascending: false });
      const [profileRes, skillsRes, annRes, notesRes, filesRes, chatRes] = await Promise.all([
        supabase.from("site_profile").select("*").eq("id", "main").maybeSingle(),
        supabase.from("skills").select("*").order("level", { ascending: false }),
        announcementsQuery,
        notesQuery,
        filesQuery,
        supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(120)
      ]);
      const firstErr = profileRes.error || skillsRes.error || annRes.error || notesRes.error || filesRes.error || chatRes.error;
      if (firstErr) {
        const formatted = formatSupabaseError(firstErr, "Failed to load site data from Supabase.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        profile: profileRes.data ? mapSiteProfileRow(profileRes.data) : null,
        skills: (skillsRes.data || []).map((r) => mapSkillRow(r)),
        announcements: (annRes.data || []).map((r) => mapAnnouncementRow(r)),
        notes: (notesRes.data || []).map((r) => mapNoteRow(r)),
        files: (filesRes.data || []).map((r) => mapSavedFileRow(r)),
        chatMessages: (chatRes.data || []).map((r) => mapChatMessageRow(r))
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to load site data.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.get("/api/admin/bootstrap", requireAdmin, async (_req, res) => {
    try {
      const supabase = getSupabaseClient();
      const [contactsRes, blockedRes, roomsRes] = await Promise.all([
        supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(150),
        supabase.from("blocked_user_records").select("*").order("created_at", { ascending: false }).limit(150),
        supabase.from("live_chat_rooms").select("*").order("updated_at", { ascending: false }).limit(150)
      ]);
      const firstErr = contactsRes.error || blockedRes.error || roomsRes.error;
      if (firstErr) {
        const formatted = formatSupabaseError(firstErr, "Failed to load admin records.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        contactMessages: (contactsRes.data || []).map((r) => mapContactMessageRow(r)),
        blockedUsers: (blockedRes.data || []).map((r) => mapBlockedRecordRow(r)),
        liveChatRooms: (roomsRes.data || []).map((r) => mapLiveChatRoomRow(r))
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to load admin records.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.put("/api/admin/profile", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("site_profile").upsert({
        id: "main",
        owner_name: String(b.ownerName || "Daniel Biranu").trim().slice(0, 120),
        role_title_om: String(b.roleTitleOm || "").trim().slice(0, 300),
        role_title_en: String(b.roleTitleEn || "").trim().slice(0, 300),
        headline_om: String(b.headlineOm || "").trim().slice(0, 300),
        headline_en: String(b.headlineEn || "").trim().slice(0, 300),
        bio_om: String(b.bioOm || "").trim().slice(0, 5e3),
        bio_en: String(b.bioEn || "").trim().slice(0, 5e3),
        location: String(b.location || "").trim().slice(0, 120),
        email: String(b.email || "").trim().slice(0, 160),
        phone: String(b.phone || "").trim().slice(0, 60),
        github_url: String(b.githubUrl || "").trim().slice(0, 300),
        linkedin_url: String(b.linkedinUrl || "").trim().slice(0, 300),
        telegram_url: String(b.telegramUrl || "").trim().slice(0, 300),
        avatar_url: String(b.avatarUrl || "/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg").trim().slice(0, 500),
        years_experience: String(b.yearsExperience || "").trim().slice(0, 60),
        projects_completed: String(b.projectsCompleted || "").trim().slice(0, 60),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to save profile.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ profile: mapSiteProfileRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to save profile.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/skills", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("skills").insert({
        name: String(b.name || "").trim().slice(0, 80),
        category: String(b.category || "General").trim().slice(0, 60),
        level: Math.min(100, Math.max(1, Number(b.level) || 80)),
        years: String(b.years || "").trim().slice(0, 30),
        description: String(b.description || "").trim().slice(0, 400),
        author_id: "admin"
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to add skill.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ skill: mapSkillRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to add skill.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.put("/api/admin/skills/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("skills").update({
        name: String(b.name || "").trim().slice(0, 80),
        category: String(b.category || "General").trim().slice(0, 60),
        level: Math.min(100, Math.max(1, Number(b.level) || 80)),
        years: String(b.years || "").trim().slice(0, 30),
        description: String(b.description || "").trim().slice(0, 400),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", id).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update skill.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ skill: mapSkillRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update skill.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/skills/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("skills").delete().eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete skill.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete skill.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/announcements", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("announcements").insert({
        title: String(b.title || "").trim().slice(0, 160),
        content: String(b.content || "").trim().slice(0, 5e3),
        category: String(b.category || "General").trim().slice(0, 60) || "General",
        is_pinned: Boolean(b.isPinned),
        is_published: b.isPublished !== false,
        author_id: "admin"
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to save announcement.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ announcement: mapAnnouncementRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to save announcement.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.put("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("announcements").update({
        title: String(b.title || "").trim().slice(0, 160),
        content: String(b.content || "").trim().slice(0, 5e3),
        category: String(b.category || "General").trim().slice(0, 60) || "General",
        is_pinned: Boolean(b.isPinned),
        is_published: b.isPublished !== false,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", id).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update announcement.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ announcement: mapAnnouncementRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update announcement.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete announcement.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete announcement.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/notes", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("notes").insert({
        title: String(b.title || "").trim().slice(0, 160),
        content: String(b.content || "").trim().slice(0, 2e4),
        category: String(b.category || "Notes").trim().slice(0, 60) || "Notes",
        is_public: b.isPublic !== false,
        author_id: "admin"
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to save note.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ note: mapNoteRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to save note.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.put("/api/admin/notes/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("notes").update({
        title: String(b.title || "").trim().slice(0, 160),
        content: String(b.content || "").trim().slice(0, 2e4),
        category: String(b.category || "Notes").trim().slice(0, 60) || "Notes",
        is_public: b.isPublic !== false,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", id).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update note.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ note: mapNoteRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update note.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/notes/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete note.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete note.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/files", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("saved_files").insert({
        title: String(b.title || b.fileName || "Untitled").trim().slice(0, 160),
        description: String(b.description || "").trim().slice(0, 1e3),
        file_name: String(b.fileName || "").trim().slice(0, 255),
        stored_name: String(b.storedName || "").trim().slice(0, 255),
        mime_type: String(b.mimeType || "application/octet-stream").trim().slice(0, 120),
        size_bytes: Math.max(0, Number(b.sizeBytes) || 0),
        download_url: String(b.downloadUrl || "").trim().slice(0, 500),
        category: String(b.category || "Documents").trim().slice(0, 60),
        is_public: b.isPublic !== false,
        author_id: "admin"
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to save file record.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ file: mapSavedFileRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to save file record.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.patch("/api/admin/files/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("saved_files").update({
        is_public: Boolean(b.isPublic),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", id).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update file visibility.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ file: mapSavedFileRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update file visibility.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/files/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase.from("saved_files").select("stored_name").eq("id", id).maybeSingle();
      const { error } = await supabase.from("saved_files").delete().eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete file.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      if (existing && existing.stored_name) {
        await deleteStoredMedia(existing.stored_name);
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete file.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/seed", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const p = b.profile || {};
      const supabase = getSupabaseClient();
      const { error: profileErr } = await supabase.from("site_profile").upsert({
        id: "main",
        owner_name: String(p.ownerName || "Daniel Biranu"),
        role_title_om: String(p.roleTitleOm || "College of Computing Department of Information system for 2026 Gc"),
        role_title_en: String(p.roleTitleEn || "College of Computing Department of Information system for 2026 Gc"),
        headline_om: String(p.headlineOm || "Teeknoloojii ammayyaa, yaadannoo fi kuusaa hojii kootii bakka tokkotti."),
        headline_en: String(p.headlineEn || "Building modern software, sharing knowledge, and connecting ideas in one personal hub."),
        bio_om: String(p.bioOm || ""),
        bio_en: String(p.bioEn || ""),
        location: String(p.location || "Finfinnee, Oromia"),
        email: String(p.email || "danielbiranu142@gmail.com"),
        phone: String(p.phone || "+251932387559"),
        github_url: String(p.githubUrl || "https://github.com"),
        linkedin_url: String(p.linkedinUrl || "https://linkedin.com"),
        telegram_url: String(p.telegramUrl || "https://t.me"),
        avatar_url: String(p.avatarUrl || "/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg"),
        years_experience: String(p.yearsExperience || "5+ Waggaa"),
        projects_completed: String(p.projectsCompleted || "28+ Pirojektii"),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (profileErr) {
        const formatted = formatSupabaseError(profileErr, "Failed to seed profile.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      const [skillsCount, annCount, notesCount] = await Promise.all([
        supabase.from("skills").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true })
      ]);
      if ((skillsCount.count || 0) === 0) {
        await supabase.from("skills").insert([
          {
            name: "TypeScript & React",
            category: "Frontend",
            level: 95,
            years: "5+ Waggaa",
            description: "Websaayitii saffisaa fi ammayyaa ijaaruu.",
            author_id: "admin"
          },
          {
            name: "Node.js & Express",
            category: "Backend",
            level: 90,
            years: "4+ Waggaa",
            description: "API nageenya qabuu fi server hojjechuu.",
            author_id: "admin"
          },
          {
            name: "Supabase & PostgreSQL",
            category: "Cloud & Data",
            level: 90,
            years: "3+ Waggaa",
            description: "Database cimaa fi cloud storage qindeessuu.",
            author_id: "admin"
          },
          {
            name: "AI Integration (Gemini)",
            category: "AI & Automation",
            level: 85,
            years: "2+ Waggaa",
            description: "Chatbot fi tajaajila hubannoo namtolchee ijaaruu.",
            author_id: "admin"
          }
        ]);
      }
      if ((annCount.count || 0) === 0) {
        await supabase.from("announcements").insert({
          title: "Websaayitii Dhuunfaa Haaraan Banameera!",
          content: "Baga nagaan dhuftan! Websaayitii kana irratti yaadannoo, faayiloota, beeksisa haaraa fi bakka waliin haasa\u2019uu argachuu dandeessu. Gaaffii yoo qabaattan AI Chatbot ykn Contact fayyadamaa.",
          category: "Beeksisa Waliigalaa",
          is_pinned: true,
          is_published: true,
          author_id: "admin"
        });
      }
      if ((notesCount.count || 0) === 0) {
        await supabase.from("notes").insert({
          title: "Qajeelfama Jalqabaa: React, TypeScript & Supabase",
          content: "1. Component xixiqqoo fi qulqulluu ijaari.\n2. Type safety (TypeScript) yeroo hunda fayyadami.\n3. Daataa Supabase PostgreSQL irratti nageenyaan olkaa\u2019i.\n4. Vault keenya keessaa barruu fi viidiyoo dubbisi.",
          category: "Teeknoloojii",
          is_public: true,
          author_id: "admin"
        });
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to seed demo content.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    const storedName = req.file.filename;
    const filePath = path.join(UPLOAD_DIR, storedName);
    const mimeType = req.file.mimetype || "application/octet-stream";
    let storageUploaded = false;
    try {
      const { url, key } = getSupabaseConfig();
      if (url && key) {
        const supabase = getSupabaseClient();
        const fileBuffer = fs.readFileSync(filePath);
        const { error: uploadErr } = await supabase.storage.from("media").upload(storedName, fileBuffer, {
          contentType: mimeType,
          upsert: false
        });
        if (!uploadErr) {
          storageUploaded = true;
          if (IS_VERCEL) {
            try {
              fs.unlinkSync(filePath);
            } catch {
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
      storageUploaded
    });
  });
  app.get("/api/files/download/:storedName", async (req, res) => {
    const rawName = String(req.params.storedName || "");
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      res.status(400).json({ error: "Invalid file name." });
      return;
    }
    const originalName = typeof req.query.name === "string" && req.query.name.trim() ? path.basename(req.query.name) : safeName;
    const filePath = path.join(UPLOAD_DIR, safeName);
    if (!IS_VERCEL && fs.existsSync(filePath)) {
      res.setHeader("Content-Disposition", `inline; filename="${originalName.replace(/"/g, "")}"`);
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(filePath);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from("media").download(safeName);
      if (error || !data) {
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Disposition", `inline; filename="${originalName.replace(/"/g, "")}"`);
          res.setHeader("Cache-Control", "no-store");
          res.sendFile(filePath);
          return;
        }
        res.status(404).json({ error: "File not found." });
        return;
      }
      const arrayBuf = await data.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (data.type) {
        res.setHeader("Content-Type", data.type);
      }
      res.setHeader("Content-Disposition", `inline; filename="${originalName.replace(/"/g, "")}"`);
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch {
      res.status(404).json({ error: "File not found." });
    }
  });
  app.delete("/api/files/:storedName", async (req, res) => {
    const rawName = String(req.params.storedName || "");
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      res.status(400).json({ error: "Invalid file name." });
      return;
    }
    await deleteStoredMedia(safeName);
    res.json({ deleted: true });
  });
  app.post("/api/community/messages", async (req, res) => {
    try {
      const idToken = extractBearerToken(req);
      if (!idToken) {
        res.status(401).json({ error: "Google sign-in token required." });
        return;
      }
      const decoded = await getAuth().verifyIdToken(idToken);
      const blocked = await isAnyKeyBlocked([`uid_${decoded.uid}`]);
      if (blocked) {
        res.status(403).json({ error: "You are blocked from posting messages." });
        return;
      }
      const b = req.body;
      const channel = b.channel === "tech" || b.channel === "qa" ? b.channel : "general";
      const cleanText = typeof b.text === "string" ? b.text.trim().slice(0, 1500) : "";
      if (!cleanText) {
        res.status(400).json({ error: "Message text is required." });
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("chat_messages").insert({
        channel,
        text: cleanText,
        sender_id: decoded.uid,
        sender_name: String(decoded.name || decoded.email || "Member").slice(0, 100),
        sender_photo: String(decoded.picture || "").slice(0, 500),
        is_pinned: false
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to post message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ message: mapChatMessageRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to post message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.patch("/api/community/messages/:id/pin", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const b = req.body;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("chat_messages").update({ is_pinned: Boolean(b.isPinned) }).eq("id", id).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update pin.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ message: mapChatMessageRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update pin.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/community/messages/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const token = extractBearerToken(req);
      const adminUsername = await verifyAdminToken(token);
      let firebaseUid = null;
      if (!adminUsername && token) {
        try {
          const decoded = await getAuth().verifyIdToken(token);
          firebaseUid = decoded.uid;
        } catch {
          firebaseUid = null;
        }
      }
      if (!adminUsername && !firebaseUid) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }
      const supabase = getSupabaseClient();
      if (!adminUsername && firebaseUid) {
        const { data: existing } = await supabase.from("chat_messages").select("sender_id").eq("id", id).maybeSingle();
        if (!existing || String(existing.sender_id) !== firebaseUid) {
          res.status(403).json({ error: "Not allowed to delete this message." });
          return;
        }
      }
      const { error } = await supabase.from("chat_messages").delete().eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/contact/messages", async (req, res) => {
    try {
      const b = req.body;
      const senderKey = typeof b.senderKey === "string" ? b.senderKey : "";
      const deviceKey = typeof b.deviceKey === "string" ? b.deviceKey : "";
      const uidKey = typeof b.uidKey === "string" ? b.uidKey : "";
      const blocked = await isAnyKeyBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        res.status(403).json({ blocked: true, error: "Blocked from sending messages." });
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("contact_messages").insert({
        sender_name: String(b.senderName || "").trim().slice(0, 100),
        sender_email: String(b.senderEmail || "").trim().slice(0, 160),
        subject: String(b.subject || "").trim().slice(0, 160),
        message: String(b.message || "").trim().slice(0, 3e3),
        status: "unread",
        sender_key: senderKey || null,
        device_key: deviceKey || null,
        tracking_code: String(b.trackingCode || "").trim().slice(0, 64) || null,
        attachment_name: b.attachmentName ? String(b.attachmentName).slice(0, 255) : null,
        attachment_stored_name: b.attachmentStoredName ? String(b.attachmentStoredName).slice(0, 255) : null,
        attachment_mime_type: b.attachmentMimeType ? String(b.attachmentMimeType).slice(0, 120) : null,
        attachment_size_bytes: typeof b.attachmentSizeBytes === "number" ? b.attachmentSizeBytes : null,
        attachment_url: b.attachmentUrl ? String(b.attachmentUrl).slice(0, 500) : null,
        has_reply: false
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to submit contact message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ message: mapContactMessageRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to submit contact message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.get("/api/contact/exchanges/:trackingCode", async (req, res) => {
    try {
      const trackingCode = String(req.params.trackingCode || "").trim();
      if (!/^[a-zA-Z0-9_\-]{12,64}$/.test(trackingCode)) {
        res.status(400).json({ error: "Invalid tracking code." });
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("contact_exchanges").select("*").eq("tracking_code", trackingCode).maybeSingle();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to look up reply.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        exchange: data ? mapContactExchangeRow(data) : null
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to look up reply.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.patch("/api/admin/contact/messages/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const b = req.body;
      const status = b.status === "read" || b.status === "archived" ? b.status : "unread";
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update message status.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update message status.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/contact/messages/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase.from("contact_messages").select("attachment_stored_name").eq("id", id).maybeSingle();
      const { error } = await supabase.from("contact_messages").delete().eq("id", id);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete contact message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      if (existing && existing.attachment_stored_name) {
        await deleteStoredMedia(existing.attachment_stored_name);
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete contact message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/contact/reply", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const messageId = String(b.messageId || "");
      const trackingCode = String(b.trackingCode || "").trim();
      const subject = String(b.subject || "").trim().slice(0, 160);
      const adminReply = String(b.adminReply || "").trim().slice(0, 3e3);
      if (!trackingCode || !adminReply) {
        res.status(400).json({ error: "Tracking code and reply text are required." });
        return;
      }
      const supabase = getSupabaseClient();
      const exchangeRow = {
        tracking_code: trackingCode,
        subject,
        admin_reply: adminReply,
        author_id: "admin",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (b.replyFileName) {
        exchangeRow.reply_file_name = String(b.replyFileName).slice(0, 255);
        exchangeRow.reply_stored_name = b.replyStoredName ? String(b.replyStoredName).slice(0, 255) : null;
        exchangeRow.reply_mime_type = b.replyMimeType ? String(b.replyMimeType).slice(0, 120) : null;
        exchangeRow.reply_size_bytes = typeof b.replySizeBytes === "number" ? b.replySizeBytes : null;
        exchangeRow.reply_download_url = b.replyDownloadUrl ? String(b.replyDownloadUrl).slice(0, 500) : null;
      }
      const { data, error } = await supabase.from("contact_exchanges").upsert(exchangeRow).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to save reply.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      if (messageId) {
        await supabase.from("contact_messages").update({ status: "read", has_reply: true }).eq("id", messageId);
      }
      res.json({ exchange: mapContactExchangeRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to save reply.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/live-chat/rooms", async (req, res) => {
    try {
      const b = req.body;
      const roomId = String(b.roomId || "").trim();
      const visitorName = String(b.visitorName || "").trim().slice(0, 100);
      const deviceKey = String(b.deviceKey || "").trim();
      const senderKey = typeof b.senderKey === "string" ? b.senderKey.trim() : "";
      const uidKey = typeof b.uidKey === "string" ? b.uidKey.trim() : "";
      if (!roomId || !visitorName || !deviceKey) {
        res.status(400).json({ error: "Room ID, visitor name, and device key are required." });
        return;
      }
      const blocked = await isAnyKeyBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        res.status(403).json({ blocked: true, error: "Blocked from starting live chat." });
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("live_chat_rooms").insert({
        room_id: roomId,
        visitor_name: visitorName,
        sender_key: senderKey || null,
        device_key: deviceKey,
        visitor_active: true,
        last_message_preview: ""
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to start live chat room.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ room: mapLiveChatRoomRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to start live chat.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.get("/api/live-chat/rooms/:roomId/messages", async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const supabase = getSupabaseClient();
      const { data: room, error: roomErr } = await supabase.from("live_chat_rooms").select("visitor_active").eq("room_id", roomId).maybeSingle();
      if (roomErr || !room || !room.visitor_active) {
        res.json({ active: false, messages: [] });
        return;
      }
      const { data, error } = await supabase.from("live_chat_messages").select("*").eq("room_id", roomId).eq("visitor_visible", true).order("created_at", { ascending: true });
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to fetch live chat messages.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        active: true,
        messages: (data || []).map((r) => mapLiveChatMessageRow(r))
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to fetch live chat messages.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/live-chat/rooms/:roomId/messages", async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const b = req.body;
      const deviceKey = typeof b.deviceKey === "string" ? b.deviceKey : "";
      const senderKey = typeof b.senderKey === "string" ? b.senderKey : "";
      const uidKey = typeof b.uidKey === "string" ? b.uidKey : "";
      const blocked = await isAnyKeyBlocked([deviceKey, senderKey, uidKey]);
      if (blocked) {
        res.status(403).json({ blocked: true, error: "Blocked from sending live messages." });
        return;
      }
      const supabase = getSupabaseClient();
      const { data: room } = await supabase.from("live_chat_rooms").select("visitor_active").eq("room_id", roomId).maybeSingle();
      if (!room || !room.visitor_active) {
        res.status(410).json({ ended: true, error: "Live chat session has ended." });
        return;
      }
      const cleanText = String(b.text || "").trim().slice(0, 3e3);
      const mediaName = b.mediaName ? String(b.mediaName).slice(0, 255) : null;
      if (!cleanText && !mediaName) {
        res.status(400).json({ error: "Message text or media is required." });
        return;
      }
      const { data, error } = await supabase.from("live_chat_messages").insert({
        room_id: roomId,
        sender_role: "visitor",
        sender_name: String(b.senderName || "Visitor").trim().slice(0, 100),
        text: cleanText,
        visitor_visible: true,
        is_edited: false,
        media_name: mediaName,
        media_stored_name: b.mediaStoredName ? String(b.mediaStoredName).slice(0, 255) : null,
        media_mime_type: b.mediaMimeType ? String(b.mediaMimeType).slice(0, 120) : null,
        media_size_bytes: typeof b.mediaSizeBytes === "number" ? b.mediaSizeBytes : null,
        media_url: b.mediaUrl ? String(b.mediaUrl).slice(0, 500) : null
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to send live message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      const preview = (cleanText || mediaName || "").slice(0, 180);
      await supabase.from("live_chat_rooms").update({
        last_message_preview: preview,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("room_id", roomId);
      res.json({ message: mapLiveChatMessageRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to send live message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/live-chat/rooms/:roomId/end", async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const supabase = getSupabaseClient();
      await supabase.from("live_chat_rooms").update({
        visitor_active: false,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("room_id", roomId);
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });
  app.get("/api/admin/live-chat/rooms/:roomId/messages", requireAdmin, async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("live_chat_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to fetch archive messages.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({
        messages: (data || []).map((r) => mapLiveChatMessageRow(r))
      });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to fetch archive messages.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/admin/live-chat/rooms/:roomId/messages", requireAdmin, async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const b = req.body;
      const cleanText = String(b.text || "").trim().slice(0, 3e3);
      const mediaName = b.mediaName ? String(b.mediaName).slice(0, 255) : null;
      if (!cleanText && !mediaName) {
        res.status(400).json({ error: "Message text or media is required." });
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("live_chat_messages").insert({
        room_id: roomId,
        sender_role: "admin",
        sender_name: String(b.senderName || "Daniel Biranu").trim().slice(0, 100),
        text: cleanText,
        visitor_visible: b.visitorVisible !== false,
        is_edited: false,
        media_name: mediaName,
        media_stored_name: b.mediaStoredName ? String(b.mediaStoredName).slice(0, 255) : null,
        media_mime_type: b.mediaMimeType ? String(b.mediaMimeType).slice(0, 120) : null,
        media_size_bytes: typeof b.mediaSizeBytes === "number" ? b.mediaSizeBytes : null,
        media_url: b.mediaUrl ? String(b.mediaUrl).slice(0, 500) : null,
        author_id: "admin"
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to send admin reply.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      const preview = (cleanText || mediaName || "").slice(0, 180);
      await supabase.from("live_chat_rooms").update({
        last_message_preview: preview,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("room_id", roomId);
      res.json({ message: mapLiveChatMessageRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to send admin reply.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.patch("/api/admin/live-chat/rooms/:roomId", requireAdmin, async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const b = req.body;
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("live_chat_rooms").update({
        admin_note: String(b.adminNote || "").trim().slice(0, 500),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("room_id", roomId);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update admin note.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update admin note.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/live-chat/rooms/:roomId", requireAdmin, async (req, res) => {
    try {
      const roomId = String(req.params.roomId || "").trim();
      const supabase = getSupabaseClient();
      const { data: msgs } = await supabase.from("live_chat_messages").select("media_stored_name").eq("room_id", roomId);
      const { error } = await supabase.from("live_chat_rooms").delete().eq("room_id", roomId);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete chat thread.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          const sn = m.media_stored_name;
          if (sn) await deleteStoredMedia(sn);
        }
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete chat thread.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.patch("/api/admin/live-chat/messages/:msgId", requireAdmin, async (req, res) => {
    try {
      const msgId = String(req.params.msgId || "");
      const b = req.body;
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("live_chat_messages").update({
        text: String(b.text || "").trim().slice(0, 3e3),
        visitor_visible: b.visitorVisible !== false,
        is_edited: true,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", msgId);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to update live message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to update live message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/live-chat/messages/:msgId", requireAdmin, async (req, res) => {
    try {
      const msgId = String(req.params.msgId || "");
      const supabase = getSupabaseClient();
      const { data: existing } = await supabase.from("live_chat_messages").select("media_stored_name").eq("id", msgId).maybeSingle();
      const { error } = await supabase.from("live_chat_messages").delete().eq("id", msgId);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to delete live message.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      if (existing && existing.media_stored_name) {
        await deleteStoredMedia(existing.media_stored_name);
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to delete live message.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/blocked/check", async (req, res) => {
    const b = req.body;
    const blocked = await isAnyKeyBlocked(Array.isArray(b.keys) ? b.keys : []);
    res.json({ blocked });
  });
  app.post("/api/admin/blocked", requireAdmin, async (req, res) => {
    try {
      const b = req.body;
      const supabase = getSupabaseClient();
      const blockRows = [];
      if (b.emailBlockId) {
        blockRows.push({
          block_id: b.emailBlockId,
          block_type: "email",
          active: true,
          author_id: "admin"
        });
      }
      if (b.deviceBlockId) {
        blockRows.push({
          block_id: b.deviceBlockId,
          block_type: "device",
          active: true,
          author_id: "admin"
        });
      }
      if (b.uidBlockId) {
        blockRows.push({
          block_id: b.uidBlockId,
          block_type: "uid",
          active: true,
          author_id: "admin"
        });
      }
      if (blockRows.length > 0) {
        const { error: blockErr } = await supabase.from("blocked_users").upsert(blockRows);
        if (blockErr) {
          const formatted = formatSupabaseError(blockErr, "Failed to block user.");
          res.status(formatted.status).json({ error: formatted.message });
          return;
        }
      }
      const { data, error } = await supabase.from("blocked_user_records").insert({
        target_name: String(b.targetName || "Unknown").trim().slice(0, 120),
        target_email: b.targetEmail ? String(b.targetEmail).trim().slice(0, 160) : null,
        reason: b.reason ? String(b.reason).trim().slice(0, 400) : null,
        source: b.source || "manual",
        email_block_id: b.emailBlockId || null,
        device_block_id: b.deviceBlockId || null,
        uid_block_id: b.uidBlockId || null,
        author_id: "admin"
      }).select("*").single();
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to create block record.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ record: mapBlockedRecordRow(data) });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to block user.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.delete("/api/admin/blocked/:recordId", requireAdmin, async (req, res) => {
    try {
      const recordId = String(req.params.recordId || "");
      const supabase = getSupabaseClient();
      const { data: rec } = await supabase.from("blocked_user_records").select("email_block_id, device_block_id, uid_block_id").eq("id", recordId).maybeSingle();
      if (rec) {
        const r = rec;
        const keysToRemove = [r.email_block_id, r.device_block_id, r.uid_block_id].filter(
          (v) => Boolean(v)
        );
        if (keysToRemove.length > 0) {
          await supabase.from("blocked_users").delete().in("block_id", keysToRemove);
        }
      }
      const { error } = await supabase.from("blocked_user_records").delete().eq("id", recordId);
      if (error) {
        const formatted = formatSupabaseError(error, "Failed to unblock user.");
        res.status(formatted.status).json({ error: formatted.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const formatted = formatSupabaseError(err, "Failed to unblock user.");
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/chat", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: "GEMINI_API_KEY is not configured. Please check Settings > Secrets."
        });
        return;
      }
      const body = req.body;
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) {
        res.status(400).json({ error: "Messages array is required." });
        return;
      }
      const lang = body.language === "en" ? "English" : "Afaan Oromo";
      const ctx = body.siteContext || {};
      const skillsText = (ctx.skills || []).slice(0, 20).map((s) => `${s.name} (${s.category}, ${s.level}%)`).join(", ");
      const announcementsText = (ctx.announcements || []).slice(0, 5).map((a) => `- ${a.title}: ${a.content.slice(0, 180)}`).join("\n");
      const systemInstruction = [
        `You are the helpful, warm, concise AI assistant on ${ctx.ownerName || "the owner"}'s personal website.`,
        `Respond primarily in ${lang} unless the user writes in another language (such as English or Afaan Oromo), in which case match the user's language naturally.`,
        `Owner profile:`,
        `- Name: ${ctx.ownerName || "Daniel Biranu"}`,
        `- Role: ${ctx.roleTitle || "College of Computing Department of Information system for 2026 Gc"}`,
        `- Location: ${ctx.location || "Oromia / Ethiopia"}`,
        `- Email: ${ctx.email || "danielbiranu142@gmail.com"}`,
        `- Bio: ${ctx.bio || ""}`,
        skillsText ? `- Skills: ${skillsText}` : "",
        announcementsText ? `- Recent Announcements:
${announcementsText}` : "",
        `- Public Notes available: ${ctx.publicNotesCount ?? 0}, Public Files available: ${ctx.publicFilesCount ?? 0}.`,
        `Guide visitors to relevant sections (About, Skills, Announcements, Notes & Files Vault, Community Chat, or Contact form). Keep answers clear, accurate, and friendly.`
      ].filter(Boolean).join("\n");
      const contents = messages.slice(-12).map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: String(m.text || "").slice(0, 4e3) }]
      }));
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: "Empty response received from AI service." });
        return;
      }
      res.json({ reply });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI request failed.";
      console.error("Gemini chat error:", err);
      res.status(500).json({ error: message });
    }
  });
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    const message = err instanceof Error ? err.message : "Internal server error.";
    const status = typeof err === "object" && err !== null && "status" in err && typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ error: message });
  });
  return app;
}

// src/server/vercelEntry.ts
var cachedApp = null;
var initError = null;
try {
  cachedApp = createApiApp();
} catch (err) {
  initError = err;
}
function handler(req, res) {
  try {
    if (!cachedApp) {
      cachedApp = createApiApp();
    }
    cachedApp(req, res);
  } catch (err) {
    const activeErr = err || initError;
    const message = activeErr instanceof Error ? activeErr.message : "Server initialization error.";
    if (!res.headersSent) {
      res.status(500).setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: message }));
    }
  }
}
export {
  handler as default
};
