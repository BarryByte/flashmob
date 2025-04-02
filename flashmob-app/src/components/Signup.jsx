

import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase"; // Import db
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; // Import Firestore functions
import { useNavigate } from "react-router-dom"; // Import for redirection

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Initialize navigate

  const handleSignup = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setError(""); // Clear previous errors
    setLoading(true);

    if (!email || !password) {
        setError("Please enter both email and password.");
        setLoading(false);
        return;
    }

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Signup successful for user:", user.uid);

      // 2. Create user document in Firestore 'users' collection
      try {
          const userDocRef = doc(db, "users", user.uid);
          await setDoc(userDocRef, {
            email: user.email,
            createdAt: serverTimestamp() // Optional: track when user joined
            // Add any other initial user profile data here if needed
          });
          console.log("User document created in Firestore for:", user.uid);
      } catch (firestoreError) {
          console.error("Error creating user document in Firestore:", firestoreError);
          // Decide how to handle this - maybe alert the user, but signup itself was successful
          setError("Signup successful, but failed to create user profile data. Please try logging in or contact support.");
          // Don't block login if only Firestore write failed, user exists in Auth
      }

      setLoading(false);
      navigate("/dashboard"); // Redirect to dashboard (or DeckList) after successful signup & profile creation

    } catch (authError) {
      setLoading(false);
      let errorMessage = "Signup failed. Please try again.";
      if (authError.code === "auth/email-already-in-use") {
        errorMessage = "Email address is already in use. Please use a different email or login.";
      } else if (authError.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use at least 6 characters.";
      } else if (authError.code === "auth/invalid-email") {
         errorMessage = "Please enter a valid email address.";
      }
      console.error("Signup Auth Error:", authError);
      setError(errorMessage);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-100 to-gray-200">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-3xl font-bold text-center text-gray-800">Create Your Account</h2>
            <form onSubmit={handleSignup} className="space-y-4">
                {error && <p className="p-3 bg-red-100 border border-red-300 text-red-700 rounded text-center text-sm">{error}</p>}
                <div>
                    <label htmlFor="email-signup" className="sr-only">Email address</label>
                    <input
                        id="email-signup"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                 <div>
                     <label htmlFor="password-signup" className="sr-only">Password</label>
                    <input
                        id="password-signup"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (min. 6 characters)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                 </div>
                <div>
                    <button
                        type="submit" // Use type="submit" for forms
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? "Signing up..." : "Sign Up"}
                    </button>
                </div>
            </form>
             <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                    Log in
                </a>
            </p>
        </div>
    </div>
  );
};

export default Signup;