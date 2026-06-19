# Class Reunion App - Design System & Guide

## Overview
This design guide documents the visual design system for the Class Reunion application, including colors, typography, components, and layout patterns.

---

## 1. Color Palette

### Primary Colors
- **Primary Green:** `#4CAF50`
  - Usage: Main CTA buttons, active states, success messages, headers
  - RGB: 76, 175, 80
  - Semantic: Positive, growth, action

- **Primary Blue:** `#2196F3`
  - Usage: Secondary buttons, links, info messages, edit actions
  - RGB: 33, 150, 243
  - Semantic: Information, trust

- **Danger Red:** `#f44336`
  - Usage: Delete buttons, error messages, destructive actions
  - RGB: 244, 67, 54
  - Semantic: Danger, warning, destructive

### Neutral Colors
- **Dark Text:** `#333333`
  - Usage: Primary text, headings
  - RGB: 51, 51, 51

- **Medium Text:** `#555555`
  - Usage: Secondary text, descriptions
  - RGB: 85, 85, 85

- **Light Text:** `#666666`
  - Usage: Tertiary text, hints
  - RGB: 102, 102, 102

- **Gray:** `#999999`
  - Usage: Disabled text, timestamps, metadata
  - RGB: 153, 153, 153

- **Light Gray:** `#DDDDDD`
  - Usage: Borders, dividers
  - RGB: 221, 221, 221

- **Lighter Gray:** `#E0E0E0`
  - Usage: Card borders, subtle dividers
  - RGB: 224, 224, 224

- **Background Light:** `#F0F0F0`
  - Usage: Input backgrounds, section backgrounds
  - RGB: 240, 240, 240

- **Background Lighter:** `#F5F5F5`
  - Usage: Page backgrounds, card backgrounds
  - RGB: 245, 245, 245

- **Background Lightest:** `#F9F9F9`
  - Usage: Subtle backgrounds, hover states
  - RGB: 249, 249, 249

- **White:** `#FFFFFF`
  - Usage: Card backgrounds, modal backgrounds, inputs

### Status Colors
- **Success Background:** `#E8F5E9`
  - Usage: Success message backgrounds
  - RGB: 232, 245, 233

- **Success Text:** `#2E7D32`
  - Usage: Success message text
  - RGB: 46, 125, 50

- **Error Background:** `#FFEBEE`
  - Usage: Error message backgrounds
  - RGB: 255, 235, 238

- **Error Text:** `#C62828`
  - Usage: Error message text
  - RGB: 198, 40, 40

---

## 2. Typography

### Font Family
- **Primary Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  - Clean, modern system fonts for maximum performance and compatibility

### Font Sizes
- **H1 (Page Title):** 32px, Bold (600-700 weight)
- **H2 (Section Title):** 24px, Bold (600-700 weight)
- **H3 (Subsection Title):** 18px, Bold (600 weight)
- **H4 (Card Title):** 16px, Bold (600 weight)
- **H5 (Label):** 14px, Bold (600 weight)
- **Body Large:** 16px, Regular (400 weight)
- **Body Regular:** 14px, Regular (400 weight)
- **Body Small:** 12px, Regular (400 weight)
- **Caption:** 12px, Regular (400 weight), italic

### Line Heights
- Headings: 1.2
- Body: 1.6
- Captions: 1.4

---

## 3. Spacing System

### Base Unit: 4px (Multiples of 4)

**Spacing Scale:**
- **XS:** 4px
- **S:** 8px
- **M:** 12px
- **L:** 16px
- **XL:** 20px
- **2XL:** 30px
- **3XL:** 40px

**Common Usage:**
- Button padding: 10px 20px (vertical: 10px, horizontal: 20px)
- Card padding: 20px
- Section padding: 20px top/bottom, 40px sides
- Gap between elements: 15px (card to card), 20px (section to section)

---

## 4. Border Radius

- **None:** 0px (rarely used)
- **Small:** 4px (input fields, small components)
- **Medium:** 8px (cards, buttons, modals)
- **Large:** Depends on context (usually not used)

