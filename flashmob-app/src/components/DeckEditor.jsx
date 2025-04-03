import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { auth, db } from "../firebase";

// Import services and utils
import { isValidEmail } from './utils';
import {
    listenToAuthChanges,
    fetchInitialDeckData,
    subscribeToDeckUpdates,
    updateDeckTitleInFirebase,
    addCollaboratorToFirebase,
    removeCollaboratorFromFirebase,
    subscribeToCardUpdates,
    addOrUpdateCardInFirebase,
    deleteCardFromFirebase,
    addAiGeneratedCardsToFirebase 
} from './FirebaseService';
import { generateAICards } from './AiService';
import { exportDeckToPDF } from './ExportToPDF';

const DeckEditor = () => {
    const { deckId } = useParams();
    const [deck, setDeck] = useState(null); // { title: '', ownerId: '', collaborators: [] }
    const [cards, setCards] = useState([]);
    // Manual card states
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    // AI-specific prompt state
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiGeneratedCards, setAiGeneratedCards] = useState([]);
    // Collaborator states
    const [collaboratorEmail, setCollaboratorEmail] = useState("");
    const [collaborators, setCollaborators] = useState([]); // Stores emails
    // Editing states
    const [editCardId, setEditCardId] = useState(null);
    const [editDeckTitle, setEditDeckTitle] = useState("");
    const [isEditingDeckTitle, setIsEditingDeckTitle] = useState(false);

    // State for messages and loading indicators
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isLoadingAI, setIsLoadingAI] = useState(false); // AI generation loading
    const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    // User state
    const [currentUserEmail, setCurrentUserEmail] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null); // UID for owner check

    // --- Clear Messages ---
    const clearMessages = () => {
        setErrorMessage("");
        setSuccessMessage("");
    }

    // --- Get Current User ---
    useEffect(() => {
        const unsubscribe = listenToAuthChanges(setCurrentUserEmail, setCurrentUserId);
        return () => unsubscribe(); // Cleanup auth listener
    }, []);


    // --- Fetch Initial Data and Subscribe to Updates ---
    useEffect(() => {
        if (!deckId) return;

        let isMounted = true; // Prevent state updates on unmounted component
        let unsubscribeCards = () => {};
        let unsubscribeDeck = () => {};

        // Fetch initial deck data (run once)
        fetchInitialDeckData(deckId,
            (data) => isMounted && setDeck(data),
            (title) => isMounted && setEditDeckTitle(title),
            (collabs) => isMounted && setCollaborators(collabs),
            (err) => isMounted && setErrorMessage(err)
        );

        // Subscribe to real-time card updates
        unsubscribeCards = subscribeToCardUpdates(deckId,
            (cardsData) => isMounted && setCards(cardsData),
            (err) => isMounted && setErrorMessage(prev => prev || err) // Avoid overwriting deck errors
        );

        // Subscribe to real-time deck updates (collaborators, title)
        unsubscribeDeck = subscribeToDeckUpdates(deckId,
            (data) => isMounted && setDeck(data),
            (collabs) => isMounted && setCollaborators(collabs),
            (title) => { if (isMounted && !isEditingDeckTitle) setEditDeckTitle(title) },
            (err) => isMounted && setErrorMessage(prev => prev || err),
            (cardsData) => isMounted && setCards(cardsData), // Pass setCards to clear if deck disappears
            isEditingDeckTitle // Pass isEditing flag
        );

        // Cleanup function
        return () => {
            isMounted = false;
            unsubscribeCards();
            unsubscribeDeck();
        };
    }, [deckId, isEditingDeckTitle]); // Re-run if isEditingDeckTitle changes (for deck listener logic)


    // --- Determine if the current user is the owner ---
    const isOwner = deck && currentUserId && deck.ownerId === currentUserId;


    // --- Handler Functions (Call Service Functions) ---

    const handleUpdateDeckTitle = () => {
        clearMessages();
        if (!isOwner) {
            setErrorMessage("Only the deck owner can change the title.");
            return;
        }
        updateDeckTitleInFirebase(deckId, editDeckTitle, setIsEditingDeckTitle, setSuccessMessage, setErrorMessage);
    };

    const handleAddCollaborator = () => {
        clearMessages();
        const emailToAdd = collaboratorEmail.trim().toLowerCase();

        if (!isOwner) {
            setErrorMessage("Only the deck owner can add collaborators."); return;
        }
        if (!isValidEmail(emailToAdd)) {
            setErrorMessage("Please enter a valid email address."); return;
        }
        if (!currentUserEmail) {
            setErrorMessage("Could not verify current user. Please log in again."); return;
        }
        if (emailToAdd === currentUserEmail) {
            setErrorMessage("You cannot add yourself as a collaborator."); return;
        }
        if (collaborators.includes(emailToAdd)) {
            setErrorMessage(`'${emailToAdd}' is already a collaborator.`); return;
        }

        addCollaboratorToFirebase(deckId, emailToAdd, collaborators, setCollaboratorEmail, setSuccessMessage, setErrorMessage, setIsAddingCollaborator);
    };

    const handleRemoveCollaborator = (emailToRemove) => {
        clearMessages();
        if (!isOwner) {
            setErrorMessage("Only the deck owner can remove collaborators."); return;
        }
        removeCollaboratorFromFirebase(deckId, emailToRemove, collaborators, setSuccessMessage, setErrorMessage);
    };

    const handleAddOrUpdateCard = () => {
        clearMessages();
        if (!isOwner) {
             setErrorMessage("Only the deck owner can add or modify cards."); return;
        }
        addOrUpdateCardInFirebase(deckId, question, answer, editCardId, setQuestion, setAnswer, setEditCardId, setSuccessMessage, setErrorMessage);
    };

    const handleEditCard = (card) => {
        if (!isOwner) return;
        clearMessages();
        setEditCardId(card.id);
        setQuestion(card.question);
        setAnswer(card.answer);
        document.getElementById('add-edit-card-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleDeleteCard = (cardId) => {
        clearMessages();
        if (!isOwner) {
            setErrorMessage("Only the deck owner can delete cards."); return;
        }
        deleteCardFromFirebase(cardId, setSuccessMessage, setErrorMessage);
    };

    const handleGenerateAICards = () => {
        clearMessages();
        if (!isOwner) {
            setErrorMessage("Only the deck owner can generate AI cards."); return;
        }
        // hard code value - 5
        generateAICards(aiPrompt, 5, setIsLoadingAI, setAiGeneratedCards, setSuccessMessage, setErrorMessage);
    };

    const handleAddAiGeneratedCards = () => {
        clearMessages();
        if (!isOwner) {
            setErrorMessage("Only the deck owner can add AI cards."); return;
        }
        addAiGeneratedCardsToFirebase(deckId, aiGeneratedCards, setAiGeneratedCards, setAiPrompt, setSuccessMessage, setErrorMessage);
    };

    const handleTriggerPDFExport = () => {
        clearMessages();
        exportDeckToPDF(deck, cards, setIsExportingPDF, setSuccessMessage, setErrorMessage);
    }


    // --- Render Logic ---

    if (!deck && !errorMessage) {
        return <div className="flex justify-center items-center min-h-screen"><p>Loading Deck Editor...</p></div>;
    }
    if (!deck && errorMessage) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen p-6">
                <p className="text-xl text-red-600 bg-red-100 p-4 rounded border border-red-300 text-center">{errorMessage}</p>
                <Link to="/dashboard" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">Go to Dashboard</Link>
            </div>
        );
    }

    // --- Main Render Output ---
    return (
      <div className="min-h-screen bg-gradient-to-r from-gray-100 to-gray-200 p-6 relative">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 space-y-6">
            {/* Deck Title Area */}
            <div className="flex items-center justify-between mb-4">
                {isEditingDeckTitle && isOwner ? (
                    <div className="flex items-center w-full gap-2">
                    <input
                        type="text"
                        value={editDeckTitle}
                        onChange={(e) => setEditDeckTitle(e.target.value)}
                        className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-3xl font-bold"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateDeckTitle()}
                        autoFocus
                    />
                    <button onClick={handleUpdateDeckTitle} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm">Save</button>
                    <button onClick={() => {setIsEditingDeckTitle(false); setEditDeckTitle(deck.title); clearMessages();}} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition text-sm">Cancel</button>
                    </div>
                ) : (
                    <div className={`flex items-center ${isOwner ? 'cursor-pointer group' : ''}`} onClick={() => isOwner && setIsEditingDeckTitle(true)} title={isOwner ? "Click to edit title" : ""}>
                    <h1 className="text-3xl font-bold text-gray-800 mr-3">{editDeckTitle}</h1>
                    {isOwner && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    )}
                    </div>
                )}
            </div>

            {/* Feedback Messages Area */}
            <div className="space-y-2">
                {errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{errorMessage}</span>
                    <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-700">
                        <svg className="fill-current h-6 w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.651-3.03-2.651-3.029a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-2.651 3.029 2.651 3.03a1.2 1.2 0 0 1 0 1.697z"/></svg>
                    </button>
                    </div>
                )}
                {successMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{successMessage}</span>
                    <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-green-500 hover:text-green-700">
                        <svg className="fill-current h-6 w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.651-3.03-2.651-3.029a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-2.651 3.029 2.651 3.03a1.2 1.2 0 0 1 0 1.697z"/></svg>
                    </button>
                    </div>
                )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={handleTriggerPDFExport}
                    disabled={isExportingPDF || !cards || cards.length === 0}
                    className={`px-4 py-2 bg-teal-500 text-white rounded-lg shadow text-sm font-medium hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isExportingPDF ? "Exporting..." : "Export PDF"}
                </button>
                <Link
                    to={`/study/${deckId}`}
                    className={`px-4 py-2 bg-green-500 text-white rounded-lg shadow text-sm font-medium hover:bg-green-600 transition text-center ${cards.length === 0 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                    aria-disabled={cards.length === 0}
                    tabIndex={cards.length === 0 ? -1 : undefined}
                >
                    Study Mode
                </Link>
            </div>


            {/* Owner-Specific Sections Grid */}
            {isOwner && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card Add/Edit Section */}
                    <div id="add-edit-card-section" className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col">
                        <h2 className="text-xl font-semibold mb-3 text-gray-800">{editCardId ? "Edit Card" : "Add New Card"}</h2>
                        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer" rows="4" className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 flex-grow" />
                        <div className="flex gap-2 mt-auto">
                            <button onClick={handleAddOrUpdateCard} className="flex-1 p-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition">{editCardId ? "Update Card" : "Add Card"}</button>
                            {editCardId && (<button onClick={() => { setEditCardId(null); setQuestion(''); setAnswer(''); clearMessages(); }} className="flex-1 p-3 bg-gray-400 text-white rounded hover:bg-gray-500 transition">Cancel Edit</button>)}
                        </div>
                    </div>

                    {/* AI Generation Section */}
                    <div className="p-4 border rounded-lg shadow-sm bg-gray-50 flex flex-col">
                        <h2 className="text-xl font-semibold mb-3 text-gray-800">Generate Cards with AI</h2>
                        <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Paste text here..." rows="6" className="w-full p-3 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 flex-grow" disabled={isLoadingAI} />
                        <button onClick={handleGenerateAICards} disabled={isLoadingAI || !aiPrompt.trim()} className={`w-full p-3 bg-green-500 text-white rounded hover:bg-green-600 transition mt-auto ${isLoadingAI || !aiPrompt.trim() ? "opacity-50 cursor-not-allowed" : ""}`}>
                            {isLoadingAI ? "Generating..." : "Generate Questions"}
                        </button>
                    </div>

                    {/* AI Generated Cards Review (if any) */}
                    {aiGeneratedCards.length > 0 && (
                        <div className="md:col-span-2 p-4 border rounded-lg shadow-sm bg-indigo-50">
                            <h3 className="text-lg font-semibold mb-3 text-indigo-800">Review AI Generated Cards</h3>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 mb-3">
                                {aiGeneratedCards.map((card, index) => (
                                    <div key={index} className="p-2 border border-indigo-200 rounded bg-white text-sm">
                                        <p><strong>Q:</strong> {card.question}</p>
                                        <p><strong>A:</strong> {card.answer}</p>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddAiGeneratedCards} className="w-full p-3 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition">Add These Cards to Deck</button>
                        </div>
                    )}

                    {/* Collaborators Section */}
                    <div className="md:col-span-2 p-4 border rounded-lg shadow-sm bg-gray-50">
                        <h2 className="text-xl font-semibold mb-3 text-gray-800">Collaborators</h2>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="email"
                                value={collaboratorEmail}
                                onChange={(e) => setCollaboratorEmail(e.target.value)}
                                placeholder="Collaborator's email"
                                className="flex-grow p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                disabled={isAddingCollaborator}
                            />
                            <button
                                onClick={handleAddCollaborator}
                                disabled={isAddingCollaborator || !collaboratorEmail.trim()}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAddingCollaborator ? "Adding..." : "Add"}
                            </button>
                        </div>
                        {collaborators.length > 0 ? (
                            <ul className="space-y-1">
                                {collaborators.map(email => (
                                <li key={email} className="flex justify-between items-center text-sm p-1 bg-gray-100 rounded">
                                    <span>{email}</span>
                                    <button onClick={() => handleRemoveCollaborator(email)} className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                                </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500">No collaborators added yet.</p>
                        )}
                    </div>
                </div>
             )} {/* End isOwner check for grid */}


             {/* Cards List (Visible to Owner and Collaborators) */}
             <div className="mt-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Cards in this Deck ({cards.length})</h2>
                {cards.length > 0 ? (
                <div className="space-y-3">
                    {cards.map((card) => (
                    <div key={card.id} className="p-4 border rounded-lg shadow-sm bg-white flex justify-between items-start">
                        <div className="flex-1 mr-4">
                        <p className="font-medium text-gray-700 break-words"><strong>Q:</strong> {card.question}</p>
                        <p className="text-sm text-gray-600 break-words"><strong>A:</strong> {card.answer}</p>
                        </div>
                        {/* Show edit/delete only to owner */}
                        {isOwner && (
                            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                            <button onClick={() => handleEditCard(card)} className="px-3 py-1 bg-yellow-400 text-white rounded text-xs hover:bg-yellow-500 transition">Edit</button>
                            <button onClick={() => handleDeleteCard(card.id)} className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition">Delete</button>
                            </div>
                        )}
                    </div>
                    ))}
                </div>
                ) : (
                <p className="text-gray-500 italic">
                    {isOwner ? "No cards added yet. Use the form above or generate with AI!" : "This deck currently has no cards."}
                </p>
                )}
            </div>

        </div>
    </div>
    );
};

export default DeckEditor;