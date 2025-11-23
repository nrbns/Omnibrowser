/**
 * PDF Viewer Component
 * Renders PDF documents with page navigation
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface PDFViewerProps {
  filePath: string;
  onPageChange?: (page: number) => void;
}

export function PDFViewer({ filePath, onPageChange }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPDF();
  }, [filePath]);

  const loadPDF = async () => {
    setLoading(true);
    try {
      // Use pdfjs-dist for PDF rendering
      const pdfjsLib = require('pdfjs-dist');
      
      // For browser environment, use worker
      if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      }

      // Load PDF (filePath should be accessible URL or data URL)
      const loadingTask = pdfjsLib.getDocument(filePath);
      const pdf = await loadingTask.promise;
      
      setTotalPages(pdf.numPages);
      
      // Render first page
      if (canvasRef.current) {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      }
    } catch (error) {
      console.error('Failed to load PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      onPageChange?.(page);
    }
  };

  const zoomIn = () => setZoom(Math.min(zoom + 0.25, 3.0));
  const zoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400">Loading PDF...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} className="text-gray-300" />
          </button>
          <span className="text-sm text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} className="text-gray-300" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={zoomOut} className="p-2 rounded hover:bg-gray-700">
            <ZoomOut size={18} className="text-gray-300" />
          </button>
          <span className="text-sm text-gray-400 w-16 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="p-2 rounded hover:bg-gray-700">
            <ZoomIn size={18} className="text-gray-300" />
          </button>
          <button className="p-2 rounded hover:bg-gray-700">
            <Maximize size={18} className="text-gray-300" />
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <motion.canvas
          ref={canvasRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          className="border border-gray-700 shadow-lg bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      </div>
    </div>
  );
}

