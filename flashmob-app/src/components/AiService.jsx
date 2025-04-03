const AI_API_ENDPOINT = "https://flashmob-4gj7.onrender.com/generate_questions";

/**
 * Sends text to the AI backend to generate flashcard questions and answers.
 * @param {string} textPrompt - The text to generate cards from.
 * @param {number} numQuestions - The desired number of questions.
 * @param {function} setIsLoading - Setter for the AI loading state.
 * @param {function} setAiGeneratedCards - Setter for the generated cards state.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const generateAICards = async (textPrompt, numQuestions, setIsLoading, setAiGeneratedCards, setSuccessMessage, setErrorMessage) => {
    setIsLoading(true);
    setAiGeneratedCards([]); // Clear previous results

    try {
        if (!textPrompt.trim()) {
            throw new Error("Please enter text to generate questions from");
        }

        const response = await fetch(AI_API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: textPrompt,
                num_questions: numQuestions,
            }),
            signal: AbortSignal.timeout(45000), // 45-second timeout
        });

        if (!response.ok) {
            let errorMsg = `AI Service Error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
              //
             }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Received AI data:", data);

        if (data.generated_cards && Array.isArray(data.generated_cards)) {
            setAiGeneratedCards(data.generated_cards);
            if (data.generated_cards.length === 0) {
                setSuccessMessage("AI processing complete, but no cards were generated. Try adjusting your input text.");
            } else {
                setSuccessMessage(`Generated ${data.generated_cards.length} cards. Review below.`);
            }
        } else {
            throw new Error("Invalid response format from AI server");
        }
    } catch (error) {
        console.error("Error generating questions:", error);
        let userFriendlyError = error.message || "Failed to generate questions. Please try again.";
        if (error.name === 'TimeoutError') {
            userFriendlyError = "The request to generate questions timed out. Please try again later.";
        }
        setErrorMessage(userFriendlyError);
    } finally {
        setIsLoading(false);
    }
};