// src/components/editor/CollaborativeEditor.tsx
// Features: Collaboration, Line-Level Locking, Revision History (modal with preview), Snapshot Compare

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Snapshot from "@tiptap-pro/extension-snapshot";
import { watchPreviewContent } from "@tiptap-pro/extension-snapshot";
import { SnapshotCompare, getVersions } from "@tiptap-pro/extension-snapshot-compare";
import { TiptapCollabProvider } from "@tiptap-pro/provider";
import * as Y from "yjs";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { api } from "@/lib/api";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link,
  Image,
  Loader2,
  Check,
  Save,
  Users,
  History,
  X,
  RotateCcw,
  Lock,
  Bookmark,
  GitCompare,
  Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CollaborativeEditorProps {
  documentName: string;
  token: string;
  appId: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
  placeholder?: string;
  initialContent?: string | null;
  onSave?: (content: { html: string; json: object }) => Promise<void>;
  onContentChange?: (hasContent: boolean) => void;
  maxChars?: number;
  answeredAt?: string | null;
}

interface OnlineUser {
  name: string;
  color: string;
  clientId: number;
}

interface VersionInfo {
  version: number;
  name?: string;
  date: number;
}

interface LineLock {
  paragraphIndex: number;
  userName: string;
  userColor: string;
  userId: string;
  clientId: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
        <Lock size={12} /> {message}
      </div>
    </div>
  );
}

const renderCaret = (user: { name: string; color: string }) => {
  const cursor = document.createElement("span");
  cursor.classList.add("collaboration-cursor__caret");
  cursor.style.borderColor = user.color;
  const label = document.createElement("span");
  label.classList.add("collaboration-cursor__label");
  label.style.backgroundColor = user.color;
  label.textContent = user.name;
  cursor.appendChild(label);
  return cursor;
};

function getParagraphIndexAtPos(pos: number, doc: any): number | null {
  try {
    const resolved = doc.resolve(pos);
    return resolved.depth >= 1 ? resolved.index(0) : null;
  } catch { return null; }
}

const lineLockPluginKey = new PluginKey("lineLock");

function renderDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function getVersionName(v: VersionInfo): string {
  if (v.name) return v.name;
  return `Version ${v.version + 1}`;
}

// ─── Version History Modal ───────────────────────────────────────────────────

