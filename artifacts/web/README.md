# Telegram Mass Reporter

A web app to manage Telegram accounts and submit mass report jobs against target links, channels, or messages.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A PostgreSQL database (local or remote)
- Telegram API credentials (`api_id` and `api_hash`) for each account — get them at [my.telegram.org](https://my.telegram.org)

## Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd tg-app
npm install
```

### 2. Configure environment variables

Create a `.env` file in the `tg-app` directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tg_reporter
```

Replace the value with your actual PostgreSQL connection string.

### 3. Push the database schema

This creates all required tables automatically:

```bash
npm run db:push
```

### 4. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:5000**

---

## Usage

### Adding Accounts

1. Go to the **Accounts** tab
2. Enter your `api_id`, `api_hash`, and phone number for each Telegram account
3. Complete the OTP verification — the session is saved so you won't need to log in again
4. Accounts with `active` status will be used for reporting

### Submitting a Report Job

1. Go to the **Reports** tab
2. Enter the target link (channel URL or message URL, e.g. `https://t.me/channelname` or `https://t.me/channelname/123`)
3. Choose the report type and how many reports to send per account
4. Pick a speed mode:
   - **Normal** — sends reports one at a time with a 2-second delay between each
   - **Fast** — sends reports in parallel batches of 5, with a 500ms pause between batches
5. Click **Launch Report Job** — progress updates live on the page

### Report Templates

Go to the **Templates** tab to manage the message text sent with each report. Mark one as default and it will be used automatically for all jobs.

---

## Production Build

To build and run a production bundle locally:

```bash
npm run build
npm start
```

---

## Hosting on Render

The repo includes a `render.yaml` that automatically configures a web service and a free PostgreSQL database on [Render](https://render.com).

### Option A — Blueprint deploy (recommended)

1. Push the `tg-app` folder to a GitHub repository
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your GitHub repo — Render will detect `render.yaml` and set everything up automatically
4. Once deployed, open the Render shell or a one-off job and run the schema migration:
   ```bash
   npm run db:push
   ```
   *(Only needed on first deploy — Render's `DATABASE_URL` is already wired in by the blueprint)*

### Option B — Manual setup

1. **Create a PostgreSQL database** on Render and copy the connection string
2. **Create a Web Service** pointing to your repo with:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
3. Add the following environment variables in the Render dashboard:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(your Render Postgres connection string)* |

4. After the first deploy, open the Render **Shell** tab and run:
   ```bash
   npm run db:push
   ```

### Notes

- Render's free plan spins down after 15 minutes of inactivity — the first request after that may take ~30 seconds to wake up. Upgrade to a paid plan to avoid this.
- All Telegram session data is stored in the database, so accounts and report history survive redeploys.

---

## Using Supabase as the Database

The app automatically detects Supabase connections and enables SSL — no extra config needed.

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, then navigate to:
**Project Settings → Database → Connection string → URI**

Copy the connection string. For the best compatibility with Drizzle and the `pg` driver, it is recommended to use the **Session** mode (port 5432) or **Transaction** mode (port 6543).

**Important:** If you use Transaction mode (port 6543), ensure you append `?sslmode=require` to the URI if it's not already there.

The URI looks like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### 2. Set the environment variable

**Locally** — add it to your `.env` file:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**On Render** — paste it as the `DATABASE_URL` environment variable in the dashboard instead of using the auto-provisioned Render database.

### 3. Push or Migrate the schema

You can use `db:push` for rapid development:
```bash
npm run db:push
```

Or use migrations for a more controlled production environment:
```bash
# Generate a new migration based on schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate
```

SSL is enabled automatically when the URL contains `supabase.co`. If you're using another hosted Postgres that requires SSL, set:
```env
DATABASE_SSL=true
```

---

## Project Structure

```
tg-app/
├── client/          # React + Vite frontend
│   └── src/
│       ├── pages/   # Accounts, Reports, Templates pages
│       └── hooks/   # React Query data hooks
├── server/          # Express backend
│   ├── routes.ts    # API routes + Telegram job logic
│   └── storage.ts   # Database access layer
├── shared/
│   ├── schema.ts    # Drizzle ORM schema (accounts, reports, templates)
│   └── routes.ts    # Shared route path constants
└── drizzle.config.ts
```
