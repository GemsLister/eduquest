import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";

export const StudentProfileNav = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [students, setStudents] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch instructor and sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) setUser(authUser);

        if (authUser) {
          const { data: sectionsData } = await supabase
            .from("sections")
            .select("id, name, description")
            .eq("instructor_id", authUser.id)
            .order("created_at", { ascending: false });
          setSections(sectionsData || []);
          if (sectionsData?.length > 0) {
            setSelectedSection(sectionsData[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch students for selected section
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedSection) return;

      try {
        setLoading(true);

        // Get all quizzes in the section
        const { data: quizzes } = await supabase
          .from("quizzes")
          .select("id")
          .eq("section_id", selectedSection)
          .eq("is_archived", false);

        if (!quizzes || quizzes.length === 0) {
          setStudents([]);
          return;
        }

        const quizIds = quizzes.map((q) => q.id);

        // Get all quiz attempts for these quizzes
        const { data: attempts } = await supabase
          .from("quiz_attempts")
          .select(
            "id, student_id, score, total_points, student_profile(id, student_name, student_email, student_id)"
          )
          .in("quiz_id", quizIds);

        if (!attempts) {
          setStudents([]);
          return;
        }

        // Group by student
        const studentMap = new Map();
        attempts.forEach((attempt) => {
          if (attempt.student_profile) {
            const key = attempt.student_profile.id;
            if (!studentMap.has(key)) {
              studentMap.set(key, attempt.student_profile);
            }
          }
        });

        // Convert to array and sort by name
        const uniqueStudents = Array.from(studentMap.values()).sort((a, b) =>
          (a.student_name || "").localeCompare(b.student_name || "")
        );

        setStudents(uniqueStudents);

        // Calculate stats for each student
        const stats = {};
        for (const student of uniqueStudents) {
          const studentAttempts = attempts.filter(
            (a) => a.student_profile?.id === student.id
          );
          const totalScore = studentAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
          const totalPoints = studentAttempts.reduce((sum, a) => sum + (a.total_points || 0), 0);

          stats[student.id] = {
            attempts: studentAttempts.length,
            averageScore:
              studentAttempts.length > 0
                ? Math.round((totalScore / totalPoints) * 100)
                : 0,
          };
        }
        setStudentStats(stats);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [selectedSection]);

  // Filter students by search term
  const filteredStudents = students.filter(
    (student) =>
      student.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="text-casual-green font-semibold mb-4 hover:underline flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-hornblende-green mb-2">
          Student Profiles
        </h1>
        <p className="text-gray-600">
          View student performance and strengths/weaknesses by Bloom's taxonomy levels
        </p>
      </div>

      {/* Section Selection */}
      <div className="mb-6 max-w-xs">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Select Section
        </label>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, email, or student ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
        />
      </div>

      {/* Students Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
            <p className="mt-4 text-hornblende-green font-semibold">
              Loading students...
            </p>
          </div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">
            {searchTerm
              ? "No students match your search"
              : "No students found in this section"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const stats = studentStats[student.id] || {
              attempts: 0,
              averageScore: 0,
            };
            return (
              <div
                key={student.id}
                onClick={() =>
                  navigate(
                    `/instructor-dashboard/student-profile/${student.id}`,
                    { state: { section: selectedSection } }
                  )
                }
                className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg hover:border-casual-green transition-all cursor-pointer"
              >
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-casual-green to-hornblende-green flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {student.student_name?.charAt(0)?.toUpperCase() || "S"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 truncate">
                      {student.student_name || "Unknown"}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {student.student_id}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <p className="text-xs text-gray-600 mb-4 truncate">
                  {student.student_email}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-black text-blue-600">
                      {stats.attempts}
                    </p>
                    <p className="text-xs text-blue-600 font-semibold">
                      Attempts
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-black text-emerald-600">
                      {stats.averageScore}%
                    </p>
                    <p className="text-xs text-emerald-600 font-semibold">
                      Avg Score
                    </p>
                  </div>
                </div>

                {/* View Profile Button */}
                <button className="w-full bg-casual-green text-white py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors text-sm">
                  View Profile →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
