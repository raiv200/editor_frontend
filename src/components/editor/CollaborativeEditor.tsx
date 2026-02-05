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

        {/* Online Users - shows OTHER users' avatars, count includes self */}
        <div className="flex items-center gap-2">
          <Users size={14} className="text-gray-400" />
          <div className="flex -space-x-2">
            {/* Show other users' avatars */}
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
            {/* Always show current user's avatar */}
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














































// // src/components/editor/CollaborativeEditor.tsx
// // VERSION: Using @tiptap-pro/provider (Tiptap Cloud)
// // If you're using Tiptap Cloud, use this version instead of the hocuspocus version

// "use client";

// import { useEditor, EditorContent } from "@tiptap/react";
// import StarterKit from "@tiptap/starter-kit";
// import Underline from "@tiptap/extension-underline";
// import Placeholder from "@tiptap/extension-placeholder";
// import Collaboration from "@tiptap/extension-collaboration";
// import CollaborationCaret from "@tiptap/extension-collaboration-caret";
// import { TiptapCollabProvider } from "@tiptap-pro/provider";
// import * as Y from "yjs";
// import { useEffect, useState, useRef, useCallback, useMemo } from "react";
// import {
//   Bold,
//   Italic,
//   Underline as UnderlineIcon,
//   Users,
//   Save,
//   Loader2,
//   Check,
// } from "lucide-react";


// interface CollaborativeEditorProps {
//   documentName: string;
//   token: string;
//   appId: string;
//   user: {
//     name: string;
//     color: string;
//   };
//   placeholder?: string;
//   initialContent?: string | null;
//   onSave?: (content: { html: string; json: object }) => Promise<void>;
//   maxChars?: number;
// }
// const renderCaret = (user: { name: string; color: string }) => {
//   const cursor = document.createElement('span');
//   cursor.classList.add('collaboration-cursor__caret');
//   cursor.style.borderColor = user.color;
//   cursor.style.backgroundColor = user.color;

//   const label = document.createElement('span');
//   label.classList.add('collaboration-cursor__label');
//   label.style.backgroundColor = user.color;
//   label.textContent = user.name;

//   cursor.appendChild(label);
//   return cursor;
// };

 
// export default function CollaborativeEditor({
//   documentName,
//   token,
//   appId,
//   user,
//   placeholder = "Start typing...",
//   initialContent = null,
//   onSave,
//   maxChars = 3000,
// }: CollaborativeEditorProps) {
//   const [isSynced, setIsSynced] = useState(false);
//   const [isConnecting, setIsConnecting] = useState(true);
//   const [isSaving, setIsSaving] = useState(false);
//   const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
//   const [onlineUsers, setOnlineUsers] = useState<Array<{ name: string; color: string; clientId: number }>>([]);
//   const [charCount, setCharCount] = useState(0);
  
//   // Track if initial content has been loaded
//   const initialContentLoadedRef = useRef(false);

//   // Create stable Y.Doc instance - CRITICAL: must be stable across renders
//   const ydoc = useMemo(() => new Y.Doc(), []);

//   // Create provider instance - recreate when document/token changes
//   const provider = useMemo(() => {
//     console.log("🔄 Creating provider for document:", documentName);
    
//     const p = new TiptapCollabProvider({
//       appId,
//       name: documentName,
//       token,
//       document: ydoc,
//     });

//     return p;
//   }, [appId, documentName, token, ydoc]);

//   // Setup provider event handlers
//   useEffect(() => {
//     const handleSynced = () => {
//       setIsSynced(true);
//       setIsConnecting(false);
//       console.log("✅ Document synced:", documentName);
      
//       // Check if we need to set initial content
//       const yXmlFragment = ydoc.getXmlFragment('default');
//       const configMap = ydoc.getMap('config');
//       const isDocEmpty = yXmlFragment.length === 0;
//       const contentAlreadyLoaded = configMap.get('initialContentLoaded');
      
//       if (isDocEmpty && initialContent && !contentAlreadyLoaded && !initialContentLoadedRef.current) {
//         configMap.set('initialContentLoaded', true);
//         initialContentLoadedRef.current = true;
//         console.log("📝 Will load initial content from database");
//       }
//     };

