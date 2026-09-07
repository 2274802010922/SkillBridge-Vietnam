# SkillBridge Vietnam Design System

## Product character

SkillBridge is proof-to-payout infrastructure for students, businesses, and universities. The interface should feel precise enough for Web3 infrastructure, human enough for education, and credible enough for enterprise review.

## Visual thesis

Light Swiss editorial structure with terminal-grade data details. Use generous whitespace, hard alignment, restrained geometric surfaces, and a small number of high-contrast accents. Avoid generic SaaS card mosaics, dark crypto gradients, fake metrics, and decorative dashboards.

## Tokens

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#F7F6F1` | Page background |
| Surface | `#FFFFFF` | Primary content surface |
| Ink | `#091426` | Primary text and hard borders |
| Ink soft | `#354256` | Body text |
| Muted | `#526174` | Supporting text |
| Lime | `#B7F34D` | Primary CTA and approved states |
| Blue | `#2456E6` | Links and active navigation |
| Violet | `#7557FF` | Web3/protocol states and focus accents |
| Coral | `#FF6B4A` | Rare editorial emphasis |
| Line | `rgba(11, 20, 38, .14)` | Dividers and quiet borders |

## Typography

- Display and body: Be Vietnam Pro, self-hosted by Next.js. The legacy
  `--font-geist-sans` variable now points to this font so all existing routes inherit it.
- Protocol labels, statuses, hashes, and indices: Geist Mono.
- Display headings: `clamp()` sizing, restrained tracking, 1.14–1.25 line height.
- Body: minimum 16px on marketing pages with 1.6–1.75 line height.
- Labels: minimum 12px, uppercase only for short protocol metadata.

## Layout

- Container: maximum 1280px with adaptive gutters.
- Grid: 12 columns on desktop, 6 on tablet, 1 on mobile.
- Spacing follows an 8px rhythm; primary section spacing is 96–144px.
- Prefer open rows, rails, and editorial dividers over repeated cards.
- Do not use a full-width dark section on the landing page.

## Components

- Primary CTA: lime fill, ink text, 8px corners, no offset shadow, 46px minimum height.
- Secondary CTA: text link with visible underline or arrow.
- Product proof surface: light terminal canvas with real product states and no fabricated user data.
- Statuses always include text; color alone never communicates meaning.
- Interactive targets are at least 44px and have visible `:focus-visible` treatment.

## Motion

- Use 180–260ms transitions for hover and focus.
- Use small opacity/translate changes only where they clarify hierarchy.
- Preserve the final visible state under `prefers-reduced-motion: reduce`.
- Avoid autoplay, parallax, and continuously moving backgrounds.

## Quality gates

- 4.5:1 minimum normal-text contrast.
- No horizontal scroll at 375px, 768px, 1024px, or 1440px.
- Navigation order matches keyboard order.
- No fake traction, testimonials, scores, or payout amounts.
- Vietnamese and English layouts must both remain readable.
