---
name: "LLG Local-Service Pilot"
description: "Provisional staging integration-test styling for the LLG local-service lead-capture pilot."
colors:
  project-clay: "#bd552f"
  project-clay-deep: "#8f3b21"
  evergreen-ink: "#17251f"
  field-gray: "#5d6b64"
  warm-paper: "#f7f5ef"
  white-surface: "#ffffff"
  quiet-line: "#d8d8cd"
  soft-sage: "#dfe6dc"
  status-muted: "#b8c3bc"
  peach-focus: "#f3a785"
  modal-backdrop: "rgba(13, 23, 18, 0.72)"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(3rem, 7vw, 6.3rem)"
    fontWeight: 500
    lineHeight: 0.94
    letterSpacing: "-0.055em"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(2rem, 4vw, 3.3rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  display-mobile:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(3rem, 15vw, 4.6rem)"
    fontWeight: 500
    lineHeight: 0.94
    letterSpacing: "-0.055em"
  lede:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "clamp(1.05rem, 2vw, 1.3rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontWeight: 400
    lineHeight: 1.5
  compact:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.5
  dialog-title:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "1.6rem"
    fontWeight: 500
    lineHeight: 1.05
  close-glyph:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.8rem"
    fontWeight: 400
    lineHeight: 1
  label:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.78rem"
    fontWeight: 900
    lineHeight: 1.5
    letterSpacing: "0.13em"
  action:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontWeight: 800
    lineHeight: 1.5
rounded:
  button: "8px"
  mark: "12px"
  dialog: "18px"
  card: "20px"
  circle: "50%"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.project-clay}"
    textColor: "{colors.white-surface}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "0.8rem 1.1rem"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.project-clay-deep}"
    textColor: "{colors.white-surface}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "0.8rem 1.1rem"
    height: "50px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.evergreen-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "0.8rem 1.1rem"
    height: "50px"
  project-card:
    backgroundColor: "rgba(255, 255, 255, 0.82)"
    textColor: "{colors.evergreen-ink}"
    rounded: "{rounded.card}"
    padding: "clamp(1.6rem, 4vw, 2.5rem)"
  quote-launcher:
    backgroundColor: "{colors.project-clay}"
    textColor: "{colors.white-surface}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "1rem 1.25rem"
---

# Design System: LLG Local-Service Pilot

## Overview

**Creative North Star: "The Straightforward Service Desk"**

This is the provisional visual language of a staging integration test: warm, direct, and legible enough for a homeowner to call or start a quote without hesitation. An earth-toned accent and deep green ink give the bare functional surface a local-service character, while generous spacing and large editorial headlines keep it from feeling like an internal operations tool.

The system deliberately stays restrained. Its job is to prove property-aware content, phone routing, SMS gating, the Fillout popup, and attribution handoff. It is not the production identity for 3V San Antonio Paver Services or a reusable brand mandate for the wider site portfolio.

**Key Characteristics:**

- Warm paper and tonal green surfaces with one clay action color.
- Editorial Georgia headlines paired with highly legible system UI text.
- Large, obvious contact actions and a focused modal quote flow.
- Responsive simplification into a persistent mobile contact rail.
- Explicit staging and trust language instead of unverified sales claims.

## Colors

The implemented palette is an earthy primary-plus-neutral system: clay marks action, evergreen ink anchors content, and warm paper and sage distinguish layers without visual noise.

### Primary

- **Project Clay:** Used for quote actions, the mobile quote control, and the floating launcher.
- **Deep Project Clay:** Used for hover states and high-emphasis eyebrow text.

### Neutral

- **Evergreen Ink:** Primary text, dark fact-band surface, brand mark, and secondary-button inversion.
- **Field Gray:** Supporting copy and footer text.
- **Warm Paper:** Page canvas and translucent header base.
- **White Surface:** Modal, mobile action rail, and component foreground text on dark fills.
- **Quiet Line:** Structural borders inside cards, the dialog, and the footer.
- **Soft Sage:** Low-emphasis circular step markers and tonal support.
- **Status Muted:** Secondary labels within the dark fact band.
- **Peach Focus:** High-visibility keyboard focus outline.
- **Modal Backdrop:** Dark translucent focus layer behind the quote dialog.