const VersioningModal = memo(({
  versions,
  isOpen,
  onClose,
  onRevert,
  onSaveVersion,
  currentVersion,
  latestVersion,
  provider,
  resolveUser,
  fetchUserDetails,
}: {
  versions: VersionInfo[];
  isOpen: boolean;
  onClose: () => void;
  onRevert: (version: number, versionData: VersionInfo | null) => void;
  onSaveVersion: (name: string) => void;
  currentVersion: number;
  latestVersion: number;
  provider: TiptapCollabProvider | null;
  resolveUser: (userId: string) => { name: string; color: string };
  fetchUserDetails: (userIds: string[]) => Promise<void>;
}) => {
  const [activeTab, setActiveTab] = useState<"history" | "compare">("history");
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [diffUsers, setDiffUsers] = useState<Array<{ id: string; name: string; color: string }>>([]);

  // Resolved user data cache: userId → { name, color }
  // Separate read-only editor for previewing version content — includes SnapshotCompare
  const previewEditor = useEditor({
    editable: false,
    content: "",
    extensions: [
      StarterKit,
      ...(provider ? [
        SnapshotCompare.configure({ provider }),
      ] : []),
    ],
    immediatelyRender:false
  });

  const reversedVersions = useMemo(() => [...versions].reverse(), [versions]);
  const isCurrentVersion = versions.length > 0 ? selectedVersionId === versions[versions.length - 1]?.version : false;

  const selectedVersionData = useMemo(
    () => versions.find((v) => v.version === selectedVersionId) ?? null,
    [selectedVersionId, versions]
  );

  // When modal opens, auto-select latest version
  useEffect(() => {
    if (isOpen && selectedVersionId === null && versions.length > 0) {
      const initialVersion = versions[versions.length - 1].version;
      setSelectedVersionId(initialVersion);
      setActiveTab("history");
      if (provider) {
        provider.sendStateless(
          JSON.stringify({ action: "version.preview", version: initialVersion })
        );
      }
    }
  }, [isOpen, selectedVersionId, versions, provider]);

  // Watch for preview content from server and feed into preview editor
  useEffect(() => {
    if (isOpen && provider) {
      const unbind = watchPreviewContent(provider, (content: any) => {
        if (previewEditor) {
          previewEditor.commands.setContent(content);
        }
      });
      return () => { unbind(); };
    }
  }, [isOpen, provider, previewEditor]);

  const handleVersionClick = useCallback((versionId: number) => {
    setSelectedVersionId(versionId);
    if (provider) {
      provider.sendStateless(
        JSON.stringify({ action: "version.preview", version: versionId })
      );
    }
  }, [provider]);

  const handleCompareClick = useCallback(async (versionId: number) => {
    if (!previewEditor || !provider) return;

    // Clear any existing diff
    if (previewEditor.can().hideDiff()) {
      previewEditor.chain().hideDiff().run();
    }

    setCompareVersionId(versionId);
    setIsComparing(true);

    if (versionId === 0) {
      provider.sendStateless(
        JSON.stringify({ action: "version.preview", version: versionId })
      );
      return;
    }

    try {
      const versionsResolved: any = await getVersions({
        provider,
        fromVersion: versionId - 1,
        toVersion: versionId,
      });

      // First pass: run compare to collect user IDs
      const collectedUserIds = new Set<string>();

      previewEditor
        .chain()
        .compareVersions({
          snapshot: versionsResolved.snapshot,
          prevSnapshot: versionsResolved.prevSnapshot,
          hydrateUserData: ({ userId }: { userId: string | undefined }) => {
            const uid = userId || "unknown";
            collectedUserIds.add(uid);
            // Use whatever we have cached for now
            const data = resolveUser(uid);
            return {
              name: data.name,
              color: {
                color: "#000",
                backgroundColor: `${data.color}40`,
                delete: { color: "#777", backgroundColor: `${data.color}25`, textDecoration: "line-through" },
              },
            };
          },
          onCompare: (ctx: any) => {
            if (ctx.error) { console.error("Compare error:", ctx.error); return; }
            previewEditor.commands.showDiff(ctx.tr);

            // Also collect from diffs
            const diffs = ctx.diffSet || ctx.diffs || [];
            if (Array.isArray(diffs)) {
              diffs.forEach((diff: any) => {
                const uid = diff.attribution?.userId || diff.userId;
                if (uid) collectedUserIds.add(uid);
              });
            }
            if (previewEditor.storage?.snapshotCompare?.diffs) {
              previewEditor.storage.snapshotCompare.diffs.forEach((diff: any) => {
                if (diff.attribution?.userId) collectedUserIds.add(diff.attribution.userId);
              });
            }
          },
        })
        .run();

      // Now fetch unknown users from API
      const unknownIds = Array.from(collectedUserIds).filter(
        id => id !== "unknown" && resolveUser(id).name.startsWith("User ")
      );

      if (unknownIds.length > 0) {
        await fetchUserDetails(unknownIds);

        // Re-run compare with resolved names
        if (previewEditor.can().hideDiff()) {
          previewEditor.chain().hideDiff().run();
        }

        previewEditor
          .chain()
          .compareVersions({
            snapshot: versionsResolved.snapshot,
            prevSnapshot: versionsResolved.prevSnapshot,
            hydrateUserData: ({ userId }: { userId: string | undefined }) => {
              const uid = userId || "unknown";
              const data = resolveUser(uid);
              return {
                name: data.name,
                color: {
                  color: "#000",
                  backgroundColor: `${data.color}40`,
                  delete: { color: "#777", backgroundColor: `${data.color}25`, textDecoration: "line-through" },
                },
              };
            },
            onCompare: (ctx: any) => {
              if (ctx.error) { console.error("Compare error:", ctx.error); return; }
              previewEditor.commands.showDiff(ctx.tr);
            },
          })
          .run();
      }

      // Build legend with resolved names
      const userSet = new Map<string, { id: string; name: string; color: string }>();
      collectedUserIds.forEach((uid) => {
        if (uid !== "unknown") {
          const data = resolveUser(uid);
          userSet.set(uid, { id: uid, name: data.name, color: data.color });
        }
      });
      setDiffUsers(Array.from(userSet.values()));

    } catch (err) {
      console.error("Compare error:", err);
    }
  }, [previewEditor, provider, resolveUser, fetchUserDetails]);

  const handleClose = useCallback(() => {
    if (isComparing && previewEditor && previewEditor.can().hideDiff()) {
      try { previewEditor.chain().hideDiff().run(); } catch {}
    }
    onClose();
    setSelectedVersionId(null);
    setCompareVersionId(null);
    setIsComparing(false);
    setDiffUsers([]);
    setActiveTab("history");
    previewEditor?.commands.clearContent();
  }, [onClose, previewEditor, isComparing]);

  const handleRevert = useCallback(() => {
    if (selectedVersionId == null) return;
    const accepted = window.confirm(
      "Are you sure you want to restore this version? Any unversioned changes will be lost."
    );
    if (accepted) {
      onRevert(selectedVersionId, selectedVersionData);
      handleClose();
    }
  }, [selectedVersionId, selectedVersionData, onRevert, handleClose]);

  const handleSave = useCallback(() => {
    const name = versionName.trim() || `Version ${latestVersion + 1}`;
    onSaveVersion(name);
    setVersionName("");
  }, [versionName, latestVersion, onSaveVersion]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[95%] max-w-[900px] h-[80vh] max-h-[700px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <History size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Version History</h2>
              <p className="text-xs text-gray-400">
                {versions.length} version{versions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5 flex-shrink-0">
          <button
            onClick={() => {
              if (isComparing && previewEditor && previewEditor.can().hideDiff()) {
                try { previewEditor.chain().hideDiff().run(); } catch {}
                setIsComparing(false);
                setCompareVersionId(null);
                setDiffUsers([]);
              }
              setActiveTab("history");
              // Re-select the latest version for preview
              if (versions.length > 0 && provider) {
                const latestV = versions[versions.length - 1].version;
                setSelectedVersionId(latestV);
                provider.sendStateless(JSON.stringify({ action: "version.preview", version: latestV }));
              }
            }}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Clock size={13} /> Versions
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "compare" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <GitCompare size={13} /> Compare
          </button>
        </div>

        {/* Body — two column layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left — Preview content */}
          <div className="flex-1 overflow-y-auto border-r border-gray-100 bg-white">
            <div className="p-5">
              {/* User attribution legend — only in Compare tab */}
              {activeTab === "compare" && isComparing && diffUsers.length > 0 && (
                <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">Changes by:</span>
                  {diffUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: u.color }} />
                      <span className="text-xs font-medium text-gray-700">{u.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Comparing banner — only in Compare tab */}
              {activeTab === "compare" && isComparing && compareVersionId != null && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <GitCompare size={14} className="text-amber-600 flex-shrink-0" />
                  <span className="text-xs text-amber-800">
                    Comparing <strong>{getVersionName(versions.find(v => v.version === compareVersionId) || { version: compareVersionId ?? 0 } as VersionInfo)}</strong> with <strong>{getVersionName(versions.find(v => v.version === (compareVersionId ?? 1) - 1) || { version: Math.max(0, (compareVersionId ?? 1) - 1) } as VersionInfo)}</strong>
                  </span>
                </div>
              )}
              {previewEditor ? (
                <EditorContent editor={previewEditor} />
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  Select a version to preview
                </div>
              )}
            </div>
          </div>

          {/* Right — Sidebar */}
          <div className="w-[280px] flex-shrink-0 flex flex-col bg-gray-50/50">
            {activeTab === "history" && (
              <>
                {/* Save new version */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="Version name (optional)"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                  />
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Bookmark size={12} /> Save
                  </button>
                </div>

                {/* Version list */}
                <div className="flex-1 overflow-y-auto">
                  {reversedVersions.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Clock size={20} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-xs text-gray-400">No versions yet</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {reversedVersions.map((v) => (
                        <button
                          key={v.version}
                          type="button"
                          onClick={() => handleVersionClick(v.version)}
                          className={`w-full text-left px-4 py-2.5 transition-colors group ${
                            selectedVersionId === v.version
                              ? "bg-white shadow-sm border-l-2 border-blue-600"
                              : "hover:bg-white/80 border-l-2 border-transparent"
                          }`}
                        >
                          <p className={`text-xs font-medium truncate ${
                            selectedVersionId === v.version ? "text-blue-700" : "text-gray-700"
                          }`}>
                            {getVersionName(v)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {v.date ? renderDate(v.date) : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom actions */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0">
                  <button onClick={handleClose} className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                    Close
                  </button>
                  <button
                    onClick={handleRevert}
                    disabled={!selectedVersionData || isCurrentVersion}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                </div>
              </>
            )}

            {activeTab === "compare" && (
              <>
                {/* Compare info */}
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs text-gray-500">
                    Click a version to compare it with the latest. Changes are highlighted in the preview.
                  </p>
                </div>

                {/* Version list for compare */}
                <div className="flex-1 overflow-y-auto">
                  {reversedVersions.length < 2 ? (
                    <div className="px-4 py-10 text-center">
                      <GitCompare size={20} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-xs text-gray-400">Need at least 2 versions to compare</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {reversedVersions.map((v) => {
                        const isFirst = v.version === 0;
                        const isSelected = compareVersionId === v.version;
                        return (
                          <button
                            key={v.version}
                            type="button"
                            onClick={() => {
                              if (!isFirst) handleCompareClick(v.version);
                            }}
                            disabled={isFirst}
                            className={`w-full text-left px-4 py-2.5 transition-colors ${
                              isFirst
                                ? "opacity-40 cursor-default"
                                : isSelected
                                  ? "bg-white shadow-sm border-l-2 border-blue-600"
                                  : "hover:bg-white/80 border-l-2 border-transparent"
                            }`}
                          >
                            <p className={`text-xs font-medium truncate ${
                              isSelected ? "text-blue-700" : isFirst ? "text-gray-400" : "text-gray-700"
                            }`}>
                              {getVersionName(v)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {v.date ? renderDate(v.date) : ""}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom actions */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0">
                  <button onClick={handleClose} className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                    Close
                  </button>
                  {compareVersionId != null && (
                    <button
                      onClick={() => {
                        const vData = versions.find((v) => v.version === compareVersionId) ?? null;
                        const accepted = window.confirm("Restore this version? Unversioned changes will be lost.");
                        if (accepted) {
                          onRevert(compareVersionId, vData);
                          handleClose();
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

VersioningModal.displayName = "VersioningModal";

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CollaborativeEditor({
  documentName,
  token,
  appId,
  user,
  placeholder = "Start typing your answer or select an AI suggestion from the right panel...",
  initialContent = null,
  onSave,
  onContentChange,
  maxChars = 3000,
  answeredAt,
}: CollaborativeEditorProps) {
  const [isSynced, setIsSynced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [latestVersion, setLatestVersion] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const [lockedLines, setLockedLines] = useState<Map<number, LineLock>>(new Map());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastBroadcastedParagraph = useRef<number | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  const initialContentLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  const autoVersioningEnabledRef = useRef(false);

  const lockedLinesRef = useRef(lockedLines);
  useEffect(() => { lockedLinesRef.current = lockedLines; }, [lockedLines]);
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => { onContentChangeRef.current = onContentChange; }, [onContentChange]);
  const toastRef = useRef(setToastMessage);

  const updateOnlineUsers = useCallback((provider: TiptapCollabProvider) => {
    if (!provider.awareness) return;
    const myClientId = provider.awareness.clientID;
    const states = provider.awareness.getStates();
    const usersMap = new Map<string, OnlineUser>();
    states.forEach((state: any, clientId: number) => {
      if (!state?.user?.name || clientId === myClientId) return;
      if (!usersMap.has(state.user.name)) {
        usersMap.set(state.user.name, { name: state.user.name, color: state.user.color || "#3B82F6", clientId });
      }
    });
    setOnlineUsers(Array.from(usersMap.values()));
  }, []);

  const updateLockedLines = useCallback((provider: TiptapCollabProvider) => {
    if (!provider.awareness) return;
    const myClientId = provider.awareness.clientID;
    const states = provider.awareness.getStates();
    const newLocks = new Map<number, LineLock>();
    states.forEach((state: any, clientId: number) => {
      if (clientId === myClientId) return;
      if (state?.lockedParagraph != null && state?.user) {
        newLocks.set(state.lockedParagraph, {
          paragraphIndex: state.lockedParagraph,
          userName: state.user.name,
          userColor: state.user.color || "#3B82F6",
          userId: state.user.id || "",
          clientId,
        });
      }
    });
    setLockedLines(newLocks);
  }, []);

  const broadcastActiveParagraph = useCallback((paragraphIndex: number | null) => {
    if (!providerRef.current) return;
    if (lastBroadcastedParagraph.current === paragraphIndex) return;
    lastBroadcastedParagraph.current = paragraphIndex;
    providerRef.current.setAwarenessField("lockedParagraph", paragraphIndex);
  }, []);

  // Initialize Y.Doc and Provider
  useEffect(() => {
    mountedRef.current = true;
    initialContentLoadedRef.current = false;
    autoVersioningEnabledRef.current = false;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new TiptapCollabProvider({
      appId, name: documentName, token, document: ydoc, user: user.id,
      onSynced() { if (mountedRef.current) { setIsSynced(true); setIsConnecting(false); } },
      onConnect() {},
      onDisconnect() { if (mountedRef.current) { setIsSynced(false); setIsConnecting(true); } },
      onStatus({ status }) {
        if (mountedRef.current && status === "connected" && provider.isSynced) { setIsSynced(true); setIsConnecting(false); }
      },
      onAwarenessUpdate() {
        if (!mountedRef.current || !provider.awareness) return;
        updateOnlineUsers(provider); updateLockedLines(provider);
      },
    });

    providerRef.current = provider;
    provider.setAwarenessField("user", { id: user.id, name: user.name, color: user.color });

    const handleAwarenessChange = () => {
      if (!mountedRef.current) return;
      updateOnlineUsers(provider); updateLockedLines(provider);
    };
    provider.awareness?.on("change", handleAwarenessChange);
    provider.awareness?.on("update", handleAwarenessChange);

    const checkSyncTimer = setTimeout(() => {
      if (mountedRef.current && provider.isSynced) { setIsSynced(true); setIsConnecting(false); }
    }, 100);

    setEditorReady(true);

    return () => {
      mountedRef.current = false;
      clearTimeout(checkSyncTimer);
      provider.awareness?.off("change", handleAwarenessChange);
      provider.awareness?.off("update", handleAwarenessChange);
      if (provider.awareness) provider.awareness.setLocalState(null);
      provider.destroy(); ydoc.destroy();
      providerRef.current = null; ydocRef.current = null;
      setEditorReady(false); setIsSynced(false); setIsConnecting(true); setOnlineUsers([]);
    };
  }, [documentName, token, appId, user.id, user.name, user.color]);

  // Create Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false } as any),
      Underline,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
      ...(ydocRef.current ? [Collaboration.configure({ document: ydocRef.current })] : []),
      ...(providerRef.current ? [
        CollaborationCaret.configure({ provider: providerRef.current, user: { name: user.name, color: user.color }, render: renderCaret }),
        Snapshot.configure({
          provider: providerRef.current,
          onUpdate(payload: any) {
            if (!mountedRef.current) return;
            setCurrentVersion(payload.currentVersion || 0);
            setLatestVersion(payload.version || 0);
            setVersions(payload.versions || []);
          },
        }),
      ] : []),
    ],
    editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3" } },
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      setCharCount(ed.getText().length);
      if (onContentChangeRef.current) {
        const text = ed.getText();
        onContentChangeRef.current(text.trim().length > 0 && ed.getHTML() !== "<p></p>");
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      broadcastActiveParagraph(getParagraphIndexAtPos(ed.state.selection.from, ed.state.doc));
    },
  }, [editorReady, user.name, user.color, placeholder]);

  // Auto-enable versioning
  useEffect(() => {
    if (!editor || !isSynced || autoVersioningEnabledRef.current) return;
    autoVersioningEnabledRef.current = true;
    try { editor.commands.toggleVersioning(); } catch {}
  }, [editor, isSynced]);

  // Line Lock Plugin
  useEffect(() => {
    if (!editor) return;
    const plugin = new Plugin({
      key: lineLockPluginKey,
      filterTransaction(tr, state) {
        if (!tr.docChanged) return true;
        const locks = lockedLinesRef.current;
        if (locks.size === 0) return true;
        for (const step of (tr as any).steps) {
          const from = (step as any).from; const to = (step as any).to;
          if (from == null || to == null) continue;
          try {
            const fromIdx = getParagraphIndexAtPos(from, state.doc);
            if (fromIdx == null) continue;
            const toIdx = getParagraphIndexAtPos(to, state.doc) ?? fromIdx;
            for (let idx = fromIdx; idx <= toIdx; idx++) {
              const lock = locks.get(idx);
              if (lock) { toastRef.current(`This line is being edited by ${lock.userName}`); return false; }
            }
          } catch {}
        }
        return true;
      },
      appendTransaction(transactions, _oldState, newState) {
        // Redirect cursor away from locked paragraphs
        const locks = lockedLinesRef.current;
        if (locks.size === 0) return null;

        const { from } = newState.selection;
        const cursorIdx = getParagraphIndexAtPos(from, newState.doc);
        if (cursorIdx == null) return null;

        const lock = locks.get(cursorIdx);
        if (!lock) return null;

        // Find nearest unlocked paragraph
        const nodeCount = newState.doc.childCount;
        // Try moving down first, then up
        for (let offset = 1; offset < nodeCount; offset++) {
          for (const dir of [1, -1]) {
            const tryIdx = cursorIdx + offset * dir;
            if (tryIdx >= 0 && tryIdx < nodeCount && !locks.has(tryIdx)) {
              // Calculate position of this paragraph
              let pos = 0;
              for (let i = 0; i < tryIdx; i++) {
                pos += newState.doc.child(i).nodeSize;
              }
              const targetPos = pos + 1; // +1 to get inside the paragraph
              if (targetPos >= 0 && targetPos <= newState.doc.content.size) {
                const { tr } = newState;
                try {
                  const resolvedPos = newState.doc.resolve(targetPos);
                  tr.setSelection(TextSelection.near(resolvedPos));
                  return tr;
                } catch { /* fall through */ }
              }
            }
          }
        }
        return null;
      },
    });
    const pluginRef = plugin;
    const newState = editor.state.reconfigure({ plugins: [...editor.state.plugins, pluginRef] });
    editor.view.updateState(newState);
    return () => {
      try {
        editor.view.updateState(editor.state.reconfigure({ plugins: editor.state.plugins.filter((p) => p !== pluginRef) }));
      } catch {}
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const h = () => broadcastActiveParagraph(getParagraphIndexAtPos(editor.state.selection.from, editor.state.doc));
    editor.on("transaction", h);
    return () => { editor.off("transaction", h); };
  }, [editor, broadcastActiveParagraph]);

  // Load initial content
  useEffect(() => {
    if (!editor || !isSynced || !ydocRef.current || initialContentLoadedRef.current) return;
    const ydoc = ydocRef.current;
    const yXml = ydoc.getXmlFragment("default");
    const configMap = ydoc.getMap("config");
    if (yXml.length > 0 || configMap.get("initialContentLoaded")) {
      initialContentLoadedRef.current = true;
    } else if (initialContent) {
      configMap.set("initialContentLoaded", true);
      initialContentLoadedRef.current = true;
      editor.commands.setContent(initialContent);
    } else { initialContentLoadedRef.current = true; }
    setCharCount(editor.getText().length);
  }, [editor, isSynced, initialContent]);

  // Handlers
  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;
    setIsSaving(true); setSaveStatus("saving");
    try {
      await onSave({ html: editor.getHTML(), json: editor.getJSON() });
      setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000);
    } catch { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 3000); }
    finally { setIsSaving(false); }
  }, [editor, onSave]);

  // User cache: userId → { name, color } — populated from API
  const userCacheRef = useRef<Map<string, { name: string; color: string }>>(new Map());

  // Fetch user details from API and update cache
  const fetchUserDetails = useCallback(async (userIds: string[]) => {
    // Filter out already cached and current user
    const toFetch = userIds.filter(id =>
      !userCacheRef.current.has(id) && id !== user.id
    );
    if (toFetch.length === 0) return;

    try {
      const data = await api.collaboration.getUsers(toFetch);
      if (data.users) {
        Object.entries(data.users).forEach(([id, userData]: [string, any]) => {
          userCacheRef.current.set(id, { name: userData.name, color: userData.color });
        });
      }
    } catch (err) {
      console.error("Failed to fetch user details:", err);
    }
  }, [user.id]);

  // Synchronous resolve — returns cached data or fallback
  const resolveUser = useCallback((userId: string): { name: string; color: string } => {
    // 1. Current user
    if (userId === user.id) return { name: user.name, color: user.color };

    // 2. Check cache (populated from API)
    const cached = userCacheRef.current.get(userId);
    if (cached) return cached;

    // 3. Check awareness states (online users)
    if (providerRef.current?.awareness) {
      const states = providerRef.current.awareness.getStates();
      for (const [, state] of states) {
        if (state?.user?.id === userId && state.user.name) {
          const result = { name: state.user.name, color: state.user.color || "#3B82F6" };
          userCacheRef.current.set(userId, result); // cache it
          return result;
        }
      }
    }

    // 4. Fallback
    return { name: `User ${userId.slice(-6)}`, color: "#94A3B8" };
  }, [user.id, user.name, user.color]);

  const handleSaveVersion = useCallback((name: string) => {
    if (editor) editor.commands.saveVersion(name);
  }, [editor]);

  const handleRevertToVersion = useCallback((version: number, versionData: VersionInfo | null) => {
    if (!editor) return;
    const title = versionData ? versionData.name || renderDate(versionData.date) : `v${version}`;
    editor.commands.revertToVersion(version, `Restored to ${title}`, `Backup before restore to ${title}`);
  }, [editor]);

  if (!editorReady || !editor) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span>Loading editor...</span></div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden relative">
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSynced ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-xs text-gray-500">{isSynced ? "Synced" : isConnecting ? "Connecting..." : "Disconnected"}</span>
          </div>
          {answeredAt && <p className="text-xs text-gray-500">Last saved: {new Date(answeredAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-3">
          {lockedLines.size > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400"><Lock size={12} /><span>{lockedLines.size} line{lockedLines.size > 1 ? "s" : ""} locked</span></div>
          )}
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            <div className="flex -space-x-2">
              {onlineUsers.map((u) => (
                <div key={u.name} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm" style={{ backgroundColor: u.color }} title={u.name}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm" style={{ backgroundColor: user.color }} title={`${user.name} (you)`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-xs text-gray-500">{onlineUsers.length + 1} online</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold"><Bold size={16} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic"><Italic size={16} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline"><UnderlineIcon size={16} /></ToolbarButton>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List"><List size={16} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List"><ListOrdered size={16} /></ToolbarButton>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolbarButton onClick={() => {}} isActive={false} title="Insert Link"><Link size={16} /></ToolbarButton>
          <ToolbarButton onClick={() => {}} isActive={false} title="Insert Image"><Image size={16} /></ToolbarButton>
        </div>
        <ToolbarButton onClick={() => setShowModal(true)} isActive={showModal} title="Version History"><History size={16} /></ToolbarButton>
      </div>

      {/* Editor */}
      <div className="relative min-h-[200px] max-h-[350px] overflow-y-auto cursor-text"
        onMouseDown={(e) => {
          if (!editor) return;
          const target = e.target as HTMLElement;
          if (target.closest("p, li, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, code, a, img, table")) return;
          const pm = (e.currentTarget as HTMLElement).querySelector(".ProseMirror");
          if (!pm) return;
          const last = pm.lastElementChild;
          if (!last) { editor.commands.focus(); return; }
          if (e.clientY <= last.getBoundingClientRect().bottom) return;
          e.preventDefault();
          const { doc } = editor.state;
          const lastNode = doc.lastChild;
          if (lastNode?.type.name === "paragraph" && lastNode.content.size === 0) { editor.commands.focus("end"); }
          else { editor.chain().insertContentAt(doc.content.size, { type: "paragraph" }).focus("end").run(); }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
        {onSave && (
          <button onClick={handleSave} disabled={isSaving || !isSynced}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saveStatus === "saved" ? "bg-green-50 text-green-700 border border-green-200"
              : saveStatus === "error" ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            }`}>
            {isSaving ? (<><Loader2 size={14} className="animate-spin" />Saving...</>)
            : saveStatus === "saved" ? (<><Check size={14} />Saved</>)
            : saveStatus === "error" ? "Save Failed"
            : (<><Save size={14} />Save Draft</>)}
          </button>
        )}
      </div>

      {/* Version History Modal */}
      <VersioningModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        versions={versions}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        provider={providerRef.current}
        resolveUser={resolveUser}
        fetchUserDetails={fetchUserDetails}
        onSaveVersion={handleSaveVersion}
        onRevert={handleRevertToVersion}
      />
    </div>
  );
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({ onClick, isActive, title, children, disabled = false }: {
  onClick: () => void; isActive: boolean; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`p-2 rounded-lg transition-colors ${
        disabled ? "text-gray-300 cursor-not-allowed"
        : isActive ? "bg-blue-100 text-blue-600"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`} title={title}>
      {children}
    </button>
  );
}


































































// // src/components/editor/CollaborativeEditor.tsx
// // Features: Collaboration, Line-Level Locking, Revision History (modal with preview), Snapshot Compare

// "use client";

// import { useEditor, EditorContent } from "@tiptap/react";
// import StarterKit from "@tiptap/starter-kit";
// import Underline from "@tiptap/extension-underline";
// import Placeholder from "@tiptap/extension-placeholder";
// import Collaboration from "@tiptap/extension-collaboration";
// import CollaborationCaret from "@tiptap/extension-collaboration-caret";
// import Snapshot from "@tiptap-pro/extension-snapshot";
// import { watchPreviewContent } from "@tiptap-pro/extension-snapshot";
// import { SnapshotCompare, getVersions } from "@tiptap-pro/extension-snapshot-compare";
// import { TiptapCollabProvider } from "@tiptap-pro/provider";
// import * as Y from "yjs";
// import { Plugin, PluginKey } from "prosemirror-state";
// import {
//   useEffect,
//   useState,
//   useRef,
//   useCallback,
//   useMemo,
//   memo,
// } from "react";
// import {
//   Bold,
//   Italic,
//   Underline as UnderlineIcon,
//   List,
//   ListOrdered,
//   Link,
//   Image,
//   Loader2,
//   Check,
//   Save,
//   Users,
//   History,
//   X,
//   RotateCcw,
//   Lock,
//   Bookmark,
//   GitCompare,
//   Clock,
// } from "lucide-react";

// // ─── Types ───────────────────────────────────────────────────────────────────

// interface CollaborativeEditorProps {
//   documentName: string;
//   token: string;
//   appId: string;
//   user: {
//     id: string;
//     name: string;
//     color: string;
//   };
//   placeholder?: string;
//   initialContent?: string | null;
//   onSave?: (content: { html: string; json: object }) => Promise<void>;
//   onContentChange?: (hasContent: boolean) => void;
//   maxChars?: number;
//   answeredAt?: string | null;
// }

// interface OnlineUser {
//   name: string;
//   color: string;
//   clientId: number;
// }

// interface VersionInfo {
//   version: number;
//   name?: string;
//   date: number;
// }

// interface LineLock {
//   paragraphIndex: number;
//   userName: string;
//   userColor: string;
//   userId: string;
//   clientId: number;
// }

// // ─── Helpers ─────────────────────────────────────────────────────────────────

// function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
//   useEffect(() => {
//     const timer = setTimeout(onDismiss, 2500);
//     return () => clearTimeout(timer);
//   }, [onDismiss]);
//   return (
//     <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
//       <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
//         <Lock size={12} /> {message}
//       </div>
//     </div>
//   );
// }

// const renderCaret = (user: { name: string; color: string }) => {
//   const cursor = document.createElement("span");
//   cursor.classList.add("collaboration-cursor__caret");
//   cursor.style.borderColor = user.color;
//   const label = document.createElement("span");
//   label.classList.add("collaboration-cursor__label");
//   label.style.backgroundColor = user.color;
//   label.textContent = user.name;
//   cursor.appendChild(label);
//   return cursor;
// };

// function getParagraphIndexAtPos(pos: number, doc: any): number | null {
//   try {
//     const resolved = doc.resolve(pos);
//     return resolved.depth >= 1 ? resolved.index(0) : null;
//   } catch { return null; }
// }

// const lineLockPluginKey = new PluginKey("lineLock");

// function renderDate(timestamp: number): string {
//   const d = new Date(timestamp);
//   const day = String(d.getDate()).padStart(2, "0");
//   const month = String(d.getMonth() + 1).padStart(2, "0");
//   const year = d.getFullYear();
//   const hours = String(d.getHours()).padStart(2, "0");
//   const minutes = String(d.getMinutes()).padStart(2, "0");
//   return `${day}.${month}.${year} ${hours}:${minutes}`;
// }

// function getVersionName(v: VersionInfo): string {
//   if (v.name) return v.name;
//   if (v.version === 0) return "Initial version";
//   return `Version ${v.version}`;
// }

// // ─── Version History Modal ───────────────────────────────────────────────────

// const VersioningModal = memo(({
//   versions,
//   isOpen,
//   onClose,
//   onRevert,
//   onSaveVersion,
//   currentVersion,
//   latestVersion,
//   provider,
// }: {
//   versions: VersionInfo[];
//   isOpen: boolean;
//   onClose: () => void;
//   onRevert: (version: number, versionData: VersionInfo | null) => void;
//   onSaveVersion: (name: string) => void;
//   currentVersion: number;
//   latestVersion: number;
//   provider: TiptapCollabProvider | null;
// }) => {
//   const [activeTab, setActiveTab] = useState<"history" | "compare">("history");
//   const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
//   const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
//   const [isComparing, setIsComparing] = useState(false);
//   const [versionName, setVersionName] = useState("");
//   const [diffUsers, setDiffUsers] = useState<string[]>([]);

//   // Color mapping for user attribution in diffs
//   const colorMappingRef = useRef<Map<string, string>>(new Map());
//   const diffColors = ["#FAF594", "#958DF1", "#F98181", "#70CFF8", "#FBBC88", "#94FADB", "#B9F18D", "#6EE7B7"];

//   // Separate read-only editor for previewing version content — includes SnapshotCompare
//   const previewEditor = useEditor({
//     editable: false,
//     content: "",
//     extensions: [
//       StarterKit,
//       ...(provider ? [
//         SnapshotCompare.configure({ provider }),
//       ] : []),
//     ],
//     immediatelyRender:false
//   });

//   const reversedVersions = useMemo(() => [...versions].reverse(), [versions]);
//   const isCurrentVersion = versions.length > 0 ? selectedVersionId === versions[versions.length - 1]?.version : false;

//   const selectedVersionData = useMemo(
//     () => versions.find((v) => v.version === selectedVersionId) ?? null,
//     [selectedVersionId, versions]
//   );

//   // When modal opens, auto-select latest version
//   useEffect(() => {
//     if (isOpen && selectedVersionId === null && versions.length > 0) {
//       const initialVersion = versions[versions.length - 1].version;
//       setSelectedVersionId(initialVersion);
//       setActiveTab("history");
//       if (provider) {
//         provider.sendStateless(
//           JSON.stringify({ action: "version.preview", version: initialVersion })
//         );
//       }
//     }
//   }, [isOpen, selectedVersionId, versions, provider]);

//   // Watch for preview content from server and feed into preview editor
//   useEffect(() => {
//     if (isOpen && provider) {
//       const unbind = watchPreviewContent(provider, (content: any) => {
//         if (previewEditor) {
//           previewEditor.commands.setContent(content);
//         }
//       });
//       return () => { unbind(); };
//     }
//   }, [isOpen, provider, previewEditor]);

//   const handleVersionClick = useCallback((versionId: number) => {
//     setSelectedVersionId(versionId);
//     if (provider) {
//       provider.sendStateless(
//         JSON.stringify({ action: "version.preview", version: versionId })
//       );
//     }
//   }, [provider]);

//   const handleCompareClick = useCallback((versionId: number) => {
//     if (!previewEditor || !provider) return;

//     // Clear any existing diff
//     if (previewEditor.can().hideDiff()) {
//       previewEditor.chain().hideDiff().run();
//     }

//     setCompareVersionId(versionId);
//     setIsComparing(true);

//     if (versionId === 0) {
//       // Version 0 has no previous version, just show its content
//       provider.sendStateless(
//         JSON.stringify({ action: "version.preview", version: versionId })
//       );
//       return;
//     }

//     // Get both versions and compute diff on the preview editor
//     getVersions({ provider, fromVersion: versionId - 1, toVersion: versionId })
//       .then((versionsResolved: any) => {
//         previewEditor
//           .chain()
//           .compareVersions({
//             snapshot: versionsResolved.snapshot,
//             prevSnapshot: versionsResolved.prevSnapshot,
//             hydrateUserData: ({ userId }: { userId: string | undefined }) => {
//               const mapping = colorMappingRef.current;
//               const uid = userId || "unknown";
//               if (!mapping.has(uid)) {
//                 mapping.set(uid, diffColors[uid.length % diffColors.length]);
//               }
//               const userColor = mapping.get(uid)!;
//               return {
//                 color: {
//                   color: "#000",
//                   backgroundColor: `${userColor}B0`,
//                   delete: {
//                     color: "#777",
//                     backgroundColor: `${userColor}50`,
//                   },
//                 },
//               };
//             },
//             onCompare: (ctx: any) => {
//               if (ctx.error) {
//                 console.error("Compare error:", ctx.error);
//                 return;
//               }
//               // Show the diff in the preview editor
//               previewEditor.commands.showDiff(ctx.tr);

//               // Extract unique users from diffs for the legend
//               const users = new Set<string>();
//               ctx.diffs?.forEach((diff: any) => {
//                 if (diff.attribution?.userId) users.add(diff.attribution.userId);
//               });
//               setDiffUsers(Array.from(users));
//             },
//           })
//           .run();
//       })
//       .catch((err: any) => {
//         console.error("getVersions error:", err);
//       });
//   }, [previewEditor, provider]);

//   const handleClose = useCallback(() => {
//     if (isComparing && previewEditor && previewEditor.can().hideDiff()) {
//       try { previewEditor.chain().hideDiff().run(); } catch {}
//     }
//     onClose();
//     setSelectedVersionId(null);
//     setCompareVersionId(null);
//     setIsComparing(false);
//     setDiffUsers([]);
//     setActiveTab("history");
//     previewEditor?.commands.clearContent();
//   }, [onClose, previewEditor, isComparing]);

//   const handleRevert = useCallback(() => {
//     if (selectedVersionId == null) return;
//     const accepted = window.confirm(
//       "Are you sure you want to restore this version? Any unversioned changes will be lost."
//     );
//     if (accepted) {
//       onRevert(selectedVersionId, selectedVersionData);
//       handleClose();
//     }
//   }, [selectedVersionId, selectedVersionData, onRevert, handleClose]);

//   const handleSave = useCallback(() => {
//     const name = versionName.trim() || `Version ${latestVersion + 1}`;
//     onSaveVersion(name);
//     setVersionName("");
//   }, [versionName, latestVersion, onSaveVersion]);

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50">
//       {/* Backdrop */}
//       <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

//       {/* Modal */}
//       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[95%] max-w-[900px] h-[80vh] max-h-[700px] overflow-hidden flex flex-col">
//         {/* Header */}
//         <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
//           <div className="flex items-center gap-3">
//             <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
//               <History size={18} className="text-blue-600" />
//             </div>
//             <div>
//               <h2 className="text-sm font-semibold text-gray-900">Version History</h2>
//               <p className="text-xs text-gray-400">
//                 {versions.length} version{versions.length !== 1 ? "s" : ""} &middot; Current: v{currentVersion}
//               </p>
//             </div>
//           </div>
//           <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
//             <X size={18} />
//           </button>
//         </div>

//         {/* Tabs */}
//         <div className="flex border-b border-gray-100 px-5 flex-shrink-0">
//           <button
//             onClick={() => {
//               if (isComparing && previewEditor && previewEditor.can().hideDiff()) {
//                 try { previewEditor.chain().hideDiff().run(); } catch {}
//                 setIsComparing(false);
//                 setCompareVersionId(null);
//                 setDiffUsers([]);
//               }
//               setActiveTab("history");
//               // Re-select the latest version for preview
//               if (versions.length > 0 && provider) {
//                 const latestV = versions[versions.length - 1].version;
//                 setSelectedVersionId(latestV);
//                 provider.sendStateless(JSON.stringify({ action: "version.preview", version: latestV }));
//               }
//             }}
//             className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
//               activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
//             }`}
//           >
//             <Clock size={13} /> Versions
//           </button>
//           <button
//             onClick={() => setActiveTab("compare")}
//             className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
//               activeTab === "compare" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
//             }`}
//           >
//             <GitCompare size={13} /> Compare
//           </button>
//         </div>

//         {/* Body — two column layout */}
//         <div className="flex flex-1 min-h-0">
//           {/* Left — Preview content */}
//           <div className="flex-1 overflow-y-auto border-r border-gray-100 bg-white">
//             <div className="p-5">
//               {/* User attribution legend when comparing */}
//               {isComparing && diffUsers.length > 0 && (
//                 <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
//                   <span className="text-xs text-gray-500 font-medium">Changes by:</span>
//                   {diffUsers.map((userId) => {
//                     const mapping = colorMappingRef.current;
//                     const color = mapping.get(userId) || "#ccc";
//                     return (
//                       <div key={userId} className="flex items-center gap-1.5">
//                         <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: `${color}B0` }} />
//                         <span className="text-xs text-gray-700">{userId}</span>
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//               {isComparing && (
//                 <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
//                   <GitCompare size={14} className="text-amber-600 flex-shrink-0" />
//                   <span className="text-xs text-amber-800">
//                     Comparing <strong>v{compareVersionId}</strong> with <strong>v{(compareVersionId ?? 0) - 1}</strong>
//                   </span>
//                 </div>
//               )}
//               {previewEditor ? (
//                 <EditorContent editor={previewEditor} />
//               ) : (
//                 <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
//                   Select a version to preview
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* Right — Sidebar */}
//           <div className="w-[280px] flex-shrink-0 flex flex-col bg-gray-50/50">
//             {activeTab === "history" && (
//               <>
//                 {/* Save new version */}
//                 <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
//                   <input
//                     type="text"
//                     value={versionName}
//                     onChange={(e) => setVersionName(e.target.value)}
//                     placeholder="Version name (optional)"
//                     className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
//                     onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
//                   />
//                   <button
//                     onClick={handleSave}
//                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex-shrink-0"
//                   >
//                     <Bookmark size={12} /> Save
//                   </button>
//                 </div>

//                 {/* Version list */}
//                 <div className="flex-1 overflow-y-auto">
//                   {reversedVersions.length === 0 ? (
//                     <div className="px-4 py-10 text-center">
//                       <Clock size={20} className="mx-auto mb-2 text-gray-300" />
//                       <p className="text-xs text-gray-400">No versions yet</p>
//                     </div>
//                   ) : (
//                     <div className="py-1">
//                       {reversedVersions.map((v) => (
//                         <button
//                           key={v.version}
//                           type="button"
//                           onClick={() => handleVersionClick(v.version)}
//                           className={`w-full text-left px-4 py-2.5 transition-colors group ${
//                             selectedVersionId === v.version
//                               ? "bg-white shadow-sm border-l-2 border-blue-600"
//                               : "hover:bg-white/80 border-l-2 border-transparent"
//                           }`}
//                         >
//                           <p className={`text-xs font-medium truncate ${
//                             selectedVersionId === v.version ? "text-blue-700" : "text-gray-700"
//                           }`}>
//                             {getVersionName(v)}
//                           </p>
//                           <p className="text-[10px] text-gray-400 mt-0.5">
//                             v{v.version} {v.date ? `\u00B7 ${renderDate(v.date)}` : ""}
//                           </p>
//                         </button>
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 {/* Bottom actions */}
//                 <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0">
//                   <button onClick={handleClose} className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
//                     Close
//                   </button>
//                   <button
//                     onClick={handleRevert}
//                     disabled={!selectedVersionData || isCurrentVersion}
//                     className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
//                   >
//                     <RotateCcw size={12} /> Restore
//                   </button>
//                 </div>
//               </>
//             )}

//             {activeTab === "compare" && (
//               <>
//                 {/* Compare info */}
//                 <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
//                   <p className="text-xs text-gray-500">
//                     Click a version to compare it with the latest. Changes are highlighted in the preview.
//                   </p>
//                 </div>

//                 {/* Version list for compare */}
//                 <div className="flex-1 overflow-y-auto">
//                   {reversedVersions.length < 2 ? (
//                     <div className="px-4 py-10 text-center">
//                       <GitCompare size={20} className="mx-auto mb-2 text-gray-300" />
//                       <p className="text-xs text-gray-400">Need at least 2 versions to compare</p>
//                     </div>
//                   ) : (
//                     <div className="py-1">
//                       {reversedVersions.map((v) => {
//                         const isLatest = versions.length > 0 && v.version === versions[versions.length - 1]?.version;
//                         const isComparing = compareVersionId === v.version;
//                         return (
//                           <button
//                             key={v.version}
//                             type="button"
//                             onClick={() => {
//                               if (!isLatest) handleCompareClick(v.version);
//                             }}
//                             disabled={isLatest}
//                             className={`w-full text-left px-4 py-2.5 transition-colors ${
//                               isLatest
//                                 ? "opacity-50 cursor-default bg-gray-50"
//                                 : isComparing
//                                   ? "bg-white shadow-sm border-l-2 border-blue-600"
//                                   : "hover:bg-white/80 border-l-2 border-transparent"
//                             }`}
//                           >
//                             <div className="flex items-center justify-between">
//                               <p className={`text-xs font-medium truncate ${
//                                 isComparing ? "text-blue-700" : isLatest ? "text-gray-400" : "text-gray-700"
//                               }`}>
//                                 {getVersionName(v)}
//                               </p>
//                               {isLatest && (
//                                 <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0 ml-2">
//                                   Latest
//                                 </span>
//                               )}
//                             </div>
//                             <p className="text-[10px] text-gray-400 mt-0.5">
//                               v{v.version} {v.date ? `\u00B7 ${renderDate(v.date)}` : ""}
//                             </p>
//                           </button>
//                         );
//                       })}
//                     </div>
//                   )}
//                 </div>

//                 {/* Bottom actions */}
//                 <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0">
//                   <button onClick={handleClose} className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
//                     Close
//                   </button>
//                   {compareVersionId != null && (
//                     <button
//                       onClick={() => {
//                         const vData = versions.find((v) => v.version === compareVersionId) ?? null;
//                         const accepted = window.confirm("Restore this version? Unversioned changes will be lost.");
//                         if (accepted) {
//                           onRevert(compareVersionId, vData);
//                           handleClose();
//                         }
//                       }}
//                       className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
//                     >
//                       <RotateCcw size={12} /> Restore
//                     </button>
//                   )}
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// });

// VersioningModal.displayName = "VersioningModal";

// // ─── Main Component ──────────────────────────────────────────────────────────

// export default function CollaborativeEditor({
//   documentName,
//   token,
//   appId,
//   user,
//   placeholder = "Start typing your answer or select an AI suggestion from the right panel...",
//   initialContent = null,
//   onSave,
//   onContentChange,
//   maxChars = 3000,
//   answeredAt,
// }: CollaborativeEditorProps) {
//   const [isSynced, setIsSynced] = useState(false);
//   const [isConnecting, setIsConnecting] = useState(true);
//   const [isSaving, setIsSaving] = useState(false);
//   const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
//   const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
//   const [charCount, setCharCount] = useState(0);
//   const [editorReady, setEditorReady] = useState(false);

//   const [versions, setVersions] = useState<VersionInfo[]>([]);
//   const [currentVersion, setCurrentVersion] = useState(0);
//   const [latestVersion, setLatestVersion] = useState(0);
//   const [showModal, setShowModal] = useState(false);

//   const [lockedLines, setLockedLines] = useState<Map<number, LineLock>>(new Map());
//   const [toastMessage, setToastMessage] = useState<string | null>(null);
//   const lastBroadcastedParagraph = useRef<number | null>(null);

//   const ydocRef = useRef<Y.Doc | null>(null);
//   const providerRef = useRef<TiptapCollabProvider | null>(null);
//   const initialContentLoadedRef = useRef(false);
//   const mountedRef = useRef(true);
//   const autoVersioningEnabledRef = useRef(false);

//   const lockedLinesRef = useRef(lockedLines);
//   useEffect(() => { lockedLinesRef.current = lockedLines; }, [lockedLines]);
//   const onContentChangeRef = useRef(onContentChange);
//   useEffect(() => { onContentChangeRef.current = onContentChange; }, [onContentChange]);
//   const toastRef = useRef(setToastMessage);

//   const updateOnlineUsers = useCallback((provider: TiptapCollabProvider) => {
//     if (!provider.awareness) return;
//     const myClientId = provider.awareness.clientID;
//     const states = provider.awareness.getStates();
//     const usersMap = new Map<string, OnlineUser>();
//     states.forEach((state: any, clientId: number) => {
//       if (!state?.user?.name || clientId === myClientId) return;
//       if (!usersMap.has(state.user.name)) {
//         usersMap.set(state.user.name, { name: state.user.name, color: state.user.color || "#3B82F6", clientId });
//       }
//     });
//     setOnlineUsers(Array.from(usersMap.values()));
//   }, []);

//   const updateLockedLines = useCallback((provider: TiptapCollabProvider) => {
//     if (!provider.awareness) return;
//     const myClientId = provider.awareness.clientID;
//     const states = provider.awareness.getStates();
//     const newLocks = new Map<number, LineLock>();
//     states.forEach((state: any, clientId: number) => {
//       if (clientId === myClientId) return;
//       if (state?.lockedParagraph != null && state?.user) {
//         newLocks.set(state.lockedParagraph, {
//           paragraphIndex: state.lockedParagraph,
//           userName: state.user.name,
//           userColor: state.user.color || "#3B82F6",
//           userId: state.user.id || "",
//           clientId,
//         });
//       }
//     });
//     setLockedLines(newLocks);
//   }, []);

//   const broadcastActiveParagraph = useCallback((paragraphIndex: number | null) => {
//     if (!providerRef.current) return;
//     if (lastBroadcastedParagraph.current === paragraphIndex) return;
//     lastBroadcastedParagraph.current = paragraphIndex;
//     providerRef.current.setAwarenessField("lockedParagraph", paragraphIndex);
//   }, []);

//   // Initialize Y.Doc and Provider
//   useEffect(() => {
//     mountedRef.current = true;
//     initialContentLoadedRef.current = false;
//     autoVersioningEnabledRef.current = false;

//     const ydoc = new Y.Doc();
//     ydocRef.current = ydoc;

//     const provider = new TiptapCollabProvider({
//       appId, name: documentName, token, document: ydoc, user: user.id,
//       onSynced() { if (mountedRef.current) { setIsSynced(true); setIsConnecting(false); } },
//       onConnect() {},
//       onDisconnect() { if (mountedRef.current) { setIsSynced(false); setIsConnecting(true); } },
//       onStatus({ status }) {
//         if (mountedRef.current && status === "connected" && provider.isSynced) { setIsSynced(true); setIsConnecting(false); }
//       },
//       onAwarenessUpdate() {
//         if (!mountedRef.current || !provider.awareness) return;
//         updateOnlineUsers(provider); updateLockedLines(provider);
//       },
//     });

//     providerRef.current = provider;
//     provider.setAwarenessField("user", { id: user.id, name: user.name, color: user.color });

//     const handleAwarenessChange = () => {
//       if (!mountedRef.current) return;
//       updateOnlineUsers(provider); updateLockedLines(provider);
//     };
//     provider.awareness?.on("change", handleAwarenessChange);
//     provider.awareness?.on("update", handleAwarenessChange);

//     const checkSyncTimer = setTimeout(() => {
//       if (mountedRef.current && provider.isSynced) { setIsSynced(true); setIsConnecting(false); }
//     }, 100);

//     setEditorReady(true);

//     return () => {
//       mountedRef.current = false;
//       clearTimeout(checkSyncTimer);
//       provider.awareness?.off("change", handleAwarenessChange);
//       provider.awareness?.off("update", handleAwarenessChange);
//       if (provider.awareness) provider.awareness.setLocalState(null);
//       provider.destroy(); ydoc.destroy();
//       providerRef.current = null; ydocRef.current = null;
//       setEditorReady(false); setIsSynced(false); setIsConnecting(true); setOnlineUsers([]);
//     };
//   }, [documentName, token, appId, user.id, user.name, user.color]);

//   // Create Editor
//   const editor = useEditor({
//     extensions: [
//       StarterKit.configure({ history: false } as any),
//       Underline,
//       Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
//       ...(ydocRef.current ? [Collaboration.configure({ document: ydocRef.current })] : []),
//       ...(providerRef.current ? [
//         CollaborationCaret.configure({ provider: providerRef.current, user: { name: user.name, color: user.color }, render: renderCaret }),
//         Snapshot.configure({
//           provider: providerRef.current,
//           onUpdate(payload: any) {
//             if (!mountedRef.current) return;
//             setCurrentVersion(payload.currentVersion || 0);
//             setLatestVersion(payload.version || 0);
//             setVersions(payload.versions || []);
//           },
//         }),
//       ] : []),
//     ],
//     editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3" } },
//     immediatelyRender: false,
//     onUpdate: ({ editor: ed }) => {
//       setCharCount(ed.getText().length);
//       if (onContentChangeRef.current) {
//         const text = ed.getText();
//         onContentChangeRef.current(text.trim().length > 0 && ed.getHTML() !== "<p></p>");
//       }
//     },
//     onSelectionUpdate: ({ editor: ed }) => {
//       broadcastActiveParagraph(getParagraphIndexAtPos(ed.state.selection.from, ed.state.doc));
//     },
//   }, [editorReady, user.name, user.color, placeholder]);

//   // Auto-enable versioning
//   useEffect(() => {
//     if (!editor || !isSynced || autoVersioningEnabledRef.current) return;
//     autoVersioningEnabledRef.current = true;
//     try { editor.commands.toggleVersioning(); } catch {}
//   }, [editor, isSynced]);

//   // Line Lock Plugin
//   useEffect(() => {
//     if (!editor) return;
//     const plugin = new Plugin({
//       key: lineLockPluginKey,
//       filterTransaction(tr, state) {
//         if (!tr.docChanged) return true;
//         const locks = lockedLinesRef.current;
//         if (locks.size === 0) return true;
//         for (const step of (tr as any).steps) {
//           const from = (step as any).from; const to = (step as any).to;
//           if (from == null || to == null) continue;
//           try {
//             const fromIdx = getParagraphIndexAtPos(from, state.doc);
//             if (fromIdx == null) continue;
//             const toIdx = getParagraphIndexAtPos(to, state.doc) ?? fromIdx;
//             for (let idx = fromIdx; idx <= toIdx; idx++) {
//               const lock = locks.get(idx);
//               if (lock) { toastRef.current(`This line is being edited by ${lock.userName}`); return false; }
//             }
//           } catch {}
//         }
//         return true;
//       },
//     });
//     const pluginRef = plugin;
//     const newState = editor.state.reconfigure({ plugins: [...editor.state.plugins, pluginRef] });
//     editor.view.updateState(newState);
//     return () => {
//       try {
//         editor.view.updateState(editor.state.reconfigure({ plugins: editor.state.plugins.filter((p) => p !== pluginRef) }));
//       } catch {}
//     };
//   }, [editor]);

//   useEffect(() => {
//     if (!editor) return;
//     const h = () => broadcastActiveParagraph(getParagraphIndexAtPos(editor.state.selection.from, editor.state.doc));
//     editor.on("transaction", h);
//     return () => { editor.off("transaction", h); };
//   }, [editor, broadcastActiveParagraph]);

//   // Load initial content
//   useEffect(() => {
//     if (!editor || !isSynced || !ydocRef.current || initialContentLoadedRef.current) return;
//     const ydoc = ydocRef.current;
//     const yXml = ydoc.getXmlFragment("default");
//     const configMap = ydoc.getMap("config");
//     if (yXml.length > 0 || configMap.get("initialContentLoaded")) {
//       initialContentLoadedRef.current = true;
//     } else if (initialContent) {
//       configMap.set("initialContentLoaded", true);
//       initialContentLoadedRef.current = true;
//       editor.commands.setContent(initialContent);
//     } else { initialContentLoadedRef.current = true; }
//     setCharCount(editor.getText().length);
//   }, [editor, isSynced, initialContent]);

//   // Handlers
//   const handleSave = useCallback(async () => {
//     if (!editor || !onSave) return;
//     setIsSaving(true); setSaveStatus("saving");
//     try {
//       await onSave({ html: editor.getHTML(), json: editor.getJSON() });
//       setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000);
//     } catch { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 3000); }
//     finally { setIsSaving(false); }
//   }, [editor, onSave]);

//   const handleSaveVersion = useCallback((name: string) => {
//     if (editor) editor.commands.saveVersion(name);
//   }, [editor]);

//   const handleRevertToVersion = useCallback((version: number, versionData: VersionInfo | null) => {
//     if (!editor) return;
//     const title = versionData ? versionData.name || renderDate(versionData.date) : `v${version}`;
//     editor.commands.revertToVersion(version, `Restored to ${title}`, `Backup before restore to ${title}`);
//   }, [editor]);

//   if (!editorReady || !editor) {
//     return (
//       <div className="border border-gray-200 rounded-xl bg-white min-h-[300px] flex items-center justify-center">
//         <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span>Loading editor...</span></div>
//       </div>
//     );
//   }

//   return (
//     <div className="border border-gray-200 rounded-xl bg-white overflow-hidden relative">
//       {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}

//       {/* Status Bar */}
//       <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
//         <div className="flex flex-col gap-1">
//           <div className="flex items-center gap-2">
//             <div className={`w-2 h-2 rounded-full ${isSynced ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
//             <span className="text-xs text-gray-500">{isSynced ? "Synced" : isConnecting ? "Connecting..." : "Disconnected"}</span>
//           </div>
//           {answeredAt && <p className="text-xs text-gray-500">Last saved: {new Date(answeredAt).toLocaleString()}</p>}
//         </div>
//         <div className="flex items-center gap-3">
//           {lockedLines.size > 0 && (
//             <div className="flex items-center gap-1 text-xs text-gray-400"><Lock size={12} /><span>{lockedLines.size} line{lockedLines.size > 1 ? "s" : ""} locked</span></div>
//           )}
//           <div className="flex items-center gap-2">
//             <Users size={14} className="text-gray-400" />
//             <div className="flex -space-x-2">
//               {onlineUsers.map((u) => (
//                 <div key={u.name} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm" style={{ backgroundColor: u.color }} title={u.name}>
//                   {u.name.charAt(0).toUpperCase()}
//                 </div>
//               ))}
//               <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm" style={{ backgroundColor: user.color }} title={`${user.name} (you)`}>
//                 {user.name.charAt(0).toUpperCase()}
//               </div>
//             </div>
//             <span className="text-xs text-gray-500">{onlineUsers.length + 1} online</span>
//           </div>
//         </div>
//       </div>

//       {/* Toolbar */}
//       <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
//         <div className="flex items-center gap-1">
//           <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold"><Bold size={16} /></ToolbarButton>
//           <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic"><Italic size={16} /></ToolbarButton>
//           <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline"><UnderlineIcon size={16} /></ToolbarButton>
//           <div className="w-px h-5 bg-gray-200 mx-1" />
//           <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List"><List size={16} /></ToolbarButton>
//           <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List"><ListOrdered size={16} /></ToolbarButton>
//           <div className="w-px h-5 bg-gray-200 mx-1" />
//           <ToolbarButton onClick={() => {}} isActive={false} title="Insert Link"><Link size={16} /></ToolbarButton>
//           <ToolbarButton onClick={() => {}} isActive={false} title="Insert Image"><Image size={16} /></ToolbarButton>
//         </div>
//         <ToolbarButton onClick={() => setShowModal(true)} isActive={showModal} title="Version History"><History size={16} /></ToolbarButton>
//       </div>

//       {/* Editor */}
//       <div className="relative min-h-[200px] max-h-[350px] overflow-y-auto cursor-text"
//         onMouseDown={(e) => {
//           if (!editor) return;
//           const target = e.target as HTMLElement;
//           if (target.closest("p, li, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, code, a, img, table")) return;
//           const pm = (e.currentTarget as HTMLElement).querySelector(".ProseMirror");
//           if (!pm) return;
//           const last = pm.lastElementChild;
//           if (!last) { editor.commands.focus(); return; }
//           if (e.clientY <= last.getBoundingClientRect().bottom) return;
//           e.preventDefault();
//           const { doc } = editor.state;
//           const lastNode = doc.lastChild;
//           if (lastNode?.type.name === "paragraph" && lastNode.content.size === 0) { editor.commands.focus("end"); }
//           else { editor.chain().insertContentAt(doc.content.size, { type: "paragraph" }).focus("end").run(); }
//         }}
//       >
//         <EditorContent editor={editor} />
//       </div>

//       {/* Footer */}
//       <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
//         {onSave && (
//           <button onClick={handleSave} disabled={isSaving || !isSynced}
//             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
//               saveStatus === "saved" ? "bg-green-50 text-green-700 border border-green-200"
//               : saveStatus === "error" ? "bg-red-50 text-red-700 border border-red-200"
//               : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
//             }`}>
//             {isSaving ? (<><Loader2 size={14} className="animate-spin" />Saving...</>)
//             : saveStatus === "saved" ? (<><Check size={14} />Saved</>)
//             : saveStatus === "error" ? "Save Failed"
//             : (<><Save size={14} />Save Draft</>)}
//           </button>
//         )}
//       </div>

//       {/* Version History Modal */}
//       <VersioningModal
//         isOpen={showModal}
//         onClose={() => setShowModal(false)}
//         versions={versions}
//         currentVersion={currentVersion}
//         latestVersion={latestVersion}
//         provider={providerRef.current}
//         onSaveVersion={handleSaveVersion}
//         onRevert={handleRevertToVersion}
//       />
//     </div>
//   );
// }

// // ─── Toolbar Button ──────────────────────────────────────────────────────────

// function ToolbarButton({ onClick, isActive, title, children, disabled = false }: {
//   onClick: () => void; isActive: boolean; title: string; children: React.ReactNode; disabled?: boolean;
// }) {
//   return (
//     <button type="button" onClick={onClick} disabled={disabled}
//       className={`p-2 rounded-lg transition-colors ${
//         disabled ? "text-gray-300 cursor-not-allowed"
//         : isActive ? "bg-blue-100 text-blue-600"
//         : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
//       }`} title={title}>
//       {children}
//     </button>
//   );
// }










