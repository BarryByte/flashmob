import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useParams } from "react-router-dom";

const StudyMode = () => {
  const { deckId } = useParams();
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredCards, setAnsweredCards] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const cardsCollection = collection(db, "cards");
        const q = query(cardsCollection, where("deckId", "==", deckId));
        const querySnapshot = await getDocs(q);
        const cardsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCards(cardsData);
      } catch (error) {
        console.error("Error fetching cards:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [deckId]);

  const handleAnswer = (correct) => {
    if (correct) {
      setScore(score + 1);
    }
    setAnsweredCards([
      ...answeredCards,
      { cardId: cards[currentCardIndex].id, correct },
    ]);
    // Check if we are on the last card:
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    } else {
      // On the last card, increment index to trigger final scorecard view
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  // Render loading indicator while fetching cards
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-400 to-blue-500 p-6">
        <p className="text-white text-xl font-semibold">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-purple-400 to-blue-500 p-6">
      {cards.length > 0 && currentCardIndex < cards.length ? (
        <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-6 text-center">
          {/* Flashcard */}
          <div
            className={`relative h-60 flex items-center justify-center text-xl font-semibold border-2 border-gray-300 rounded-lg cursor-pointer transition-transform duration-500 ${
              showAnswer ? "bg-green-100" : "bg-gray-100"
            }`}
            onClick={() => setShowAnswer(!showAnswer)}
          >
            {showAnswer
              ? cards[currentCardIndex].answer
              : cards[currentCardIndex].question}
          </div>

          {/* Buttons */}
          <div className="mt-6 flex gap-4 justify-center">
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition duration-300"
            >
              {showAnswer ? "Hide Answer" : "Show Answer"}
            </button>
            <button
              onClick={() => handleAnswer(true)}
              className="px-6 py-3 bg-green-500 text-white rounded-lg shadow-lg hover:bg-green-600 transition duration-300"
            >
              Correct ✅
            </button>
            <button
              onClick={() => handleAnswer(false)}
              className="px-6 py-3 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition duration-300"
            >
              Incorrect ❌
            </button>
          </div>
        </div>
      ) : (
        // Scorecard displayed after finishing all cards
        <div className="w-full max-w-lg bg-white shadow-xl rounded-lg p-6 text-center">
          <h2 className="text-3xl font-bold text-gray-800">🎉 Study Session Completed! 🎉</h2>
          <p className="text-lg text-gray-700 mt-4">
            Your Score: <span className="text-blue-500 font-bold">{score}</span> / {cards.length}
          </p>
          {answeredCards.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800">Review Incorrect Answers</h3>
              <div className="mt-4 space-y-3">
                {answeredCards.filter((card) => !card.correct).map((card) => {
                  const reviewedCard = cards.find((c) => c.id === card.cardId);
                  return reviewedCard ? (
                    <div
                      key={reviewedCard.id}
                      className="p-4 bg-red-100 rounded-lg shadow-md border-l-4 border-red-500"
                    >
                      <p className="font-semibold">Q: {reviewedCard.question}</p>
                      <p className="text-gray-700">A: {reviewedCard.answer}</p>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyMode;
