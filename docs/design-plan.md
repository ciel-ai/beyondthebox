# Beyond the Limits — A Business Conclave 2026
## Design plan (v1, for approval)

### 1. Direction
A black stage. Two things are loud: the hero (a tilted band of stage photos over a giant moving
marquee) and the speakers row (tall photo cards you can drag). Every other section is quieter:
hairline rows, generous space, Anton titles and Manrope text. Gold is metal: thin rules,
focus rings, primary buttons, and the tickets. The tickets are the one designed object.

### 2. Tokens

**Colour**
| token | value | use | contrast |
|---|---|---|---|
| `black` | #000000 | page | — |
| `surface` | #121212 | panels, inputs, placeholders | muted 7.7:1 |
| `surface-2` | #1A1A1A | Premium ticket only | gold-deep 9.35:1 |
| `hairline` | rgba(255,255,255,.12) | rules, card frames | — |
| `edge` | #333333 | "Book tickets" nav button border (brief) | 1.66:1, decorative: the button label carries meaning |
| `text` | #FFFFFF | primary | 21:1 |
| `muted` | #A6A6A6 | secondary | 8.63:1 on black |
| `gold-deep` | #DDBB4B | gold text, icons, borders, focus rings | 11.28:1 on black |
| `gold` | #EBC95D | hover fills | — |
| `gold-mid` | #EFDA72 | leaf stop only | — |
| `gold-highlight` | #F9EF8B | leaf stop only | — |
| `gold-shadow` | #A8872B | pressed states, borders | 6.17:1 |
| `leaf` | linear-gradient(100deg, #DDBB4B 0%, #EFDA72 30%, #F9EF8B 45%, #EBC95D 65%, #DDBB4B 100%) | primary buttons, ticket foil, VIP card only | black text ≥11.28:1 |

The only colours outside gold are functional status colours in staff-only tools: check-in
VALID / ALREADY / INVALID (green / amber / red) and admin status badges. They never appear on
the public site. *(Needs your sign-off. See the review below.)*

**Type**
| role | spec |
|---|---|
| marquee | Anton, 9.5vw, lh .9, uppercase, one line |
| display-xl ("SPEAKERS") | Anton, clamp(4.5rem, 15vw, 14rem), lh .9, centred |
| display-l (section titles) | Anton, clamp(3rem, 7vw, 6.5rem), lh .9 |
| display-m (speaker name in card, ticket tier) | Anton, 40px desktop / 32px mobile |
| ui (nav, buttons, labels) | Manrope 600, 14–15px, uppercase, tracking .08em |
| body | Manrope 400, 17px / 1.6, max 65ch |
| small / meta | Manrope 500, 14px |
| numbers | Manrope with `tabular-nums` (prices, serials, times, admin tables) |

Both fonts load with `next/font/google`. Anton has one weight, so hierarchy comes from size and colour, never from faux bold.

**Shape and space**
- Buttons 52px tall, 8px radius. Circular 56px social buttons. Cards and photos 0–4px radius.
- Container 1320px; gutter clamp(20px, 4vw, 48px); section padding clamp(96px, 11vw, 160px).
- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Grid: 12 columns. Text sections share rails at col 1 (titles) and col 5 (body), so rules line up down the page.

### 3. Components
**Public**
- `Nav`: fixed black bar, stacked "BEYOND / THE LIMITS" wordmark with "THE" in gold-deep, a "BOOK TICKETS" outline button, and a full-screen mobile menu.
- `PhotoStrip`: 8 portrait 3:4 frames (two copies for the loop). Each frame gets a ±2° rotation and an offset, and the whole band is rotated -4°. It moves left on a CSS keyframe loop.
- `Marquee`: one Anton line moving right, `aria-hidden`.
- `SpeakerRow`: full-bleed horizontal row of `SpeakerCard` (430×615) and `SpeakerTBA`, the `DragCursor` (170px frosted circle, the only blur on the site), and drag with momentum, scroll-snap, keyboard arrows, native swipe on touch.
- `SocialButton` (56px circle), `Button` (leaf primary / dark outline / text link).
- `TicketCard` × 3 materials (Standard black with gold-deep hairline; Premium #1A1A1A with leaf edge; VIP full leaf). Each card: notches and perforation (SVG mask), stub with `QuantityStepper`, and a `SummaryBar` showing subtotal, GST, fees and total.
- `FormatRows` (hairline rows), `AgendaTimeline`, `AwardsBlock` (deadline shown, closes automatically), `ExhibitionPackages`, `SponsorshipBlock` (contact with `CopyField`), `SponsorLogos` (hidden when empty), `FaqAccordion` (native details), `Footer`.
- Checkout: `Stepper` (Details → Review → Pay), `AttendeeFieldset` × qty, `BusinessBuyer` (optional GSTIN + company), `PriceBreakdown`, `HoldTimer` (15:00 countdown), `TermsConsent`.
- Booking: `BookingStatus` (one panel per state), `TicketList` (download), `CancelRequest`.
- Forms: `Field`, `Select`, `Textarea`, `Checkbox`, `FileDrop` (PDF/JPG/PNG ≤10 MB), `Turnstile`, inline errors that name the fix.

**Staff**
- `/checkin`: full-screen `ScanResult` (VALID / ALREADY / INVALID) plus `OfflineBadge` and `SyncQueue`.
- Admin: `DataTable` (filter, search, CSV), `StatTile`, `CapacityBar`, `FunnelChart`, `StatusBadge`, `AuditTrail`, `NoteThread`.

### 4. Motion (complete list)
1. Hero entrance: the strip rises and fades in, then the marquee follows (Framer, about 120ms stagger).
2. Strip loop moving left and marquee loop moving right (CSS keyframes; they pause off-screen).
3. Drag cursor follow and momentum with snap on the speakers row.
4. State changes the user causes: ticket select and summary bar, accordion, form success, copy confirmation, mobile menu, check-in result.

`prefers-reduced-motion`: no loops (static tilted strip, static marquee line), no entrance, native cursor, instant state changes.

### 5. Responsive behaviour (390 / 768 / 1024 / 1440)
- Strip frames are about 300px wide on desktop, 200px on tablet, 150px on phone. The band tilt stays the same, and frames are clipped by the viewport, not squeezed.
- Speaker cards are 430×615 on desktop, 340×486 on tablet and 78vw on phone, always bleeding off both edges.
- Tickets are 3 columns from 1280px and a scroll-snap row below that with the next card peeking. They never stack.
- Admin works from 1024 up, with a read-only layout on mobile. `/checkin` is designed for phones first.

### 6. Review against "Do not" (section 12)
| rule | finding | action |
|---|---|---|
| No accent but gold | Check-in needs green, amber and red for the result screens, as the brief asks | Restricted to staff-only screens. **Needs your OK.** |
| No gradient text | The leaf gradient is tempting on the hero marquee | Marquee stays solid white. Leaf only on buttons, tickets and VIP. |
| No glows, blobs, glass | The speaker card scrim is a black gradient | Allowed by the brief (a fade up from the bottom 40%). No coloured light anywhere. The frosted cursor is the single blur. |
| No identical rounded cards with shadows | Speaker cards repeat by nature | 0–4px radius, no shadows. Repetition is the content, not decoration. |
| No fade-up on every section | — | Only the hero entrance animates on load. |
| No reference photos or branding | — | All imagery is `[Stage photo]` / `[Speaker photo]` placeholders until the organiser supplies licensed photos. |
| No emoji, lorem, fake stats or logos | "1,000 attendees" is a stated fact | Used. Everything else unknown stays bracketed. The sponsor logos section stays hidden until real logos exist. |
| Primary button overuse | The leaf gradient on every primary would cheapen gold | At most one leaf button per viewport. Secondary actions use the dark outline. |
| `#333` border | Fails 3:1 as a UI boundary | Acceptable because the button is identified by its label; the hover and focus states turn gold. Noted, not changed. |

---

## Change request 1 (approved 23 Oct 2026): React Bits components, hero fit, mobile

### Navigation: PillNav (React Bits)
- Fixed transparent header, `padding-top: env(safe-area-inset-top)`, 76px tall row. Left: PillNav in a `flex:1; min-width:0` wrapper (its collapse logic measures that width). Right (≥768px): the gold leaf "Book tickets" button, 52px, matching PillNav `size="lg"`.
- Logo bubble: a 26px placeholder monogram (gold "B" in Anton), to be replaced by the organiser's mark. The full name lives in the hero h1 and the marquee.
- Glass bar (`rgba(12,12,12,0.72)`), plain items, fill hover, gold dot indicator driven by scroll-spy. Typography override: Manrope 600, uppercase, 0.08em (applied to `.pill-nav__item`, `.pill-nav__ink-item` and `.pill-nav__row`).
- Below 768px: the header CTA is hidden; a sticky bottom "Book your pass" bar replaces it.
- Intro order: nav at 0ms, hero entrance at 150ms.

### About: AeroShards background (React Bits, WebGPU)
- Full-bleed background behind the About section, gold chrome (or glass, whichever reads more premium in screenshots). Shards flow down the right half on desktop; text sits on the left over a black scrim. On mobile, a vertical scrim sits behind the text.
- Always rendered over a still WebP frame (≤150 KB). The live effect mounts only on capable devices and unmounts on error or slow frames.

### Speakers: FlexCarousel (React Bits, WebGL2)
- Replaces the drag row on the home page (the /speakers grid is unchanged). Preset `arch`, portrait cards, gold count, Anton title captions.
- The server-rendered HTML scroll-snap row stays as the initial HTML and the fallback; the carousel swaps in only with WebGL2, at the same height (no layout shift).
- Below the carousel: an active-speaker panel (44px social buttons + "View profile", or "Announcing soon" for TBA) and the "See all speakers" button.
- The frosted 170px drag cursor stays; its label reads "• Drag •", "• View •" or "• Close •" from the carousel's `data-hover` state.
- TBA images: 3:4, 1080px tall, black with a soft gold silhouette, no text.

### Hero fits the screen
- `height: 100svh` (auto with `min-height: 100svh` below 520px tall). Grid rows: header space · strip (takes the remaining space) · marquee · meta + CTA.
- Photo height `min(clamp(150px, 36svh, 440px), 100% of row)`, width by 3:4. Tilt -3° on desktop, -4° on mobile, with the tilt's extra height reserved inside the row.
- Marquee `min(9.5vw, 13svh, 200px)` on desktop and `min(18vw, 12svh)` on mobile, line-height 0.9, never clipped vertically.
- Short landscape screens put the meta line and CTA side by side so the button stays on screen.
- Loops pause off-screen and with reduced motion.

### Mobile
- Test viewports: 360×800, 375×667, 390×844, 430×932, 844×390, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440.
- `overflow-x: clip` on html and body. Touch targets ≥44px. Inputs ≥16px. Sticky booking bar below 768px.

### Updated "Do not" rules
- Glass only on PillNav and the drag cursor. Bloom only inside AeroShards, at glow ≤0.15.
- Never pass empty items to FlexCarousel; never leave `captureWheel` on.
- No WebGL/WebGPU component above the fold, and none without a fallback.
- No third-party visual components beyond PillNav, FlexCarousel and AeroShards without asking.