//     const handleDisconnect = () => {
//       setIsSynced(false);
//       setIsConnecting(true);
//     };

//     const handleAwarenessChange = ({ states }: { states: Map<number, any> }) => {
//       const users: Array<{ name: string; color: string; clientId: number }> = [];
//       states.forEach((state, clientId) => {
//         if (state.user) {
//           users.push({ ...state.user, clientId });
//         }
//       });
//       setOnlineUsers(users);
//     };

//     provider.on('synced', handleSynced);
//     provider.on('disconnect', handleDisconnect);
//     provider.on('awarenessChange', handleAwarenessChange);




//     // Set current user awareness
//     provider.setAwarenessField('user', {
//       name: user.name,
//       color: user.color,
//     });

//     return () => {
//       provider.off('synced', handleSynced);
//       provider.off('disconnect', handleDisconnect);
//       provider.off('awarenessChange', handleAwarenessChange);
//     };
//   }, [provider, documentName, ydoc, initialContent, user.name, user.color]);

//   // Cleanup provider on unmount
//   useEffect(() => {
//     return () => {
//       console.log("🧹 Destroying provider for:", documentName);
//       provider.destroy();
//     };
//   }, [provider, documentName]);

//   // Create editor with extensions
//   const editor = useEditor(
//     {
//       extensions: [
//         StarterKit.configure({
//           // Disable history since collaboration handles undo/redo
//           history: false,
//           undoRedo:false
//         }as any),
//         Underline,
//         Placeholder.configure({ 
//           placeholder,
//           emptyEditorClass: 'is-editor-empty',
//         }),
//         Collaboration.configure({
//           document: ydoc,
//         }),

//         // Enable CollaborationCursor for showing other users' cursors
//         CollaborationCaret.configure({
//           provider: provider,
//           user: {
//             name: user.name,
//             color: user.color,
//           },
//           render: renderCaret,
//         }),
//       ],
//       editorProps: {
//         attributes: {
//           class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
//         },
//       },
//       immediatelyRender: false,
//       onUpdate: ({ editor }) => {
//         // Update character count
//         const text = editor.getText();
//         setCharCount(text.length);
//       },
//     },
//     [ydoc, provider, user.name, user.color, placeholder]
//   );

//   // Set initial content after editor and sync are ready
//   useEffect(() => {
//     if (editor && isSynced && initialContent && !initialContentLoadedRef.current) {
//       const configMap = ydoc.getMap('config');
      
//       // Check if content was already loaded (by this client or another)
//       if (!configMap.get('initialContentLoaded')) {
//         configMap.set('initialContentLoaded', true);
//         initialContentLoadedRef.current = true;
        
//         // Set the content - this will sync to other users
//         editor.commands.setContent(initialContent);
//         console.log("📝 Initial content loaded from database");
//       }
//     }
//   }, [editor, isSynced, initialContent, ydoc]);

//   // Update character count when editor content changes
//   useEffect(() => {
//     if (editor) {
//       const text = editor.getText();
//       setCharCount(text.length);
//     }
//   }, [editor]);

//   // Save handler
//   const handleSave = useCallback(async () => {
//     if (!editor || !onSave) return;
    
//     setIsSaving(true);
//     setSaveStatus('saving');
    
//     try {
//       const html = editor.getHTML();
//       const json = editor.getJSON();
      
//       await onSave({ html, json });
      
//       setSaveStatus('saved');
//       setTimeout(() => setSaveStatus('idle'), 2000);
//     } catch (error) {
//       console.error('Save error:', error);
//       setSaveStatus('error');
//       setTimeout(() => setSaveStatus('idle'), 3000);
//     } finally {
//       setIsSaving(false);
//     }
//   }, [editor, onSave]);

