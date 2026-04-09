import { useCreateSection } from "../../../hooks/useCreateSection.jsx";
import { CreateClassPopup } from "../forms/CreateClassPopup.jsx";

export const CreateSectionButton = ({ onSectionCreated, userId }) => {
  const {
    handleCreateSection,
    handleInputChange,
    showForm,
    setShowForm,
    loading,
    error,
    formData,
  } = useCreateSection(onSectionCreated, userId);

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 bg-brand-gold text-brand-navy px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-gold-dark transition-all duration-200 shadow-md"
      >
        <span className="text-lg leading-none">+</span>
        New Subject
      </button>

      {showForm && (
        <CreateClassPopup
          onSubmit={handleCreateSection}
          onClose={() => setShowForm(false)}
          loading={loading}
          error={error}
          formDataName={formData.name}
          formDataDescription={formData.description}
          formDataSubjectCode={formData.subject_code}
          onInputChange={handleInputChange}
        />
      )}
    </>
  );
};
