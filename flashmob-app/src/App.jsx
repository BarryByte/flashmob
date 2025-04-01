import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import Signup from "./components/Signup";
import DeckList from "./components/DeckList";
import DeckEditor from "./components/DeckEditor";
import StudyMode from "./components/StudyMode";

const App = () => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/" /> : <Signup />}
        />
        <Route
          path="/"
          element={user ? <DeckList /> : <Navigate to="/login" />}
        />
        <Route path="/deck/:deckId" element={<DeckEditor />} /> 
        <Route path="/study/:deckId" element={<StudyMode />} />
      </Routes>
    </Router>
  );
};

export default App;