# IEB Backend Management System (Demo)

**Institution of Engineers, Bangladesh (IEB)** — Backend API Prototype

A clean, modular, serverless backend demonstration for managing:

- Members & Membership Categories
- Membership Applications (with approval workflow)
- Membership Renewals
- Committees & Committee Members
- Events & Event Registrations
- Professional Registration & Certificates
- Dashboard Statistics
- Public Verification APIs
- Role-based Access Control (RBAC)
- Audit Logging

> **This is a functional demo/prototype**, not a complete production system.

---

## Technology Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Runtime          | Node.js 20+ / TypeScript            |
| Serverless       | Netlify Functions                   |
| Database         | PostgreSQL (Neon / Supabase)        |
| ORM              | Prisma                              |
| Validation       | Zod                                 |
| Auth             | JWT + bcrypt                        |
| API Style        | REST                                |

---

## Project Structure

```
ieb-backend/
├── netlify/
│   └── functions/
│       └── api.ts              # Main serverless API router
├── src/
│   ├── modules/
│   │   ├── members/
│   │   ├── membership-applications/
│   │   ├── membership-renewals/
│   │   ├── committees/
│   │   ├── events/
│   │   ├── professional-registration/
│   │   └── dashboard/
│   ├── auth/
│   ├── database/
│   ├── middleware/
│   ├── utils/
│   ├── types/
│   └── config/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── netlify.toml
├── package.json
└── README.md
```

---

## Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon, Supabase, or local)
- Netlify CLI (for local development): `npm i -g netlify-cli`

---

## Installation

```bash
# Clone / enter project
cd ieb-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET
```

---

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/ieb_demo?sslmode=require"
JWT_SECRET="change-this-to-a-long-random-secret-at-least-32-chars"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"
STORAGE_URL=""
STORAGE_KEY=""
NODE_ENV="development"
CORS_ORIGIN="*"
```

---

## Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates tables)
npx prisma migrate dev --name init

# Seed demo data
npm run db:seed
```

---

## Local Development

```bash
# Start Netlify Dev (serves functions + redirects)
npm run dev
# or
netlify dev
```

API base URL (local): `http://localhost:8888/api` (or the port shown by Netlify Dev)

---

## Demo Credentials

| Role                 | Email                          | Password       |
|----------------------|--------------------------------|----------------|
| **Super Admin**      | `admin@ieb-demo.local`         | `ChangeMe123!` |
| Membership Officer   | `membership@ieb-demo.local`    | `ChangeMe123!` |
| Committee Officer    | `committee@ieb-demo.local`     | `ChangeMe123!` |
| Event Officer        | `events@ieb-demo.local`        | `ChangeMe123!` |
| Registration Officer | `registration@ieb-demo.local`  | `ChangeMe123!` |

> **IMPORTANT**: These are DEMO accounts. Change the password before any production use.

---

## Key API Endpoints

### Authentication
- `POST /api/auth/login` — Login
- `GET  /api/auth/me` — Current user profile
- `POST /api/auth/logout`

### Members
- `GET    /api/members` — List (search, filter, paginate)
- `GET    /api/members/:id`
- `POST   /api/members`
- `PUT    /api/members/:id`
- `GET    /api/members/stats`
- `GET    /api/members/categories`

### Membership Applications
- `GET  /api/membership-applications`
- `POST /api/membership-applications` (public)
- `POST /api/membership-applications/:id/submit`
- `POST /api/membership-applications/:id/query`
- `POST /api/membership-applications/:id/approve`
- `POST /api/membership-applications/:id/reject`

### Membership Renewals
- `GET  /api/membership-renewals`
- `POST /api/membership-renewals`
- `POST /api/membership-renewals/:id/approve`
- `POST /api/membership-renewals/:id/reject`

### Committees
- `GET  /api/committees`
- `POST /api/committees`
- `POST /api/committees/:id/members`
- `GET  /api/committees/types`
- `GET  /api/committees/positions`

### Events
- `GET  /api/events`
- `POST /api/events`
- `POST /api/events/:id/register` (public)
- `GET  /api/events/:id/participants`
- `PATCH /api/events/:id/participants/:regId`

### Professional Registration
- `GET  /api/professional-registrations`
- `POST /api/professional-registrations` (public)
- `POST /api/professional-registrations/:id/approve`
- `POST /api/professional-registrations/:id/reject`

### Dashboard
- `GET /api/dashboard`

### Public Verification
- `GET /api/public/verify-member/:membershipNumber`
- `GET /api/public/verify-registration/:registrationNumber`
- `GET /api/public/events`

---

## Response Format

**Success**
```json
{
  "success": true,
  "message": "Member created successfully",
  "data": { ... }
}
```

**Error**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "email": ["Invalid email"] }
}
```

---

## Netlify Deployment

1. Push the repository to GitHub/GitLab.
2. Create a new site on Netlify and connect the repo.
3. Set environment variables in Netlify UI:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - (optional) `STORAGE_URL`, `STORAGE_KEY`
4. Build command: `npm run build`
5. Publish directory: `public` (can be empty)
6. Functions directory is configured in `netlify.toml`.

After deploy, run migrations against the production database:

```bash
DATABASE_URL="your-prod-url" npx prisma migrate deploy
DATABASE_URL="your-prod-url" npm run db:seed
```

---

## Security Notes

- Passwords are hashed with bcrypt (cost 12).
- All private endpoints require a valid JWT.
- Role checks are enforced server-side.
- Public verification endpoints return only non-sensitive data.
- Input validation via Zod on all write endpoints.
- Audit logs record important administrative actions.
- Never commit `.env` or real secrets.

---

## Seed Data Summary

- 7 roles + permissions
- 6 membership categories
- 30 sample members (various statuses & disciplines)
- 12 membership applications (various workflow statuses)
- 8 renewal records
- 7 committees with members
- 10 events with registrations
- 8 professional registration applications (2 approved with certificates)
- Admin + 4 officer demo users

---

## Future Expansion

The modular architecture supports adding later:

- Finance & fee collection
- Full document storage integration
- Notifications (email/SMS)
- Election management
- Accreditation modules
- Mobile app consumption of the same APIs

---

## License

MIT — Demo / Educational use.
