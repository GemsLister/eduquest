import { CreateSectionButton } from "../../components/ui/buttons/CreateSectionButton.jsx";
import { useFetchSectionQuiz } from "../../hooks/quizHook/useFetchSectionQuiz.jsx";
import * as Container from "../../components/container/containers.js";
import * as ClassCard from "../../pages/instructors/ClassSections/classIndex.js";

export const InstructorDashboard = () => {
  const {
    user,
    sections = [],
    setSections,
    sectionQuizzes,
    loading,
  } = useFetchSectionQuiz();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-hornblende-green to-sea-green px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-casual-green text-sm font-semibold uppercase tracking-widest mb-1">
              Instructor
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Your Sections
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {sections.length} {sections.length === 1 ? "class" : "classes"}{" "}
              active
            </p>
          </div>
          <CreateSectionButton
            onSectionCreated={(newSections) =>
              setSections((prev) => [newSections, ...prev])
            }
            userId={user?.id}
          />
        </div>
      </div>

      {/* Classes Grid */}
      {sections?.length === 0 ? (
        <div>
          <ClassCard.EmptyClassSection title="No Classes Found" icon="📚" />
        </div>
      ) : (
        <Container.ContentContainer>
          {sections.map((section) => (
            <Container.SectionContainer key={section.id}>
              <ClassCard.ClassInfo
                sectionId={section.id}
                sectionName={section.name}
                examCode={section.exam_code}
                subject={section.description}
                quizCount={sectionQuizzes[section.id]?.length || 0}
              />
            </Container.SectionContainer>
          ))}
        </Container.ContentContainer>
      )}
    </>
  );
};
