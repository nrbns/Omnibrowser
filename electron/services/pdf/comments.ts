/**
 * Comment Storage - Store comments per PDF + page + coordinates
 */

import { app } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

export interface Comment {
  id: string;
  pdfPath: string;
  page: number;
  x: number;
  y: number;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

class CommentStorage {
  private storageDir: string;

  constructor() {
    this.storageDir = path.join(app.getPath('userData'), 'pdf-comments');
    this.ensureStorageDir();
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('[CommentStorage] Failed to create storage dir:', error);
    }
  }

  /**
   * Get comments file path for a PDF
   */
  private getCommentsFilePath(pdfPath: string): string {
    const hash = createHash('sha256').update(pdfPath).digest('hex').substring(0, 16);
    return path.join(this.storageDir, `${hash}.json`);
  }

  /**
   * Load comments for a PDF
   */
  async loadComments(pdfPath: string): Promise<Comment[]> {
    try {
      const filePath = this.getCommentsFilePath(pdfPath);
      const data = await fs.readFile(filePath, 'utf-8');
      const comments = JSON.parse(data) as Comment[];
      return Array.isArray(comments) ? comments : [];
    } catch (error) {
      // File doesn't exist or invalid - return empty array
      return [];
    }
  }

  /**
   * Save comments for a PDF
   */
  async saveComments(pdfPath: string, comments: Comment[]): Promise<void> {
    try {
      const filePath = this.getCommentsFilePath(pdfPath);
      await fs.writeFile(filePath, JSON.stringify(comments, null, 2), 'utf-8');
    } catch (error) {
      console.error('[CommentStorage] Failed to save comments:', error);
      throw error;
    }
  }

  /**
   * Add a comment
   */
  async addComment(pdfPath: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const comments = await this.loadComments(pdfPath);
    const newComment: Comment = {
      ...comment,
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    };
    comments.push(newComment);
    await this.saveComments(pdfPath, comments);
    return newComment;
  }

  /**
   * Update a comment
   */
  async updateComment(pdfPath: string, commentId: string, updates: Partial<Comment>): Promise<Comment | null> {
    const comments = await this.loadComments(pdfPath);
    const index = comments.findIndex(c => c.id === commentId);
    
    if (index === -1) {
      return null;
    }

    comments[index] = {
      ...comments[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveComments(pdfPath, comments);
    return comments[index];
  }

  /**
   * Delete a comment
   */
  async deleteComment(pdfPath: string, commentId: string): Promise<boolean> {
    const comments = await this.loadComments(pdfPath);
    const filtered = comments.filter(c => c.id !== commentId);
    
    if (filtered.length === comments.length) {
      return false; // Comment not found
    }

    await this.saveComments(pdfPath, filtered);
    return true;
  }

  /**
   * Get comments for a specific page
   */
  async getPageComments(pdfPath: string, page: number): Promise<Comment[]> {
    const comments = await this.loadComments(pdfPath);
    return comments.filter(c => c.pdfPath === pdfPath && c.page === page);
  }
}

// Singleton instance
let commentStorageInstance: CommentStorage | null = null;

export function getCommentStorage(): CommentStorage {
  if (!commentStorageInstance) {
    commentStorageInstance = new CommentStorage();
  }
  return commentStorageInstance;
}