**Standard:** 4-8px for most components

---

## 5. Shadows

### Elevation System
- **Level 1 (Subtle):** `0 1px 3px rgba(0,0,0,0.1)`
  - Usage: Cards on light backgrounds

- **Level 2 (Prominent):** `0 2px 4px rgba(0,0,0,0.1)`
  - Usage: Hovered cards, slight elevation

- **Level 3 (High):** `0 4px 8px rgba(0,0,0,0.15)`
  - Usage: Modals, dropdowns, floating elements

---

## 6. Component Library

### Buttons

#### Primary Button
- Background: #4CAF50
- Text Color: White
- Padding: 10px 20px
- Border: None
- Border Radius: 4px
- Hover: Opacity 0.9
- Disabled: Background #CCCCCC, Cursor not-allowed
- Font: 14px, Bold

#### Secondary Button
- Background: #2196F3
- Text Color: White
- Padding: 10px 20px
- Border: None
- Border Radius: 4px
- Hover: Opacity 0.9
- Disabled: Background #CCCCCC
- Font: 14px, Bold

#### Danger Button
- Background: #f44336
- Text Color: White
- Padding: 10px 20px
- Border: None
- Border Radius: 4px
- Hover: Opacity 0.9
- Font: 14px, Bold

#### Text Button (Link)
- Background: None
- Text Color: #2196F3
- Padding: 0px
- Border: None
- Hover: Opacity 0.8
- Font: 12px, Bold

### Input Fields

#### Text Input
- Background: White
- Border: 1px solid #DDDDDD
- Border Radius: 4px
- Padding: 10px 12px
- Font: 14px
- Focus: Border color #4CAF50, Outline none
- Placeholder: #999999
- Disabled: Background #F0F0F0, Color #999999

#### Textarea
- Background: White
- Border: 1px solid #DDDDDD
- Border Radius: 4px
- Padding: 12px
- Font: 14px
- Min Height: 80px
- Resize: Vertical
- Focus: Border color #4CAF50

#### Select/Dropdown
- Background: White
- Border: 1px solid #DDDDDD
- Border Radius: 4px
- Padding: 8px 12px
- Font: 14px
- Focus: Border color #4CAF50

### Cards

#### Standard Card
- Background: White
- Border: 1px solid #E0E0E0
- Border Radius: 8px
- Padding: 15-20px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Hover: Shadow 0 2px 4px rgba(0,0,0,0.1)

#### Profile Card
- Background: White
- Border: None
- Border Radius: 8px
- Padding: 20px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Min Width: 180px

### Messages/Alerts

#### Success Message
- Background: #E8F5E9
- Text Color: #2E7D32
- Border: 1px solid #4CAF50
- Border Radius: 4px
- Padding: 12px
- Font: 14px

#### Error Message
- Background: #FFEBEE
- Text Color: #C62828
- Border: 1px solid #ef5350
- Border Radius: 4px
- Padding: 12px
- Font: 14px

#### Info Message
- Background: #E3F2FD
- Text Color: #1565C0
- Border: 1px solid #2196F3
- Border Radius: 4px
- Padding: 12px
- Font: 14px

---

## 7. Layout Patterns

### Header/Navigation
- **Height:** 60px
- **Background:** White
- **Border Bottom:** 2px solid #4CAF50
- **Box Shadow:** 0 2px 4px rgba(0,0,0,0.1)
- **Padding:** 0 20px
- **Position:** Sticky/Fixed top
- **Z-index:** 100

**Logo/Brand:**
- Font: 20px, Bold
- Color: #4CAF50
- Vertical Align: Center

**Nav Links:**
- Font: 14px, Medium weight
- Color: #333333
- Gap: 30px
- Hover: Color #4CAF50
- Transition: 0.2s

### Container
- **Max Width:** 1200px
- **Padding:** 0 20px
- **Margin:** 0 auto
- **Responsive:** 
  - Desktop (1200px+): 1200px max-width
  - Tablet (768px-1199px): 100% width, 20px padding
  - Mobile (< 768px): 100% width, 20px padding

