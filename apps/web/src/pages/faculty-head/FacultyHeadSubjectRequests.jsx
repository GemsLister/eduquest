import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { notify } from "../../utils/notify.jsx";

export const FacultyHeadSubjectRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, approved, rejected
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  
  // Direct subject creation form
  const [newSubject, setNewSubject] = useState({
    subject_name: "",
    subject_code: "",
    grade_level: "1st",
    description: "",
  });
  const [creatingSubject, setCreatingSubject] = useState(false);

  const gradeLevels = ["1st", "2nd", "3rd", "4th"];

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc("get_all_subject_requests");

      if (error) {
        // If the function doesn't exist yet (migration not run), show helpful message
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn("get_all_subject_requests function not available - migration may not be run yet");
          setRequests([]);
          return;
        }
        throw error;
      }

      let filteredData = data || [];
      
      if (filter !== "all") {
        filteredData = filteredData.filter(r => r.request_status === filter);
      }

      setRequests(filteredData);
    } catch (err) {
      console.error("Error fetching subject requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      const { data, error } = await supabase.rpc("approve_subject_request", {
        p_request_id: requestId,
      });

      if (error) throw error;

      if (data.success) {
        notify.success("Subject request approved and created successfully!");
        fetchRequests();
      } else {
        notify.error(data.error || "Failed to approve request");
      }
    } catch (err) {
      console.error("Error approving request:", err);
      notify.error("Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId, reason) => {
    if (!reason || !reason.trim()) {
      notify.error("Please provide a reason for rejection");
      return;
    }

    setProcessingId(requestId);
    try {
      const { data, error } = await supabase.rpc("approve_subject_request", {
        p_request_id: requestId,
        p_rejection_reason: reason.trim(),
      });

      if (error) throw error;

      if (data.success) {
        notify.success("Subject request rejected");
        fetchRequests();
      } else {
        notify.error(data.error || "Failed to reject request");
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
      notify.error("Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDirectCreate = async (e) => {
    e.preventDefault();
    setCreatingSubject(true);

    try {
      if (!newSubject.subject_name.trim()) {
        notify.error("Subject name is required");
        return;
      }

      const { data, error } = await supabase.rpc("create_subject_direct", {
        p_subject_name: newSubject.subject_name.trim(),
        p_subject_code: newSubject.subject_code.trim() || null,
        p_grade_level: newSubject.grade_level,
        p_description: newSubject.description.trim() || null,
      });

      if (error) throw error;

      if (data.success) {
        notify.success("Subject created successfully!");
        setNewSubject({
          subject_name: "",
          subject_code: "",
          grade_level: "1st",
          description: "",
        });
        setShowCreateForm(false);
      } else {
        notify.error(data.error || "Failed to create subject");
      }
    } catch (err) {
      console.error("Error creating subject:", err);
      notify.error("Failed to create subject");
    } finally {
      setCreatingSubject(false);
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy mb-2">
          Subject Request Management
        </h1>
        <p className="text-gray-600">
          Review and manage subject requests from instructors
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending Requests</p>
          <p className="text-2xl font-bold text-brand-navy">
            {requests.filter(r => r.request_status === 'pending').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Approved Today</p>
          <p className="text-2xl font-bold text-green-600">
            {requests.filter(r => r.request_status === 'approved' && 
              new Date(r.reviewed_at).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Processed</p>
          <p className="text-2xl font-bold text-gray-700">
            {requests.filter(r => r.request_status !== 'pending').length}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filter === status
                  ? "bg-brand-navy text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:border-brand-navy"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
        >
          + Create Subject Directly
        </button>
      </div>

      {/* Direct Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Create New Subject</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleDirectCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={newSubject.subject_name}
                  onChange={(e) => setNewSubject({...newSubject, subject_name: e.target.value})}
                  placeholder="e.g., Database Management"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                  disabled={creatingSubject}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject Code
                </label>
                <input
                  type="text"
                  value={newSubject.subject_code}
                  onChange={(e) => setNewSubject({...newSubject, subject_code: e.target.value})}
                  placeholder="e.g., CS301"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                  disabled={creatingSubject}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Grade Level *
              </label>
              <select
                value={newSubject.grade_level}
                onChange={(e) => setNewSubject({...newSubject, grade_level: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
                disabled={creatingSubject}
              >
                {gradeLevels.map((level) => (
                  <option key={level} value={level}>
                    {level} Year
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={newSubject.description}
                onChange={(e) => setNewSubject({...newSubject, description: e.target.value})}
                placeholder="Brief description of the subject..."
                rows="3"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm resize-none"
                disabled={creatingSubject}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                disabled={creatingSubject}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingSubject}
                className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-50"
              >
                {creatingSubject ? "Creating..." : "Create Subject"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No subject requests found
          </div>
        ) : (
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
                      <span>Requested by: {request.requester_name || request.requested_by_email}</span>
                      <span>•</span>
                      <span>{new Date(request.created_at).toLocaleDateString()}</span>
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
                  
                  {request.request_status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {processingId === request.id ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Enter rejection reason:");
                          if (reason) handleReject(request.id, reason);
                        }}
                        disabled={processingId === request.id}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};