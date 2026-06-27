---
name: Industrial Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#4442e3'
  on-secondary: '#ffffff'
  secondary-container: '#5f5ffd'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e1dfff'
  secondary-fixed-dim: '#c1c1ff'
  on-secondary-fixed: '#09006b'
  on-secondary-fixed-variant: '#2c24ce'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  glass-bg: rgba(255, 255, 255, 0.7)
  glass-border: rgba(255, 255, 255, 0.4)
  status-milling: '#3B82F6'
  status-welding: '#F59E0B'
  status-assembly: '#10B981'
  status-shipped: '#6366F1'
  danger: '#EF4444'
typography:
  display-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  container-max: 1440px
---

## Brand & Style
The design system is engineered for the high-stakes environment of uPVC fabrication, where precision and industrial efficiency are paramount. The brand personality is **authoritative, meticulous, and forward-thinking**, bridging the gap between heavy manufacturing and modern cloud-based intelligence. 

The design style is **Corporate Modern with subtle Glassmorphic accents**. This approach utilizes a clean, structured layout inspired by top-tier B2B SaaS platforms, softened by semi-transparent utility panels and soft ambient shadows. The interface prioritizes clarity and high-density data visualization, ensuring that fabrication managers and floor supervisors can navigate complex production schedules with zero friction. It evokes a sense of "digital machinery"—reliable, smooth-running, and high-performance.

## Colors
The palette is anchored by **Deep Navy (#0F172A)**, providing a sophisticated industrial foundation. **White (#FFFFFF)** is used extensively for the main canvas to maintain a "clean-room" manufacturing aesthetic.

**Action & Accent:**
- **Electric Blue (#6161FF)**: Used for primary calls-to-action and interactive elements, inherited from the modern SaaS aesthetic.
- **Manufacturing Status Tints**: A secondary spectrum of functional colors is utilized to track fabrication stages: Blue for Milling, Amber for Welding, and Green for Final Assembly.

**Neutral Surfaces:**
- Backgrounds utilize a very light slate tint to reduce eye strain during long shifts.
- Glassmorphic layers are defined by a 70% opacity white surface with a high-saturation backdrop blur (20px), primarily used for floating sidebars and modal overlays.

## Typography
The typographic hierarchy balances modern SaaS aesthetics with technical legibility.

- **Headlines:** Use **Hanken Grotesk**. Its sharp, geometric terminals provide a contemporary, engineered feel that reflects the precision of uPVC cutting and assembly.
- **Body:** Use **Inter**. Chosen for its exceptional readability in data-heavy tables and ERP forms.
- **Technical Data:** Use **JetBrains Mono** for serial numbers, dimensions (e.g., 1200mm x 1500mm), and SKU codes. This monospaced choice ensures that numerical values align vertically, critical for manual measurement verification on the shop floor.

## Layout & Spacing
The layout follows a **12-column fixed-fluid hybrid grid**. The sidebar and navigation are fixed, while the primary workspace fluidly adapts to screen width to maximize table visibility.

**Rhythm:**
- A **4px baseline grid** governs all internal spacing.
- **Desktop:** 24px gutters provide significant breathing room between complex data modules.
- **Tablets/Mobile:** On smaller screens, the layout collapses into a single-column stack. Sidebars transform into bottom-sheet overlays or full-screen menus.

**Industrial Density:**
While whitespace is used to denote sections, the "Data Grid" views utilize a high-density spacing model (8px cell padding) to allow fabrication managers to see up to 20 production rows without scrolling.

## Elevation & Depth
Depth in this design system is used to indicate the "active phase" of the fabrication workflow.

- **Level 0 (Surface):** The main canvas, neutral slate.
- **Level 1 (Cards):** Production cards use a **Low-contrast outline** (1px border, #E2E8F0) with no shadow to maintain a clean, flat appearance for background tasks.
- **Level 2 (Active/Hover):** When a production order is hovered or selected, it gains an **Ambient Shadow**: a soft, 15% opacity Deep Navy blur with a 12px spread.
- **Level 3 (Overlays):** Modals and fly-out panels use **Glassmorphism**. They feature a `backdrop-filter: blur(20px)` and a thin, semi-transparent white border to simulate polished glass inserts—reminiscent of the window products being manufactured.

## Shapes
The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern feel while maintaining the "hard" structural integrity associated with industrial manufacturing. 

- **Standard Elements:** Inputs, buttons, and status tags use the 4px base radius.
- **Containers:** Large dashboard widgets and production boards use `rounded-lg` (8px) to frame content clearly.
- **Interactive Nodes:** Selection handles and radio buttons remain circular to provide a clear contrast against the predominantly rectangular layout of window dimension inputs.

## Components

**Buttons:**
- **Primary:** Deep Navy (#0F172A) background with White text. Crisp 4px corners. High-contrast.
- **Secondary:** White with 1px border (#E2E8F0). Glass effect applied on hover.

**Production Chips:**
- Used for "Status" or "Material Type" (e.g., 'White uPVC', 'Anthracite Gray'). These are flat, using the functional color palette with 10% opacity backgrounds and 100% opacity text.

**Input Fields:**
- High-contrast focus states using the Secondary Blue (#6161FF). 
- Labeling always uses the JetBrains Mono `label-sm` for technical precision. Units (mm, kg, qty) are permanently affixed as right-aligned suffixes within the field.

**Data Tables:**
- The core of the ERP. Sticky headers with a glassmorphic background ensure context is never lost. 
- Alternating row zebra-striping is replaced by a subtle 1px bottom border to maintain the "clean" industrial aesthetic.

**Manufacturing Icons:**
- Use thick-stroke (2px) SVG icons. 
- Specific icons for: *Cutting Saw, Heat Welder, Glazing Bead, and Corner Cleaner.* These icons should be monolinear and geometric.

**Progress Indicators:**
- Step-based production trackers should use a thick 4px line to connect fabrication stages, filling with the Secondary Blue as the order moves from 'Ordered' to 'Dispatched'.