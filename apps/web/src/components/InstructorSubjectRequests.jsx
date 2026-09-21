import React, { useState, useEffect } from "react";
import { subjectService } from "../services/subjectService.js";
import { useAuth } from "../context/AuthContext.jsx";

export const InstructorSubjectRequests = ({ onCreateSectionForSubject }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRequests();
    window.addEventListener("subject-requests-changed", fetchMyRequests);
    window.addEventListener("pending-subject-requests-changed", fetchMyRequests);
    return () => {
      window.removeEventListener("subject-requests-changed", fetchMyRequests);
      window.removeEventListener("pending-subject-requests-changed", fetchMyRequests);
    };
  }, [user]);

  const fetchMyRequests = async () => {
    if (!user?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await subjectService.getMySubjectRequests(user.id);
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("Error fetching my subject requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Approved
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Rejected
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending Review
      </span>
    );
  };

  const getGradeLabel = (gradeLevel) => {
    const labels = {
      "1st": "1st Year",
      "2nd": "2nd Year",
      "3rd": "3rd Year",
      "4th": "4th Year",
    };
    return labels[gradeLevel] || gradeLevel;
  };

  // If loading or there are no active requests, render nothing so the UI is completely clean
  if (loading || requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-bold text-sm text-brand-navy flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>My Subject Requests</span>
        </h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-brand-navy text-white">
          {requests.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {requests.map((request) => {
          const isApproved = (request.request_status || "").toLowerCase() === "approved";
          const isRejected = (request.request_status || "").toLowerCase() === "rejected";
          const hasCleanDesc =
            request.description &&
            typeof request.description === "string" &&
            !request.description.trim().startsWith("{") &&
            request.description.trim().length > 0;

          return (
            <div key={request.id} className="p-4 hover:bg-slate-50/70 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-sm text-slate-800">
                      {request.subject_name}
                    </h4>
                    {request.subject_code && (
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        ({request.subject_code})
                      </span>
                    )}
                    {getStatusBadge(request.request_status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                    {request.grade_level && (
                      <>
                        <span className="font-bold text-slate-700">{getGradeLabel(request.grade_level)}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>Requested: {new Date(request.created_at).toLocaleDateString()}</span>
                    {request.reviewed_at && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600">Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>

                  {hasCleanDesc && (
                    <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                      {request.description}
                    </p>
                  )}

                  {isApproved && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Approved & Active — Ready for section creation</span>
                    </div>
                  )}

                  {isRejected && request.rejection_reason && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mt-2">
                      <p className="text-xs text-rose-800">
                        <strong className="font-bold uppercase text-[10px] tracking-wider block mb-1">
                          Rejection Feedback from Department Head:
                        </strong>
                        {request.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                {isApproved && onCreateSectionForSubject && (
                  <div className="shrink-0 pt-1 sm:pt-0">
                    <button
                      onClick={() => onCreateSectionForSubject(request)}
                      className="px-3.5 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create Section</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};