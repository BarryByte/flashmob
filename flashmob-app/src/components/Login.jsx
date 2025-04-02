
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom"; // Import for redirection

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Initialize navigate

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setError(""); // Clear previous errors
    setLoading(true);

     if (!email || !password) {
        setError("Please enter both email and password.");
        setLoading(false);
        return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      console.log("Login successful");
      navigate("/dashboard"); // Redirect to dashboard (or DeckList) after successful login
    } catch (err) {
      setLoading(false);
      let errorMessage = "Login failed. Please check your credentials.";
      // Use modern error codes if available (check Firebase docs for latest)
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-email") {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (err.code === "auth/wrong-password") { // May be deprecated, covered by invalid-credential
        errorMessage = "Incorrect password. Please try again.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      }
      console.error("Login Auth Error:", err);
      setError(errorMessage);
    }
  };

  return (
     <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-100 to-gray-200">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-3xl font-bold text-center text-gray-800">Log In to Your Account</h2>
             <form onSubmit={handleLogin} className="space-y-4">
                {error && <p className="p-3 bg-red-100 border border-red-300 text-red-700 rounded text-center text-sm">{error}</p>}
                 <div>
                    <label htmlFor="email-login" className="sr-only">Email address</label>
                    <input
                        id="email-login"
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
                    <label htmlFor="password-login" className="sr-only">Password</label>
                    <input
                        id="password-login"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                 </div>
                 {/* Add Forgot Password link if needed */}
                 {/* <div className="text-sm text-right">
                    <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                        Forgot your password?
                    </a>
                 </div> */}
                  <div>
                    <button
                        type="submit"
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                  </div>
             </form>
              <p className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <a href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                    Sign up
                </a>
            </p>
        </div>
     </div>
  );
};

export default Login;