<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Landing page config (video URL, prices, checkout flags, contact) lives in src/config/site.ts — single place to edit offer details.
- Lead submissions go through a server function using the admin client; the leads table has RLS with no public policies so visitors can never read leads.
