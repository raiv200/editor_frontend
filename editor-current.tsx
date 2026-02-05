// src/components/editor/CollaborativeEditor.tsx
// This version handles document switching gracefully without full remount

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [charCount, setCharCount] = useState(0);
  
  // Track current document to detect changes
  const currentDocNameRef = useRef<string>(documentName);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const initialContentLoadedRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up provider");
    
    if (providerRef.current) {
      // Clear awareness before destroying
      if (providerRef.current.awareness) {
        providerRef.current.awareness.setLocalState(null);
      }
      providerRef.current.destroy();
      providerRef.current = null;
    }
    
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
    
    setIsSynced(false);
    setIsConnecting(true);
  }, []);

  // Initialize or reinitialize provider when document changes
  useEffect(() => {
    // Check if document name changed
    const docChanged = currentDocNameRef.current !== documentName;
    
    if (docChanged || !isInitializedRef.current) {
      console.log("📄 Document changed from", currentDocNameRef.current, "to", documentName);
      currentDocNameRef.current = documentName;
      
      // Cleanup previous connection
      cleanup();
      
      // Create new Y.Doc
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      console.log("🔄 Creating provider for document:", documentName);

      // Create provider with connection options
      const provider = new TiptapCollabProvider({
        appId,
        name: documentName,
        token,
        document: ydoc,
        // Add connection options to reduce reconnection spam
        onSynced() {
          console.log("✅ Document synced:", documentName);
          setIsSynced(true);
          setIsConnecting(false);
          
          // Load initial content if needed
          if (initialContent && !initialContentLoadedRef.current.has(documentName)) {
            const configMap = ydoc.getMap('config');
            const yXmlFragment = ydoc.getXmlFragment('default');
            
            if (!configMap.get('initialContentLoaded') && yXmlFragment.length === 0) {
              configMap.set('initialContentLoaded', true);
              initialContentLoadedRef.current.add(documentName);
              
              // Set content via editor if available
              if (editorRef.current) {
                editorRef.current.commands.setContent(initialContent);
                console.log("📝 Initial content loaded from database");
              }
            }
          }
        },
        onConnect() {
          console.log("🔌 Connected to:", documentName);
        },
        onDisconnect() {
          console.log("🔌 Disconnected from:", documentName);
          setIsSynced(false);
          setIsConnecting(true);
        },
        onAwarenessChange({ states }) {
          const myClientId = provider.awareness?.clientID;
          
          // Build unique users list, filtering out current user
          const usersMap = new Map<string, OnlineUser>();
          
          states.forEach((state, clientId) => {
            if (state.user && state.user.name) {
              // Skip current user
              if (clientId === myClientId) return;
              
              // Use name as key to prevent duplicates
              const key = state.user.name;
              if (!usersMap.has(key)) {
                usersMap.set(key, {
                  name: state.user.name,
                  color: state.user.color || '#3B82F6',
                  clientId,
                });
              }
            }
          });

          setOnlineUsers(Array.from(usersMap.values()));
        },
      });

      providerRef.current = provider;

      // Set current user awareness
      provider.setAwarenessField('user', {
        name: user.name,
        color: user.color,
      });

      isInitializedRef.current = true;
    }

    // Cleanup on unmount
    return () => {
      cleanup();
      isInitializedRef.current = false;
    };
  }, [documentName, token, appId, user.name, user.color, initialContent, cleanup]);

  // Create editor
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
          undoRedo:false
        }as any),
        Underline,
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
        Collaboration.configure({
          document: ydocRef.current || new Y.Doc(),
        }),
        ...(providerRef.current ? [
          CollaborationCaret.configure({
            provider: providerRef.current,
            user: {
              name: user.name,
              color: user.color,
            },
          }),
        ] : []),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        const text = editor.getText();
        setCharCount(text.length);
      },
    },
    [documentName] // Recreate editor when document changes
  );

  // Store editor ref
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Update char count
  useEffect(() => {
    if (editor) {
      setCharCount(editor.getText().length);
    }
  }, [editor]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const html = editor.getHTML();
      const json = editor.getJSON();
      await onSave({ html, json });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  // Loading state
  if (!editor) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading editor...</span>
        </div>
      </div>
    );
  }

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

        {/* Online Users */}
        <div className="flex items-center gap-2">
          <Users size={14} className="text-gray-400" />
          <div className="flex -space-x-2">
            {onlineUsers.slice(0, 5).map((u) => (
              <div
                key={`${u.name}-${u.clientId}`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
                +{onlineUsers.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {totalOnline} online
          </span>
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
              saveStatus === 'saved'
                ? 'bg-green-100 text-green-700'
                : saveStatus === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check size={14} />
                Saved
              </>
            ) : saveStatus === 'error' ? (
              'Save Failed'
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
        <span className={`text-xs ${charCount > maxChars ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
        </span>
      </div>

      {/* Collaboration Caret Styles */}
      <style jsx global>{`
        .collaboration-cursor__caret {
          border-left: 1px solid;
          border-right: 1px solid;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }

        .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: white;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 0.1rem 0.3rem;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
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
        isActive
          ? "bg-blue-100 text-blue-600"
          : "text-gray-600 hover:bg-gray-100"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}