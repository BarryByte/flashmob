import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth"; // To get current user
import jsPDF from 'jspdf';

// --- Helper: Email Validation ---
const isValidEmail = (email) => {
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const DeckEditor = () => {
  const { deckId } = useParams();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  // Manual card states
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  // AI-specific prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGeneratedCards, setAiGeneratedCards] = useState([]);
  // Collaborator states
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaborators, setCollaborators] = useState([]); // Stores emails of collaborators
  // Editing states
  const [editCardId, setEditCardId] = useState(null);
  const [editDeckTitle, setEditDeckTitle] = useState("");
  const [isEditingDeckTitle, setIsEditingDeckTitle] = useState(false);

  // State for messages and loading indicators
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState(""); // For success feedback
  const [isLoading, setIsLoading] = useState(false); // For AI generation
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false); // Loading state for adding collaborator
  const [currentUserEmail, setCurrentUserEmail] = useState(null); // Store current user's email
  const [currentUserId, setCurrentUserId] = useState(null); // Store current user's UID for owner check

  const [isExportingPDF, setIsExportingPDF] = useState(false); // State for PDF export loading


  // --- Get Current User ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
       if (user) {
         setCurrentUserEmail(user.email);
         setCurrentUserId(user.uid); // Store UID
       } else {
         setCurrentUserEmail(null);
         setCurrentUserId(null);
         // Handle logged-out state if necessary (e.g., redirect)
         console.log("User is logged out.");
         // Might want to clear deck/card data or redirect here
       }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);


  // --- Fetch Deck, Cards, and Collaborators ---
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component

    // Fetch initial deck data
    const fetchDeckData = async () => {
      if (!deckId) return;
      try {
        const deckRef = doc(db, "decks", deckId);
        const deckDoc = await getDoc(deckRef);
        if (isMounted && deckDoc.exists()) {
          const deckData = deckDoc.data();
          setDeck(deckData);
          setEditDeckTitle(deckData.title);
          // Set initial collaborators from the first fetch
          setCollaborators(deckData.collaborators || []);
        } else if (isMounted) {
          console.error("Deck not found!");
          setErrorMessage("Deck not found or you may not have access.");
        }
      } catch (error) {
        console.error("Error fetching initial deck data:", error);
        if (isMounted) {
          setErrorMessage("Failed to load deck data.");
        }
      }
    };

    fetchDeckData(); // Call the fetch function

    // Subscribe to real-time card updates
    const cardsQuery = query(collection(db, "cards"), where("deckId", "==", deckId));
    const unsubscribeCards = onSnapshot(cardsQuery, (snapshot) => {
        if (isMounted) {
          const cardsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setCards(cardsData);
        }
      }, (error) => {
        console.error("Error listening to card updates:", error);
        if (isMounted) {
          // Avoid overwriting more specific errors like 'deck not found'
          if (!errorMessage) setErrorMessage("Failed to load card updates.");
        }
      }
    );

    // Subscribe to real-time deck updates (for collaborators and title changes)
    const deckRef = doc(db, "decks", deckId);
    const unsubscribeDeck = onSnapshot(deckRef, (docSnap) => {
        if (isMounted && docSnap.exists()) {
          const deckData = docSnap.data();
          setDeck(deckData); // Keep deck state updated
          setCollaborators(deckData.collaborators || []); // Update collaborators list
          // Update title display if it's not currently being edited
          if (!isEditingDeckTitle) {
             setEditDeckTitle(deckData.title);
          }
        } else if (isMounted) {
          // Handle case where deck is deleted while viewing or permissions change
          console.error("Deck not found or deleted, or permissions revoked.");
          setErrorMessage("Deck not found, or access may have been revoked.");
          setDeck(null); // Clear deck data
          setCards([]); // Clear cards
        }
      }, (error) => {
        console.error("Error listening to deck updates:", error);
        if (isMounted) {
           if (!errorMessage) setErrorMessage("Failed to sync deck updates.");
        }
      }
    );

    // Cleanup function
    return () => {
      isMounted = false;
      unsubscribeCards();
      unsubscribeDeck();
    };
    // Add isEditingDeckTitle to dependencies to avoid resetting title input during edit
  }, [deckId, isEditingDeckTitle]);


  // --- Determine if the current user is the owner ---
  // IMPORTANT: Assumes your deck document has an 'ownerId' field containing the Firebase Auth UID of the creator.
  const isOwner = deck && currentUserId && deck.ownerId === currentUserId;


  // --- Clear Messages ---
  const clearMessages = () => {
      setErrorMessage("");
      setSuccessMessage("");
  }

  // --- Update Deck Title ---
  const updateDeckTitle = async () => {
    clearMessages();
    if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can change the title.");
        return;
    }
    if (!editDeckTitle.trim()) {
      setErrorMessage("Deck title cannot be empty.");
      return;
    }
    try {
      await updateDoc(doc(db, "decks", deckId), {
        title: editDeckTitle.trim(),
      });
      setIsEditingDeckTitle(false);
      setSuccessMessage("Deck title updated successfully.");
    } catch (error) {
      console.error("Error updating deck title:", error);
      setErrorMessage("Failed to update deck title. Please try again.");
    }
  };

  // --- Add Collaborator ---
  const addCollaborator = async () => {
    clearMessages(); // Clear previous messages
    const emailToAdd = collaboratorEmail.trim().toLowerCase(); // Normalize email

    if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can add collaborators.");
        return;
    }

    if (!isValidEmail(emailToAdd)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!currentUserEmail) {
        setErrorMessage("Could not verify current user. Please log in again.");
        return;
    }

    // Check if inviting self
    if (emailToAdd === currentUserEmail) {
      setErrorMessage("You cannot add yourself as a collaborator.");
      return;
    }

    // Check if already a collaborator
    if (collaborators.includes(emailToAdd)) {
      setErrorMessage(`'${emailToAdd}' is already a collaborator.`);
      return;
    }

    setIsAddingCollaborator(true);

    try {
      // **Step 1: Check if the user exists in your 'users' collection**
      // Assumes 'users' collection with 'email' field per user doc.
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", emailToAdd));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorMessage(
          `No registered user found with email '${emailToAdd}'. Please ask them to sign up first.`
        );
        setIsAddingCollaborator(false);
        return; // Stop execution
      }

      // **Step 2: User exists, add their email to the deck's collaborators array**
      await updateDoc(doc(db, "decks", deckId), {
        collaborators: arrayUnion(emailToAdd), // Add email to the array
      });

      setCollaboratorEmail(""); // Clear input field
      setSuccessMessage(`Successfully invited ${emailToAdd}.`);
      // The `onSnapshot` listener for the deck will automatically update the UI.

    } catch (error) {
      console.error("Error adding collaborator:", error);
      if (error.code === 'permission-denied') {
         setErrorMessage("Permission denied. Only the deck owner can add collaborators.");
      } else {
         setErrorMessage("Failed to add collaborator. Please check the email and try again.");
      }
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  // --- Remove Collaborator ---
  const removeCollaborator = async (emailToRemove) => {
    clearMessages();
     if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can remove collaborators.");
        return;
    }


    try {
        const currentCollaborators = deck?.collaborators || [];
        // Filter *out* the email to remove
        const updatedCollaborators = currentCollaborators.filter(email => email !== emailToRemove);

        await updateDoc(doc(db, "decks", deckId), {
            collaborators: updatedCollaborators, // Overwrite with the filtered array
        });
        setSuccessMessage(`Removed ${emailToRemove} from collaborators.`);
        // UI will update via onSnapshot

    } catch (error) {
        console.error("Error removing collaborator:", error);
         if (error.code === 'permission-denied') {
            setErrorMessage("Permission denied. Only the deck owner can remove collaborators.");
         } else {
            setErrorMessage("Failed to remove collaborator. Please try again.");
         }
    }
  };


  // --- Add/Update Card ---
  const addCard = async () => {
    clearMessages();
    if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can add or modify cards.");
        return;
    }
    if (!question.trim() || !answer.trim()) {
      setErrorMessage("Both question and answer fields are required.");
      return;
    }
    try {
        const cardData = {
            deckId,
            question: question.trim(),
            answer: answer.trim(),
            // Add createdAt or updatedAt timestamps if desired
            // createdAt: serverTimestamp(), // For new cards
            // updatedAt: serverTimestamp(), // For updates
        };

      if (editCardId) {
        // Update existing card
        await updateDoc(doc(db, "cards", editCardId), cardData);
        setSuccessMessage("Card updated successfully.");
        setEditCardId(null);
      } else {
        // Add new card
        await addDoc(collection(db, "cards"), cardData);
        setSuccessMessage("Card added successfully.");
      }
      // Clear form fields after successful operation
      setQuestion("");
      setAnswer("");
    } catch (error) {
      console.error("Error adding/updating card:", error);
       if (error.code === 'permission-denied') {
         setErrorMessage("Permission denied. Only the deck owner can modify cards.");
       } else {
         setErrorMessage("Failed to save card. Please try again.");
       }
    }
  };

  // --- Set Card for Editing ---
  const editCard = (card) => {
    if (!isOwner) return; // Prevent non-owners from initiating edit
    clearMessages();
    setEditCardId(card.id);
    setQuestion(card.question);
    setAnswer(card.answer);
     // Scroll to the add/edit card form for better UX
    document.getElementById('add-edit-card-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- Delete Card ---
  const deleteCard = async (cardId) => {
    clearMessages();
    if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can delete cards.");
        return;
    }
    // Optional: Add confirmation dialog
    // if (!window.confirm("Are you sure you want to delete this card?")) return;
    try {
      await deleteDoc(doc(db, "cards", cardId));
      setSuccessMessage("Card deleted successfully.");
      // UI updates via onSnapshot
    } catch (error) {
      console.error("Error deleting card:", error);
      if (error.code === 'permission-denied') {
         setErrorMessage("Permission denied. Only the deck owner can delete cards.");
       } else {
         setErrorMessage("Failed to delete card. Please try again.");
       }
    }
  };

  // --- Generate Questions (AI) ---
  const generateQuestions = async () => {
    clearMessages();
    if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can generate AI cards.");
        return;
    }
    setIsLoading(true); // Use isLoading specific to AI generation
    setAiGeneratedCards([]); // Clear previous results

    try {
      if (!aiPrompt.trim()) {
        throw new Error("Please enter text to generate questions from");
      }

      const response = await fetch(`https://flashmob-4gj7.onrender.com/generate_questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: aiPrompt,
          num_questions: 5, // Make this configurable if needed
        }),
        signal: AbortSignal.timeout(45000), // 45-second timeout
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) { /* Ignore parsing error if response is not JSON */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log("Received AI data:", data);

      if (data.generated_cards && Array.isArray(data.generated_cards)) {
        setAiGeneratedCards(data.generated_cards);
        if (data.generated_cards.length === 0) {
          setSuccessMessage( // Use success message for neutral outcome
            "AI processing complete, but no cards were generated. Try adjusting your input text."
          );
        } else {
           setSuccessMessage(`Generated ${data.generated_cards.length} cards. Review below and add them if desired.`);
        }
      } else {
        throw new Error("Invalid response format from AI server");
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      let userFriendlyError = error.message || "Failed to generate questions. Please try again.";
      if (error.name === 'TimeoutError') {
          userFriendlyError = "The request to generate questions timed out. The server might be busy or the text too long. Please try again later.";
      }
      setErrorMessage(userFriendlyError);
    } finally {
      setIsLoading(false); // Stop AI loading indicator
    }
  };

 // --- Add AI Generated Cards ---
 const addAiGeneratedCards = async () => {
    clearMessages();
    if (!isOwner) { // Security check
        setErrorMessage("Only the deck owner can add AI cards.");
        return;
    }
    if (aiGeneratedCards.length === 0) {
        setErrorMessage("No AI-generated cards to add.");
        return;
    }

    try {
        // Use a batch write for efficiency
        const batch = writeBatch(db);
        aiGeneratedCards.forEach(card => {
            const newCardRef = doc(collection(db, "cards")); // Auto-generate ID
            batch.set(newCardRef, {
                deckId,
                question: card.question,
                answer: card.answer,
                // createdAt: serverTimestamp(), // Optional timestamp
            });
        });

        await batch.commit(); // Commit the batch
        setSuccessMessage(`Successfully added ${aiGeneratedCards.length} AI-generated cards.`);
        setAiGeneratedCards([]); // Clear the generated cards list
        setAiPrompt(""); // Optionally clear the AI prompt

    } catch (error) {
        console.error("Error adding AI-generated cards:", error);
         if (error.code === 'permission-denied') {
            setErrorMessage("Permission denied. Only the deck owner can add cards.");
         } else {
            setErrorMessage("Failed to add AI-generated cards. Please try again.");
         }
    }
};

  // --- Render Logic ---

  // Show loading state until deck is loaded or an error occurs
  if (!deck && !errorMessage) {
      return (
        <div className="flex justify-center items-center min-h-screen">
            <p className="text-xl text-gray-600">Loading Deck Editor...</p>
            {/* You could add a spinner here */}
        </div>
      )
  }
  // If there's an error message but no deck (e.g., not found, permission denied), show error
  if (!deck && errorMessage) {
       return (
        <div className="flex flex-col justify-center items-center min-h-screen p-6">
            <p className="text-xl text-red-600 bg-red-100 p-4 rounded border border-red-300 text-center">{errorMessage}</p>
             <Link to="/dashboard" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
                Go to Dashboard
            </Link>
        </div>
       )
  }

  // --- PDF Export Function ---
  const handleExportPDF = () => {
    if (!deck || !cards || cards.length === 0) {
        alert("No cards available in this deck to export.");
        return;
    }

    setIsExportingPDF(true);
    clearMessages();

    try {
        const doc = new jsPDF({
            orientation: 'p', // portrait
            unit: 'mm',       // millimeters
            format: 'a4'      // A4 size page
        });

        // --- PDF Configuration ---
        const marginLeft = 15;
        const marginRight = 15;
        const marginTop = 20;
        const marginBottom = 20;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const usableWidth = pageWidth - marginLeft - marginRight;
        const titleFontSize = 18;
        const cardFontSize = 11; // Slightly smaller for potentially more content
        const prefixFontSize = 10;
        const questionPrefix = "Q: ";
        const answerPrefix = "A: ";
        const cardSpacing = 8; // Space between cards
        const lineSpacing = 1; // Extra space between lines of wrapped text
        const textLineHeight = (cardFontSize / 3.5) + lineSpacing; // Approximate mm line height

        let currentY = marginTop;

        // --- Helper to add text and handle page breaks ---
        const addWrappedText = (text, x, y, options = {}) => {
            const { fontSize = cardFontSize, maxWidth = usableWidth, textColor = [0, 0, 0] } = options;
            doc.setFontSize(fontSize);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);

            const lines = doc.splitTextToSize(text, maxWidth);

            lines.forEach((line, index) => {
                // Check for page break BEFORE adding the line
                if (currentY + textLineHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = marginTop; // Reset Y for new page
                }
                doc.text(line, x, currentY);
                currentY += textLineHeight;
            });
            return lines.length; // Return number of lines added
        };

        // --- Add Deck Title ---
        addWrappedText(deck.title || "Flashcards", marginLeft, currentY, { fontSize: titleFontSize });
        currentY += cardSpacing; // Add space after title

        // --- Add Cards ---
        cards.forEach((card, index) => {
            // Store Y position before starting card
            const startY = currentY;

            // --- Add Question ---
            // Add prefix separately for potential styling
            doc.setFontSize(prefixFontSize);
            doc.setTextColor(50, 50, 50);
            doc.text(questionPrefix, marginLeft, currentY);
            // Add question text next to prefix
            const questionLinesAdded = addWrappedText(
                card.question || "-",
                marginLeft + doc.getTextWidth(questionPrefix) + 1, // Position after prefix
                currentY,
                { fontSize: cardFontSize, maxWidth: usableWidth - (doc.getTextWidth(questionPrefix) + 1), textColor: [0, 0, 0] }
            );
            // If question itself caused page break, currentY is already updated
            // If not, ensure Y is advanced correctly even for short questions
            if (questionLinesAdded <= 1) {
               currentY = Math.max(currentY, startY + textLineHeight); // Ensure at least one line height added
            }

            const questionEndY = currentY; // Remember Y after question

            // --- Add Answer ---
            currentY += lineSpacing * 2; // Add a bit more space before answer
             // Check for page break before answer prefix
            if (currentY + textLineHeight > pageHeight - marginBottom) {
                  doc.addPage();
                  currentY = marginTop;
            }

            doc.setFontSize(prefixFontSize);
            doc.setTextColor(50, 50, 50);
            doc.text(answerPrefix, marginLeft, currentY);
            // Add answer text next to prefix
            const answerLinesAdded = addWrappedText(
                card.answer || "-",
                marginLeft + doc.getTextWidth(answerPrefix) + 1,
                currentY,
                { fontSize: cardFontSize, maxWidth: usableWidth - (doc.getTextWidth(answerPrefix) + 1), textColor: [50, 50, 50] } // Slightly muted answer
            );
             if (answerLinesAdded <= 1) {
               currentY = Math.max(currentY, questionEndY + lineSpacing*2 + textLineHeight);
            }


            // --- Add Separator / Spacing ---
            if (index < cards.length - 1) {
                currentY += cardSpacing / 2; // Add some space before potential separator/next card

                // Check for page break before separator
                if (currentY + 2 > pageHeight - marginBottom) { // Need space for line
                      doc.addPage();
                      currentY = marginTop;
                } else {
                    // Optional: Add a light line separator
                    doc.setDrawColor(200, 200, 200); // Light gray
                    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY); // Line across usable width
                    currentY += cardSpacing / 2; // Space after separator
                }
            }
        });

        // --- Save the PDF ---
        const filename = `${deck.title.replace(/[^a-z0-9]/gi, '_') || 'flashcards'}_export.pdf`;
        doc.save(filename);
        setSuccessMessage("PDF exported successfully!");

    } catch (e) {
        console.error("Error generating or saving PDF:", e);
        setErrorMessage("Failed to generate PDF. Please try again.");
    } finally {
        setIsExportingPDF(false);
    }
};

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-100 to-gray-200 p-6 relative">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 space-y-6"> {/* Increased max-width & added space-y */}
        {/* Deck Title Area */}
        <div className="flex items-center justify-between mb-4">
          {isEditingDeckTitle && isOwner ? ( // Show input only if editing and owner
            <div className="flex items-center w-full gap-2">
              <input
                type="text"
                value={editDeckTitle}
                onChange={(e) => setEditDeckTitle(e.target.value)}
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-3xl font-bold" // Match display style
                onKeyDown={(e) => e.key === 'Enter' && updateDeckTitle()}
                autoFocus
              />
              <button
                onClick={updateDeckTitle}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {setIsEditingDeckTitle(false); setEditDeckTitle(deck.title); clearMessages();}} // Reset on cancel
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            // Display Title - Make clickable only for owner
            <div className={`flex items-center ${isOwner ? 'cursor-pointer group' : ''}`} onClick={() => isOwner && setIsEditingDeckTitle(true)} title={isOwner ? "Click to edit title" : ""}>
              <h1 className="text-3xl font-bold text-gray-800 mr-3">
                {editDeckTitle} {/* Display state for consistency */}
              </h1>
              {isOwner && ( // Show edit icon only for owner (optional visual cue)
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                 </svg>
              )}
            </div>
          )}
           {/* Study Mode Link - Always visible */}
           <Link
              to={`/study/${deckId}`}
              className="ml-auto flex-shrink-0 px-4 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition text-center font-semibold"
            >
              Study Mode
            </Link>
        </div>

        {/* --- Feedback Messages Area --- */}
         <div className="space-y-2"> {/* Container for messages */}
            {errorMessage && (
                <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                role="alert"
                >
                <span className="block sm:inline">{errorMessage}</span>
                <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-700">
                    <svg className="fill-current h-6 w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.651-3.03-2.651-3.029a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-2.651 3.029 2.651 3.03a1.2 1.2 0 0 1 0 1.697z"/></svg>
                </button>
                </div>
            )}
            {successMessage && (
                <div
                className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative"
                role="alert"
                >
                <span className="block sm:inline">{successMessage}</span>
                <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-green-500 hover:text-green-700">
                    <svg className="fill-current h-6 w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.651-3.03-2.651-3.029a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-2.651 3.029 2.651 3.03a1.2 1.2 0 0 1 0 1.697z"/></svg>
                </button>
                </div>
            )}
         </div>

         <div className="flex items-center gap-2 flex-shrink-0">
             {/* Export PDF Button */}
             <button
                onClick={handleExportPDF}
                disabled={isExportingPDF || !cards || cards.length === 0}
                className={`px-4 py-2 bg-teal-500 text-white rounded-lg shadow text-sm font-medium hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed`}
             >
                {isExportingPDF ? "Exporting..." : "Export PDF"}
             </button>
             {/* Study Mode Button */}
            <Link
              to={`/study/${deckId}`}
              className="px-4 py-2 bg-green-500 text-white rounded-lg shadow text-sm font-medium hover:bg-green-600 transition text-center"
            >
              Study Mode
            </Link>
          </div>
        {/* Grid for Content Sections - Conditionally render owner-only sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* --- Card Add/Edit Section --- */}
          {isOwner && ( // Only owner sees this section
             <div id="add-edit-card-section" className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col"> {/* Added flex-col */}
              <h2 className="text-xl font-semibold mb-3 text-gray-800">
                 {editCardId ? "Edit Card" : "Add New Card"}
              </h2>
                <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Question"
                className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <textarea // Changed to textarea for potentially longer answers
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer"
                rows="4" // Give more space
                className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 flex-grow" // flex-grow added
                />
                <div className="flex gap-2 mt-auto"> {/* Buttons at bottom */}
                    <button
                    onClick={addCard}
                    className="flex-1 p-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                    {editCardId ? "Update Card" : "Add Card"}
                    </button>
                    {editCardId && (
                        <button
                        onClick={() => { setEditCardId(null); setQuestion(''); setAnswer(''); clearMessages(); }}
                        className="flex-1 p-3 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                        >
                        Cancel Edit
                        </button>
                    )}
                </div>
            </div>
          )}

          {/* --- AI Generation Section --- */}
          {isOwner && ( // Only owner sees this section
            <div className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col"> {/* Added flex-col */}
                <h2 className="text-xl font-semibold mb-3 text-gray-800">
                Generate Cards with AI
                </h2>
                <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Paste text here to generate flashcards..."
                rows="6" // Give more space
                className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 flex-grow" // flex-grow added
                disabled={isLoading}
                />
                <button
                    onClick={generateQuestions}
                    disabled={isLoading || !aiPrompt.trim()}
                    className={`w-full p-3 bg-green-500 text-white rounded hover:bg-green-600 transition mt-auto ${
                    isLoading || !aiPrompt.trim() ? "opacity-50 cursor-not-allowed" : ""
                    }`} // Button at bottom
                >
                {isLoading ? "Generating..." : "Generate Questions"}
                </button>
            </div>
          )}

          {/* --- Collaborators Section --- */}
          {isOwner && ( // Only owner sees this section
            <div className="p-4 border rounded-lg shadow-sm bg-white md:col-span-2"> {/* Span full width on medium screens if needed, or adjust grid layout */}
                <h2 className="text-xl font-semibold mb-3 text-gray-800">
                Manage Collaborators
                </h2>
                 <p className="text-sm text-gray-600 mb-3">
                    Invite others to study this deck (read-only access). They must have an account with the specified email.
                </p>
                <div className="flex items-center mb-4 gap-2">
                <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={(e) => setCollaboratorEmail(e.target.value)}
                    placeholder="Collaborator's email"
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    disabled={isAddingCollaborator}
                />
                <button
                    onClick={addCollaborator}
                    disabled={isAddingCollaborator || !collaboratorEmail.trim()}
                    className={`px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition ${
                    (isAddingCollaborator || !collaboratorEmail.trim())
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                >
                    {isAddingCollaborator ? "Adding..." : "Add"}
                </button>
                </div>
                <h3 className="text-md font-semibold mb-2 text-gray-700">Current Collaborators:</h3>
                 {collaborators.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {collaborators.map((email) => (
                        <li key={email} className="text-sm flex justify-between items-center group pr-2"> {/* Added group and padding */}
                        <span>{email}</span>
                        <button
                            onClick={() => removeCollaborator(email)}
                            className="ml-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:text-red-700 font-medium"
                            title="Remove collaborator"
                        >
                           (Remove)
                        </button>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <p className="text-sm text-gray-500 italic">No collaborators yet.</p>
                )}
            </div>
          )}


         {!isOwner && <div className="hidden md:block"></div>}

        </div> {/* End Grid */}


        {/* AI Generated Cards Preview */}
        {isOwner && aiGeneratedCards.length > 0 && ( // Only owner sees preview and add button
          <div className="mt-6 p-4 border rounded-lg shadow-sm bg-gray-50">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Review AI Generated Cards ({aiGeneratedCards.length})
            </h2>
             <div className="max-h-60 overflow-y-auto space-y-3 mb-4 pr-2 border p-2 rounded bg-white"> {/* Scrollable area */}
                {aiGeneratedCards.map((card, index) => (
                <div key={index} className="mb-3 p-2 border rounded bg-white shadow-sm">
                    <p className="font-semibold text-gray-700 text-sm">
                    Q: {card.question}
                    </p>
                    <p className="text-gray-600 text-sm mt-1">
                    A: {card.answer}
                    </p>
                </div>
                ))}
             </div>
            <div className="flex gap-2">
                <button
                    onClick={addAiGeneratedCards}
                    className="flex-1 p-3 bg-purple-500 text-white rounded hover:bg-purple-600 transition"
                >
                    Add These Cards to Deck
                </button>
                 <button
                    onClick={() => {setAiGeneratedCards([]); clearMessages();}} // Clear generated cards
                    className="flex-1 p-3 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                >
                    Discard Generated Cards
                </button>
            </div>
          </div>
        )}

        {/* Existing Cards List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            Cards in Deck ({cards.length})
          </h2>
          {cards.length > 0 ? (
             <ul className="space-y-4">
                {cards.map((card) => (
                <li
                    key={card.id}
                    className="p-4 bg-white rounded-lg shadow flex flex-col md:flex-row items-start md:items-center justify-between" // Improved alignment
                >
                    <div className="mb-3 md:mb-0 md:mr-4 flex-1"> {/* Allow text to wrap */}
                    <p className="text-gray-800">
                        <span className="font-semibold">Q:</span> {card.question}
                    </p>
                    <p className="text-gray-700 mt-1">
                        <span className="font-semibold">A:</span> {card.answer}
                    </p>
                    </div>
                     {/* Edit/Delete buttons only for owner */}
                    {isOwner && (
                        <div className="flex gap-3 flex-shrink-0 mt-2 md:mt-0"> {/* Spacing and prevent shrinking */}
                        <button
                            onClick={() => editCard(card)}
                            className="px-3 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500 transition text-sm" // Smaller buttons
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => deleteCard(card.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm" // Smaller buttons
                        >
                            Delete
                        </button>
                        </div>
                    )}
                </li>
                ))}
             </ul>
          ) : (
             <p className="text-gray-500 italic p-4 text-center">
                {isOwner ? "No cards added yet. Use the forms above to add cards manually or with AI." : "This deck currently has no cards."}
             </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeckEditor;