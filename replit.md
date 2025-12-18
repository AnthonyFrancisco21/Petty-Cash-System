# P CashManager

## Overview

P CashManager is a petty cash management system for tracking imprest fund disbursements. It provides voucher entry, approval workflows, and replenishment reporting capabilities. The application follows a role-based access control model with four user roles: cash managers, requesters, approvers, and admins.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React single-page application built with Vite. It uses:
- **React Router**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for a Fluent Design-inspired interface
- **Forms**: React Hook Form with Zod validation

The design system emphasizes data clarity for financial applications, using Inter for UI text and JetBrains Mono for financial figures and account codes.

### Backend Architecture

The backend is an Express.js server running on Node.js with TypeScript:
- **API Design**: RESTful endpoints under `/api` prefix
- **Authentication**: Replit Auth via OpenID Connect with Passport.js
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **Authorization**: Role-based middleware that checks user roles before allowing access to protected routes

### Data Storage

- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**:
  - `users` - User accounts with role assignments
  - `vouchers` - Petty cash voucher records
  - `chartOfAccounts` - Account codes for categorizing expenses
  - `pettyCashFund` - Fund configuration and current balance
  - `replenishmentRequests` - Fund replenishment tracking
  - `sessions` - Authentication session storage

### Build System

The project uses a custom build script that:
1. Builds the frontend with Vite (outputs to `dist/public`)
2. Bundles the server with esbuild (outputs to `dist/index.cjs`)
3. Bundles select dependencies to reduce cold start times

Development uses Vite's dev server with HMR proxied through the Express server.

## External Dependencies

### Database
- PostgreSQL database (connection via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe queries and migrations
- Schema changes pushed via `npm run db:push`

### Authentication
- Replit Auth (OpenID Connect provider)
- Requires `REPL_ID`, `ISSUER_URL`, and `SESSION_SECRET` environment variables

### UI Libraries
- Radix UI primitives for accessible components
- Tailwind CSS for styling
- Lucide React for icons
- date-fns for date formatting

### Key Runtime Dependencies
- Express.js for HTTP server
- Passport.js for authentication middleware
- Zod for runtime validation
- TanStack Query for data fetching