// src/components/editor/CollaborativeEditor.tsx
// Features: Collaboration, Line-Level Locking, Revision History (Snapshots), Snapshot Compare

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Snapshot from "@tiptap-pro/extension-snapshot";
import { SnapshotCompare } from "@tiptap-pro/extension-snapshot-compare";
import { TiptapCollabProvider } from "@tiptap-pro/provider";
import * as Y from "yjs";
import { Plugin, PluginKey } from "prosemirror-state";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
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
  GitCompare,
  X,
  RotateCcw,
  Lock,
  Bookmark,
  ToggleLeft,
  ToggleRight,
  Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CollaborativeEditorProps {
  documentName: string;
  token: string;
  appId: string;
  user: {
    id: string; // REQUIRED: unique user ID for attribution & line locking
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

// ─── Toast Notification ──────────────────────────────────────────────────────

function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
        <Lock size={12} />
        {message}
      </div>
    </div>
  );
}

// ─── Caret Renderer ──────────────────────────────────────────────────────────

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

// ─── Helper: Get paragraph index at a given editor position ──────────────────

function getParagraphIndexAtPos(pos: number, doc: any): number | null {
  try {
    const resolved = doc.resolve(pos);
    if (resolved.depth >= 1) {
      return resolved.index(0);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Line Lock Plugin Key ────────────────────────────────────────────────────

const lineLockPluginKey = new PluginKey("lineLock");

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
  // ── Core state ──
  const [isSynced, setIsSynced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  // ── Revision History state ──
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [latestVersion, setLatestVersion] = useState(0);
  const [versioningEnabled, setVersioningEnabled] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [versionName, setVersionName] = useState("");

  // ── Snapshot Compare state ──
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [compareFromVersion, setCompareFromVersion] = useState<number | "">("");
  const [compareToVersion, setCompareToVersion] = useState<number | "">("");
  const [showCompareControls, setShowCompareControls] = useState(false);

  // ── Line Locking state ──
  const [lockedLines, setLockedLines] = useState<Map<number, LineLock>>(new Map());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastBroadcastedParagraph = useRef<number | null>(null);

  // ── Refs for stable instances ──
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  const initialContentLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  // Refs for callbacks used inside editor (avoids stale closures)
  const lockedLinesRef = useRef(lockedLines);
  useEffect(() => {
    lockedLinesRef.current = lockedLines;
  }, [lockedLines]);

  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const toastRef = useRef(setToastMessage);

  // ── Helper: Update online users from awareness ──
  const updateOnlineUsers = useCallback((provider: TiptapCollabProvider) => {
    if (!provider.awareness) return;
    const myClientId = provider.awareness.clientID;
    const states = provider.awareness.getStates();
    const usersMap = new Map<string, OnlineUser>();

    states.forEach((state: any, clientId: number) => {
      if (!state?.user?.name) return;
      if (clientId === myClientId) return;
      const userName = state.user.name;
      if (!usersMap.has(userName)) {
        usersMap.set(userName, {
          name: userName,
          color: state.user.color || "#3B82F6",
          clientId,
        });
      }
    });
    setOnlineUsers(Array.from(usersMap.values()));
  }, []);

  // ── Helper: Update locked lines from awareness ──
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

  // ── Helper: Broadcast current user's active paragraph ──
  const broadcastActiveParagraph = useCallback((paragraphIndex: number | null) => {
    if (!providerRef.current) return;
    if (lastBroadcastedParagraph.current === paragraphIndex) return;
    lastBroadcastedParagraph.current = paragraphIndex;
    providerRef.current.setAwarenessField("lockedParagraph", paragraphIndex);
  }, []);

  // ── Initialize Y.Doc and Provider ──
  useEffect(() => {
    mountedRef.current = true;
    initialContentLoadedRef.current = false;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new TiptapCollabProvider({
      appId,
      name: documentName,
      token,
      document: ydoc,
      user: user.id, // REQUIRED for snapshot compare user attribution
      onSynced() {
        if (!mountedRef.current) return;
        setIsSynced(true);
        setIsConnecting(false);
      },
      onConnect() {
        if (!mountedRef.current) return;
      },
      onDisconnect() {
        if (!mountedRef.current) return;
        setIsSynced(false);
        setIsConnecting(true);
      },
      onStatus({ status }) {
        if (!mountedRef.current) return;
        if (status === "connected" && provider.isSynced) {
          setIsSynced(true);
          setIsConnecting(false);
        }
      },
      onAwarenessUpdate() {
        if (!mountedRef.current || !provider.awareness) return;
        updateOnlineUsers(provider);
        updateLockedLines(provider);
      },
    });

    providerRef.current = provider;

    // Set current user awareness fields
    provider.setAwarenessField("user", {
      id: user.id,
      name: user.name,
      color: user.color,
    });

    const handleAwarenessChange = () => {
      if (!mountedRef.current) return;
      updateOnlineUsers(provider);
      updateLockedLines(provider);
    };

    provider.awareness?.on("change", handleAwarenessChange);
    provider.awareness?.on("update", handleAwarenessChange);

    const checkSyncTimer = setTimeout(() => {
      if (mountedRef.current && provider.isSynced) {
        setIsSynced(true);
        setIsConnecting(false);
      }
    }, 100);

    setEditorReady(true);

    return () => {
      mountedRef.current = false;
      clearTimeout(checkSyncTimer);
      provider.awareness?.off("change", handleAwarenessChange);
      provider.awareness?.off("update", handleAwarenessChange);
      if (provider.awareness) {
        provider.awareness.setLocalState(null);
      }
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      setEditorReady(false);
      setIsSynced(false);
      setIsConnecting(true);
      setOnlineUsers([]);
    };
  }, [documentName, token, appId, user.id, user.name, user.color]);

  // ── Create Editor ──
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        } as any),
        Underline,
        Placeholder.configure({
          placeholder,
          emptyEditorClass: "is-editor-empty",
        }),
        ...(ydocRef.current
          ? [
              Collaboration.configure({
                document: ydocRef.current,
              }),
            ]
          : []),
        ...(providerRef.current
          ? [
              CollaborationCaret.configure({
                provider: providerRef.current,
                user: {
                  name: user.name,
                  color: user.color,
                },
                render: renderCaret,
              }),
              // ── Snapshot (Revision History) ──
              Snapshot.configure({
                provider: providerRef.current,
                onUpdate(payload: any) {
                  if (!mountedRef.current) return;
                  setCurrentVersion(payload.currentVersion || 0);
                  setLatestVersion(payload.version || 0);
                  setVersions(payload.versions || []);
                  setVersioningEnabled(payload.autoVersioning || false);
                },
              }),
              // ── Snapshot Compare ──
              SnapshotCompare.configure({
                provider: providerRef.current,
              }),
            ]
          : []),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
        },
      },
      immediatelyRender: false,

      onUpdate: ({ editor: ed }) => {
        const text = ed.getText();
        const html = ed.getHTML();
        setCharCount(text.length);

        // Notify parent about content changes
        if (onContentChangeRef.current) {
          const hasContent = text.trim().length > 0 && html !== "<p></p>";
          onContentChangeRef.current(hasContent);
        }

        // Sync isPreviewing from snapshot compare storage
        if (ed.storage.snapshotCompare) {
          setIsPreviewing(ed.storage.snapshotCompare.isPreviewing);
        }
      },

      onSelectionUpdate: ({ editor: ed }) => {
        // Broadcast which paragraph this user is currently on
        const { from } = ed.state.selection;
        const paraIdx = getParagraphIndexAtPos(from, ed.state.doc);
        broadcastActiveParagraph(paraIdx);
      },
    },
    [editorReady, user.name, user.color, placeholder]
  );

  // ── Register Line Lock Plugin after editor creation ──
  useEffect(() => {
    if (!editor) return;

    const plugin = new Plugin({
      key: lineLockPluginKey,
      filterTransaction(tr, state) {
        if (!tr.docChanged) return true;

        const locks = lockedLinesRef.current;
        if (locks.size === 0) return true;

        // Check each step for modifications in locked paragraphs
        for (const step of (tr as any).steps) {
          const from = (step as any).from;
          const to = (step as any).to;
          if (from == null || to == null) continue;

          try {
            const fromIdx = getParagraphIndexAtPos(from, state.doc);
            const toIdx = getParagraphIndexAtPos(to, state.doc);
            if (fromIdx == null) continue;

            const endIdx = toIdx ?? fromIdx;
            for (let idx = fromIdx; idx <= endIdx; idx++) {
              const lock = locks.get(idx);
              if (lock) {
                toastRef.current(
                  `This line is being edited by ${lock.userName}`
                );
                return false; // Block the transaction
              }
            }
          } catch {
            // If position resolution fails, allow the transaction
          }
        }
        return true;
      },
    });

    // Store plugin reference for cleanup
    const pluginRef = plugin;

    const newState = editor.state.reconfigure({
      plugins: [...editor.state.plugins, pluginRef],
    });
    editor.view.updateState(newState);

    return () => {
      try {
        const filteredPlugins = editor.state.plugins.filter((p) => p !== pluginRef);
        const cleanState = editor.state.reconfigure({ plugins: filteredPlugins });
        editor.view.updateState(cleanState);
      } catch {
        // Editor may already be destroyed
      }
    };
  }, [editor]);

  // ── Broadcast paragraph on every transaction (covers typing) ──
  useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      const { from } = editor.state.selection;
      const paraIdx = getParagraphIndexAtPos(from, editor.state.doc);
      broadcastActiveParagraph(paraIdx);
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, broadcastActiveParagraph]);

  // ── Load initial content after sync ──
  useEffect(() => {
    if (!editor || !isSynced || !ydocRef.current) return;
    if (initialContentLoadedRef.current) return;

    const ydoc = ydocRef.current;
    const yXmlFragment = ydoc.getXmlFragment("default");
    const configMap = ydoc.getMap("config");
    const cloudHasContent = yXmlFragment.length > 0;
    const alreadyInitialized = configMap.get("initialContentLoaded");

    if (cloudHasContent || alreadyInitialized) {
      initialContentLoadedRef.current = true;
    } else if (initialContent) {
      configMap.set("initialContentLoaded", true);
      initialContentLoadedRef.current = true;
      editor.commands.setContent(initialContent);
    } else {
      initialContentLoadedRef.current = true;
    }
    setCharCount(editor.getText().length);
  }, [editor, isSynced, initialContent]);

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;
    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const html = editor.getHTML();
      const json = editor.getJSON();
      await onSave({ html, json });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  // ── Revision History handlers ──
  const handleSaveVersion = useCallback(() => {
    if (!editor) return;
    const name = versionName.trim() || `Version ${latestVersion + 1}`;
    editor.commands.saveVersion(name);
    setVersionName("");
  }, [editor, versionName, latestVersion]);

  const handleToggleVersioning = useCallback(() => {
    if (!editor) return;
    editor.commands.toggleVersioning();
    setVersioningEnabled((prev) => !prev);
  }, [editor]);

  const handleRevertToVersion = useCallback(
    (version: number) => {
      if (!editor) return;
      const confirmRevert = window.confirm(
        `Revert to version ${version}? A backup of current changes will be saved automatically.`
      );
      if (!confirmRevert) return;
      editor.commands.revertToVersion(
        version,
        `Reverted to version ${version}`,
        "Backup before revert"
      );
    },
    [editor]
  );

  // ── Snapshot Compare handlers ──
  const handleCompareVersions = useCallback(() => {
    if (!editor || compareFromVersion === "") return;

    const options: any = {
      fromVersion: Number(compareFromVersion),
    };

    if (compareToVersion !== "") {
      options.toVersion = Number(compareToVersion);
    }

    editor.chain().compareVersions(options);
    setIsPreviewing(true);
  }, [editor, compareFromVersion, compareToVersion]);

  const handleHideDiff = useCallback(() => {
    if (!editor) return;
    editor.commands.hideDiff();
    setIsPreviewing(false);
    setShowCompareControls(false);
  }, [editor]);

  // ── Loading state ──
  if (!editorReady || !editor) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading editor...</span>
        </div>
      </div>
    );
  }

  const totalOnline = onlineUsers.length + 1;

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden relative">
      {/* ── Toast ── */}
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}

      {/* ── Diff Preview Banner ── */}
      {isPreviewing && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Eye size={14} />
            <span className="font-medium">Comparing versions — editor is read-only</span>
          </div>
          <button
            onClick={handleHideDiff}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
          >
            <X size={12} />
            Exit Compare
          </button>
        </div>
      )}

      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isSynced
                  ? "bg-green-500"
                  : isConnecting
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
              }`}
            />
            <span className="text-xs text-gray-500">
              {isSynced ? "Synced" : isConnecting ? "Connecting..." : "Disconnected"}
            </span>
          </div>
          <div>
            {answeredAt && (
              <p className="text-xs text-gray-500">
                Last saved: {new Date(answeredAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Locked lines indicator */}
          {lockedLines.size > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock size={12} />
              <span>
                {lockedLines.size} line{lockedLines.size > 1 ? "s" : ""} locked
              </span>
            </div>
          )}

          {/* Online users */}
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            <div className="flex -space-x-2">
              {onlineUsers.map((u) => (
                <div
                  key={u.name}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm"
                  style={{ backgroundColor: u.color }}
                  title={u.name}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm"
                style={{ backgroundColor: user.color }}
                title={`${user.name} (you)`}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-xs text-gray-500">{totalOnline} online</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold"
            disabled={isPreviewing}
          >
            <Bold size={16} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic"
            disabled={isPreviewing}
          >
            <Italic size={16} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive("underline")}
            title="Underline"
            disabled={isPreviewing}
          >
            <UnderlineIcon size={16} />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="Bullet List"
            disabled={isPreviewing}
          >
            <List size={16} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="Numbered List"
            disabled={isPreviewing}
          >
            <ListOrdered size={16} />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton onClick={() => {}} isActive={false} title="Insert Link" disabled={isPreviewing}>
            <Link size={16} />
          </ToolbarButton>

          <ToolbarButton onClick={() => {}} isActive={false} title="Insert Image" disabled={isPreviewing}>
            <Image size={16} />
          </ToolbarButton>
        </div>

        {/* History & Compare buttons */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => {
              setShowCompareControls((prev) => !prev);
              setShowHistoryPanel(false);
            }}
            isActive={showCompareControls}
            title="Compare Versions"
          >
            <GitCompare size={16} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => {
              setShowHistoryPanel((prev) => !prev);
              setShowCompareControls(false);
            }}
            isActive={showHistoryPanel}
            title="Version History"
          >
            <History size={16} />
          </ToolbarButton>
        </div>
      </div>

      {/* ── Compare Controls Bar ── */}
      {showCompareControls && !isPreviewing && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <span className="text-xs font-medium text-blue-700">Compare:</span>
          <label className="flex items-center gap-1 text-xs text-blue-600">
            From v
            <input
              type="number"
              min={1}
              max={latestVersion}
              value={compareFromVersion}
              onChange={(e) =>
                setCompareFromVersion(e.target.value ? Number(e.target.value) : "")
              }
              className="w-14 px-1 py-0.5 border border-blue-200 rounded text-xs text-center"
              placeholder="#"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-blue-600">
            To v
            <input
              type="number"
              min={1}
              max={latestVersion}
              value={compareToVersion}
              onChange={(e) =>
                setCompareToVersion(e.target.value ? Number(e.target.value) : "")
              }
              className="w-14 px-1 py-0.5 border border-blue-200 rounded text-xs text-center"
              placeholder="latest"
            />
          </label>
          <button
            onClick={handleCompareVersions}
            disabled={compareFromVersion === ""}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Compare
          </button>
          <button
            onClick={() => setShowCompareControls(false)}
            className="ml-auto text-blue-400 hover:text-blue-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Editor Content ── */}
      <div
        className="relative min-h-[200px] max-h-[350px] overflow-y-auto cursor-text"
        onMouseDown={(e) => {
          if (!editor || isPreviewing) return;

          // Only handle clicks directly on the wrapper or .tiptap or .ProseMirror root
          // NOT on any child content elements
          const target = e.target as HTMLElement;

          // If clicked on an actual content node, let ProseMirror handle it
          const isContentNode = target.closest("p, li, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, code, a, img, table");
          if (isContentNode) return;

          // Check if click is below the actual content
          const proseMirrorEl = (e.currentTarget as HTMLElement).querySelector(".ProseMirror");
          if (!proseMirrorEl) return;

          // Get the last child element of ProseMirror (last paragraph/block)
          const lastChild = proseMirrorEl.lastElementChild;
          if (!lastChild) {
            // Editor is empty — just focus
            editor.commands.focus();
            return;
          }

          const lastChildRect = lastChild.getBoundingClientRect();
          const clickY = e.clientY;

          // Only trigger if click is below the last content block
          if (clickY <= lastChildRect.bottom) return;

          // Clicked below content — ensure there's an empty paragraph and focus it
          e.preventDefault();

          const { doc } = editor.state;
          const lastNode = doc.lastChild;
          const isLastNodeEmpty =
            lastNode?.type.name === "paragraph" && lastNode.content.size === 0;

          if (isLastNodeEmpty) {
            editor.commands.focus("end");
          } else {
            const endPos = doc.content.size;
            editor
              .chain()
              .insertContentAt(endPos, { type: "paragraph" })
              .focus("end")
              .run();
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* ── Version History Panel ── */}
      {showHistoryPanel && (
        <div className="border-t border-gray-100 bg-gray-50 max-h-[250px] overflow-y-auto">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 sticky top-0 bg-gray-50 z-10">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <History size={14} />
              Version History
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleVersioning}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  versioningEnabled
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-500"
                }`}
                title={versioningEnabled ? "Autoversioning ON" : "Autoversioning OFF"}
              >
                {versioningEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                Auto
              </button>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Save new version */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Version name (optional)"
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveVersion();
              }}
            />
            <button
              onClick={handleSaveVersion}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <Bookmark size={12} />
              Save Version
            </button>
          </div>

          {/* Version metadata */}
          <div className="px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50">
            Current: v{currentVersion} &middot; Latest: v{latestVersion} &middot;{" "}
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </div>

          {/* Version list */}
          {versions.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              No versions saved yet. Save your first version above or enable autoversioning.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {[...versions].reverse().map((v) => (
                <li
                  key={v.version}
                  className="flex items-center justify-between px-4 py-2 hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {v.name || `Version ${v.version}`}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      v{v.version}
                      {v.date && ` \u00B7 ${new Date(v.date).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setCompareFromVersion(v.version);
                        setCompareToVersion("");
                        setShowCompareControls(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      title="Compare with latest"
                    >
                      <GitCompare size={12} />
                    </button>
                    <button
                      onClick={() => handleRevertToVersion(v.version)}
                      className="p-1 text-gray-400 hover:text-orange-600 rounded"
                      title="Revert to this version"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Footer with Save Button ── */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
        {onSave && (
          <button
            onClick={handleSave}
            disabled={isSaving || !isSynced || isPreviewing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saveStatus === "saved"
                ? "bg-green-50 text-green-700 border border-green-200"
                : saveStatus === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Check size={14} />
                Saved
              </>
            ) : saveStatus === "error" ? (
              "Save Failed"
            ) : (
              <>
                <Save size={14} />
                Save Draft
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Styles ── */}
    </div>
  );
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
  disabled = false,
}: {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors ${
        disabled
          ? "text-gray-300 cursor-not-allowed"
          : isActive
            ? "bg-blue-100 text-blue-600"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}