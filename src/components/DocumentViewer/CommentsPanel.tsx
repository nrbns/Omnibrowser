/**
 * Comments Panel - Side-by-side comments for PDF viewer
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, X } from 'lucide-react';

export interface Comment {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  createdAt: number;
}

interface CommentsPanelProps {
  comments: Comment[];
  onAddComment: (comment: Omit<Comment, 'id' | 'createdAt'>) => void;
  onDeleteComment: (id: string) => void;
  currentPage: number;
}

export function CommentsPanel({ comments, onAddComment, onDeleteComment, currentPage }: CommentsPanelProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const pageComments = comments.filter(c => c.page === currentPage);

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;

    onAddComment({
      page: currentPage,
      x: 0, // Would be from click position
      y: 0,
      text: newCommentText,
    });

    setNewCommentText('');
    setShowAddForm(false);
  };

  return (
    <div className="w-80 h-full bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-200">Comments</h3>
          <span className="text-xs text-gray-500">({pageComments.length})</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 rounded hover:bg-gray-700"
        >
          <Plus size={16} className="text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600"
          >
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAddComment}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewCommentText('');
                }}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {pageComments.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No comments on this page
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pageComments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-gray-700/30 rounded-lg border border-gray-600/50"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs text-gray-400">Page {comment.page}</span>
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="p-0.5 rounded hover:bg-gray-600"
                  >
                    <X size={12} className="text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-200">{comment.text}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

