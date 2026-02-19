import * as Container from "../../container/PopupContainer.jsx";
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
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-casual-green text-white px-4 py-2 md:py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-hornblende-green transition-colors shadow-md"
        >
          <span className="text-lg">+</span>
          Create New Class
        </button>
      ) : (
        <Container.PopupContainer>
          <CreateClassPopup
            onSubmit={handleCreateSection}
            onClose={() => setShowForm(false)}
            loading={loading}
            error={error}
            formDataName={formData.name}
            formDataDescription={formData.description}
            onInputChange={handleInputChange}
          />
        </Container.PopupContainer>
      )}
    </div>
  );
};
