# LinkedIn Content Engine

Automated Java content generation and scheduling platform. Generates daily LinkedIn posts about Java programming topics using LLM APIs and publishes them on a configurable schedule.

---

## Features

- **Automated content generation** — Uses Groq-hosted LLMs (Llama 3.3, Mixtral, Gemma) with automatic model fallback
- **Scheduled posting** — Cron-based daily scheduler with configurable time and timezone
- **Manual composer** — Draft, preview, edit, and publish posts from the web dashboard
- **Post history** — Local telemetry tracking all published and failed posts
- **OAuth integration** — Connect your LinkedIn account directly from the dashboard
- **Duplicate prevention** — Content-hash idempotency keys on both API and storage layers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express |
| AI | Groq API (Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B, Gemma 2 9B) |
| Scheduling | node-cron |
| LinkedIn | LinkedIn UGC Posts API v2, OAuth 2.0 |
| Frontend | Vanilla HTML/CSS/JS |
| Data | JSON file storage |

## Project Structure

```
├── server.js                 # Express server, API routes, OAuth flow
├── config/
│   └── config.js             # Centralized configuration from env vars
├── services/
│   ├── ai-generator.js       # LLM prompt construction and multi-model fallback
│   ├── linkedin-api.js       # LinkedIn API client (post, auth, profile)
│   ├── post-store.js         # JSON-based post history with deduplication
│   └── scheduler.js          # Cron job management
├── public/
│   ├── index.html            # Dashboard UI
│   ├── styles.css            # Stylesheet
│   └── app.js                # Frontend logic
├── data/
│   └── posts.json            # Post history (auto-generated, gitignored)
├── .env                      # Environment variables (gitignored)
└── .env.example              # Template for environment setup
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Groq API key](https://console.groq.com/keys)
- A [LinkedIn Developer App](https://www.linkedin.com/developers/apps) with the `w_member_social` and `openid` scopes

### Installation

```bash
git clone https://github.com/nampallyharish4/LinkedIn-Java-AutoPoster.git
cd LinkedIn-Java-AutoPoster
npm install
```

### Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GROQ_API_KEY=your_groq_api_key
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
PORT=3000
POST_TIME=09:00
TIMEZONE=Asia/Kolkata
```

> **Note:** `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_PERSON_URN` are automatically populated when you authenticate via the dashboard.

### Running

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Dashboard

The web dashboard provides:

1. **Content Composer** — Select a Java topic (or let the system choose), generate a draft, edit it, and publish to LinkedIn.
2. **Automated Scheduler** — Set a daily posting time. The scheduler generates and publishes a post automatically at the configured hour.
3. **Execution Control** — One-click to generate and publish immediately.
4. **Telemetry & History** — View all past posts with status, topic, and timestamp.

### LinkedIn Authentication

1. Click **"Link Profile Authentication"** on the dashboard.
2. You will be redirected to LinkedIn's OAuth consent screen.
3. After authorizing, you will be redirected back to the dashboard with your access token and person URN configured automatically.

### Scheduler

The scheduler runs a cron job at the configured `POST_TIME` in the configured `TIMEZONE`. It:

1. Picks a random Java topic from the pool of 40+ topics
2. Selects a random post style (tips, code snippet, opinion, tutorial, etc.)
3. Generates a LinkedIn-optimized post via the Groq API
4. Publishes to your LinkedIn profile
5. Logs the result to post history

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/preview` | Generate a draft post |
| `POST` | `/api/publish` | Publish content to LinkedIn |
| `POST` | `/api/post-now` | Generate and publish immediately |
| `POST` | `/api/scheduler/start` | Start the cron scheduler |
| `POST` | `/api/scheduler/stop` | Stop the cron scheduler |
| `GET` | `/api/scheduler` | Get scheduler status |
| `PUT` | `/api/scheduler/time` | Update scheduled posting time |
| `GET` | `/api/posts` | Get post history (paginated) |
| `DELETE` | `/api/posts/:id` | Delete a post from history |
| `GET` | `/api/topics` | Get available Java topics |
| `GET` | `/api/auth/status` | Check authentication status |
| `GET` | `/auth/linkedin` | Start OAuth flow |
| `GET` | `/auth/linkedin/callback` | OAuth callback handler |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | API key for Groq LLM service |
| `LINKEDIN_CLIENT_ID` | Yes | LinkedIn app client ID |
| `LINKEDIN_CLIENT_SECRET` | Yes | LinkedIn app client secret |
| `LINKEDIN_ACCESS_TOKEN` | Auto | Set via OAuth flow |
| `LINKEDIN_PERSON_URN` | Auto | Set via OAuth flow |
| `PORT` | No | Server port (default: 3000) |
| `POST_TIME` | No | Daily post time in HH:MM format (default: 09:00) |
| `TIMEZONE` | No | IANA timezone string (default: Asia/Kolkata) |

## License

This project is for personal use. All rights reserved.
