import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { notify } from "../utils/notify.jsx";

export const InstructorSubjectRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc("get_my_subject_requests");

      if (error) {
        // If the function doesn't exist yet (migration not run), show helpful message
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn("Subject requests function not available - migration may not be run yet");
          setRequests([]); // Set empty array instead of showing error
          return;
        }
        throw error;
      }

      setRequests(data || []);
    } catch (err) {
      console.error("Error fetching my subject requests:", err);
      // Don't show error notification - just set empty array
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    return (
      <span className={`px-2 py-1 text-xs font-bold rounded ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getGradeLabel = (gradeLevel) => {
    const labels = {
      '1st': '1st Year',
      '2nd': '2nd Year',
      '3rd': '3rd Year',
      '4th': '4th Year',
    };
    return labels[gradeLevel] || gradeLevel;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-sm text-gray-400">
          Loading your subject requests...
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-sm text-gray-400">
          <p className="mb-2">You haven't submitted any subject requests yet.</p>
          <p className="text-xs text-gray-500">
            Use the "+ Request New Subject" option in the subject dropdown to request a new subject.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Note: This feature requires the database migration to be run first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">My Subject Requests</h3>
      </div>
      
      <div className="divide-y divide-gray-100">
        {requests.map((request) => (
          <div key={request.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-800">
                    {request.subject_name}
                  </h4>
                  {request.subject_code && (
                    <span className="text-sm text-gray-500">
                      ({request.subject_code})
                    </span>
                  )}
                  {getStatusBadge(request.request_status)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                  <span>{getGradeLabel(request.grade_level)}</span>
                  <span>•</span>
                  <span>Requested: {new Date(request.created_at).toLocaleDateString()}</span>
                  {request.reviewed_at && (
                    <>
                      <span>•</span>
                      <span>Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
                
                {request.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {request.description}
                  </p>
                )}
                
                {request.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                    <p className="text-xs text-red-700">
                      <strong>Rejection reason:</strong> {request.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};