**The One Clay Action Rule.** Use the clay family for primary conversion actions and small orientation cues; keep the rest of the interface neutral.

## Typography

**Display Font:** Georgia (with Times New Roman and generic serif fallbacks)
**Body Font:** System UI (with Segoe UI and generic sans-serif fallbacks)

**Character:** The serif is warm and editorial without introducing a webfont dependency. The system sans keeps operational copy, actions, labels, and phone numbers immediate and familiar.

### Hierarchy

- **Display:** Medium-weight, tightly tracked, compact-line hero statement; reserved for the single page-level promise.
- **Headline:** Medium-weight serif for section and card headings.
- **Body:** Regular system sans with a relaxed line height for explanatory copy.
- **Label:** Heavy, widely tracked uppercase system sans for eyebrows and metadata.
- **Action:** Heavy system sans for buttons, phone links, and mobile contact controls.

**The One Display Rule.** Use the largest serif treatment once per page; supporting sections step down to the headline role.

## Layout

The page uses a centered fluid shell capped at 1120px, with 40px total horizontal breathing room on larger screens and 28px on screens at or below the 800px breakpoint. The hero pairs a wider message column with a narrower project card; the fact band and process steps each use three equal columns.

At the mobile breakpoint, every major grid collapses to one column, header phone text is removed, and the floating quote launcher becomes a persistent bottom contact rail. Primary hero actions become full width, and the quote dialog docks to the bottom of the viewport with a rounded top edge.

**The Contact-First Collapse Rule.** Mobile simplification must preserve call, verified text, and quote actions before secondary information.

## Elevation & Depth

Depth is used sparingly and structurally. The project card and quote dialog share one broad ambient shadow, while the floating quote launcher uses a smaller, denser shadow to remain distinct from page content. Elsewhere, tonal backgrounds and thin borders provide separation.

### Shadow Vocabulary

- **Ambient Surface:** A broad, low-contrast green-black shadow for the project card and modal dialog.
- **Floating Action:** A tighter shadow for the persistent desktop quote launcher.

**The Structural Elevation Rule.** Reserve shadows for an elevated card, an active modal, or a genuinely floating action; ordinary content stays flat.

## Shapes

The form language combines gently rounded rectangular controls with distinctly softer containers. Buttons use the smallest corner treatment, the brand mark is slightly rounder, the dialog and project card use large corners, and circular or pill geometry is reserved for step markers, close controls, and the floating launcher.

## Components

### Buttons

- **Shape:** Compact rounded rectangle with a minimum 50px tap height.
- **Primary:** Clay fill, white text, heavy system-sans label, and a darker clay hover state.
- **Secondary:** Transparent fill with an evergreen border and text; hover inverts to evergreen with white text.
- **Focus:** All interactive elements receive the same three-pixel peach outline with a three-pixel offset.

### Cards / Containers

- **Project Card:** Translucent white surface, quiet border, large corner radius, ambient shadow, and fluid internal padding.
- **Fact Band:** Flat evergreen strip with three equal information cells and translucent white dividers.
- **Process Step:** Flat content row with a top divider and a sage circular number marker.

### Navigation

- **Desktop Header:** Warm-paper translucent surface, bottom divider, left-aligned brand, and right-aligned underlined phone action.
- **Mobile Contact Rail:** Fixed white rail with equal-width call, optional verified text, and clay quote actions; it replaces the desktop floating launcher.

### Quote Dialog

- **Container:** White modal surface with large rounded corners, ambient shadow, and a dark blurred backdrop.
- **Header:** Sticky white header with a quiet divider and circular close control.
- **Mobile:** Full-width bottom sheet with only its top corners rounded.

## Do's and Don'ts

### Do:

- **Do** keep quote, call, and verified text actions obvious at both desktop and mobile widths.
- **Do** use the shared keyboard focus treatment on every interactive control.
- **Do** preserve the staging disclosure and restrained, evidence-backed copy.
- **Do** treat the Fillout form as externally styled content inside the documented modal shell.

### Don't:

- **Don't** treat this provisional test palette, typography, or component language as production brand identity.
- **Don't** show a text action unless the property's phone inventory confirms SMS capability.
- **Don't** add invented trust badges, reviews, credentials, imagery, or availability claims to make the test surface feel more complete.
- **Don't** introduce extra accent colors or decorative shadows into this baseline integration surface.