//   // Loading state
//   if (!editor) {
//     return (
//       <div className="border border-gray-200 rounded-lg bg-white min-h-[300px] flex items-center justify-center">
//         <div className="flex items-center gap-2 text-gray-400">
//           <Loader2 className="w-5 h-5 animate-spin" />
//           <span>Loading editor...</span>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
//       {/* Status Bar */}
//       <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
//         <div className="flex items-center gap-2">
//           <div
//             className={`w-2 h-2 rounded-full ${
//               isSynced ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"
//             }`}
//           />
//           <span className="text-xs text-gray-500">
//             {isSynced ? "Synced" : isConnecting ? "Connecting..." : "Disconnected"}
//           </span>
//         </div>

//         {/* Online Users */}
//         <div className="flex items-center gap-2">
//           <Users size={14} className="text-gray-400" />
//           <div className="flex -space-x-2">
//             {onlineUsers.slice(0, 5).map((u, i) => (
//               <div
//                 key={u.clientId || i}
//                 className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-sm"
//                 style={{ backgroundColor: u.color }}
//                 title={u.name}
//               >
//                 {u.name.charAt(0).toUpperCase()}
//               </div>
//             ))}
//             {onlineUsers.length > 5 && (
//               <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
//                 +{onlineUsers.length - 5}
//               </div>
//             )}
//           </div>
//           <span className="text-xs text-gray-500">
//             {onlineUsers.length} online
//           </span>
//         </div>
//       </div>

//       {/* Toolbar */}
//       <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
//         <div className="flex items-center gap-1">
//           <ToolbarButton
//             onClick={() => editor.chain().focus().toggleBold().run()}
//             isActive={editor.isActive("bold")}
//             title="Bold (Ctrl+B)"
//           >
//             <Bold size={18} />
//           </ToolbarButton>

//           <ToolbarButton
//             onClick={() => editor.chain().focus().toggleItalic().run()}
//             isActive={editor.isActive("italic")}
//             title="Italic (Ctrl+I)"
//           >
//             <Italic size={18} />
//           </ToolbarButton>

//           <ToolbarButton
//             onClick={() => editor.chain().focus().toggleUnderline().run()}
//             isActive={editor.isActive("underline")}
//             title="Underline (Ctrl+U)"
//           >
//             <UnderlineIcon size={18} />
//           </ToolbarButton>

//           <div className="w-px h-6 bg-gray-300 mx-1" />
//         </div>

//         {/* Save Button */}
//         {onSave && (
//           <button
//             onClick={handleSave}
//             disabled={isSaving || !isSynced}
//             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
//               saveStatus === 'saved'
//                 ? 'bg-green-100 text-green-700'
//                 : saveStatus === 'error'
//                 ? 'bg-red-100 text-red-700'
//                 : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
//             }`}
//           >
//             {isSaving ? (
//               <>
//                 <Loader2 size={14} className="animate-spin" />
//                 Saving...
//               </>
//             ) : saveStatus === 'saved' ? (
//               <>
//                 <Check size={14} />
//                 Saved
//               </>
//             ) : saveStatus === 'error' ? (
//               <>
//                 Save Failed
//               </>
//             ) : (
//               <>
//                 <Save size={14} />
//                 Save Answer
//               </>
//             )}
//           </button>
//         )}
//       </div>

//       {/* Editor */}
//       <EditorContent editor={editor} />

//       {/* Character Count */}
//       <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex justify-end">
//         <span className={`text-xs ${charCount > maxChars ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
//           {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
//         </span>
//       </div>

//       {/* Collaboration Cursor Styles */}
//       <style jsx global>{`
//         /* Collaboration cursor styles */
//         .collaboration-cursor__caret {
//           border-left: 1px solid;
//           border-right: 1px solid;
//           margin-left: -1px;
//           margin-right: -1px;
//           pointer-events: none;
//           position: relative;
//           word-break: normal;
//         }

//         .collaboration-cursor__label {
//           border-radius: 3px 3px 3px 0;
//           color: white;
//           font-size: 12px;
//           font-style: normal;
//           font-weight: 600;
//           left: -1px;
//           line-height: normal;
//           padding: 0.1rem 0.3rem;
//           position: absolute;
//           top: -1.4em;
//           user-select: none;
//           white-space: nowrap;
//         }

