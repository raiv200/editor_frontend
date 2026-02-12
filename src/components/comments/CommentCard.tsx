// src/components/rfp/comments/CommentCard.tsx

"use client";

import { useState, useCallback } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";

interface CommentCardProps {
  name: string;
  color?: string;
  content: string | null;
  createdAt: number | string;
  deleted?: boolean;
  showActions?: boolean;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
}

export default function CommentCard({
  name,
  color = "#3B82F6",
  content,
  createdAt,
  deleted,
  showActions = false,
  onEdit,
  onDelete,
}: CommentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content || "");

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const timeStr =
    typeof createdAt === "number"
      ? new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (onEdit && editValue.trim()) {
        onEdit(editValue.trim());
        setIsEditing(false);
      }
    },
    [editValue, onEdit]
  );

  if (deleted) {
    return (
      <div className="flex items-start gap-3 py-2 opacity-50">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0" style={{ backgroundColor: color }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 italic">Comment was deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-2 group">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0 mt-0.5" style={{ backgroundColor: color }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-900">{name}</span>
          <span className="text-[10px] text-gray-400">{timeStr}</span>
        </div>
        {isEditing ? (
          <form onSubmit={handleSubmit} className="mt-1.5">
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2.5 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none" rows={2} autoFocus />
            <div className="flex items-center gap-1.5 mt-1.5">
              <button type="button" onClick={() => { setIsEditing(false); setEditValue(content || ""); }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"><X size={10} /> Cancel</button>
              <button type="submit" disabled={!editValue.trim() || editValue.trim() === content} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><Check size={10} /> Save</button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{content}</p>
            {showActions && (
              <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil size={10} /> Edit</button>
                )}
                {onDelete && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={10} /> Delete</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}