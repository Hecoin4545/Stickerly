# 🎭 Stickerly
> The daily candid sticker game for friend groups

## What is Stickerly?
Every day at midnight, one friend is randomly selected as the "target". All other members have 22 hours to secretly snap a candid photo of that person, turn it into a sticker, and upload it. At 10 PM, everyone votes for their top 3 favorite stickers. Points are awarded based on votes, and the leaderboard updates in real time.

## Game Loop
- 🎯 **12:00 AM** — Target selected randomly (with fairness lock to avoid repeat targets)
- 📸 **12:00 AM – 10:00 PM** — Hunt phase: upload candid sticker photos
- 🔒 All submissions are hidden from others until voting opens
- 🗳️ **10:00 PM – 12:00 AM** — Voting: rank your top 3 (1st=5pts, 2nd=3pts, 3rd=1pt)
- 🏆 **12:00 AM** — Results revealed, points awarded, leaderboard updated

## Points System
| Achievement | Points |
|---|---:|
| 🥇 1st Place | +5 pts |
| 🥈 2nd Place | +3 pts |
| 🥉 3rd Place | +1 pt |
| 📤 Submission bonus | +2 pts |
| ⚡ Early bird (before 6 PM) | +1 pt |

## Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account (free tier works)

### Installation
```bash
git clone <repo>
cd stickerly
npm run install:all
```

### Configuration
1. Copy `server/.env.example` to `server/.env` and fill in your values:
   - `MONGO_URI` — MongoDB connection string
   - `JWT_SECRET` — Any random long string
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — From cloudinary.com
2. Set `client/.env` `VITE_API_URL` if deploying (default: `http://localhost:5000/api`)

### Run Development
```bash
npm run dev
```
Opens backend on `http://localhost:5000` and frontend on `http://localhost:5173`

## Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + TailwindCSS + Framer Motion |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **Auth** | JWT + bcryptjs |
| **Real-time** | Socket.io |
| **Image Storage** | Cloudinary |
| **Scheduling** | node-cron |

## Project Structure
```
stickerly/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── hooks/
│   └── package.json
├── server/          # Node.js + Express backend
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── scheduler/
│   └── package.json
└── package.json     # Workspace runner
```

## License
MIT
