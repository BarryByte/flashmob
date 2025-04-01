import React from 'react';

// Component focused on AI Generation features
const AiCardGenerator = ({
  aiPrompt,
  setAiPrompt,
  generateQuestions,
  isLoading,
  errorMessage, // Pass only relevant errors or handle specific AI errors
  aiGeneratedCards,
  addAiGeneratedCards,
}) => {
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-gray-50">
      <h2 className="text-xl font-semibold mb-3 text-gray-800">
        Generate Cards with AI
      </h2>
      <textarea
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
        placeholder="Paste text here to generate questions and answers..."
        className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        rows={4} // Give it a bit more space
      />
      <button
        onClick={generateQuestions}
        disabled={isLoading}
        className={`w-full p-3 text-white rounded transition ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isLoading ? 'Generating...' : 'Generate Cards'}
      </button>
      {/* Display AI-specific error message if needed */}
      {/* {errorMessage && <p className="mt-2 text-red-600">{errorMessage}</p>} */}


      {/* AI Generated Cards Preview */}
      {aiGeneratedCards.length > 0 && (
        <div className="mt-6 p-4 border rounded-lg shadow-sm bg-blue-50">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            Preview AI Generated Cards
          </h3>
          <div className="max-h-60 overflow-y-auto space-y-3 pr-2"> {/* Added scroll */}
            {aiGeneratedCards.map((card, index) => (
              <div key={index} className="p-3 border rounded bg-white shadow-sm">
                <p className="font-semibold text-gray-700">
                  Q: {card.question}
                </p>
                <p className="text-gray-600 text-sm">A: {card.answer}</p>
              </div>
            ))}
          </div>
          <button
            onClick={addAiGeneratedCards}
            className="w-full mt-4 p-3 bg-purple-500 text-white rounded hover:bg-purple-600 transition"
          >
            Add These Cards to Deck
          </button>
        </div>
      )}
    </div>
  );
};

export default AiCardGenerator;