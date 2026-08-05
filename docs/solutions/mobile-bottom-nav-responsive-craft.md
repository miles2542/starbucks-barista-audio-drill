---
title: "Mobile Bottom Navigation Bar & Mobile Card Dashboard Design"
category: "frontend_ui"
problem_type: "mobile_ux_responsive_breakage"
component: "Navbar.tsx, SRSDashboard.tsx, index.css"
tags: ["responsive-design", "mobile-bottom-nav", "touch-targets", "nordic-obsidian", "css-clamp"]
date: "2026-08-05"
---

# Mobile Bottom Navigation Bar & Mobile Card Dashboard Design

## Problem
1. **Header Navigation Overflow:** Top desktop header navigation buttons wrapped awkwardly or clipped on small mobile viewports ($360\text{px} - 430\text{px}$).
2. **Table Horizontal Scrolling:** SRS Metrics table required horizontal scrolling on mobile screens, making confidence metrics and recall stats hard to scan.
3. **Small Touch Targets:** Interactive buttons lacked consistent touch dimensions, causing accidental taps.

## Solution

### 1. Dual Header/Bottom Nav Architecture (`Navbar.tsx` & `App.tsx`)
* **Mobile Viewports ($<768\text{px}$):**
  * Condensed top header displaying only Siren Logo + Compact App Title + Auto-Sync status.
  * Fixed **Mobile Bottom Navigation Bar** locking the 4 main tabs (**Quiz**, **SRS Metrics**, **Recipes**, **Settings**) to the bottom edge with active mint indicators and due-item badges.
* **Desktop Viewports ($\ge 768\text{px}$):**
  * Retains standard top header navigation bar.

### 2. Mobile Cards SRS Dashboard View (`SRSDashboard.tsx`)
* On viewports $<768\text{px}$, CSS media queries hide `.srs-table-view` and display `.srs-card-view`.
* Renders each drink as a scannable mobile card displaying:
  * Recipe Name & HOT/ICED badge
  * Status badge (Mastered, Learning, Due)
  * Visual progress bar & Accuracy percentage
  * Due indicator and recall counts

### 3. Touch Target & Fluid Typography Standards (`index.css`)
* **Touch Targets:** Enforced `min-height: 44px` on all interactive buttons with tactile `:active` press scaling (`scale(0.97)`).
* **Fluid Typography:** Applied CSS `clamp()` for dynamic scaling across viewports (`font-size: clamp(1.1rem, 4.5vw, 1.5rem)` for headers).

## Key Learnings & Error Avoidance
* **Bottom Navigation for Mobile SPAs:** Lock high-frequency navigation tabs to the screen bottom on mobile viewports for single-thumb ergonomics.
* **Transform wide tables to card lists on mobile:** Avoid horizontal table scrolling on mobile screens by rendering stacked CSS card components.
