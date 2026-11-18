# Security Specification — Biranu Personal Hub

## 1. Data Invariants
1. **Admin Authority**: Only verified `danielbiranu142@gmail.com` or UIDs registered in `/admins/{uid}` may mutate `site_profile`, `skills`, `announcements`, `notes`, `files`, `file_blobs`, `contact_exchanges`, `blocked_users`, `blocked_user_records`, or manage `contact_messages` and archived `live_chat_rooms`.
2. **Visibility Isolation**: Non-admin users can only read `announcements` where `isPublished == true`, and `notes`, `files`, `file_blobs` where `isPublic == true`. Private notes and files remain strictly confidential to the Admin.
3. **PII Protection**: `contact_messages` and `blocked_user_records` contain visitor email addresses and private details; `get`, `list`, `update`, and `delete` are strictly restricted to `isAdmin()`. Visitor-facing replies and files from the Admin are isolated in `/contact_exchanges/{trackingCode}` with zero PII fields, accessible only via single-document `get` using an unguessable tracking code (`>= 12` chars); `list` on `contact_exchanges` is restricted to `isAdmin()`.
4. **Blocking Enforcement**: Any sender matching a `blocked_users/{blockId}` entry (`uid_<uid>`, `em_<sha256>`, or `dv_<sha256>`) is denied `create` on `contact_messages`, `chat_messages`, `live_chat_rooms`, and `live_chat_rooms/{roomId}/messages`. `blocked_users` contains zero PII and `list` is restricted to `isAdmin()`.
5. **Ephemeral Visitor Live Chat / Permanent Admin Archive**: Visitors may only read or post inside an active `/live_chat_rooms/{roomId}` (`roomId.size() >= 24`, `visitorActive == true`) and its `/messages` where `visitorVisible == true` and `roomId` matches. `list` on `/live_chat_rooms` is strictly `isAdmin()`. Once ended (`visitorActive == false`), visitors lose read/write access while Admin retains full read, edit, and delete control.
6. **Community Chat Identity Integrity**: Authenticated, email-verified, non-blocked users may post `chat_messages` only with `senderId == request.auth.uid`, `isPinned == false` (unless admin), and `createdAt == request.time`. Only the sender or an admin may delete a message.
7. **Path ID & Payload Bounds**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), every string enforces `.size()` limits, media uploads validate `<= 104857600` bytes (100MB), and `hasAll`/`hasOnly` prevent shadow fields.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Shadow Field Injection on Profile**: Non-admin attempts `setDoc` on `site_profile/main` with `isAdmin: true`. -> Expect `PERMISSION_DENIED`.
2. **Private Note Scraping**: Unauthenticated or non-admin user attempts `getDocs(collection(db, 'notes'))` without `where('isPublic', '==', true)`. -> Expect `PERMISSION_DENIED`.
3. **Draft Announcement Leak**: Non-admin requests `getDoc(doc(db, 'announcements', 'draft_id'))` where `isPublished == false`. -> Expect `PERMISSION_DENIED`.
4. **Contact & Blocked Records Scraping**: Non-admin attempts `getDocs(collection(db, 'contact_messages'))`, `getDocs(collection(db, 'contact_exchanges'))`, `getDocs(collection(db, 'blocked_users'))`, or `getDocs(collection(db, 'blocked_user_records'))`. -> Expect `PERMISSION_DENIED`.
5. **Blocked Sender Bypass**: A blocked user (`uid_<uid>`, `em_<hash>`, or `dv_<hash>` present in `/blocked_users`) attempts `addDoc` to `contact_messages`, `chat_messages`, or `live_chat_rooms`. -> Expect `PERMISSION_DENIED`.
6. **Live Chat Archive Enumeration**: Non-admin attempts `getDocs(collection(db, 'live_chat_rooms'))` or guesses a short room ID (< 24 chars). -> Expect `PERMISSION_DENIED`.
7. **Ended Live Chat Replay**: Visitor attempts `getDoc` or `addDoc` on a `/live_chat_rooms/{roomId}` where `visitorActive == false`. -> Expect `PERMISSION_DENIED`.
8. **Live Chat Role Spoofing**: Non-admin visitor posts to `/live_chat_rooms/{roomId}/messages` with `senderRole: 'admin'` or `isEdited: true`. -> Expect `PERMISSION_DENIED`.
9. **Chat Identity & Pin Spoofing**: Signed-in user posts `chat_messages` with `senderId: 'other_uid'` or `isPinned: true`. -> Expect `PERMISSION_DENIED`.
10. **Self-Admin & Blocklist Tampering**: Non-admin attempts write to `/admins/{uid}` or `/blocked_users/{blockId}`. -> Expect `PERMISSION_DENIED`.
11. **Timestamp Forgery & ID Poisoning**: Client submits backdated `createdAt` or document ID > 128 chars. -> Expect `PERMISSION_DENIED`.
12. **Contact Status / Reply Tampering on Create**: Visitor submits `contact_messages` with `status: 'read'` or `hasReply: true`, or attempts to write to `contact_exchanges`. -> Expect `PERMISSION_DENIED`.
