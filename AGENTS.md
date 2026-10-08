# PenduGPT Masterclass Engineering Guidelines

- **Offer & Pricing**: Single source of truth is in `src/config/site.ts`.
- **Database & Supabase**: Lead and order operations use service role server functions with strict RLS policies.
- **WhatsApp Follow-up Tracking**: Follow-up status (`NOT_SENT`, `SENT`, `REPLIED`, `STOPPED`, `PAID`) and `video_completed_at` are tracked on `public.leads`.
