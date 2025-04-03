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
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// --- Authentication ---

/**
 * Listens for changes in the user's authentication state.
 * @param {function} setCurrentUserEmail - Setter for the user's email.
 * @param {function} setCurrentUserId - Setter for the user's UID.
 * @returns {function} - The unsubscribe function from onAuthStateChanged.
 */
export const listenToAuthChanges = (setCurrentUserEmail, setCurrentUserId) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      setCurrentUserEmail(user.email);
      setCurrentUserId(user.uid);
    } else {
      setCurrentUserEmail(null);
      setCurrentUserId(null);
      console.log("User is logged out.");
      
    }
  });
};

// --- Deck Operations ---

/**
 * Fetches initial deck data once.
 * @param {string} deckId - The ID of the deck to fetch.
 * @param {function} setDeck - Setter for the deck state.
 * @param {function} setEditDeckTitle - Setter for the editable deck title state.
 * @param {function} setCollaborators - Setter for the collaborators state.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const fetchInitialDeckData = async (deckId, setDeck, setEditDeckTitle, setCollaborators, setErrorMessage) => {
    if (!deckId) return;
    try {
        const deckRef = doc(db, "decks", deckId);
        const deckDoc = await getDoc(deckRef);
        if (deckDoc.exists()) {
            const deckData = deckDoc.data();
            setDeck(deckData);
            setEditDeckTitle(deckData.title);
            setCollaborators(deckData.collaborators || []);
        } else {
            console.error("Deck not found!");
            setErrorMessage("Deck not found or you may not have access.");
        }
    } catch (error) {
        console.error("Error fetching initial deck data:", error);
        setErrorMessage("Failed to load deck data.");
    }
};


/**
 * Subscribes to real-time updates for a specific deck.
 * @param {string} deckId - The ID of the deck to subscribe to.
 * @param {function} setDeck - Setter for the deck state.
 * @param {function} setCollaborators - Setter for the collaborators state.
 * @param {function} setEditDeckTitle - Setter for the editable deck title state.
 * @param {function} setErrorMessage - Setter for error messages.
 * @param {function} setCards - Setter for the cards state (to clear if deck disappears).
 * @param {boolean} isEditingDeckTitle - Flag indicating if the title is currently being edited.
 * @returns {function} - The unsubscribe function from onSnapshot.
 */
export const subscribeToDeckUpdates = (deckId, setDeck, setCollaborators, setEditDeckTitle, setErrorMessage, setCards, isEditingDeckTitle) => {
    const deckRef = doc(db, "decks", deckId);
    return onSnapshot(deckRef, (docSnap) => {
        if (docSnap.exists()) {
            const deckData = docSnap.data();
            setDeck(deckData);
            setCollaborators(deckData.collaborators || []);
            if (!isEditingDeckTitle) {
                setEditDeckTitle(deckData.title);
            }
        } else {
            console.error("Deck not found or deleted, or permissions revoked.");
            setErrorMessage("Deck not found, or access may have been revoked.");
            setDeck(null);
            setCards([]);
        }
    }, (error) => {
        console.error("Error listening to deck updates:", error);
        setErrorMessage(prev => prev || "Failed to sync deck updates.");
    });
};

/**
 * Updates the title of a deck in Firestore.
 * @param {string} deckId - The ID of the deck to update.
 * @param {string} newTitle - The new title for the deck.
 * @param {function} setIsEditingDeckTitle - Setter to control title edit mode.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const updateDeckTitleInFirebase = async (deckId, newTitle, setIsEditingDeckTitle, setSuccessMessage, setErrorMessage) => {
    if (!newTitle.trim()) {
        setErrorMessage("Deck title cannot be empty.");
        return;
    }
    try {
        await updateDoc(doc(db, "decks", deckId), {
            title: newTitle.trim(),
        });
        setIsEditingDeckTitle(false);
        setSuccessMessage("Deck title updated successfully.");
    } catch (error) {
        console.error("Error updating deck title:", error);
        setErrorMessage("Failed to update deck title. Please try again.");
    }
};


// --- Collaborator Operations ---

/**
 * Adds a collaborator's email to a deck's collaborators list.
 * @param {string} deckId - The ID of the deck.
 * @param {string} emailToAdd - The collaborator's email (normalized).
 * @param {Array<string>} currentCollaborators - The current list of collaborator emails.
 * @param {function} setCollaboratorEmail - Setter to clear the input field.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @param {function} setIsAddingCollaborator - Setter for the loading state.
 * @returns {Promise<void>}
 */
