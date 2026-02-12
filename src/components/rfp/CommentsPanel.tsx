// src/components/rfp/CommentsPanel.tsx

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  MessageSquareText,
} from "lucide-react";
import { subscribeToThreads } from "@tiptap-pro/extension-comments";
import type { TiptapCollabProvider } from "@tiptap-pro/provider";
import type { Editor } from "@tiptap/react";
import ThreadCard from "../comments/ThreadCard";

interface CommentsPanelProps {
  provider: TiptapCollabProvider | null;
  editor: Editor | null;
  user: {
    id: string;
    name: string;
    color: string;
  };
}

export default function CommentsPanel({
  provider,
  editor,
  user,
}: CommentsPanelProps) {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"open" | "resolved">("open");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  // Subscribe to threads from Tiptap Cloud
  useEffect(() => {
    if (!provider) return;

    const unsubscribe = subscribeToThreads({
      provider,
      callback: (currentThreads: any) => {
        setThreads(currentThreads || []);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [provider]);

  // Filter threads by tab
  const filteredThreads = useMemo(() => {
    return threads.filter((t: any) =>
      activeTab === "open" ? !t.resolvedAt : !!t.resolvedAt
    );
  }, [threads, activeTab]);

  const openCount = useMemo(() => threads.filter((t: any) => !t.resolvedAt).length, [threads]);
  const resolvedCount = useMemo(() => threads.filter((t: any) => !!t.resolvedAt).length, [threads]);

  // Track focused threads from editor (when user clicks on commented text)
  const [focusedThreads, setFocusedThreads] = useState<string[]>([]);

  useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      const focused: string[] = editor.storage?.comments?.focusedThreads || [];
      setFocusedThreads(focused);
    };

    editor.on("transaction", handleTransaction);
    return () => { editor.off("transaction", handleTransaction); };
  }, [editor]);

  // Auto-select thread when user clicks on commented text in the editor
  useEffect(() => {
    if (focusedThreads.length > 0) {
      const firstFocused = focusedThreads[0];
      // Only auto-select if it's a different thread
      if (firstFocused !== selectedThread) {
        setSelectedThread(firstFocused);
        // Switch to the correct tab if needed
        const thread = threads.find((t: any) => t.id === firstFocused);
        if (thread) {
          setActiveTab(thread.resolvedAt ? "resolved" : "open");
        }
      }
    }
  }, [focusedThreads]);

  // ── Thread actions ─────────────────────────────────────────────────────

  const handleClickThread = useCallback(
    (threadId: string) => {
      if (selectedThread === threadId) {
        setSelectedThread(null);
        try { editor?.chain().unselectThread().run(); } catch {}
      } else {
        setSelectedThread(threadId);
        try {
          editor?.chain().selectThread({ id: threadId, updateSelection: false }).run();
        } catch {
          try { (editor as any)?.commands?.selectThread({ id: threadId }); } catch {}
        }
      }
    },
    [editor, selectedThread]
  );

  const handleHoverThread = useCallback(
    (threadId: string) => {
      if (!editor) return;
      const { tr } = editor.state;
      tr.setMeta("threadMouseOver", [threadId]);
      editor.view.dispatch(tr);
    },
    [editor]
  );

  const handleLeaveThread = useCallback(
    (threadId: string) => {
      if (!editor) return;
      const { tr } = editor.state;
      tr.setMeta("threadMouseOut", [threadId]);
      editor.view.dispatch(tr);
    },
    [editor]
  );

  const handleResolveThread = useCallback(
    (threadId: string) => {
      try { editor?.commands.resolveThread({ id: threadId }); } catch {}
    },
    [editor]
  );

  const handleUnresolveThread = useCallback(
    (threadId: string) => {
      try { editor?.commands.unresolveThread({ id: threadId }); } catch {}
    },
    [editor]
  );

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      if (!provider || !editor) return;
      try {
        provider.deleteThread(threadId);
        editor.commands.removeThread({ id: threadId });
      } catch {}
      if (selectedThread === threadId) setSelectedThread(null);
    },
    [provider, editor, selectedThread]
  );

  // ── Waiting state ──────────────────────────────────────────────────────

  if (!provider || !editor) {
    return (
      <div className="w-[320px] flex-shrink-0 bg-white border-l border-gray-200 flex items-center justify-center">
        <div className="text-center px-6">
          <MessageSquareText size={24} className="mx-auto mb-2 text-gray-300" />
          <p className="text-xs text-gray-400">Connecting to comments...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-84 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText size={16} className="text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
          </div>
          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            {threads.length} total
          </span>
        </div>
      </div>

      {/* Tabs */}
    

      <div className="flex border-b border-gray-200">
              <button
               onClick={() => setActiveTab("open")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
                  activeTab === "open"
                    ? "text-amber-600 border-b-2 border-amber-600 bg-amber-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Clock size={12} />
          Open ({openCount})
              </button>
      
              <button
               onClick={() => setActiveTab("resolved")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
                  activeTab === "resolved"
                    ? "text-green-600 border-b-2 border-green-600 bg-green-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <CheckCircle2 size={12} />
          Resolved ({resolvedCount})
              </button>
            </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            {activeTab === "open" ? (
              <>
                <MessageSquareText size={28} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400 text-center">
                  No open comments yet.
                </p>
                <p className="text-[10px] text-gray-300 text-center mt-1">
                  Select text in the editor and click the comment icon to add one.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 size={28} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400 text-center">
                  No resolved comments.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredThreads.map((thread: any) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                provider={provider}
                isActive={focusedThreads.includes(thread.id)}
                isOpen={selectedThread === thread.id}
                userName={user.name}
                userColor={user.color}
                onClick={handleClickThread}
                onHover={handleHoverThread}
                onLeave={handleLeaveThread}
                onResolve={handleResolveThread}
                onUnresolve={handleUnresolveThread}
                onDelete={handleDeleteThread}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}