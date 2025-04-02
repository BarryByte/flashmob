# 📚 FlashMob - Collaborative Flashcard App with AI-Powered Question Generation

## 🚀 Overview

**FlashMob** is a collaborative flashcard application designed to enhance study sessions by allowing users to create, share, and review flashcards seamlessly. It leverages **AI-powered question generation** to help users save time and focus on learning rather than manually creating flashcards, well you can create them manually too. The app is built using **React** for the frontend and **Express.js** for the backend, with real-time collaboration features powered by **Firebase**.

## 🎯 Key Features

### 🔹 Collaborative Flashcard Creation
- Create and organize flashcard decks.
- Share flashcards with friends and collaborate in real-time (powered by **Firebase**).
- Manually add questions and answers.

### 🔹 AI-Generated Questions
- Paste study material, and the **AI generates Q&A pairs** automatically.
- Uses **Gemini 2.0 Flash API** for smart question generation.
- Example:
  - **Input:** "Einstein's theory of relativity, encompassing special and general relativity, essentially states that space and time are relative and not absolute, and gravity is a curvature of spacetime caused by mass and energy. "
  ![Screenshot from 2025-04-02 13-12-40](https://github.com/user-attachments/assets/9be81005-3943-4070-a081-2cfea22f6d97)

  - **Output:** "What does the Earth revolve around?" → "The Sun."
  ![Screenshot from 2025-04-02 13-13-31](https://github.com/user-attachments/assets/e6b90b72-f3db-4889-ad1b-44bd7c6d7125)


### 🔹 Study Mode
- Flip through flashcards with a **smooth animation**.
- Track correct/incorrect responses.
- Score tracking to measure progress.
![Screenshot from 2025-04-02 13-44-56](https://github.com/user-attachments/assets/413b1481-570a-43eb-88ad-6f6dee457631)

- ![image](https://github.com/user-attachments/assets/05030eb9-7f33-49bd-bc39-a2d2f96cc230)


### 🔹 Export & Share
- Export flashcards as a pdf
  ![Screenshot from 2025-04-02 13-46-12](https://github.com/user-attachments/assets/b7d9d396-5915-4255-8ded-9b5719f94633)

- Share decks with friends via gmail, so they can study together.
  ![image](https://github.com/user-attachments/assets/e5c3400f-3436-4bf4-a133-046d600fd439)


## 🛠️ Tech Stack

### Frontend:
- **React** (Fast and responsive UI)
- **Tailwind CSS** (Modern styling framework)
- **React Router** (Navigation management)
- **Firebase** (Real-time collaboration and storage)

### Backend:
- **Express.js** (Lightweight and fast backend framework)
- **Node.js** (Server-side execution)
- **Google Gemini 2.0 Flash API** (AI-powered question generation)
- **Firebase** (User authentication and data storage)
- **CORS & Body-Parser** (For handling API requests)

## 📦 Installation & Setup

### 🔹 Prerequisites
- **Node.js** (>= v16)
- **npm** or **yarn**
- **Firebase account** (for real-time collaboration)

### 🔹 Clone the Repository
```sh
  git clone https://github.com/yourusername/flashmob.git
  cd flashmob
```

### 🔹 Backend Setup
```sh
  cd backend
  npm install
  npm run dev
```
- Create a `.env` file and add your **Google Gemini API Key**

### 🔹 Frontend Setup
```sh
  cd frontend
  npm install
  npm run dev
```

## 📌 Usage
1. **Sign up/login** using Firebase authentication.
2. **Create a flashcard deck** manually or by using AI-generated questions.
3. **Invite friends** to collaborate in real-time.
4. **Study using interactive flashcards** and track progress.
5. **Export or share** your deck for revision.

## 📜 API Endpoints
### 🔹 Generate Questions (POST)
```http
POST /api/generate-questions
```
**Request Body:**
```json
{
  "text": "The Earth revolves around the Sun.",
  "num_questions": 1
}
```
**Response:**
```json
{
  "question": "What does the Earth revolve around?",
  "answer": "The Sun."
}
```


## 📄 License
This project is licensed under the **MIT License**.

## 🔗 Contact
For any queries, reach out via **abhayraj.12667@gmail.com**.