export const addCollaboratorToFirebase = async (deckId, emailToAdd, currentCollaborators, setCollaboratorEmail, setSuccessMessage, setErrorMessage, setIsAddingCollaborator) => {
    setIsAddingCollaborator(true);
    try {
        // Step 1: Check if the user exists (requires 'users' collection query)
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", emailToAdd));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            setErrorMessage(`No registered user found with email '${emailToAdd}'. Please ask them to sign up first.`);
            setIsAddingCollaborator(false);
            return;
        }

        // Step 2: User exists, add to collaborators array
        await updateDoc(doc(db, "decks", deckId), {
            collaborators: arrayUnion(emailToAdd),
        });

        setCollaboratorEmail("");
        setSuccessMessage(`Successfully invited ${emailToAdd}.`);


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

/**
 * Removes a collaborator's email from a deck's collaborators list.
 * @param {string} deckId - The ID of the deck.
 * @param {string} emailToRemove - The email to remove.
 * @param {Array<string>} currentCollaborators - The current list of collaborator emails.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const removeCollaboratorFromFirebase = async (deckId, emailToRemove, currentCollaborators, setSuccessMessage, setErrorMessage) => {
    try {
        const updatedCollaborators = currentCollaborators.filter(email => email !== emailToRemove);
        await updateDoc(doc(db, "decks", deckId), {
            collaborators: updatedCollaborators,
        });
        setSuccessMessage(`Removed ${emailToRemove} from collaborators.`);

    } catch (error) {
        console.error("Error removing collaborator:", error);
         if (error.code === 'permission-denied') {
            setErrorMessage("Permission denied. Only the deck owner can remove collaborators.");
         } else {
            setErrorMessage("Failed to remove collaborator. Please try again.");
         }
    }
};

// --- Card Operations ---

/**
 * Subscribes to real-time updates for cards belonging to a specific deck.
 * @param {string} deckId - The ID of the deck whose cards to fetch.
 * @param {function} setCards - Setter for the cards state.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {function} - The unsubscribe function from onSnapshot.
 */
export const subscribeToCardUpdates = (deckId, setCards, setErrorMessage) => {
    const cardsQuery = query(collection(db, "cards"), where("deckId", "==", deckId));
    return onSnapshot(cardsQuery, (snapshot) => {
        const cardsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        setCards(cardsData);
    }, (error) => {
        console.error("Error listening to card updates:", error);
        setErrorMessage(prev => prev || "Failed to load card updates.");
    });
};

/**
 * Adds a new card or updates an existing card in Firestore.
 * @param {string} deckId - The ID of the deck the card belongs to.
 * @param {string} question - The card question.
 * @param {string} answer - The card answer.
 * @param {string|null} editCardId - The ID of the card to update, or null to add a new card.
 * @param {function} setQuestion - Setter to clear the question input.
 * @param {function} setAnswer - Setter to clear the answer input.
 * @param {function} setEditCardId - Setter to clear the edit mode.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const addOrUpdateCardInFirebase = async (deckId, question, answer, editCardId, setQuestion, setAnswer, setEditCardId, setSuccessMessage, setErrorMessage) => {
    if (!question.trim() || !answer.trim()) {
        setErrorMessage("Both question and answer fields are required.");
        return;
    }
    try {
        const cardData = {
            deckId,
            question: question.trim(),
            answer: answer.trim(),

        };

        if (editCardId) {

            await updateDoc(doc(db, "cards", editCardId), cardData);
            setSuccessMessage("Card updated successfully.");
            setEditCardId(null);
        } else {

            await addDoc(collection(db, "cards"), cardData);
            setSuccessMessage("Card added successfully.");
        }
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

/**
 * Deletes a card from Firestore.
 * @param {string} cardId - The ID of the card to delete.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const deleteCardFromFirebase = async (cardId, setSuccessMessage, setErrorMessage) => {

    try {
      await deleteDoc(doc(db, "cards", cardId));
      setSuccessMessage("Card deleted successfully.");

    } catch (error) {
      console.error("Error deleting card:", error);
      if (error.code === 'permission-denied') {
         setErrorMessage("Permission denied. Only the deck owner can delete cards.");
       } else {
         setErrorMessage("Failed to delete card. Please try again.");
       }
    }
};

/**
 * Adds multiple AI-generated cards to Firestore using a batch write.
 * @param {string} deckId - The ID of the deck.
 * @param {Array<object>} aiGeneratedCards - Array of {question, answer} objects.
 * @param {function} setAiGeneratedCards - Setter to clear the AI card list.
 * @param {function} setAiPrompt - Setter to optionally clear the AI prompt.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 * @returns {Promise<void>}
 */
export const addAiGeneratedCardsToFirebase = async (deckId, aiGeneratedCards, setAiGeneratedCards, setAiPrompt, setSuccessMessage, setErrorMessage) => {
    if (aiGeneratedCards.length === 0) {
        setErrorMessage("No AI-generated cards to add.");
        return;
    }
    try {
        const batch = writeBatch(db);
        aiGeneratedCards.forEach(card => {
            const newCardRef = doc(collection(db, "cards"));
            batch.set(newCardRef, {
                deckId,
                question: card.question,
                answer: card.answer,

            });
        });

        await batch.commit();
        setSuccessMessage(`Successfully added ${aiGeneratedCards.length} AI-generated cards.`);
        setAiGeneratedCards([]);
        setAiPrompt("");
    } catch (error) {
        console.error("Error adding AI-generated cards:", error);
         if (error.code === 'permission-denied') {
            setErrorMessage("Permission denied. Only the deck owner can add cards.");
         } else {
            setErrorMessage("Failed to add AI-generated cards. Please try again.");
         }
    }
};