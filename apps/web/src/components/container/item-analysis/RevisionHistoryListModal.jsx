import React, { useState } from 'react';
import { RevisionHistoryModal } from './RevisionHistoryModal';

export const RevisionHistoryListModal = ({ isOpen, onClose, revisions, questionId }) => {
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState(null);

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

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const revDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now - revDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatDate(dateStr);
  };

  const sortedRevisions = [...(revisions || [])].reverse(); // Show newest first

  return (
    <>
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
            {sortedRevisions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No revisions yet.</p>
            ) : (
              sortedRevisions.map((revision, index) => (
                <div 
                  key={index} 
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedRevision(revision);
                    setSelectedRevisionIndex(sortedRevisions.length - 1 - index);
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Version {sortedRevisions.length - index}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(revision.revised_at || revision.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-800 mb-3 font-medium text-sm line-clamp-2">
                    {revision.text}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {formatDate(revision.revised_at || revision.timestamp)}
                    </span>
                    <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      View Details →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {selectedRevision && (
        <RevisionHistoryModal
          isOpen={!!selectedRevision}
          onClose={() => {
            setSelectedRevision(null);
            setSelectedRevisionIndex(null);
          }}
          revision={selectedRevision}
          revisionIndex={selectedRevisionIndex}
          totalRevisions={sortedRevisions.length}
        />
      )}
    </>
  );
};
