// src/components/rfp/comments/ThreadCard.tsx

"use client";

import { useMemo, useCallback } from "react";
import { CheckCircle2, Undo2, Trash2, MessageSquare } from "lucide-react";
import type { TiptapCollabProvider } from "@tiptap-pro/provider";
import CommentCard from "./CommentCard";
import ThreadComposer from "./ThreadComposer";

interface ThreadCardProps {
  thread: any;
  provider: TiptapCollabProvider;
  isActive: boolean;
  isOpen: boolean;
  userName: string;
  userColor: string;
  onClick: (threadId: string) => void;
  onHover: (threadId: string) => void;
  onLeave: (threadId: string) => void;
  onResolve: (threadId: string) => void;
  onUnresolve: (threadId: string) => void;
  onDelete: (threadId: string) => void;
}

export default function ThreadCard({
  thread,
  provider,
  isActive,
  isOpen,
  userName,
  userColor,
  onClick,
  onHover,
  onLeave,
  onResolve,
  onUnresolve,
  onDelete,
}: ThreadCardProps) {
  const comments = useMemo(
    () => provider.getThreadComments(thread.id, true) || [],
    [provider, thread]
  );

  const firstComment = comments[0];
  const replyCount = Math.max(0, comments.length - 1);

  const handleEditComment = useCallback(
    (commentId: string, newContent: string) => {
      provider.updateComment(thread.id, commentId, { content: newContent });
    },
    [provider, thread.id]
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      provider.deleteComment(thread.id, commentId, { deleteContent: true });
    },
    [provider, thread.id]
  );

  return (
    <div
      onMouseEnter={() => onHover(thread.id)}
      onMouseLeave={() => onLeave(thread.id)}
      onClick={() => onClick(thread.id)}
      className={`rounded-xl border-2 transition-all cursor-pointer ${
        isOpen
          ? "border-blue-400 bg-white shadow-md ring-2 ring-blue-100"
          : isActive
            ? "border-blue-400 bg-blue-50 shadow-sm ring-1 ring-blue-200"
            : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      {isOpen ? (
        <div className="p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              {!thread.resolvedAt ? (
                <button type="button" onClick={() => onResolve(thread.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-50 rounded-lg transition-colors"><CheckCircle2 size={11} /> Resolve</button>
              ) : (
                <button type="button" onClick={() => onUnresolve(thread.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"><Undo2 size={11} /> Unresolve</button>
              )}
            </div>
            <button type="button" onClick={() => onDelete(thread.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={11} /> Delete</button>
          </div>
          {thread.resolvedAt && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2 bg-green-50 border border-green-100 rounded-lg">
              <CheckCircle2 size={11} className="text-green-600" />
              <span className="text-[10px] text-green-700">Resolved {new Date(thread.resolvedAt).toLocaleDateString()} {new Date(thread.resolvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
          <div className="space-y-0.5">
            {comments.map((comment: any) => (
              <CommentCard
                key={comment.id}
                name={comment.data?.userName || "Unknown"}
                color={comment.data?.userColor || userColor}
                content={comment.deletedAt ? null : comment.content}
                createdAt={comment.createdAt}
                deleted={!!comment.deletedAt}
                showActions={!comment.deletedAt}
                onEdit={(val) => handleEditComment(comment.id, val)}
                onDelete={() => handleDeleteComment(comment.id)}
              />
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100">
            <ThreadComposer threadId={thread.id} provider={provider} userName={userName} />
          </div>
        </div>
      ) : (
        <div className="p-3">
          {firstComment && firstComment.data ? (
            <>
              <CommentCard
                name={firstComment.data.userName || "Unknown"}
                color={firstComment.data.userColor || userColor}
                content={firstComment.deletedAt ? null : firstComment.content}
                createdAt={firstComment.createdAt}
                deleted={!!firstComment.deletedAt}
              />
              {replyCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 pl-10">
                  <MessageSquare size={10} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400">{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 italic">Empty thread</p>
          )}
        </div>
      )}
    </div>
  );
}