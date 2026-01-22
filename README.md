# EduQuest - Quiz Management Platform

A comprehensive platform for instructors to create, manage, and track student quizzes with real-time analytics.

## Project Structure

```
eduquest/
├── apps/
│   ├── web/              # React web application (Vite + Tailwind)
│   └── mobile/           # React Native mobile app (Expo)
├── supabase/             # Supabase configuration & migrations
└── README.md             # This file
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+ or yarn

### Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Run the web app:**
   ```bash
   npm run dev:web
   ```
   The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev:web` - Start web development server
- `npm run build:web` - Build web app for production
- `npm run lint` - Lint all apps

## Tech Stack

### Web

- **Framework:** React 19
- **Routing:** React Router v7
- **Styling:** Tailwind CSS
- **Build Tool:** Vite
- **Backend:** Supabase (PostgreSQL)

### Mobile

- **Framework:** React Native (Expo)
