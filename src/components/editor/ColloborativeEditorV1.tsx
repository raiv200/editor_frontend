// src/components/editor/CollaborativeEditor.tsx
// FINAL FIXED VERSION - Properly handles sync timing, awareness, and presence

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { TiptapCollabProvider } from "@tiptap-pro/provider";
import * as Y from "yjs";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Users,
  Save,
  Loader2,
  Check,
} from "lucide-react";

interface CollaborativeEditorProps {
  documentName: string;
  token: string;
  appId: string;
  user: {
    name: string;
    color: string;
  };
  placeholder?: string;
  initialContent?: string | null;
  onSave?: (content: { html: string; json: object }) => Promise<void>;
  maxChars?: number;
}

interface OnlineUser {
  name: string;
  color: string;
  clientId: number;
}

// Custom render function for collaboration carets
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

export default function CollaborativeEditor({
  documentName,
  token,
  appId,
  user,
  placeholder = "Start typing...",
  initialContent = null,
  onSave,
  maxChars = 3000,
}: CollaborativeEditorProps) {
  const [isSynced, setIsSynced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  // Refs for stable instances
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  const initialContentLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  // Initialize Y.Doc and Provider
  useEffect(() => {
    mountedRef.current = true;
    initialContentLoadedRef.current = false;
    
    console.log("🔄 Initializing for document:", documentName);

    // Create Y.Doc
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create provider with all event handlers inline
    const provider = new TiptapCollabProvider({
      appId,
      name: documentName,
      token,
      document: ydoc,
      onSynced() {
        if (!mountedRef.current) return;
        console.log("✅ Document synced:", documentName);
        setIsSynced(true);
        setIsConnecting(false);
      },
      onConnect() {
        if (!mountedRef.current) return;
        console.log("🔌 Connected to:", documentName);
        // Don't set isConnecting false here - wait for sync
      },
      onDisconnect() {
        if (!mountedRef.current) return;
        console.log("🔌 Disconnected from:", documentName);
        setIsSynced(false);
        setIsConnecting(true);
      },
      onStatus({ status }) {
        if (!mountedRef.current) return;
        console.log("📡 Status:", status);
        if (status === 'connected') {
          // Check if already synced
          if (provider.isSynced) {
            setIsSynced(true);
            setIsConnecting(false);
          }
        }
      },
      onAwarenessUpdate() {
        if (!mountedRef.current || !provider.awareness) return;
        updateOnlineUsers(provider);
      },
    });

    providerRef.current = provider;

    // Set current user awareness
    provider.setAwarenessField("user", {
      name: user.name,
      color: user.color,
    });

    // Also listen on awareness directly
    const handleAwarenessChange = () => {
      if (!mountedRef.current) return;
      updateOnlineUsers(provider);
    };

    provider.awareness?.on("change", handleAwarenessChange);
    provider.awareness?.on("update", handleAwarenessChange);

    // Check initial sync state after a short delay (in case synced event already fired)
    const checkSyncTimer = setTimeout(() => {
      if (mountedRef.current && provider.isSynced) {
        console.log("✅ Already synced (checked after mount)");
        setIsSynced(true);
        setIsConnecting(false);
      }
    }, 100);

    // Mark editor as ready
    setEditorReady(true);

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up for document:", documentName);
      mountedRef.current = false;
      clearTimeout(checkSyncTimer);

      // Remove awareness listeners
      provider.awareness?.off("change", handleAwarenessChange);
      provider.awareness?.off("update", handleAwarenessChange);

      // Clear local awareness state before destroying
      if (provider.awareness) {
        provider.awareness.setLocalState(null);
      }

      // Destroy provider and doc
      provider.destroy();
      ydoc.destroy();

      // Clear refs
      providerRef.current = null;
      ydocRef.current = null;
      
      // Reset states
      setEditorReady(false);
      setIsSynced(false);
      setIsConnecting(true);
      setOnlineUsers([]);
    };
  }, [documentName, token, appId, user.name, user.color]);

  // Helper function to update online users list
  const updateOnlineUsers = useCallback((provider: TiptapCollabProvider) => {
    if (!provider.awareness) return;

    const myClientId = provider.awareness.clientID;
    const states = provider.awareness.getStates();
    const usersMap = new Map<string, OnlineUser>();

    states.forEach((state: any, clientId: number) => {
      // Skip if no user data
      if (!state?.user?.name) return;
      
      // Skip current user (don't show own cursor in list)
      if (clientId === myClientId) return;

      // Use name as key to deduplicate same user with multiple connections
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

  // Create editor
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false, // Disable - collaboration handles undo/redo
        }as any),
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
            ]
          : []),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        setCharCount(editor.getText().length);
      },
    },
    [editorReady, user.name, user.color, placeholder]
  );

  // Load initial content from database after sync
  useEffect(() => {
    if (!editor || !isSynced || !ydocRef.current) return;
    if (initialContentLoadedRef.current) return;

    const ydoc = ydocRef.current;
    const yXmlFragment = ydoc.getXmlFragment("default");
    const configMap = ydoc.getMap("config");
    const cloudHasContent = yXmlFragment.length > 0;
    const alreadyInitialized = configMap.get("initialContentLoaded");

    console.log("📋 Content check:", {
      cloudHasContent,
      alreadyInitialized,
      hasDbContent: !!initialContent,
    });

    if (cloudHasContent || alreadyInitialized) {
      // Tiptap Cloud has content - use it
      console.log("📄 Using content from Tiptap Cloud");
      initialContentLoadedRef.current = true;
    } else if (initialContent) {
      // Load from database
      console.log("📝 Loading content from database");
      configMap.set("initialContentLoaded", true);
      initialContentLoadedRef.current = true;
      editor.commands.setContent(initialContent);
    } else {
      // Empty document
      initialContentLoadedRef.current = true;
    }

    setCharCount(editor.getText().length);
  }, [editor, isSynced, initialContent]);

  // Save handler
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

  // Loading state
  if (!editorReady || !editor) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading editor...</span>
        </div>
      </div>
    );
  }

  // Total online = other users + self
  const totalOnline = onlineUsers.length + 1;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
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

        {/* Online Users - shows OTHER users only */}
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
          </div>
          <span className="text-xs text-gray-500">{totalOnline} online</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold size={18} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic size={18} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon size={18} />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />
        </div>

        {/* Save Button */}
        {onSave && (
          <button
            onClick={handleSave}
            disabled={isSaving || !isSynced}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              saveStatus === "saved"
                ? "bg-green-100 text-green-700"
                : saveStatus === "error"
                ? "bg-red-100 text-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
                Save Answer
              </>
            )}
          </button>
        )}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Character Count */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex justify-end">
        <span
          className={`text-xs ${
            charCount > maxChars ? "text-red-600 font-medium" : "text-gray-500"
          }`}
        >
          {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
        </span>
      </div>

      {/* Collaboration Caret Styles */}
      <style jsx global>{`
        .collaboration-cursor__caret {
          border-left: 2px solid;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }

        .collaboration-cursor__label {
          border-radius: 6px 6px 6px 0;
          color: white;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 2px 6px;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
          pointer-events: none;
        }

        .is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .ProseMirror:focus {
          outline: none;
        }

        .ProseMirror .selection {
          background: rgba(200, 200, 255, 0.4);
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        isActive ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}
