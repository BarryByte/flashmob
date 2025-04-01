import React from 'react';

// Component focused on Manual Card Form and List
const CardManagement = ({
  cards,
  question,
  setQuestion,
  answer,
  setAnswer,
  addCard,
  editCard, // Function to initiate edit mode in parent
  deleteCard,
  editCardId, // To change button text
}) => {
  return (
    <>
      {/* Card Add/Edit Form */}
      <div className="p-4 border rounded-lg shadow-sm bg-gray-50 mb-6">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">
          {editCardId ? 'Edit Card' : 'Add Card Manually'}
        </h2>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question"
          className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer"
          className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={addCard} // Parent's function handles both add and update logic
          className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          {editCardId ? 'Update Card' : 'Add Card'}
        </button>
        {editCardId && (
           <button
             onClick={() => editCard(null)} // Pass null or an empty object to clear edit state
             className="w-full mt-2 p-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
           >
             Cancel Edit
           </button>
        )}
      </div>

      {/* Existing Cards List */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">
          Cards in Deck ({cards.length})
        </h2>
        {cards.length === 0 ? (
          <p className="text-gray-500 italic">No cards added yet.</p>
        ) : (
          <ul className="space-y-4">
            {cards.map((card) => (
              <li
                key={card.id}
                className="p-4 bg-white rounded-lg shadow flex flex-col md:flex-row items-start justify-between gap-4"
              >
                <div className="flex-1">
                  <p className="text-gray-800">
                    <span className="font-semibold">Q:</span> {card.question}
                  </p>
                  <p className="text-gray-700 mt-1">
                    <span className="font-semibold">A:</span> {card.answer}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-3">
                  <button
                    onClick={() => editCard(card)} // Pass the whole card object to parent
                    className="px-4 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500 transition text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default CardManagement;