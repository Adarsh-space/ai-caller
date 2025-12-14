# TeleCaller - AI Voice & WhatsApp Automation SaaS Platform

## Overview

TeleCaller is a multi-tenant SaaS platform for AI-powered voice calling and WhatsApp automation. The application enables businesses to create AI agents that can make outbound calls, handle inbound calls, and manage WhatsApp conversations automatically. Key features include campaign management, lead tracking, call analytics, compliance management (DNC lists), and a credit-based billing system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state, React Context for auth
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode)
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API with Bearer token authentication
- **Session Management**: Simple token-based auth (userId:tenantId format)
- **Build Process**: esbuild for production bundling with selective dependency bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Definition**: Zod schemas in shared/schema.ts for validation and type inference
- **Storage Interface**: Abstract IStorage interface in server/storage.ts allowing for different implementations

### Multi-Tenancy Model
- Tenant isolation at the data level with tenantId on all entities
- User roles: OWNER, ADMIN, AGENT, VIEWER
- Middleware-based authorization checking tenant membership

### Key Domain Entities
- **Tenants**: Business accounts with subscription plans
- **Users**: Team members belonging to tenants
- **Agents**: AI voice/chat agents with configurable behaviors
- **Campaigns**: Outbound calling campaigns with scheduling
- **Leads**: Contact records for campaigns
- **Calls**: Call logs with outcomes and recordings
- **WAConversations/Messages**: WhatsApp conversation history
- **Wallet/Transactions**: Credit-based billing system
- **DNCEntries**: Do-Not-Call compliance list

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components (shadcn/ui + custom)
│       ├── pages/        # Route pages
│       ├── lib/          # Utilities, auth context, API client
│       └── hooks/        # Custom React hooks
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data access layer interface
│   ├── static.ts     # Static file serving
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client/server
│   └── schema.ts     # Zod schemas and TypeScript types
└── migrations/       # Drizzle database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database via DATABASE_URL environment variable
- **Drizzle Kit**: Database migrations and schema pushing

### Authentication (Optional)
- **Firebase**: Google authentication support configured but not required for basic auth

### UI/Component Libraries
- **Radix UI**: Accessible component primitives
- **shadcn/ui**: Pre-built component library (new-york style)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel component
- **React Day Picker**: Calendar component
- **cmdk**: Command palette component

### Development Tools
- **Vite**: Development server with HMR
- **esbuild**: Production bundling
- **TypeScript**: Type checking
- **Tailwind CSS**: Utility-first CSS

### Form Handling
- **React Hook Form**: Form state management
- **Zod**: Schema validation with @hookform/resolvers

### Data Fetching
- **TanStack Query**: Server state management and caching