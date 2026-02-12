// src/components/rfp/comments/ThreadComposer.tsx

"use client";

import { useState, useCallback } from "react";
import { Send } from "lucide-react";
import type { TiptapCollabProvider } from "@tiptap-pro/provider";

interface ThreadComposerProps {
  threadId: string;
  provider: TiptapCollabProvider;
  userName: string;
}

export default function ThreadComposer({ threadId, provider, userName }: ThreadComposerProps) {
  const [comment, setComment] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!comment.trim()) return;

      (provider as any).addComment(threadId, {
        content: comment.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: { userName },
      });

      setComment("");
    },
    [comment, provider, threadId, userName]
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reply..." className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" />
      <button type="submit" disabled={!comment.trim()} className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"><Send size={12} /></button>
    </form>
  );
}