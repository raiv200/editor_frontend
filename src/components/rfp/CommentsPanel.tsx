// src/components/rfp/CommentsPanel.tsx

"use client";

import { useState } from "react";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Edit3,
  FileText,
  MessageCircle,
} from "lucide-react";

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: string;
  isResolved?: boolean;
  resolvedBy?: string;
  mentions?: string[];
}

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  action: "edited" | "completed" | "commented";
  target: string;
  timestamp: string;
}

interface CommentsPanelProps {
  questionId: string;
  onClose?: () => void;
}

// Dummy data - will be replaced with API calls later
const DUMMY_COMMENTS: Comment[] = [
  {
    id: "comment-1",
    userId: "user-1",
    userName: "John Doe",
    userColor: "#3B82F6",
    content:
      "Should we mention specific numbers for our auto-scaling capacity? Like maximum nodes?",
    timestamp: "5 mins ago",
  },
  {
    id: "comment-2",
    userId: "user-2",
    userName: "Alice Smith",
    userColor: "#10B981",
    content:
      "Good point! I'll add that we can scale to 500+ nodes across our production clusters.",
    timestamp: "2 mins ago",
  },
  {
    id: "comment-3",
    userId: "user-3",
    userName: "Sarah Jones",
    userColor: "#6366F1",
    content: "@JohnDoe Can you verify the 100k concurrent users metric?",
    timestamp: "12 mins ago",
    isResolved: true,
    resolvedBy: "John Doe",
    mentions: ["JohnDoe"],
  },
];

const DUMMY_ACTIVITY: ActivityItem[] = [
  {
    id: "activity-1",
    userId: "user-2",
    userName: "Alice Smith",
    action: "edited",
    target: "Q 2.2",
    timestamp: "Just now",
  },
  {
    id: "activity-2",
    userId: "user-1",
    userName: "John Doe",
    action: "completed",
    target: "Q 2.3",
    timestamp: "8 mins ago",
  },
  {
    id: "activity-3",
    userId: "user-3",
    userName: "Sarah Jones",
    action: "commented",
    target: "",
    timestamp: "12 mins ago",
  },
];

export default function CommentsPanel({
  questionId,
  onClose,
}: CommentsPanelProps) {
  const [replyText, setReplyText] = useState("");
  const [comments, setComments] = useState(DUMMY_COMMENTS);

  const activeComments = comments.filter((c) => !c.isResolved).length;

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    // In future, this will call the API
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      userId: "current-user",
      userName: "You",
      userColor: "#3B82F6",
      content: replyText,
      timestamp: "Just now",
    };
    setComments([...comments, newComment]);
    setReplyText("");
  };

  const getActivityIcon = (action: ActivityItem["action"]) => {
    switch (action) {
      case "edited":
        return <Edit3 size={14} className="text-blue-500" />;
      case "completed":
        return <CheckCircle2 size={14} className="text-green-500" />;
      case "commented":
        return <MessageCircle size={14} className="text-purple-500" />;
    }
  };

  const getActivityText = (item: ActivityItem) => {
    switch (item.action) {
      case "edited":
        return (
          <>
            <span className="font-medium text-gray-900">{item.userName}</span>{" "}
            edited {item.target}
          </>
        );
      case "completed":
        return (
          <>
            <span className="font-medium text-gray-900">{item.userName}</span>{" "}
            completed {item.target}
          </>
        );
      case "commented":
        return (
          <>
            <span className="font-medium text-gray-900">{item.userName}</span>{" "}
            added comment
          </>
        );
    }
  };

  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Comments</h3>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {activeComments} active
        </span>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`${comment.isResolved ? "opacity-60" : ""}`}
          >
            {/* Comment Header */}
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                style={{ backgroundColor: comment.userColor }}
              >
                {comment.userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.userName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {comment.timestamp}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{comment.content}</p>

                {/* Resolved Badge */}
                {comment.isResolved && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <CheckCircle2 size={12} />
                    <span>Resolved by {comment.resolvedBy}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Reply Input */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
            placeholder="Reply..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim()}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="border-t border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Recent Activity
        </h4>
        <div className="space-y-3">
          {DUMMY_ACTIVITY.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              {getActivityIcon(item.action)}
              <span className="flex-1 text-gray-600">
                {getActivityText(item)}
              </span>
              <span className="text-gray-400">{item.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Comment Button */}
      <div className="p-4 border-t border-gray-200">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <MessageSquare size={16} />
          Add Comment
        </button>
      </div>
    </aside>
  );
}