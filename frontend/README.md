## Google Fit OAuth Setup

This frontend now includes Google OAuth endpoints for connecting the app to Google Fit.

### Environment variables

Copy `.env.example` to `.env.local` and fill in your Google OAuth credentials:

```bash
cp .env.example .env.local
```

Required values:

- `APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`

### OAuth endpoints added

- `GET /api/auth/google/login` starts the Google OAuth flow
- `GET /api/auth/google/callback` handles the Google redirect and exchanges the auth code for tokens
- `GET /api/auth/session` returns the current connection state
- `POST /api/auth/logout` clears the stored session cookie

### Google Cloud Console values

For local development, add these in your Google OAuth client:

- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`

For production, replace `http://localhost:3000` with your deployed app URL and keep the same callback path:

- Authorized JavaScript origins: `https://your-domain.com`
- Authorized redirect URIs: `https://your-domain.com/api/auth/google/callback`

### Included Google Fit scopes

- `https://www.googleapis.com/auth/fitness.activity.read`
- `https://www.googleapis.com/auth/fitness.body.read`
- `https://www.googleapis.com/auth/fitness.heart_rate.read`

The app also requests `openid`, `email`, and `profile`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
