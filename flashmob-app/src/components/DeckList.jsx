
import React, { useState, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  Timestamp, // Use Timestamp for server timestamp
  serverTimestamp,
  writeBatch, // Import writeBatch
  onSnapshot // Use onSnapshot for real-time updates (optional but good)
} from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged


const DeckList = () => {
  const [decks, setDecks] = useState([]); // Combined list of owned and collaborated decks
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial fetch
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(auth.currentUser); // Store user object
  const navigate = useNavigate();

  // Effect to listen for Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        // If user logs out, clear decks and navigate to login
        setDecks([]);
        setIsLoading(false);
        navigate("/login");
      } else {
          // User is logged in or state changed, fetching will be triggered below
          setIsLoading(true); // Set loading true when user changes until data loads
      }
    });
    return () => unsubscribe(); // Cleanup listener
  }, [navigate]);


  // Effect to fetch decks when currentUser is available
  useEffect(() => {
    if (!currentUser) {
        setIsLoading(false); // Not logged in, stop loading
        setDecks([]); // Clear decks if user logs out
        return;
    }

    setError(""); // Clear previous errors
    setIsLoading(true);

    // --- Query 1: Decks owned by the user ---
    const ownedDecksQuery = query(
      collection(db, "decks"),
      where("ownerId", "==", currentUser.uid)
    );

    // --- Query 2: Decks where the user is a collaborator ---
    const collaboratedDecksQuery = query(
      collection(db, "decks"),
      where("collaborators", "array-contains", currentUser.email) // Query by email in collaborators array
    );

    // Use onSnapshot for real-time updates (optional, can revert to getDocs if not needed)
    const unsubscribeOwned = onSnapshot(ownedDecksQuery, (snapshot) => {
        const ownedDecksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Update state combining results (see updateDecksState below)
        updateDecksState(ownedDecksData, 'owned');
    }, (err) => {
        console.error("Error fetching owned decks:", err);
        setError("Failed to load owned decks.");
        setIsLoading(false);
    });

    const unsubscribeCollaborated = onSnapshot(collaboratedDecksQuery, (snapshot) => {
        const collaboratedDecksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         // Update state combining results (see updateDecksState below)
        updateDecksState(collaboratedDecksData, 'collaborated');
    }, (err) => {
        console.error("Error fetching collaborated decks:", err);
        setError("Failed to load collaborated decks.");
        setIsLoading(false);
    });

     // Helper to merge results and update state, handling potential duplicates
    let currentOwned = [];
    let currentCollaborated = [];
    let firstLoad = true; // Flag to set loading false after both initial loads complete

    const updateDecksState = (newData, type) => {
        if (type === 'owned') currentOwned = newData;
        if (type === 'collaborated') currentCollaborated = newData;

        // Merge and remove duplicates (using a Map for efficiency)
        const combinedMap = new Map();
        currentOwned.forEach(deck => combinedMap.set(deck.id, {...deck, isOwner: true})); // Mark owned decks
        currentCollaborated.forEach(deck => {
            if (!combinedMap.has(deck.id)) { // Don't overwrite if already present as owned
                 combinedMap.set(deck.id, {...deck, isOwner: false}); // Mark collaborated decks
            }
        });

        setDecks(Array.from(combinedMap.values()));

        // Set loading to false only after both listeners have fired at least once
        if (firstLoad && currentOwned.length >= 0 && currentCollaborated.length >= 0) {
            setIsLoading(false);
            firstLoad = false; // Prevent setting loading false on subsequent updates
        }
    };


    // Cleanup function for listeners
    return () => {
      unsubscribeOwned();
      unsubscribeCollaborated();
    };

  }, [currentUser]); // Re-run fetch logic when currentUser changes

  // --- Create Deck Function ---
  const createDeck = async () => {
    if (!currentUser) {
        setError("You must be logged in to create a deck.");
        return;
    }
    if (!title.trim()){
        setError("Please enter a title for the new deck.");
        return;
    }
    setError(""); // Clear error

    try {
      const docRef = await addDoc(collection(db, "decks"), {
        title: title.trim() || "Untitled Deck", // Use trimmed title or default
        ownerId: currentUser.uid, // *** Store ownerId ***
        collaborators: [],      // *** Initialize empty collaborators array ***
        createdAt: serverTimestamp(), // Add a timestamp
      });
      // No need to navigate immediately if using onSnapshot, UI will update.
      // navigate(`/deck/${docRef.id}`); // Optional: navigate if you prefer
      console.log("Deck created with ID:", docRef.id);
      setTitle(""); // Clear input field
    } catch (error) {
      console.error("Error creating deck:", error);
      setError("Failed to create deck. Please try again.");
    }
  };

  // --- Logout Function ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // No need to navigate here, onAuthStateChanged effect will handle it
      console.log("User signed out");
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out.");
    }
  };

  // --- Delete Deck Function (with card deletion) ---
  const handleDeleteDeck = async (deckId, isDeckOwner) => {
     if (!currentUser) return; // Should not happen if button is shown correctly
     if (!isDeckOwner) {
         alert("Only the owner can delete this deck."); // Simple alert, could be better UI
         return;
     }

    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to permanently delete this deck and all its cards? This cannot be undone.`)) {
        return;
    }

    console.log(`Attempting to delete deck ${deckId} and its cards...`);
    try {
        const batch = writeBatch(db);

        // 1. Find all cards associated with the deck
        const cardsQuery = query(collection(db, "cards"), where("deckId", "==", deckId));
        const cardsSnapshot = await getDocs(cardsQuery);
        console.log(`Found ${cardsSnapshot.size} cards to delete.`);

        // 2. Add delete operations for each card to the batch
        cardsSnapshot.forEach((cardDoc) => {
            batch.delete(doc(db, "cards", cardDoc.id));
        });

        // 3. Add delete operation for the deck itself to the batch
        const deckRef = doc(db, "decks", deckId);
        batch.delete(deckRef);

        // 4. Commit the batch
        await batch.commit();

        console.log(`Successfully deleted deck ${deckId} and its cards.`);
        // UI will update automatically if using onSnapshot.
        // If using getDocs, manually filter the state:
        // setDecks(prevDecks => prevDecks.filter((deck) => deck.id !== deckId));

    } catch (error) {
        console.error("Error deleting deck and cards:", error);
        setError(`Failed to delete deck: ${error.message}. Please try again.`);
    }
  };

  // --- Render Logic ---
  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 shadow-lg rounded-lg mt-10 min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
         <h1 className="text-3xl font-bold text-gray-800">
            My Flashcard Decks
         </h1>
         {currentUser && ( // Show logout only if logged in
            <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition duration-300 shadow"
            >
            Logout ({currentUser.email})
            </button>
         )}
      </div>

       {error && <p className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded text-center text-sm">{error}</p>}

      {/* Input and Button for creating decks */}
      <div className="flex items-center gap-3 mb-8">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter title for new deck..."
          className="flex-1 p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={createDeck}
          className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 font-medium shadow"
        >
          + Create Deck
        </button>
      </div>

      {/* Decks Grid/List */}
      {isLoading ? (
         <p className="text-center text-gray-500">Loading decks...</p>
      ) : decks.length > 0 ? (
        <div className="space-y-4"> {/* Changed to vertical list for clarity */}
          {decks.map((deck) => (
            <div
              key={deck.id}
              className={`p-4 rounded-lg shadow-sm border ${deck.isOwner ? 'bg-white border-blue-200' : 'bg-purple-50 border-purple-200'}`} // Different style for owned vs collaborated
            >
              <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-1">
                        {deck.title}
                    </h2>
                    {!deck.isOwner && ( // Show collaborator tag
                        <span className="text-xs font-medium bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">
                            Collaborator
                        </span>
                     )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Study Link */}
                    <Link
                        to={`/study/${deck.id}`}
                        className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-300 shadow"
                    >
                        Study
                    </Link>
                    {/* Edit/View Link - different text based on ownership */}
                    <Link
                        to={`/deck/${deck.id}`} // Link to DeckEditor
                        className="px-3 py-1 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition duration-300 shadow"
                    >
                        {deck.isOwner ? "Edit" : "View"} Deck
                    </Link>
                    {/* Delete Button - only for owner */}
                    {deck.isOwner && (
                        <button
                        onClick={() => handleDeleteDeck(deck.id, deck.isOwner)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-300 shadow"
                        title="Delete Deck Permanently"
                      >
                        Delete
                      </button>
                    )}
                  </div>
              </div>
               {/* Optionally show owner if collaborator */}
               {!deck.isOwner && deck.ownerId && (
                   <p className="text-xs text-gray-500 mt-2">Owner: [Need to fetch owner email based on ownerId]</p>
                   // Fetching owner email here would require another query per deck, might be slow.
                   // Consider storing ownerEmail on the deck document if needed frequently on this page.
               )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 mt-8">
          No decks found. Create one above or ask someone to share a deck with you ({currentUser?.email})!
        </p>
      )}
    </div>
  );
};

export default DeckList;