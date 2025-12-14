# Design Guidelines: AI Voice & WhatsApp Automation SaaS Platform

## Design Approach

**System-Based Approach**: Material Design principles adapted for enterprise SaaS
- **Rationale**: Information-dense application requiring clear hierarchy, strong data visualization, and professional credibility
- **Core Principles**: Clarity over cleverness, consistency over creativity, function over form

---

## Typography System

**Font Stack**:
- Primary: Inter (Google Fonts) - headings, UI elements, data tables
- Secondary: System font stack for body text performance

**Hierarchy**:
- H1: 2.5rem (40px), font-weight 700 - Page titles
- H2: 2rem (32px), font-weight 600 - Section headers
- H3: 1.5rem (24px), font-weight 600 - Card titles, subsections
- H4: 1.25rem (20px), font-weight 500 - Table headers, tabs
- Body Large: 1rem (16px), font-weight 400 - Primary content
- Body Small: 0.875rem (14px), font-weight 400 - Secondary text, captions
- Label: 0.75rem (12px), font-weight 500, uppercase - Status badges, metadata

---

## Layout System

**Spacing Scale**: Tailwind units 2, 4, 6, 8, 12, 16
- Micro spacing (2, 4): Icon-text gaps, input padding
- Component spacing (6, 8): Card padding, form field gaps
- Section spacing (12, 16): Between major sections, page margins

**Grid Structure**:
- Dashboard: 12-column grid with 8-unit gutters
- Sidebar: Fixed 256px (64 units) on desktop, collapsible on mobile
- Main content: max-w-7xl with p-6 on desktop, p-4 on mobile

---

## Component Library

### Navigation
**Admin Top Bar**: Fixed header with logo, global search, notifications bell, user avatar dropdown
**Sidebar Navigation**: Hierarchical menu with icons, active state indication, section grouping

### Dashboard Cards
**Metric Cards**: White background, subtle border, p-6, includes icon, large number, label, trend indicator
**Data Tables**: Zebra striping, sortable headers, row hover states, actions column with dropdown
**Status Badges**: Pill-shaped, colored backgrounds (green=active, yellow=pending, red=failed, gray=inactive)

### Forms & Inputs
**Text Inputs**: Clear borders, focus ring, floating labels, helper text below, error states in red
**Dropdowns**: Chevron indicator, search functionality for long lists, selected state visual
**Toggles**: Material-style switches for enable/disable features
**File Upload**: Drag-drop zone with CSV icon, progress indicator

### Agent Builder Interface
**Three-Panel Layout**:
- Left (320px): Agent configuration form with sections
- Center (flex-1): Conversation flow builder with intent cards
- Right (320px): Voice preview player, test call controls

**Intent Cards**: White cards with colored left border, drag handles, expand/collapse for details

### WhatsApp Inbox
**Conversation List**: Compact rows with avatar, name, preview, timestamp, unread badge
**Chat View**: iMessage-style bubbles (user: left/gray, AI: right/blue, human: right/green)
**Message Metadata**: "AI replied" / "Human replied" labels in small text below bubbles

### Call Logs
**Table View**: Date/time, phone number, agent name, duration, status badge, actions (play recording, view transcript)
**Live Call Indicator**: Pulsing red dot with duration counter

### Billing & Credits
**Wallet Display**: Large credit balance number, progress bar showing monthly usage, "Top Up" CTA button
**Transaction History**: Timeline-style list with icons (subscription renewal, top-up, usage deduction)

### Admin Dashboard
**Overview Grid**: 4-column metric cards (customers, revenue, credits, margin)
**Customer Table**: Searchable, sortable, with quick action buttons (view, pause, edit credits)
**Kill Switch Panel**: Prominent red toggle switches for emergency controls

---

## Animations

**Minimal Motion**:
- Hover states: subtle scale (1.02) or shadow increase
- Loading states: simple spinner or skeleton screens
- Transitions: 150-200ms ease for state changes
- NO scroll-triggered animations, parallax, or decorative motion

---

## Distinctive Elements

**Status Visualization**: Color-coded system
- Green: Active, Success, Connected
- Blue: In Progress, AI Processing
- Yellow: Pending, Attention Needed
- Red: Failed, Disconnected, Critical
- Gray: Inactive, Paused

**Credit Balance Widget**: Always visible in header, click to expand transaction details

**Real-time Indicators**: WebSocket-powered live updates for active calls, incoming messages, credit deductions

**Multi-tenant Isolation**: Visual tenant branding area (logo, business name) in top-left of dashboard

---

## Images

**Hero Section (Marketing Page)**:
- Large hero image showing professional business setting with person using headset/phone
- Dashboard screenshot overlay showing the platform in action
- Placement: Full-width background with dark gradient overlay, centered content on top

**Feature Sections**:
- Screenshot images of Agent Builder interface, WhatsApp Inbox, Call Dashboard
- Placement: Alternating left/right with explanatory text

**Admin Dashboard**:
- No decorative images, pure data visualization (charts, tables, metrics)