### Page Sections
- **Margin Bottom:** 30px-40px
- **Padding:** 20px (cards), 30px-40px (section wrappers)
- **Gap Between Cards:** 15px-20px

### Grid System
- **Grid Columns:** Auto-fit, minmax(180px, 1fr) - 1fr
- **Grid Gap:** 20px
- **Responsive:**
  - Desktop: 4-6 columns
  - Tablet: 2-3 columns
  - Mobile: 1 column

---

## 8. Responsive Design

### Breakpoints
- **Mobile:** < 768px
- **Tablet:** 768px - 1199px
- **Desktop:** 1200px+

### Mobile-First Rules
- **Single Column:** Mobile layouts use single column
- **Padding:** Reduced padding on mobile (15px vs 20px)
- **Font Sizes:** Slightly smaller on mobile
- **Touch Targets:** Minimum 44px height for touch targets
- **Navigation:** Hamburger menu pattern for mobile (future enhancement)

### Touch Design
- **Button/Link Height:** Minimum 44px
- **Spacing Between Touch:** Minimum 8px
- **Input Height:** 44px on mobile for comfort

---

## 9. Icons (Emoji-based)

### Common Icons
- **🎓** - Home, Education, Main brand
- **📖** - Directory, Browse
- **👤** - Profile, User, Account
- **💬** - Comments, Messaging
- **🏫** - Schools
- **📚** - Classes
- **⚙️** - Admin, Settings
- **📧** - Email, Contact
- **📸** - Photos, Images
- **🔐** - Security, Lock, Admin
- **✅** - Success, Checkmark
- **❌** - Error, Delete
- **←** - Back arrow
- **💁** - Help, Info

---

## 10. Forms

### Form Layout
- **Label:** 14px, Bold, #333333, Margin bottom 8px
- **Input Height:** 40-44px
- **Input Margin Bottom:** 15px
- **Helper Text:** 12px, #666666, Margin top 4px

### Form Groups
- **Spacing:** 20px between groups
- **Layout:** Vertical stack (future: could add side-by-side on desktop)

### Validation
- **Error Color:** #f44336
- **Error Message:** 12px, #C62828, Margin top 4px
- **Border Color (Error):** #ef5350

---

## 11. Data Table / List Patterns

### List Items
- **Height:** 40-50px minimum
- **Padding:** 10px vertical, 15px horizontal
- **Border Bottom:** 1px solid #EEEEEE
- **Last Item:** No border bottom

### Card-based Lists
- **Card Height:** Varies (photo cards ~200px min height)
- **Spacing:** 20px gap
- **Hover:** Shadow upgrade, slight scale (1.02x)
- **Cursor:** Pointer on clickable cards

---

## 12. Loading & Empty States

### Loading State
- **Text:** "Loading..." in #999999, 14px
- **Spinner:** Simple text-based indicator
- **Padding:** 40px top/bottom
- **Text Align:** Center

### Empty State
- **Background:** White with 1px border #E0E0E0
- **Border Radius:** 8px
- **Padding:** 40px 20px
- **Text Align:** Center
- **Text Color:** #999999
- **Font:** 14px

---

## 13. Animations & Transitions

### Standard Transition
- **Duration:** 0.2s
- **Timing:** ease (default)
- **Usage:** Hover states, opacity changes

### Page Transitions
- **Duration:** None (instant) - keep navigation fast
- **No loading animations** - use skeleton screens if needed

### Avoid
- Auto-play animations
- Excessive animations that distract
- Animations longer than 0.3s for interactions

---

## 14. Accessibility Considerations

### Color Contrast
- **Text on Background:** Minimum 4.5:1 ratio
- **Green #4CAF50 on White:** Passes WCAG AA
- **Blue #2196F3 on White:** Passes WCAG AA

### Focus States
- **Focus Outline:** 2px solid #4CAF50
- **Outline Offset:** 2px
- **Visibility:** Always visible on all interactive elements

