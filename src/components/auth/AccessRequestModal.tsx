'use client';

import { useEffect, useRef } from 'react';
import AccessRequestForm from './AccessRequestForm';

interface AccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccessRequestModal({ isOpen, onClose }: AccessRequestModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Close on click outside
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background-primary/80 backdrop-blur-sm animate-fade-in"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-surface-primary border border-border-primary rounded-2xl shadow-2xl animate-scale-in"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-text-primary">Request Access</h2>
            <p className="text-text-secondary text-sm mt-1">
              Fill out the form below to request access to the trading dashboard
            </p>
          </div>

          <AccessRequestForm />
        </div>
      </div>
    </div>
  );
}
