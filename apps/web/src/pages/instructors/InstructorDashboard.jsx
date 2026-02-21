import { CreateSectionButton } from "../../components/ui/buttons/CreateSectionButton.jsx";
import { useFetchSectionQuiz } from "../../hooks/useFetchSectionQuiz.jsx";
import * as Container from "../../components/container/containers.js";
import * as ClassCard from "../../pages/instructors/ClassSections/classIndex.js";

export const InstructorDashboard = () => {
  const { user, sections = [], setSections, loading } = useFetchSectionQuiz();

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
    <Container.PagesContainer>
      {/* Hero Section */}
      <div className="flex justify-between items-center bg-white border-b border-gray-200 px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Sections
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Manage your classes and create quizzes
          </p>
        </div>
        {/* Create Section */}
      </div>
      <div className="my-4 mx-7">
        <CreateSectionButton
          onSectionCreated={(newSections) =>
            setSections((prev) => [newSections, ...prev])
          }
          userId={user?.id}
        />
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
              />
            </Container.SectionContainer>
          ))}
        </Container.ContentContainer>
      )}
    </Container.PagesContainer>
  );
};
