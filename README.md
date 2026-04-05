# ChatGPT Clone

A ChatGPT-like chatbot interface built with Next.js, Supabase, and OpenRouter.

## Features

- Send messages to chat with streaming responses
- Integrate multiple LLMs via OpenRouter (Qwen, Gemma, Gemini)
- Left side navigation with chat list, persisted in database
- User authentication and login
- Paste or attach images to chat
- Anonymous access up to 3 free questions
- Real-time chat synchronization across tabs
- Document upload for context

## Tech Stack

- **Frontend**: React 19, Next.js 16, TanStack Query
- **UI**: Shadcn UI, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Authentication
- **Realtime**: Supabase Realtime
- **AI**: OpenRouter API

## Prerequisites

- Node.js 18+ or Bun
- Supabase account
- OpenRouter API key

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd chatgpt-clone
```

2. Install dependencies:

```bash
bun install
```

3. Set up Supabase:

   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Go to Settings > API to get your project URL and anon key
   - Go to Settings > API > Service Role Key to get your service role key
   - Run the database migration in the Supabase SQL editor:

   ```sql
   -- Copy and paste the contents of supabase/migrations/001_initial_schema.sql
   ```

4. Set up environment variables:

   Create a `.env.local` file in the root directory:

   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # OpenRouter
   OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
   ```

5. Run the development server:

```bash
bun dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── session/       # Authentication endpoints
│   │   ├── chats/
│   │   │   ├── [chatId]/
│   │   │   │   ├── messages/  # Message CRUD
│   │   │   │   └── stream/    # Streaming responses
│   │   │   └── route.ts       # Chat list/create
│   │   └── documents/         # Document upload
│   ├── chat/
│   │   ├── [chatId]/          # Individual chat page
│   │   └── layout.tsx         # Chat layout with sidebar
│   ├── login/                 # Login page
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page (redirects to chat)
├── components/
│   ├── chat/
│   │   ├── chat-input.tsx     # Message input component
│   │   ├── header.tsx         # App header
│   │   ├── message-list.tsx   # Message display
│   │   ├── sidebar.tsx        # Chat list sidebar
│   │   └── welcome-screen.tsx # Welcome screen
│   ├── providers/
│   │   ├── auth-provider.tsx  # Authentication context
│   │   ├── query-provider.tsx # TanStack Query provider
│   │   └── theme-provider.tsx # Theme provider
│   └── ui/                    # Shadcn UI components
└── lib/
    ├── supabase/
    │   ├── client.ts          # Browser Supabase client
    │   └── server.ts          # Service role client
    ├── constants.ts           # App constants
    ├── types.ts               # TypeScript types
    └── utils.ts               # Utility functions
```

## API Endpoints

### Chats

- `GET /api/chats?userId=...&anonymousId=...` - List chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/[chatId]` - Get chat with messages
- `PATCH /api/chats/[chatId]` - Update chat title
- `DELETE /api/chats/[chatId]` - Delete chat

### Messages

- `GET /api/chats/[chatId]/messages` - List messages
- `POST /api/chats/[chatId]/messages` - Create message

### Streaming

- `POST /api/chats/[chatId]/stream` - Stream AI response

### Authentication

- `GET /api/auth/session` - Get current session
- `POST /api/auth/session` - Login or register

### Documents

- `GET /api/documents?chatId=...` - List documents
- `POST /api/documents` - Upload document

## Deployment

### Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel settings
4. Deploy

### Railway/Render

1. Create a new project
2. Connect your repository
3. Add environment variables
4. Deploy

## License

MIT
