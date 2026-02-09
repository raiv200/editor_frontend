// src/components/editor/CollaborativeEditor.tsx
// Updated UI to match Figma design - ALL COLLABORATION FUNCTIONALITY PRESERVED

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
  List,
  ListOrdered,
  Link,
  Image,
  Loader2,
  Check,
  Save,
  Users,
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
  answeredAt?: string | null;
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
  placeholder = "Start typing your answer or select an AI suggestion from the right panel...",
  initialContent = null,
  onSave,
  maxChars = 3000,
  answeredAt,
}: CollaborativeEditorProps) {
  const [isSynced, setIsSynced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
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
        if (status === "connected") {
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

    // Check initial sync state after a short delay
    const checkSyncTimer = setTimeout(() => {
      if (mountedRef.current && provider.isSynced) {
        setIsSynced(true);
        setIsConnecting(false);
      }
    }, 100);

    // Mark editor as ready
    setEditorReady(true);

    // Cleanup function
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
  }, [documentName, token, appId, user.name, user.color]);

  // Helper function to update online users list
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

  // Create editor
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
            ]
          : []),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        setCharCount(editor.getText().length);
      },
    },
    [editorReady, user.name, user.color, placeholder],
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
      <div className="border border-gray-200 rounded-xl bg-white min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading editor...</span>
        </div>
      </div>
    );
  }

  const totalOnline = onlineUsers.length + 1;

  return (
    <div className="h-full flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Status Bar - Minimal */}
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
              {isSynced
                ? "Synced"
                : isConnecting
                  ? "Connecting..."
                  : "Disconnected"}
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

         
                {/* <div className="flex items-center gap-2">
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
                </div> */}

        
        <span
          className={`text-xs ${
            charCount > maxChars ? "text-red-600 font-medium" : "text-gray-500"
          }`}
        >
          {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
        </span>
      </div>

      {/* Toolbar - Matching Figma Design */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarButton onClick={() => {}} isActive={false} title="Insert Link">
          <Link size={16} />
        </ToolbarButton>

        <ToolbarButton onClick={() => {}} isActive={false} title="Insert Image">
          <Image size={16} />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>

      {/* Footer with Save Button */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
        {onSave && (
          <button
            onClick={handleSave}
            disabled={isSaving || !isSynced}
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

        .ProseMirror p {
          margin: 0.5em 0;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
        }

        .ProseMirror li {
          margin: 0.25em 0;
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
      className={`p-2 rounded-lg transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-600"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}