//         /* Placeholder styles */
//         .is-editor-empty:first-child::before {
//           color: #adb5bd;
//           content: attr(data-placeholder);
//           float: left;
//           height: 0;
//           pointer-events: none;
//         }

//         /* Selection highlight for other users */
//         .ProseMirror .selection {
//           background: rgba(200, 200, 255, 0.4);
//         }
        
//         .collaboration-cursor__caret {
//           position: relative;
//           margin-left: -1px;
//           margin-right: -1px;
//           border-left: 2px solid;
//           border-right: none;
//           word-break: normal;
//           pointer-events: none;
//         }

//         .collaboration-cursor__label {
//           position: absolute;
//           top: -1.4em;
//           left: -1px;
//           padding: 2px 6px;
//           border-radius: 6px;
//           font-size: 12px;
//           font-weight: 600;
//           font-style: normal;
//           line-height: normal;
//           color: #fff;
//           white-space: nowrap;
//           user-select: none;
//           pointer-events: none;
//         }
//       `}</style>
//     </div>
//   );
// }

// // Toolbar Button Component
// function ToolbarButton({
//   onClick,
//   isActive,
//   title,
//   children,
// }: {
//   onClick: () => void;
//   isActive: boolean;
//   title: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className={`p-2 rounded transition-colors ${
//         isActive
//           ? "bg-blue-100 text-blue-600"
//           : "text-gray-600 hover:bg-gray-100"
//       }`}
//       title={title}
//     >
//       {children}
//     </button>
//   );
// }


























// // // src/components/editor/CollaborativeEditor.tsx

// // "use client";

// // import { useEditor, EditorContent } from "@tiptap/react";
// // import StarterKit from "@tiptap/starter-kit";
// // import Underline from "@tiptap/extension-underline";
// // import Placeholder from "@tiptap/extension-placeholder";
// // import Collaboration from "@tiptap/extension-collaboration";
// // import CollaborationCaret from "@tiptap/extension-collaboration-caret";
// // import { TiptapCollabProvider } from "@tiptap-pro/provider";
// // import * as Y from "yjs";
// // import { useEffect, useState, useRef, useMemo } from "react";
// // import {
// //   Bold,
// //   Italic,
// //   Underline as UnderlineIcon,
// //   Highlighter,
// //   Users,
// // } from "lucide-react";

// // interface CollaborativeEditorProps {
// //   documentName: string;
// //   token: string;
// //   appId: string;
// //   user: {
// //     name: string;
// //     color: string;
// //   };
// //   placeholder?: string;
// // }

// // export default function CollaborativeEditor({
// //   documentName,
// //   token,
// //   appId,
// //   user,
// //   placeholder = "Start typing...",
// // }: CollaborativeEditorProps) {
// //   const [isSynced, setIsSynced] = useState(false);
// //   const [onlineUsers, setOnlineUsers] = useState<
// //     Array<{ name: string; color: string }>
// //   >([]);

// //   const ydoc = new Y.Doc();
// //   const providerRef = useRef<TiptapCollabProvider | null>(null);

// //   // Initialize Y.js document and provider
// //   useEffect(() => {
// //     const provider = new TiptapCollabProvider({
// //       appId,
// //       name: documentName,
// //       token,
// //       document: ydoc,
// //       onSynced() {
// //         setIsSynced(true);
// //         console.log("✅ Document synced:", documentName);
// //       },
// //       onDisconnect() {
// //         setIsSynced(false);
// //       },
// //       onAwarenessChange({ states }) {
// //         const users: Array<{ name: string; color: string }> = [];
// //         states.forEach((state) => {
// //           if (state.user) {
// //             users.push(state.user);
// //           }
// //         });
// //         setOnlineUsers(users);
// //       },
// //     });

// //     // Set user awareness
// //     document.addEventListener("mousemove", (event) => {
// //       // Share any information you like
// //       provider.setAwarenessField("user", {
// //         name: user.name,
// //         color: user.color,
// //         mouseX: event.clientX,
// //         mouseY: event.clientY,
// //       });
// //     });
// //     providerRef.current = provider;

