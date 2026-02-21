import { useState } from "react";

export const CreateQuizFormButton = ({
  onCreateQuiz,
  isSubmitting,
  quizFormData,
  setQuizFormData,
}) => {
  const [showQuizForm, setShowQuizForm] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateQuiz(e);
    setShowQuizForm(false);
  };

  return (
    <div>
      {!showQuizForm ? (
        <div className="mb-8">
          <button
            onClick={() => setShowQuizForm(true)}
            className="flex items-center gap-2 bg-casual-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors shadow-md"
          >
            <span className="text-lg">+</span> Create Quiz
          </button>
        </div>
      ) : (
        <div className="absolute bg-white rounded-lg p-6 shadow-md border border-gray-200 mb-8 z-10">
          <h3 className="text-xl font-bold text-hornblende-green mb-4">
            Create New Quiz
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... Your existing input fields ... */}
            <div className="flex flex-col gap-3 justify-end w-2xs">
              <article className="flex flex-col gap-3">
                {/* Input for Quiz Title */}
                <label className="font-bold text-gray-800">Quiz Title</label>
                <input
                  type="text"
                  className="border border-gray-400 p-2 rounded-lg"
                  value={quizFormData.title}
                  onChange={(e) =>
                    setQuizFormData({ ...quizFormData, title: e.target.value })
                  }
                />
              </article>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
              >
                {isSubmitting ? "Creating..." : "Create Quiz"}
              </button>
              <button
                type="button"
                onClick={() => setShowQuizForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
// import * as UIComponent from "../uiComponent";

// // Add quizFormData and setQuizFormData to the props
// export const CreateQuizFormButton = ({
//   onCreateQuiz,
//   isSubmitting,
//   quizFormData,
//   setQuizFormData,
// }) => {
//   const [showQuizForm, setShowQuizForm] = useState(false);

//   // DELETE the local useState that was here!

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     onCreateQuiz(e);
//     // We don't reset state here anymore; the hook handles it after success
//     setShowQuizForm(false);
//   };

//   return (
//     <div>
//       {!showQuizForm ? (
//         <div className="mb-8">
//           <UIComponent.PrimaryButton
//             onClick={() => setShowQuizForm(true)}
//             className="..."
//           >
//             + Create Quiz Box
//           </UIComponent.PrimaryButton>
//         </div>
//       ) : (
//         <div className="...">
//           <form onSubmit={handleSubmit} className="space-y-4">
//             <article className="flex flex-col">
//               <label className="font-bold text-gray-800">Quiz Title</label>
//               <input
//                 type="text"
//                 className="border border-gray-400 p-2 rounded-lg"
//                 value={quizFormData.title} // This now refers to the HOOK'S state
//                 onChange={(e) =>
//                   setQuizFormData({ ...quizFormData, title: e.target.value })
//                 }
//               />
//             </article>

//             <UIComponent.PrimaryButton type="submit" disabled={isSubmitting}>
//               {isSubmitting ? "Creating..." : "Create"}
//             </UIComponent.PrimaryButton>
//             <button
//               type="button"
//               onClick={() => setShowQuizForm(false)}
//               className="..."
//             >
//               Cancel
//             </button>
//           </form>
//         </div>
//       )}
//     </div>
//   );
// };
