import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { subjectService } from "../services/subjectService";

export const SubjectAssignmentManager = ({ onAssignmentComplete }) => {
  const [allSubjects, setAllSubjects] = useState([]);
  const [instructorSubjects, setInstructorSubjects] = useState([]);
  const [instructorSections, setInstructorSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState(null);
  const [gradeLevelCounts, setGradeLevelCounts] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: "", code: "", description: "", grade_level: "1st" });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, instructorSubjectsRes, sectionsRes, gradeLevelsRes] = await Promise.all([
        subjectService.getAllSubjects(),
        subjectService.getInstructorSubjects(),
        subjectService.getInstructorSections(),
        subjectService.getGradeLevelsWithCounts(),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (instructorSubjectsRes.error) throw instructorSubjectsRes.error;
      if (sectionsRes.error) throw sectionsRes.error;
      if (gradeLevelsRes.error) throw gradeLevelsRes.error;

      setAllSubjects(subjectsRes.data || []);
      setInstructorSubjects(instructorSubjectsRes.data || []);
      setInstructorSections(sectionsRes.data || []);
      setGradeLevelCounts(gradeLevelsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSubject = async () => {
    if (!selectedSubject) {
      alert("Please select a subject");
      return;
    }

    setIsAssigning(true);
    try {
      // Assign subject to instructor
      const { data: assignResult, error: assignError } = await subjectService.assignSubjectToInstructor(selectedSubject);
      
      if (assignError) throw assignError;

      // Assign sections to the instructor-subject combination
      if (selectedSections.length > 0 && assignResult) {
        await subjectService.assignSectionsToInstructorSubject(assignResult, selectedSections);
      }

      await loadData();
      setSelectedSubject(null);
      setSelectedGradeLevel(null);
      setSelectedSections([]);
      if (onAssignmentComplete) onAssignmentComplete();
      alert("Subject assigned successfully!");
    } catch (error) {
      console.error("Error assigning subject:", error);
      alert("Failed to assign subject: " + error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubject.name.trim()) {
      alert("Subject name is required");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await subjectService.createSubject({
        name: newSubject.name.trim(),
        code: newSubject.code.trim(),
        description: newSubject.description.trim(),
        grade_level: newSubject.grade_level,
      });

      if (error) throw error;

      await loadData();
      setNewSubject({ name: "", code: "", description: "", grade_level: "1st" });
      setShowCreateForm(false);
      alert("Subject created successfully!");
    } catch (error) {
      console.error("Error creating subject:", error);
      alert("Failed to create subject: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveAssignment = async (instructorSubjectId) => {
    if (!confirm("Remove this subject assignment?")) return;

    try {
      await subjectService.removeInstructorSubject(instructorSubjectId);
      await loadData();
      if (onAssignmentComplete) onAssignmentComplete();
      alert("Assignment removed successfully!");
    } catch (error) {
      console.error("Error removing assignment:", error);
      alert("Failed to remove assignment: " + error.message);
    }
  };

  const handleRemoveSection = async (instructorSubjectId, sectionId) => {
    try {
      await subjectService.removeSectionFromInstructorSubject(instructorSubjectId, sectionId);
      await loadData();
      if (onAssignmentComplete) onAssignmentComplete();
    } catch (error) {
      console.error("Error removing section:", error);
      alert("Failed to remove section: " + error.message);
    }
  };

  // Group instructor subjects by subject
  const groupedInstructorSubjects = instructorSubjects.reduce((acc, item) => {
    if (!acc[item.subject_id]) {
      acc[item.subject_id] = {
        subject_id: item.subject_id,
        subject_name: item.subject_name,
        subject_code: item.subject_code,
        instructor_subject_id: item.instructor_subject_id,
        sections: [],
      };
    }
    if (item.section_id) {
      acc[item.subject_id].sections.push({
        section_id: item.section_id,
        section_name: item.section_name,
        section_exam_code: item.section_exam_code,
        instructor_subject_id: item.instructor_subject_id,
      });
    }
    return acc;
  }, {});

  const availableSubjects = allSubjects.filter(
    (s) => !groupedInstructorSubjects[s.id] && (!selectedGradeLevel || s.grade_level === selectedGradeLevel)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Assignments */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Your Subject Assignments</h3>
        
        {Object.values(groupedInstructorSubjects).length === 0 ? (
          <p className="text-gray-500 text-sm">No subject assignments yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.values(groupedInstructorSubjects).map((assignment) => (
              <div key={assignment.subject_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {assignment.subject_name}
                      {assignment.subject_code && (
                        <span className="ml-2 text-sm text-gray-500">({assignment.subject_code})</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {assignment.sections.length} {assignment.sections.length === 1 ? "section" : "sections"} assigned
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveAssignment(assignment.instructor_subject_id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
                
                {assignment.sections.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {assignment.sections.map((section) => (
                      <span
                        key={section.section_id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {section.section_name}
                        <button
                          onClick={() => handleRemoveSection(assignment.instructor_subject_id, section.section_id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign New Subject */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Assign New Subject</h3>
        
        {/* Grade Level Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Grade Level
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGradeLevel(null)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedGradeLevel === null
                  ? "bg-brand-navy text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {gradeLevelCounts.map((gl) => (
              <button
                key={gl.grade_level}
                onClick={() => setSelectedGradeLevel(gl.grade_level)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedGradeLevel === gl.grade_level
                    ? "bg-brand-navy text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {gl.grade_level} ({gl.subject_count})
              </button>
            ))}
          </div>
        </div>
        
        {!showCreateForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Subject
              </label>
              <select
                value={selectedSubject || ""}
                onChange={(e) => setSelectedSubject(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="">-- Select a subject --</option>
                {availableSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} {subject.code && `(${subject.code})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Sections (optional)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {instructorSections.map((section) => (
                  <label key={section.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(section.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSections([...selectedSections, section.id]);
                        } else {
                          setSelectedSections(selectedSections.filter((id) => id !== section.id));
                        }
                      }}
                      className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                    />
                    <span className="text-sm">{section.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAssignSubject}
                disabled={isAssigning || !selectedSubject}
                className="px-4 py-2 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-indigo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigning ? "Assigning..." : "Assign Subject"}
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Create New Subject
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade Level *
              </label>
              <select
                value={newSubject.grade_level}
                onChange={(e) => setNewSubject({ ...newSubject, grade_level: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="1st">1st Year</option>
                <option value="2nd">2nd Year</option>
                <option value="3rd">3rd Year</option>
                <option value="4th">4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Name *
              </label>
              <input
                type="text"
                value={newSubject.name}
                onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                placeholder="e.g., Database Management"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Code (optional)
              </label>
              <input
                type="text"
                value={newSubject.code}
                onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                placeholder="e.g., IT113"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={newSubject.description}
                onChange={(e) => setNewSubject({ ...newSubject, description: e.target.value })}
                placeholder="Brief description of the subject"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateSubject}
                disabled={isCreating}
                className="px-4 py-2 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-indigo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Subject"}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
