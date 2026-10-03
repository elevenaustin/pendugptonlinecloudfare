# PenduGPT — AI Website Masterclass landing page

A premium dark landing page and video funnel built from your brief. No live price, video link or payment keys yet, so those are clearly marked spots you can fill in later. No fake numbers, testimonials or countdowns.

## Look and feel

- Near-black backgrounds (#09090F / #10111A / #151622), violet-indigo accents (#8B5CF6, #6366F1, #A78BFA), success green #34D399.
- Manrope headings, Inter body text. Big confident headlines, a faint background grid, soft glows, glass cards, gentle motion that turns off for people who prefer less motion.

## Sections (one page, in order)

1. Sticky glass navbar: logo, section links, "Watch Free Training" button, mobile menu.
2. Hero: "Turn AI Into Your Website-Building Skill." with two buttons. On the right, a hand-built browser mockup with floating prompt cards that show a prompt turning into a website.
3. Trust and value strip (honest, no made-up stats).
4. The opportunity.
5. Free training video: large 16:9 player with play, loading, error, progress and completed states. Before it's finished: "Complete the free training to unlock your learning options." When 95% is watched: "You're ready for the next step." Progress is remembered on reload. Until you send a video, a clearly labeled placeholder appears.
6. What you will learn.
7. How it works (steps).
8. Course options, unlocked after the video with an animation:
   - Recorded Masterclass, ₹997, "Get Recorded Access".
   - Live Masterclass shows "Join Interest List" until you set a price.
     Payment buttons show "Checkout opening soon" and never pretend a payment went through.
9. Included resources.
10. Project showcase (sample builds made in code, clearly labeled as examples).
11. Student experiences: a "stories coming soon" layout, no invented reviews.
12. FAQ accordion.
13. Final call to action.
14. Footer.

## Signups (Lovable Cloud)

- Short interest form: name, WhatsApp number, optional email, course choice, and a consent box that starts unticked and says what they'll receive.
- Checks the input and shows loading, error and success messages. Each submission is saved in Cloud, and visitors can't read anyone else's.
- Used for the Live interest list and for recorded-course buyers until checkout is live.

## Ready for later

- Razorpay: one settings file, and when you add keys, orders are created and confirmed securely on the server.
- Simple event tracking for video start/progress/complete and button clicks, ready to connect to an analytics tool.
- Hooks for n8n and WhatsApp noted, not built.
- Page title, description and share tags set for PenduGPT.

## Technical details

- `src/config/site.ts`: video URL, completion threshold, live price/status, payment flag.
- Components in `src/components/landing/*`; route `src/routes/index.tsx` replaces the placeholder.
- Tokens in `src/styles.css` (oklch), fonts loaded via `<link>` in `__root.tsx`.
- Video uses HTML5 `<video>` events (timeupdate/ended/error), with seek-skipping handled; YouTube is supported later through the IFrame API. Unlocking happens only in the browser and is documented as not secure proof of watching.
- Cloud table `leads` with GRANTs, RLS, no anon reads. Inserts go through a server function with zod validation.
- `src/lib/analytics.ts`: `track(event, props)` dispatcher.