// //     return () => {
// //       provider.destroy();
// //       ydoc.destroy();
// //     };
// //   }, [documentName, token, appId, user]);

// //   // Configure editor extensions
// //   const extensions = useMemo(() => {
// //     const exts = [
// //       StarterKit.configure({
// //         history: false, // Disable history - collaboration handles this
// //         undoRedo: false,
// //       } as any),
// //       Underline,
// //       Placeholder.configure({ placeholder }),
// //       Collaboration.configure({
// //         document: ydoc,
// //       }),
// //       // CollaborationCaret.configure({
// //       //   provider : providerRef.current,
// //       //   user: {
// //       //     name: 'Cyndi Lauper',
// //       //     color: '#f783ac',
// //       //   },
// //       // }),
// //     ];

// //     return exts;
// //   }, [placeholder, user]);

// //   const editor = useEditor(
// //     {
// //       extensions,
// //       editorProps: {
// //         attributes: {
// //           class: "prose prose-sm max-w-none focus:outline-none min-h-[200px]",
// //         },
// //       },
// //       immediatelyRender: false,
// //     },
// //     [extensions],
// //   );

// //   if (!editor) {
// //     return (
// //       <div className="border border-gray-200 rounded-lg bg-white min-h-[300px] flex items-center justify-center">
// //         <div className="text-gray-400">Loading editor...</div>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
// //       {/* Status Bar */}
// //       <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
// //         <div className="flex items-center gap-2">
// //           <div
// //             className={`w-2 h-2 rounded-full ${isSynced ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
// //           />
// //           <span className="text-xs text-gray-500">
// //             {isSynced ? "Synced" : "Connecting..."}
// //           </span>
// //         </div>

// //         {/* Online Users */}
// //         <div className="flex items-center gap-2">
// //           <Users size={14} className="text-gray-400" />
// //           <div className="flex -space-x-2">
// //             {onlineUsers.slice(0, 5).map((u, i) => (
// //               <div
// //                 key={i}
// //                 className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
// //                 style={{ backgroundColor: u.color }}
// //                 title={u.name}
// //               >
// //                 {u.name.charAt(0).toUpperCase()}
// //               </div>
// //             ))}
// //             {onlineUsers.length > 5 && (
// //               <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
// //                 +{onlineUsers.length - 5}
// //               </div>
// //             )}
// //           </div>
// //         </div>
// //       </div>

// //       {/* Toolbar */}
// //       <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200">
// //         <ToolbarButton
// //           onClick={() => editor.chain().focus().toggleBold().run()}
// //           isActive={editor.isActive("bold")}
// //           title="Bold (Ctrl+B)"
// //         >
// //           <Bold size={18} />
// //         </ToolbarButton>

// //         <ToolbarButton
// //           onClick={() => editor.chain().focus().toggleItalic().run()}
// //           isActive={editor.isActive("italic")}
// //           title="Italic (Ctrl+I)"
// //         >
// //           <Italic size={18} />
// //         </ToolbarButton>

// //         <ToolbarButton
// //           onClick={() => editor.chain().focus().toggleUnderline().run()}
// //           isActive={editor.isActive("underline")}
// //           title="Underline (Ctrl+U)"
// //         >
// //           <UnderlineIcon size={18} />
// //         </ToolbarButton>

// //         <div className="w-px h-6 bg-gray-300 mx-1" />
// //       </div>

// //       {/* Editor */}
// //       <EditorContent editor={editor} className="p-4" />
// //     </div>
// //   );
// // }

// // // Toolbar Button Component
// // function ToolbarButton({
// //   onClick,
// //   isActive,
// //   title,
// //   children,
// // }: {
// //   onClick: () => void;
// //   isActive: boolean;
// //   title: string;
// //   children: React.ReactNode;
// // }) {
// //   return (
// //     <button
// //       type="button"
// //       onClick={onClick}
// //       className={`p-2 rounded transition-colors ${
// //         isActive
// //           ? "bg-blue-100 text-blue-600"
// //           : "text-gray-600 hover:bg-gray-100"
// //       }`}
// //       title={title}
// //     >
// //       {children}
// //     </button>
// //   );
// // }
