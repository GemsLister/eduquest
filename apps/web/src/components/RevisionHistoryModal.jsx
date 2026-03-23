import { useState } from 'react';

export const RevisionHistoryModal = ({ isOpen, onClose, revisions, questionId }) => {
  if (!isOpen) return null;

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl max-h-[80vh] overflow-y-auto w-full mx-4">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Revision History</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Question ID: {questionId}</p>
        </div>

        <div className="p-6 space-y-4">
          {revisions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No revisions yet.</p>
          ) : (
            revisions.map((revision, index) => (
              <div key={index} className="border-l-4 border-casual-green pl-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Version {revisions.length - index}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(revision.timestamp)}
                  </span>
                </div>
                <p className="text-gray-800 mb-3 font-medium">{revision.text}</p>
                {revision.options && (
                  <div className="ml-4 text-sm text-gray-600">
                    <p className="font-semibold mb-2">Options:</p>
                    <ul className="space-y-1">
                      {revision.options.map((opt, idx) => (
                        <li key={idx}>{String.fromCharCode(97 + idx)}. {opt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full bg-casual-green text-white py-2 px-6 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