### Typography
- **Line Height:** Minimum 1.5 for body text
- **Letter Spacing:** Normal (default)
- **Avoid:** All caps (except abbreviations)

### Images & Photos
- **Alt Text:** Always provide for meaningful images
- **Thumbnails:** Clear, recognizable content

---

## 15. Design Tokens Reference

```json
{
  "colors": {
    "primary": "#4CAF50",
    "secondary": "#2196F3",
    "danger": "#f44336",
    "text": {
      "dark": "#333333",
      "medium": "#555555",
      "light": "#666666",
      "disabled": "#999999"
    },
    "background": {
      "white": "#FFFFFF",
      "light": "#F9F9F9",
      "lighter": "#F5F5F5",
      "lightest": "#F0F0F0"
    }
  },
  "spacing": {
    "xs": "4px",
    "s": "8px",
    "m": "12px",
    "l": "16px",
    "xl": "20px",
    "2xl": "30px",
    "3xl": "40px"
  },
  "typography": {
    "h1": { "size": "32px", "weight": "bold" },
    "h2": { "size": "24px", "weight": "bold" },
    "h3": { "size": "18px", "weight": "bold" },
    "body": { "size": "14px", "weight": "regular" },
    "caption": { "size": "12px", "weight": "regular" }
  },
  "shadows": {
    "sm": "0 1px 3px rgba(0,0,0,0.1)",
    "md": "0 2px 4px rgba(0,0,0,0.1)",
    "lg": "0 4px 8px rgba(0,0,0,0.15)"
  },
  "radius": {
    "small": "4px",
    "medium": "8px"
  },
  "transitions": {
    "default": "0.2s ease"
  }
}
```

---

## 16. Page-Specific Guidelines

### Login Page
- **Layout:** Centered card (max-width: 400px)
- **Card Padding:** 40px
- **Form Groups:** 20px spacing
- **Button:** Full width, 12px font
- **Background:** #F5F5F5 (light)

### Dashboard/Welcome Page
- **Header:** Prominent title + subtitle
- **Stats Grid:** 4 columns (desktop), responsive down to 1 (mobile)
- **Section Spacing:** 30px between sections
- **Cards:** Equal height in grid

### Profile Page
- **Header:** User name + edit button
- **Photos Section:** 2-column grid for "then" and "now"
- **Info Section:** Form layout for editing
- **Button Actions:** Green for save, gray for cancel

### Directory Page
- **Grid:** Auto-fit, minmax(180px, 1fr)
- **Photo Cards:** 180px width, 200px height
- **Hover:** Subtle shadow increase, cursor pointer
- **Click Animation:** Navigate to user profile

### Comments Section
- **New Comment Form:** Full width textarea
- **Comment List:** Stacked vertical, 15px gap
- **Each Comment:** Card style, 15px padding
- **Timestamps:** 12px gray text

---

## 17. Implementation Notes for Designers

### Figma Setup Suggestions
1. **Create Color Styles** for all colors in palette
2. **Create Text Styles** for typography system
3. **Create Components** for buttons, cards, inputs
4. **Use Auto Layout** for responsive spacing
5. **Document Overrides** for component variations

### Handoff to Developers
- Export assets at 2x resolution (for retina displays)
- Provide CSS/Design token documentation
- Specify exact spacing and sizes
- Include responsive breakpoints for each design

### Responsive Testing
- Test at 375px (mobile), 768px (tablet), 1200px+ (desktop)
- Ensure readability at all sizes
- Test touch interactions on mobile
- Verify color contrast in all states

---

## 18. Future Enhancements

### Design System V2 Ideas
- Animation system with Lottie files
- Dark mode color palette
- Accessibility audit and WCAG AAA compliance
- Micro-interactions and feedback patterns
- Loading skeleton screens
- Mobile navigation menu (hamburger)
- Tooltip system
- Toast notification system
- Modal dialog patterns

---

**Last Updated:** June 2026
**Version:** 1.0
**Created for:** Class Reunion Application
