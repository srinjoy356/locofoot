---
name: Pitch Precision
colors:
  surface: '#121413'
  surface-dim: '#121413'
  surface-bright: '#383a38'
  surface-container-lowest: '#0d0f0e'
  surface-container-low: '#1a1c1b'
  surface-container: '#1e201f'
  surface-container-high: '#282a29'
  surface-container-highest: '#333534'
  on-surface: '#e2e3e0'
  on-surface-variant: '#bacbb6'
  inverse-surface: '#e2e3e0'
  inverse-on-surface: '#2f312f'
  outline: '#859581'
  outline-variant: '#3c4b3a'
  surface-tint: '#00e556'
  primary: '#f2ffed'
  on-primary: '#00390f'
  primary-container: '#39ff6a'
  on-primary-container: '#007226'
  inverse-primary: '#006e25'
  secondary: '#c5c7c3'
  on-secondary: '#2e312f'
  secondary-container: '#474a47'
  on-secondary-container: '#b7b9b5'
  tertiary: '#f9fcf8'
  on-tertiary: '#2d312f'
  tertiary-container: '#dcdfdc'
  on-tertiary-container: '#5f6360'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6cff80'
  primary-fixed-dim: '#00e556'
  on-primary-fixed: '#002106'
  on-primary-fixed-variant: '#00531a'
  secondary-fixed: '#e1e3df'
  secondary-fixed-dim: '#c5c7c3'
  on-secondary-fixed: '#191c1a'
  on-secondary-fixed-variant: '#454745'
  tertiary-fixed: '#e0e3e0'
  tertiary-fixed-dim: '#c4c7c4'
  on-tertiary-fixed: '#181c1b'
  on-tertiary-fixed-variant: '#444845'
  background: '#121413'
  on-background: '#e2e3e0'
  surface-variant: '#333534'
typography:
  display-lg:
    fontFamily: Inter Tight
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-sm:
    fontFamily: Inter Tight
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter Tight
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter Tight
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  stats-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is built for a premium sports-tech environment, emphasizing high-performance data and editorial clarity. The personality is confident, quiet, and hyper-focused, stripping away decorative elements to prioritize athletic insights. 

The aesthetic draws from **Minimalism** and **Technical Brutalism**, utilizing a "dark-room" environment that mimics a high-end stadium broadcast suite. Key visual characteristics include:
- **Atmospheric Contrast:** Use high-contrast stadium photography, desaturated to near-monochrome with the exception of vibrant turf-green highlights.
- **Precision Engineering:** Hairline borders and tabular data layouts suggest accuracy and real-time reliability.
- **Flat Depth:** Depth is achieved through tonal layering rather than shadows or blurs, maintaining a modern, screen-first utility.

## Colors

This design system utilizes a strictly "Dark Mode" foundation to elevate the intensity of sports imagery and the vibrancy of the primary accent.

- **Primary (#39FF6A):** "Electric Turf." Used exclusively for action items, live indicators, and critical data points.
- **Background (#0B0D0C):** A deep charcoal that serves as the base canvas, providing maximum contrast for typography.
- **Surface (#151816):** Used for cards, navigation bars, and structural containers.
- **Stroke (#232725):** The "Hairline" color used for all borders and dividers to provide subtle definition without visual bulk.
- **Text:** Primary text is Pure White (#FFFFFF); Secondary text is Slate Gray (#8A8E8C).

## Typography

The typography system relies on the **Inter** family, specifically leveraging **Inter Tight** for display roles to create a condensed, aggressive editorial feel. 

- **Display & Headlines:** Use Inter Tight with negative letter spacing. This creates a "locked-in" appearance suitable for big scores and bold headlines.
- **Body:** Standard Inter provides maximum legibility for long-form analysis and athlete bios.
- **Data & Stats:** All numeric values must use **tabular lining figures** to ensure that columns of scores and statistics align perfectly during real-time updates.

## Layout & Spacing

The design system follows a rigid **8px square grid**. Spacing should always be a multiple of 8 (8, 16, 24, 32, 48, 64, 80).

- **Grid Model:** A 12-column fluid grid for desktop with 24px gutters. For mobile, a 4-column grid with 16px margins.
- **Editorial Whitespace:** Generous vertical padding (min 80px) should be used between major sections to maintain a premium, non-cluttered feel.
- **Alignment:** Elements should be top-aligned to the grid to emphasize the technical, data-driven nature of the product.

## Elevation & Depth

This design system explicitly avoids shadows, blurs, and gradients. Depth is established through **Tonal Separation** and **Structural Framing**:

- **Level 0 (Background):** #0B0D0C.
- **Level 1 (Surfaces):** #151816. Cards and containers sit on this level.
- **Framing:** Every surface and interactive element is defined by a 1px solid hairline border (#232725). 
- **Active State:** Focus or active states are indicated by changing the border color to the Primary Electric Green or by adding a solid 1px inner stroke.

## Shapes

The shape language is **strictly geometric and sharp**. 

- **Corners:** Use 0px (sharp) corners for all cards, buttons, and input fields. This reinforces the "tech" and "precision" narrative.
- **Icons:** Use 1.5px weight, sharp-angled stroke icons. Avoid rounded terminals.
- **Indicators:** Small "Live" dots are the only exception, which may be circular to distinguish them from structural UI elements.

## Components

- **Buttons:** Primary buttons are solid #39FF6A with black text. Secondary buttons are transparent with a #232725 hairline border and white text. No rounded corners.
- **Cards:** Background #151816 with a #232725 hairline border. Content inside follows the 8px padding rule.
- **Pulsing Live Indicator:** A 6px circular dot using #39FF6A with a soft opacity pulse animation to signify real-time data streams.
- **Input Fields:** Flat #0B0D0C background, 1px border. On focus, the border changes to #39FF6A.
- **Data Tables:** No vertical lines. Use subtle horizontal dividers (#232725). Headers must be in `label-caps` typography.
- **Chips/Tags:** Rectangular, sharp corners. Use a dark background with a 1px border. Labels in `label-caps`.