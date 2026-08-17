import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { subjectService } from "../services/subjectService";

export const InstructorSubjectAssignmentManager = () => {
  const [allSubjects, setAllSubjects] = useState([]);
  const [allInstructors, setAllInstructors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, instructorsRes, assignmentsRes] = await Promise.all([
        subjectService.getAllSubjects(),
        subjectService.getAllInstructors(),
        subjectService.getAllInstructorSubjectAssignments(),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      setAllSubjects(subjectsRes.data || []);
      setAllInstructors(instructorsRes.data || []);
      setAssignments(assignmentsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignInstructor = async () => {
    if (!selectedSubject || !selectedInstructor) {
      alert("Please select both a subject and an instructor");
      return;
    }

    setIsAssigning(true);
    try {
      const { data, error } = await subjectService.assignSubjectToInstructor(
        selectedSubject,
        selectedInstructor
      );

      if (error) throw error;

      await loadData();
      setSelectedSubject(null);
      setSelectedInstructor(null);
      alert("Instructor assigned to subject successfully!");
    } catch (error) {
      console.error("Error assigning instructor:", error);
      alert("Failed to assign instructor: " + error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!confirm("Remove this instructor from the subject?")) return;

    try {
      await subjectService.removeInstructorSubject(assignmentId);
      await loadData();
      alert("Assignment removed successfully!");
    } catch (error) {
      console.error("Error removing assignment:", error);
      alert("Failed to remove assignment: " + error.message);
    }
  };

  const toggleSubjectExpand = (subjectId) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  // Group assignments by subject
  const assignmentsBySubject = assignments.reduce((acc, assignment) => {
    if (!acc[assignment.subject_id]) {
      acc[assignment.subject_id] = {
        subject_id: assignment.subject_id,
        subject_name: assignment.subjects?.name || "Unknown",
        subject_code: assignment.subjects?.code || "",
        instructors: [],
      };
    }
    acc[assignment.subject_id].instructors.push({
      id: assignment.id,
      instructor_id: assignment.instructor_id,
      instructor_name: `${assignment.profiles?.first_name || ""} ${assignment.profiles?.last_name || ""}`.trim() || assignment.profiles?.email || "Unknown",
      instructor_email: assignment.profiles?.email || "",
      assigned_at: assignment.assigned_at,
    });
    return acc;
  }, {});

  // Get available instructors for a subject (not already assigned)
  const getAvailableInstructors = (subjectId) => {
    const assignedInstructorIds = assignmentsBySubject[subjectId]?.instructors.map(i => i.instructor_id) || [];
    return allInstructors.filter(instructor => !assignedInstructorIds.includes(instructor.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Instructor Subject Assignments</h2>
        <p className="text-gray-600 text-sm">
          Manage which instructors are assigned to each subject. Instructors in the same subject can view each other's quizzes.
        </p>
      </div>

      {/* Quick Assign Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Assign Instructor to Subject</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Subject
            </label>
            <select
              value={selectedSubject || ""}
              onChange={(e) => setSelectedSubject(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="">-- Select a subject --</option>
              {allSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} {subject.code && `(${subject.code})`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Instructor
            </label>
            <select
              value={selectedInstructor || ""}
              onChange={(e) => setSelectedInstructor(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <option value="">-- Select an instructor --</option>
              {allInstructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.first_name} {instructor.last_name} ({instructor.email})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAssignInstructor}
            disabled={isAssigning || !selectedSubject || !selectedInstructor}
            className="px-6 py-2 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-indigo disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAssigning ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>

      {/* Subject Assignments List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">All Subject Assignments</h3>
        
        {allSubjects.length === 0 ? (
          <p className="text-gray-500 text-sm">No subjects found.</p>
        ) : (
          <div className="space-y-3">
            {allSubjects.map((subject) => {
              const subjectAssignments = assignmentsBySubject[subject.id];
              const isExpanded = expandedSubjects.has(subject.id);
              const availableInstructors = getAvailableInstructors(subject.id);

              return (
                <div key={subject.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSubjectExpand(subject.id)}
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {subject.name}
                          {subject.code && (
                            <span className="ml-2 text-sm text-gray-500">({subject.code})</span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {subjectAssignments?.instructors.length || 0} instructor(s) assigned
                        </p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200">
                      {subjectAssignments?.instructors.length === 0 ? (
                        <p className="text-gray-500 text-sm mb-4">No instructors assigned to this subject yet.</p>
                      ) : (
                        <div className="space-y-2 mb-4">
                          {subjectAssignments.instructors.map((instructor) => (
                            <div
                              key={instructor.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-800">{instructor.instructor_name}</p>
                                <p className="text-xs text-gray-500">{instructor.instructor_email}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveAssignment(instructor.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add instructor to this subject */}
                      <div className="border-t border-gray-200 pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Add Instructor to {subject.name}
                        </label>
                        <div className="flex gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                subjectService.assignSubjectToInstructor(subject.id, e.target.value)
                                  .then(() => loadData())
                                  .catch(err => alert("Failed to assign: " + err.message));
                                e.target.value = "";
                              }
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
                          >
                            <option value="">-- Select instructor to add --</option>
                            {availableInstructors.map((instructor) => (
                              <option key={instructor.id} value={instructor.id}>
                                {instructor.first_name} {instructor.last_name} ({instructor.email})
                              </option>
                            ))}
                          </select>
                        </div>
                        {availableInstructors.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">All instructors are already assigned to this subject.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
