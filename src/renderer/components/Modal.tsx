import React from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer, widthClass = 'max-w-md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widthClass} mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]`}>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
          <h2 className="text-sm font-semibold flex-1">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xs">✕</button>
        </div>
        <div className="p-4 overflow-auto text-sm">
          {children}
        </div>
        {footer && <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
};
