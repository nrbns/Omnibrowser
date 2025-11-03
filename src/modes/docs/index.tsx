import { useState } from 'react';
import { analyzeText } from './analyzer';
import { parsePdfFile } from './parsers/pdf';
import { parseDocxFile } from './parsers/docx';
import { PDFViewer } from '../../components/DocumentViewer/PDFViewer';
import { CommentsPanel, Comment } from '../../components/DocumentViewer/CommentsPanel';

export default function DocsPanel() {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(true);
  const report = analyzeText(text);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    setSelectedFile(f);
    
    if (f.name.toLowerCase().endsWith('.pdf')) {
      // For PDF, we'll use the PDFViewer component
      // In a real implementation, you'd save the file and get its path
      const textContent = await parsePdfFile(f);
      setText(textContent);
      // Create object URL for viewing
      const url = URL.createObjectURL(f);
      setFilePath(url);
    } else if (f.name.toLowerCase().endsWith('.docx')) {
      const textContent = await parseDocxFile(f);
      setText(textContent);
      setFilePath(null);
    }
  };

  const handleAddComment = (comment: Omit<Comment, 'id' | 'createdAt'>) => {
    const newComment: Comment = {
      ...comment,
      id: `comment_${Date.now()}`,
      createdAt: Date.now(),
    };
    setComments(prev => [...prev, newComment]);
  };

  const handleDeleteComment = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
  };

  if (filePath && selectedFile?.name.toLowerCase().endsWith('.pdf')) {
    return (
      <div className="h-full flex">
        <div className="flex-1">
          <PDFViewer 
            filePath={filePath} 
            onPageChange={(page) => {
              // Handle page change if needed
            }}
          />
        </div>
        {showComments && (
          <CommentsPanel
            comments={comments}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            currentPage={1}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full p-3 space-y-2 overflow-y-auto">
      <div className="flex items-center gap-2 text-sm mb-4">
        <input 
          type="file" 
          accept=".pdf,.docx" 
          onChange={handleFileSelect}
          className="text-gray-300"
        />
        {filePath && (
          <button
            onClick={() => setShowComments(!showComments)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
          >
            {showComments ? 'Hide' : 'Show'} Comments
          </button>
        )}
      </div>
      <textarea 
        className="w-full h-40 bg-neutral-800 rounded p-2 text-sm text-gray-200" 
        value={text} 
        onChange={(e)=>setText(e.target.value)} 
        placeholder="Paste text here or select a PDF/DOCX file" 
      />
      {text && (
        <div className="text-sm whitespace-pre-wrap text-gray-300 bg-neutral-800 rounded p-3">
          <div className="font-semibold mb-2 text-purple-400">Analysis Report:</div>
          {report.report}
        </div>
      )}
    </div>
  );
}


