import { Eye, FileText, FolderOpen, Image as ImageIcon, Search, Video, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { UI_TEXT } from '../i18n';
import type { Language, NoteItem, SavedFileItem } from '../types';
import { formatBytes, formatTimestamp, resolveFileBlobUrl } from '../utils/format';

interface VaultSectionProps {
  lang: Language;
  notes: NoteItem[];
  files: SavedFileItem[];
}

function isTextReadableFile(file: SavedFileItem): boolean {
  const name = file.fileName.toLowerCase();
  return (
    file.mimeType.startsWith('text/') ||
    file.mimeType === 'application/json' ||
    file.mimeType === 'application/xml' ||
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.log')
  );
}

export function VaultSection({ lang, notes, files }: VaultSectionProps) {
  const t = UI_TEXT[lang].vault;
  const [activeTab, setActiveTab] = useState<'notes' | 'files'>('notes');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    item: SavedFileItem;
    url: string;
    revokeOnClose: boolean;
    textContent?: string;
    unsupportedInline?: boolean;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const source = activeTab === 'notes' ? notes : files;
    const set = new Set<string>();
    source.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [activeTab, notes, files]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((note) => {
      const catMatch = selectedCategory === 'ALL' || note.category === selectedCategory;
      const textMatch =
        !q ||
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [notes, search, selectedCategory]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => {
      const catMatch = selectedCategory === 'ALL' || file.category === selectedCategory;
      const textMatch =
        !q ||
        file.title.toLowerCase().includes(q) ||
        file.fileName.toLowerCase().includes(q) ||
        (file.description || '').toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [files, search, selectedCategory]);

  async function handleReadOnlyPreview(file: SavedFileItem) {
    setBusyFileId(file.id);
    setPreviewError(null);
    try {
      if (file.mimeType.startsWith('video/')) {
        let src = '';
        let revokeOnClose = false;
        try {
          const headRes = await fetch(file.downloadUrl, { method: 'HEAD' });
          if (headRes.ok) {
            src = file.downloadUrl;
          }
        } catch {
          // Fallback to blob
        }
        if (!src) {
          src = await resolveFileBlobUrl(file);
          revokeOnClose = true;
        }
        setPreviewFile({ item: file, url: src, revokeOnClose });
        return;
      }

      const blobUrl = await resolveFileBlobUrl(file);
      let textContent: string | undefined;
      let unsupportedInline = false;

      if (isTextReadableFile(file)) {
        const res = await fetch(blobUrl);
        textContent = await res.text();
      } else if (!file.mimeType.startsWith('image/') && file.mimeType !== 'application/pdf') {
        unsupportedInline = true;
      }

      setPreviewFile({ item: file, url: blobUrl, revokeOnClose: true, textContent, unsupportedInline });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview unavailable');
    } finally {
      setBusyFileId(null);
    }
  }

  return (
    <section id="vault" className="py-20 border-t border-sky-200/70 dark:border-sky-900/50 bg-sky-50/38 dark:bg-[#050d1e]/52">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-10">
          <div className="lg:col-span-7">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-3d-heading text-balance">
              {t.sectionTitle}
            </h2>
            <p className="mt-3 text-base text-slate-800 dark:text-slate-200 max-w-2xl leading-relaxed text-3d-copy">
              {t.subtitle}
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-white/80 dark:bg-[#0D1322] aspect-[4/3] max-h-56 w-full frame-3d">
              <img
                src="/src/assets/images/notes_archive_stilllife_1794987970897.jpg"
                alt="Notes and files archive"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Segmented tabs + search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-sky-200/70 dark:border-sky-900/60">
          <div className="flex items-center gap-1.5 p-1.5 panel-3d rounded-xl self-start">
            <button
              type="button"
              onClick={() => {
                setActiveTab('notes');
                setSelectedCategory('ALL');
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white btn-3d-primary'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t.notesTab} ({notes.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('files');
                setSelectedCategory('ALL');
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white btn-3d-primary'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t.filesTab} ({files.length})
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-blue-600 dark:text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/92 dark:bg-[#0a152a]/92 border border-sky-200 dark:border-sky-800/70 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-sky-500 input-3d"
            />
          </div>
        </div>

        {/* Category Filter Bar */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 text-white btn-3d-primary'
                    : 'bg-white/90 dark:bg-[#0a152a]/90 text-slate-700 dark:text-slate-200 border border-sky-200 dark:border-sky-800/70 btn-3d-secondary hover:text-blue-700 dark:hover:text-sky-300'
                }`}
              >
                {cat === 'ALL' ? t.allCategories : cat}
              </button>
            ))}
          </div>
        )}

        {previewError && (
          <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
            {previewError}
          </div>
        )}

        {/* Notes View */}
        {activeTab === 'notes' && (
          <div className="mt-8">
            {filteredNotes.length === 0 ? (
              <div className="py-12 px-6 text-center panel-3d rounded-2xl">
                <FileText className="w-8 h-8 text-blue-500/70 dark:text-sky-400/70 mx-auto mb-3" />
                <p className="text-sm text-slate-700 dark:text-slate-300">{t.emptyNotes}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredNotes.map((note) => (
                  <article
                    key={note.id}
                    className="card-3d rounded-2xl p-6 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <span className="font-semibold text-blue-700 dark:text-sky-400">{note.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatTimestamp(note.updatedAt || note.createdAt, lang)}</span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 leading-snug mb-2 text-3d-sub">
                        {note.title}
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-4 whitespace-pre-line">
                        {note.content}
                      </p>
                    </div>
                    <div className="mt-5 pt-4 border-t border-sky-100 dark:border-sky-900/60 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t.publicLabel}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedNote(note)}
                        className="text-xs font-semibold text-blue-700 dark:text-sky-400 hover:text-indigo-700 dark:hover:text-sky-300 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {t.readMore}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files View (Read-Only, Download Disabled) */}
        {activeTab === 'files' && (
          <div className="mt-8">
            {filteredFiles.length === 0 ? (
              <div className="py-12 px-6 text-center panel-3d rounded-2xl">
                <FolderOpen className="w-8 h-8 text-blue-500/70 dark:text-sky-400/70 mx-auto mb-3" />
                <p className="text-sm text-slate-700 dark:text-slate-300">{t.emptyFiles}</p>
              </div>
            ) : (
              <div className="panel-3d rounded-2xl divide-y divide-sky-100 dark:divide-sky-900/60 overflow-hidden">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 transition-colors"
                  >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-sky-800/60 flex items-center justify-center shrink-0 mt-0.5 text-blue-700 dark:text-sky-400">
                          {file.mimeType.startsWith('image/') ? (
                            <ImageIcon className="w-5 h-5" />
                          ) : file.mimeType.startsWith('video/') ? (
                            <Video className="w-5 h-5" />
                          ) : (
                            <FileText className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span className="font-semibold text-blue-700 dark:text-sky-400">{file.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-indigo-700 dark:text-blue-300">
                              {formatBytes(file.sizeBytes)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{file.fileName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-slate-600 dark:text-slate-400">
                              {t.readOnlyBadge}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                            {file.title}
                          </h3>
                          {file.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                              {file.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyFileId === file.id}
                          onClick={() => handleReadOnlyPreview(file)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 text-white rounded-lg btn-3d-primary transition-all whitespace-nowrap cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t.preview}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* Note Reader Modal */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
          onClick={() => setSelectedNote(null)}
        >
          <div
            className="panel-3d rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-700 dark:text-sky-400">{selectedNote.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatTimestamp(selectedNote.updatedAt || selectedNote.createdAt, lang)}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50 mt-0.5 truncate text-3d-sub">
                  {selectedNote.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                aria-label={t.close}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {selectedNote.content}
            </div>
          </div>
        </div>
      )}

      {/* Read-Only File Viewer Modal (No Download Allowed) */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => {
            if (previewFile.revokeOnClose) URL.revokeObjectURL(previewFile.url);
            setPreviewFile(null);
          }}
        >
          <div
            className="panel-3d rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                  {previewFile.item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                  {previewFile.item.fileName} · {formatBytes(previewFile.item.sizeBytes)} · {t.readOnlyBadge}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (previewFile.revokeOnClose) URL.revokeObjectURL(previewFile.url);
                    setPreviewFile(null);
                  }}
                  aria-label={t.close}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 bg-slate-100 dark:bg-[#070B14] flex items-center justify-center select-none">
              {previewFile.item.mimeType.startsWith('image/') && (
                <img
                  src={previewFile.url}
                  alt={previewFile.item.title}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="max-h-[70vh] w-auto rounded-lg object-contain select-none"
                />
              )}
              {previewFile.item.mimeType.startsWith('video/') && (
                <video
                  src={previewFile.url}
                  controls
                  controlsList="nodownload"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full max-h-[70vh] rounded-lg bg-black"
                />
              )}
              {previewFile.item.mimeType === 'application/pdf' && (
                <iframe
                  src={`${previewFile.url}#toolbar=0&navpanes=0`}
                  title={previewFile.item.title}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                />
              )}
              {previewFile.textContent !== undefined && (
                <pre
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full max-h-[70vh] overflow-auto p-5 bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-none"
                >
                  {previewFile.textContent}
                </pre>
              )}
              {previewFile.unsupportedInline && (
                <div className="max-w-md text-center p-8 bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-sky-400 mx-auto" />
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {t.readOnlyBadge}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.unsupportedInline}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
