# Next.js App Router — Reusable Architecture Guide

Distilled from three reference apps by [@aurorascharff](https://github.com/aurorascharff):

| App | Repo | Demo | Distinctive bit |
|---|---|---|---|
| **NextBeats** (music player) | `aurorascharff/next-beats` | next-beats.dev | Global client provider (audio player), Web Audio synthesis |
| **Huddle** (team chat) | `aurorascharff/next16-team-chat` | next16-team-chat.vercel.app | Server-seeded TanStack Query / SWR, polling, API routes |
| **Drop** (social media) | `aurorascharff/next16-social-media` | next16-social-media.vercel.app | URL pagination, tabs w/ shared-element transitions, AI moderation |

All three implement **one architecture**. This file is that architecture, written to be portable across Next 13 → 16. Version-gated APIs are marked ⚠️ and collected in the [compatibility matrix](#17-version-compatibility-matrix).

> **Attribution:** the invariants below are derived from the `nextjs-app-architecture` skill bundled inside those repos and from [Component Architecture for React Server Components](https://aurorascharff.no/posts/component-architecture-for-react-server-components/). This file reorganizes them for reuse and strips the Next 16-only assumptions.

---

## 1. The one-sentence thesis

> **Pages describe the loading experience. Features own their data.**

A page is a synchronous composition surface: chrome, headings, `<Suspense>` boundaries, error boundaries. It never fetches. Feature components are async server components that await their own queries from minimal props (`id`, `slug`, `handle`) — never route params.

Everything else follows from that.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js App Router | 13.4+ minimum; 15+ for full pattern fidelity |
| UI | React 19 (+ React Compiler) | 18 works; you lose `useOptimistic`/`useActionState` ergonomics |
| Language | TypeScript, `strict: true` | `paths: { "@/*": ["./*"] }` |
| Styling | Tailwind CSS v4 (`@theme` in CSS) | v3 + `tailwind.config.ts` is fine |
| DB | Prisma 7 on Postgres | SQLite via `@prisma/adapter-better-sqlite3` for local |
| Validation | Zod | at every action boundary |
| A11y primitives | Ariakit | dialogs, popovers, comboboxes |
| Toasts | Sonner | |
| Icons | lucide-react | |
| Fonts | `geist/font` | Sans + Mono as CSS vars |
| Theme | next-themes | `attribute="class"`, `enableSystem` |
| Class merge | `clsx` + `tailwind-merge` → `cn()` | |
| E2E | Playwright | |
| Package manager | pnpm | |

**Deliberately absent:** no state management library, no tRPC/GraphQL, no form library, no component library. Server Components + Server Actions + `useOptimistic` cover it. Add a client data library (SWR/TanStack) *only* for live/revalidating data — see §10.

---

## 3. Directory layout

```
app/                    # routes only: pages, layouts, error/not-found, route handlers
features/<domain>/      # all domain code
  <domain>-queries.ts   # `import 'server-only'` — reads
  <domain>-actions.ts   # `'use server'` — writes
  <domain>-constants.ts # optional, folder-name prefixed
  <domain>-query-options.ts # client data-library keys/options (only if using SWR/TanStack)
  components/           # server + client components, each with its skeleton
  hooks/                # feature-local hooks
  types/                # feature-local types imported by 2+ files
  providers/            # feature-local providers
components/
  ui/                   # primitives: button, skeleton, empty-state, error-boundary, modal, tabs
  theme/                # theme-provider + theme-toggle (paired)
  scripts/              # purpose-named: pre-hydration inline <script> seeds
  <singleton>.tsx       # sidebar.tsx, mobile-nav.tsx, offline-indicator.tsx — used once each
hooks/                  # cross-feature client hooks only
types/                  # cross-feature types only
lib/                    # db.ts, utils.ts, + cohesive subsystems (lib/audio/, lib/themes/)
providers/              # app-shell providers (player-provider.tsx)
prisma/                 # schema.prisma, seed.ts
tests/                  # Playwright specs, one per page
```

### Naming rules

- Files: `kebab-case.tsx`. Components: `PascalCase`.
- Every file directly inside `features/<domain>/` starts with the folder name. `event-queries.ts`, `event-actions.ts`, `event-constants.ts`.
- Files inside `components/` use any descriptive name — the component is the unit there.
- **No `common/`, `shared/`, `misc/` folders.** If it's used everywhere it's a primitive (`ui/`). If it's used once it's a top-level singleton. A subfolder must name *what the files are* (`scripts/`), not "miscellaneous".

### How many feature folders?

Few. One per **domain noun a user would recognize** — not per DB table.

A new folder is justified only when **all three** hold:
1. It has its own queries.
2. It has its own pages/routes.
3. It's referenced from ≥2 other features.

**Merge aggressively.** `favorite`, `like`, `repost`, `bookmark`, `vote`, `reaction`, `search`, `auth`, `session` are almost never their own folder:

- `toggleFavorite` → `features/track/track-actions.ts` (it's a mutation *about tracks*)
- `searchTracks` → `features/track/track-queries.ts` (no `features/search/`)
- current user / session / auth → one `features/user/`

A `favorite-button.tsx` **component** inside `features/track/components/` is fine. A `features/favorite/` **folder** is not.

---

## 4. The invariants

Every change must satisfy these. They're checkable by reading a diff.

1. **Pages compose, never fetch.** No `*-queries` import inside `app/**/page.tsx` or `layout.tsx`. No domain logic. No inline route-specific components.
2. **Pages stay synchronous.** ⚠️ On Next 15+, `params.then()` / `searchParams.then()` — never `await params` at the top of the page body. Chrome above the `.then()` paints immediately; only the data-dependent section suspends.
3. **Feature components receive IDs, not route props.** Resolve `params`/`searchParams` at the page boundary; pass `id`, `slug`, `handle`, `query`, parsed filters. No feature prop is ever named `params` or `searchParams`.
4. **Async server component is the default.** `'use client'` only for hooks, event handlers, or browser APIs — and only on **leaves**, never on a parent of server content.
5. **The page owns the `<Suspense>`; the feature owns the skeleton.** Features never pre-wrap themselves in Suspense.
6. **Skeletons live in the same file as the component**, exported alongside it, defined **at the end** of the file. `Feed` and `FeedSkeleton` are siblings.
7. **Queries in `<domain>-queries.ts`** (`import 'server-only'`); **actions in `<domain>-actions.ts`** (`'use server'`). Filename matches folder, even for sub-concepts.
8. **One feature folder per real domain noun.** Sub-concepts fold into the parent.
9. **Client components import server actions directly** — never receive an action as a prop just to call it.
10. **Feature-local client support stays with its domain.** Query keys/options at the feature root, hook wrappers in `hooks/`, leaf components in `components/`. Promote to top-level only after real cross-feature reuse.

---

## 5. Data layer

### 5.1 Queries

`features/<domain>/<domain>-queries.ts`, first line `import 'server-only'`.

```ts
import 'server-only';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { toPost } from '@/features/post/types/post';

export async function getFeed(userId: string) {
  const rows = await prisma.post.findMany({ where: { userId }, include: { author: true } });
  return rows.map(toPost);
}

export async function getPost(id: string) {
  const row = await prisma.post.findUnique({ where: { id }, include: { author: true } });
  if (!row) notFound();   // bubbles to the nearest not-found.tsx — never try/catch it
  return toPost(row);
}
```

**Rules**

- `import 'server-only'` is the invariant. It turns an accidental client import into a build error.
- **Map ORM rows to domain types.** Components see `Post`, not `Prisma.Post & { author: User }`. Write the mapper next to the type in `features/<domain>/types/`.
- `notFound()` inside the query, not in the page. The page stays declarative.
- React `cache()` only for **proven same-request dedup** (session lookup used by 6 queries; a read shared by `generateMetadata` + the page). Not "just in case" — it hides when data is intentionally dynamic.

### 5.2 Actions

`features/<domain>/<domain>-actions.ts`, first line `'use server'`. Always, in order:

1. Verify auth
2. Validate input (Zod)
3. Mutate
4. Invalidate
5. Return a discriminated union

```ts
'use server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { verifyAuth } from '@/features/user/user-queries';
import { prisma } from '@/lib/db';

const schema = z.object({ body: z.string().min(1, 'Say something').max(1000, '1000 characters max') });

export async function createPost(formData: FormData) {
  const userId = await verifyAuth();

  const parsed = schema.safeParse({ body: formData.get('body') });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const post = await prisma.post.create({ data: { body: parsed.data.body, userId } });

  revalidateTag('feed');          // ⚠️ see §9 for the version-appropriate call
  return { ok: true as const, post };
}
```

**Return shape.** Fallible actions return a discriminated union the client narrows on:

```ts
type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };
```

A shared type is optional — a per-action inline union is often clearer (`{ ok: true as const, playlist }` beats a generic `data`). What matters is the discriminant.

**Never** `redirect()` inside an action that a dialog awaits — it throws, so the client never toasts or closes. Return `{ ok: true }` and `router.push()` at the call site.

**Never** toast inside a server action. Toasts are client-side; return a result and toast where it was called.

### 5.3 Calling actions

```tsx
// ✅ client leaf imports the action directly
'use client';
import { likePost } from '@/features/post/post-actions';
export function LikeButton({ postId }: { postId: string }) {
  return <button onClick={() => likePost(postId)}>Like</button>;
}
```

```tsx
// ❌ indirection with no benefit
<LikeButton postId={id} onLike={likePost} />
```

Prefer `<form action={serverAction}>` for form mutations — React opens the transition and surfaces pending state for free. `onClick={() => action(args)}` is fine for one-off buttons; wrap in `startTransition` if you need pending state.

The **exception** is the *action-prop pattern*: a reusable design component (`<ToggleGroup>`, `<BottomNav>`, `<ConfirmDialog>`) may take an `action` / `*Action` prop and own the async coordination internally, so consumers pass a plain callback. `action`/`*Action` signals "this triggers a mutation I coordinate"; `onClick`/`onChange` doesn't. Renaming between them is a contract change.

---

## 6. Components

### 6.1 Default: async server component

```tsx
// features/post/components/post-detail.tsx
import { getPost } from '@/features/post/post-queries';
import { PostActions } from './post-actions';   // 'use client' leaf
import { Skeleton } from '@/components/ui/skeleton';

export async function PostDetail({ id }: { id: string }) {
  const post = await getPost(id);
  return (
    <article>
      <MetaStrip post={post} />
      <p>{post.body}</p>
      <PostActions postId={post.id} liked={post.liked} />
    </article>
  );
}

// non-exported single-use sub-component — exports are for other files
function MetaStrip({ post }: { post: Post }) { /* ... */ }

// skeleton LAST, exported, in the same file
export function PostDetailSkeleton() {
  return (
    <article className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-24 w-full" />
    </article>
  );
}
```

Function declarations hoist, so a skeleton referenced earlier in the file still works when defined last.

### 6.2 Skeleton rules

The single highest-leverage thing in this architecture. Skeletons are the loading *experience*, not a spinner substitute.

1. Match the real layout exactly: flex direction, gaps, padding, breakpoints.
2. Include every structural element: avatar circle, action-button placeholders, image squares.
3. Responsive visibility must match (`hidden sm:block` in the real component → same in the skeleton).
4. Variable-length lists: show **2–5** placeholders, not the real count.
5. **Don't** include skeletons for inner Suspense content — each boundary owns its own.
6. **Reserve the right height.** CLS comes from skeletons shorter than the real content.
7. Never `fallback={null}` for visible UI.

**No alias skeletons.** If a variant just preconfigures another skeleton, import the base and pass props inline at the boundary: `fallback={<GridSkeleton dense />}`.

The primitive itself is tiny:

```tsx
// components/ui/skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton-animation block', className)} />;
}
```

…with a shimmer defined once in `globals.css` (see §12).

### 6.3 Grouping and splitting

Group related components in **one file** when they're always used together: `genre-card.tsx` exports `GenrePill`, `GenreCard`, `GenreGrid`, `GenreGridSkeleton`.

Split only when:
- A component is consumed by multiple siblings — and wait until **three** call sites need it.
- One is `'use client'` and the sibling is a server component (the boundary forbids sharing a file).

Two widgets that look similar but render different data shapes are **not** the same component.

### 6.4 The server/client boundary

`'use client'` only for: hooks, event handlers, browser APIs. Keep the server component as the parent, push client leaves down.

**Server JSX crosses into client components as children/props:**

```tsx
<ComposerForm                                // 'use client'
  avatar={
    <Suspense fallback={<AvatarSkeleton />}>
      <CurrentUserAvatar />                  {/* async server component */}
    </Suspense>
  }
/>
```

`ComposerForm` doesn't know where the avatar came from; it streams in without re-rendering the form.

**Pass resolved values to server children.** A parent that already fetched the list passes each item down — the child doesn't refetch:

```tsx
// ✅
async function Feed({ userId }: { userId: string }) {
  const posts = await getFeed(userId);
  return posts.map(post => <Post key={post.id} post={post} />);
}
// ❌ Post({ id }) refetching what Feed already had
```

**Pass an unresolved promise only to a *client* component**, which reads it with `use()`. Name the prop with a `Promise` suffix so the contract is obvious at the call site:

```tsx
// page / server parent
<Suspense fallback={<TagListSkeleton />}>
  <TagPicker itemsPromise={getTags()} />
</Suspense>
```
```tsx
'use client';
import { use } from 'react';
export function TagPicker({ itemsPromise }: { itemsPromise: Promise<Tag[]> }) {
  const items = use(itemsPromise);
  /* interactive UI */
}
```

This is how a hover popover or an "add to playlist" menu owns its own loading state without moving fetching to the client.

### 6.5 Live data

| The data changes because… | Mechanism |
|---|---|
| **Other users** did something on the server (new messages, notifications, vote counts) | `<Poller>` client component calling `router.refresh()` on an interval — or a client data library (§10) |
| **This user** did something client-side (playback position, cart, open menus) | client context provider; leaves read it via `usePlayer()` etc. No server refetch |

Don't push server data into a client provider. Server data stays in queries; client state is ephemeral UI.

---

## 7. Pages and Suspense

### 7.1 Shape

```tsx
import { Suspense } from 'react';
import { PostDetail, PostDetailSkeleton } from '@/features/post/components/post-detail';
import { Replies, RepliesSkeleton } from '@/features/post/components/replies';
import ErrorBoundary from '@/components/ui/error-boundary';

export default function PostPage({ params }: PageProps<'/post/[id]'>) {   // ⚠️ generated type, Next 15.5+
  return (
    <div>
      <h1>Post</h1>                                   {/* paints instantly — outside the .then() */}
      <Suspense fallback={<PostDetailSkeleton />}>
        {params.then(({ id }) => (                    {/* ⚠️ Next 15+; see §17 */}
          <>
            <PostDetail id={id} />
            <ErrorBoundary title="Replies didn't load">
              <Suspense fallback={<RepliesSkeleton />}>
                <Replies postId={id} />
              </Suspense>
            </ErrorBoundary>
          </>
        ))}
      </Suspense>
    </div>
  );
}
```

Use an **implicit-return arrow** inside `.then()` when it just renders JSX. Switch to a block body only when you must parse or branch first.

```tsx
// searchParams only
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return searchParams.then(sp => {
    const q = typeof sp.q === 'string' ? sp.q : '';
    return q ? <SearchResults query={q} /> : <EmptyState title="Search anything" />;
  });
}

// both
export default function ProfilePage({ params, searchParams }: PageProps<'/u/[handle]'>) {
  return Promise.all([params, searchParams]).then(([{ handle }, sp]) => (
    <ProfileFeed handle={handle} tab={parseTab(sp.tab)} />
  ));
}
```

`generateMetadata` may `await params` freely — it's a separate function, it doesn't make the page body dynamic.

### 7.2 Never create page-local wrappers

```tsx
// ❌ hides the loading structure behind a wrapper
<Suspense fallback={<HomeListsSkeleton />}>
  <HomeLists searchParams={searchParams} />
</Suspense>
```
```tsx
// ✅ loading shape and grouped reveal visible at the boundary
<Suspense fallback={<><FeaturedSkeleton /><RecentSkeleton /></>}>
  {searchParams.then(sp => (
    <>
      <Featured filter={sp.filter} />
      <Recent filter={sp.filter} />
    </>
  ))}
</Suspense>
```

### 7.3 Boundary placement rules

1. First section gets its own Suspense with a known-height fallback.
2. Section headings stay **outside** Suspense when their final position is stable.
3. **Variable-height section → group everything below it in the same boundary**, including headings that would otherwise paint in the wrong vertical position.
4. Fixed-height section → its own boundary is safe.
5. Variable-length list → 2–5 skeleton items.
6. Inner Suspense content stays out of the outer skeleton.
7. Never `fallback={null}` for visible UI.
8. Never wrap the whole page. Chrome paints instantly; only data-dependent sections suspend. If you're writing `<Suspense fallback={<FullPageSkeleton />}>`, restructure.

### 7.4 CLS

Layout shift comes from exactly three things: a skeleton shorter than the content, a heading inside an unknown-height boundary, and an unfallbacked streaming list. Fixes map 1:1 to rules 1–5 above. Audit with React DevTools' Suspense panel — pin each boundary in its loading state and check vertical positions.

### 7.5 Error boundaries

Wrap fallible **sections** in a component-level boundary, placed in the page. Pair with route-segment `error.tsx` for unrecoverable failures.

⚠️ On Next 16.3+, build it on `catchError` from `next/error` — it understands Next's control-flow throws (`notFound()`, `redirect()`, `unauthorized()`, `forbidden()`) and its `ErrorInfo.retry()` re-fetches server data:

```tsx
'use client';
import { catchError, type ErrorInfo } from 'next/error';

function ErrorFallback({ title }: { title?: string }, { retry }: ErrorInfo) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <AlertTriangle className="text-danger h-6 w-6" />
      <p className="text-sm font-medium">{title ?? 'Something went wrong'}</p>
      <Button size="sm" variant="secondary" onClick={() => retry()}>Try again</Button>
    </div>
  );
}

export default catchError(ErrorFallback);
```

**On Next 13–16.2**, `react-error-boundary` is the practical fallback — but know the two costs: it swallows `notFound()`/`redirect()` (so `not-found.tsx` never renders under it), and its `reset` does not re-fetch server data. Mitigate by keeping such boundaries around sections that never call those functions, and pairing `reset` with `router.refresh()`.

### 7.6 Layout-level Suspense

Layouts compose the same way. Slots that fetch get their own boundary:

```tsx
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html>
      <body>
        <Suspense><AuthGate userPromise={getCurrentUser()} /></Suspense>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

---

## 8. Interaction & UX patterns

### 8.1 Pick the feedback mechanism

| Situation | Reach for | Key rule |
|---|---|---|
| Mutation unlikely to fail (like, favorite, follow, vote) | `useOptimistic` | Update immediately, roll back on throw. Set it **inside** a transition; `<form action>` opens one for you. Use a reducer for counters. |
| No optimistic fit (filters, sort, navigation) | `useTransition` + `data-pending` | Put `data-pending` on the pending node; ancestors react in CSS. |
| Field-level validation | `useActionState` | Action returns `{ error }`; render inline with `aria-invalid` + `role="alert"`. |
| Submit disable + spinner | `useFormStatus` | Call from a **child** of `<form>`, not the form component. |
| One-shot result with no visible change | toast | See below. |

`useOptimistic(false)` doubles as a transition-scoped pending flag that resets itself.

### 8.2 The `data-pending` bubble

Set the attribute at the pending node; let CSS propagate it — no prop drilling:

```tsx
<nav data-pending={isPending ? '' : undefined}>…</nav>
```
```tsx
<div className="transition-opacity group-has-data-pending/tabs:opacity-50">
```

Direct parent → `has-data-pending:`. Further up → `group-has-data-pending:` on a named group.

### 8.3 Optimistic toggle, canonical form

```tsx
'use client';
export function FollowButton({ targetHandle, following: initial }: Props) {
  const [following, setOptimistic] = useOptimistic(initial);
  const [, startTransition] = useTransition();

  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      className="min-w-[7rem]"                          // reserve width — no jitter on label change
      onClick={e => {
        e.preventDefault(); e.stopPropagation();
        startTransition(async () => {
          setOptimistic(!following);
          try {
            const result = await toggleFollow(targetHandle);
            if (!result.ok) toast.error(result.error);
          } catch { toast.error('Something went wrong. Try again.'); }
        });
      }}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
```

Note the `min-w`: optimistic labels of different lengths cause micro-CLS.

### 8.4 Toasts

- **Error only** when an optimistic UI already shows the result. A success toast beside an optimistic checkmark is double feedback.
- **Success only** for invisible side effects (email sent, link copied, file uploaded).
- **Never** for routine navigation — the page change *is* the feedback.
- **Never** inside a server action.

### 8.5 Destructive actions

Gate behind a confirm dialog. Two traps:
- Don't `redirect()` in the action (§5.2).
- Don't wrap the whole action call in `useTransition` inside the dialog — with view transitions on, that animates the background UI behind the modal. Track pending with `useState`/`useOptimistic(false)`; reserve `startTransition` for the post-success navigation only.

### 8.6 URL-driven pagination

Page number lives in `searchParams`. Each page renders as its own Suspense boundary so pages stream independently; "load more" navigates with `scroll: false`.

```tsx
export function Feed({ page = 1 }: { page?: number }) {
  return (
    <ul>
      {Array.from({ length: page }).map((_, i) => {
        const p = i + 1;
        return p === 1
          ? <FeedPage key={p} page={p} />
          : <Suspense key={p} fallback={<FeedPageSkeleton />}><FeedPage page={p} /></Suspense>;
      })}
    </ul>
  );
}
```

```tsx
'use client';
export function LoadMore({ href }: { href: Route }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button disabled={isPending} onClick={() => startTransition(() => router.push(href, { scroll: false }))}>
      {isPending ? 'Loading…' : 'Load more'}
    </button>
  );
}
```

Clamp the page number server-side (`Math.min(page, MAX_FEED_PAGE)`) — it's user input.

### 8.7 Global client state

Truly global client state (audio player, cart, theme) gets a root context provider. The provider is `'use client'` but `children` stays server-rendered; only leaves read the context.

---

## 9. Caching & invalidation

This is the biggest version fork. Pick **one** column and stay in it.

### 9.1 Next 13 / 14 / 15 (no Cache Components)

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';

export const getFeed = unstable_cache(
  async (userId: string) => prisma.post.findMany({ where: { userId } }),
  ['feed'],
  { tags: ['feed'], revalidate: 3600 },
);
```

```ts
'use server';
import { revalidateTag, revalidatePath } from 'next/cache';
// …mutate…
revalidateTag('feed');
```

- Plain uncached `async` queries are the sensible default; add `unstable_cache` only for reads that are genuinely reusable and expensive.
- `revalidateTag` / `revalidatePath` in actions.
- Route segment config (`export const revalidate = 60`, `dynamic = 'force-dynamic'`) is the coarse lever.
- ⚠️ Next 15 turned off the implicit `fetch`/Router cache defaults — set `revalidate`/`staleTimes` explicitly rather than relying on 14's behaviour.

### 9.2 Next 16 + `cacheComponents: true`

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  typedRoutes: true,
  experimental: { inlineCss: true, useOffline: true, viewTransition: true },
};
```

Mental model: synchronous content + `'use cache'` output + Suspense fallbacks prerender into a **static shell**; async work without `'use cache'` becomes a **dynamic hole** that streams in behind `<Suspense>`. Async work with neither fails the build.

| Data | Directive |
|---|---|
| Cacheable across users (public listings, computed pages) | `'use cache'` + `cacheTag(global, scoped)` + `cacheLife(profile)` |
| Per-user / reads cookies, headers, session | `'use cache: private'` |
| Remote third-party service, safe across users | `'use cache: remote'` |
| Genuinely per-request | none — must be justified, must sit in Suspense, invalidate with `refresh()` |

Cache the **query** when its result is reused across requests. Cache the **component** when rendering is expensive and props are stable. Never both — that's double-caching.

**Invalidation:**
- `updateTag(tag)` in **server actions** → read-your-own-writes.
- `revalidateTag(tag, 'max')` in **route handlers** (webhooks, cron) → stale-while-revalidate.
- `refresh()` only for deliberately dynamic reads with no tag. Not a substitute for `updateTag`.

The `cacheTag` in the query and the `updateTag` in the action use the same string and live in the same feature folder.

**The cookie/cache split.** A cached function can't read `cookies()`. So the exported query reads request state and passes it *into* a cached inner function — this two-function shape is everywhere in these repos:

```ts
export async function getTracksByGenre(genre: string) {
  return getTracksByGenreCached(genre, await isSlowEnabled());   // reads cookies
}

async function getTracksByGenreCached(genre: string, slow: boolean) {
  'use cache';
  cacheTag('tracks', `genre-${genre}`);
  cacheLife('hours');
  await delay(900, slow);
  return (await prisma.track.findMany({ where: { genre }, orderBy: { playCount: 'desc' } })).map(toTrack);
}
```

**Tag design.** Global + scoped, so one mutation can invalidate exactly what changed:

```ts
cacheTag('tracks', `track-${id}`, `track-${id}:${userId}`);
// action:
updateTag(`track-${id}:${userId}`);
updateTag(`favorites:${userId}`);
revalidateTag(`discover:${userId}`, 'max');   // stale-while-revalidate: user won't look immediately
```

**Build failure → architecture rule:**

| Build error | Fix |
|---|---|
| Async work without `'use cache'` and no ancestor Suspense | Cache the reusable read, or wrap a justified dynamic read in a page-owned `<Suspense>` |
| Request data inside `'use cache'` | Switch to `'use cache: private'`, or split into the two-function shape above |
| `await params` at the top of a page | Keep the page sync; move into `params.then()` |
| Sync request-time values (`new Date()`, `Math.random()`) in the shell | Cache the stable value, or `await io()` before the read |

---

## 10. Client data libraries (SWR / TanStack Query)

Only when a client component needs **library features**: focus/interval revalidation, polling, `mutate`/`invalidateQueries`, request dedup, cross-component cache. For read-once data, `use(promise)` (§6.4) is the answer — don't add a library.

**Rules**

1. **Seed the cache from the server.** Fetch in a server component, dehydrate, hand it to the client, let the library own revalidation from there. Never move all fetching to the client.
2. **`queryFn`/`fetcher` hits a route handler (GET)** — a GET that runs on both client and server. **Never** a Server Function (those are sequential POSTs, for mutations).
3. Route handlers are one-liners that delegate to the same feature query:

```ts
// app/api/channels/[channelId]/messages/route.ts
import { getMessages } from '@/features/message/message-queries';

export async function GET(_req: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  return Response.json(await getMessages(channelId));
}
```

4. Query keys/options live at the **feature root** as `<domain>-query-options.ts`; mutation wrappers exporting `use*` go in `features/<domain>/hooks/`:

```ts
export function messagesQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: messageKeys.channel(channelId),
    queryFn: async (): Promise<Message[]> => {
      const res = await fetch(apiUrl(`/api/channels/${channelId}/messages`));
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    refetchInterval: 10_000,
    refetchOnMount: 'always',
    staleTime: Infinity,
  });
}
```

5. ⚠️ Under `cacheComponents`, TanStack's `dehydrate()` reads `Date.now()` — wrap the seed helper in `'use cache'` with the same tags the seeded reads use, so the timestamp stays stable until a write invalidates it:

```ts
async function getHydrationUpdatedAt(tags: string[]) {
  'use cache';
  cacheTag(...tags);
  cacheLife('max');
  return Date.now();
}
```

6. `QueryClient` singleton: **new per request on the server, memoized on the browser.**

```ts
let browserQueryClient: QueryClient | undefined;
export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}
```

SWR's equivalent is trivially small — a `fetcher` and exported key constants in `lib/swr.ts`.

---

## 11. App shell & navigation

What makes these demos *feel* the way they do, in order of impact:

1. **Persistent chrome outside the routed content.** Sidebar / rail / player bar / mobile tab bar live in a layout, not in pages. They never re-render on navigation.
2. **Page chrome paints instantly**, data streams in behind shaped skeletons (§7.3).
3. **Prefetch on intent, not on render.** A viewport `<Link>` prefetches the shared shell; a *hover/focus* upgrade fetches the per-link data. Long lists don't wake the server N times:

```tsx
'use client';
export function HoverPrefetchLink({ href, onMouseEnter, onFocus, ...props }: Props) {
  const [intent, setIntent] = useState(false);
  return (
    <Link {...props} href={href} prefetch={intent ? true : null}
      onMouseEnter={e => { setIntent(true); onMouseEnter?.(e); }}
      onFocus={e => { setIntent(true); onFocus?.(e); }} />
  );
}
```

⚠️ `prefetch={null}` (shell-only) is a Next 16 concept. On 13–15, use `prefetch={false}` until intent, then `true`.

4. **`NavLink` with active + pending state.** Wraps `<Link>`, resolves `usePathname()` for `aria-current="page"`, and uses ⚠️ `useLinkStatus()` (Next 15.3+) for per-link pending. Accepts render-prop `className`/`children`:

```tsx
<NavLink href="/library" className={({ isActive }) => cn('...', isActive && 'bg-card')}>
  {({ isPending }) => <>{isPending && <Spinner />} Library</>}
</NavLink>
```

Under `cacheComponents`, wrap the `usePathname()` half in its own `<Suspense>` with an inactive-state fallback so the link still prerenders into the shell.

5. **Mobile parity.** Desktop sidebar ⇄ mobile bottom tab bar, same routes. `pb-24 sm:pb-0` on `<main>` to clear the fixed bar.
6. **Empty states are designed**, not blank: icon + title + optional body + optional CTA, as a `components/ui/empty-state.tsx` primitive.
7. **Keyboard.** `⌘K` command palette, `⌘↵` to submit a composer, `Enter`/`Space` on `role="button"` rows.

### View Transitions ⚠️ (React 19.2+ / `experimental.viewTransition`)

Three rules cover 90% of it:

- **Cross-fade streamed content** with a tiny wrapper the pages use at the boundary:
  ```tsx
  export function Crossfade({ children }: { children: React.ReactNode }) {
    return <ViewTransition enter="auto" default="none">{children}</ViewTransition>;
  }
  ```
- **Exclude persistent chrome.** Sidebars, nav bars, player bars, toolbars must not animate:
  ```css
  ::view-transition-group(sidebar),
  ::view-transition-group(player-bar) { animation: none; z-index: 100; }
  ::view-transition-old(sidebar) { display: none; }
  ```
- **Portaled UI** (toasts, dialogs, popovers) flickers unless excluded: `viewTransitionName: 'none'` on the portal root — or a *named* transition neutralized in CSS when you also need z-index/backdrop-blur control.

Shared-element transitions are worth it for exactly one thing: a tab underline.
```tsx
{isCommitted && (
  <ViewTransition name={indicatorName} share="tab-underline">
    <span className="absolute inset-x-6 -bottom-px h-1 rounded-t-full bg-black dark:bg-white" aria-hidden />
  </ViewTransition>
)}
```

Always honour reduced motion:
```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) {
    animation-duration: 0s !important; animation-delay: 0s !important;
  }
}
```

---

## 12. Styling

Tailwind v4, tokens in CSS via `@theme`. One `app/globals.css`.

```css
@import 'tailwindcss';

@theme {
  --color-surface: #fafafa;      --color-surface-dark: #121212;
  --color-card: #f4f4f5;         --color-card-dark: #181818;
  --color-divider: #e4e4e7;      --color-divider-dark: #282828;
  --color-gray: #a1a1aa;         --color-muted: #71717a;
  --color-accent: #4f6ef7;       --color-accent-hover: #3d5bd9;
  --color-success: #0fa958;      --color-danger: #e54848;  --color-warning: #f5a524;

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
  --animate-pending: pending 1.2s ease-in-out 150ms infinite both;
}

@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  h1 { @apply font-sans text-2xl font-bold tracking-tight; }
  h2 { @apply font-sans text-xl  font-bold tracking-tight; }
  input, textarea { @apply border-divider placeholder-gray focus:border-accent focus:ring-accent/30 w-full rounded-full border px-4 py-2 text-sm transition-colors focus:ring-2 focus:outline-none; }
  label { @apply text-gray mb-1.5 block text-xs font-medium tracking-wide; }
}

.skeleton-animation {
  background: linear-gradient(to right,
    rgba(130,130,130,.15) 8%, rgba(170,170,170,.25) 18%, rgba(150,150,150,.15) 33%);
  background-size: 800px 100px;
  animation: wave-lines 2s infinite ease-out;
}
.skeleton-animation:not([class*='rounded-']) { border-radius: var(--radius-sm); }
@keyframes wave-lines { 0% { background-position: -468px 0 } 100% { background-position: 468px 0 } }
```

**Conventions**

- Semantic token names (`surface`, `card`, `divider`, `muted`, `accent`) with explicit `-dark` twins — not raw palette scales in components.
- Dark mode via `.dark` class (`next-themes`, `attribute="class"`, `suppressHydrationWarning` on `<html>`), plus a light/dark/system three-way toggle.
- Base element styles in `@layer base` so `<h2>` needs no classes at call sites.
- `cn()` = `twMerge(clsx(...))` for every conditional class.
- Variant objects, not a variants library:
  ```ts
  const variants: Record<Variant, string> = { primary: '…', secondary: '…', ghost: '…' };
  const sizes:    Record<Size, string>    = { default: '…', sm: '…', icon: '…' };
  ```
- Fixed app height: `<body className="flex h-[100dvh] flex-col">`, scroll on `<main className="min-w-0 flex-1 overflow-y-auto">`. `viewport: { viewportFit: 'cover' }` for notches.

---

## 13. The demo/diagnostic toolbar

Optional, but it's the single most *educational* feature in all three apps: a fixed toolbar (`top-3 right-3 z-50 hidden sm:flex`) toggling cookie-backed dev modes.

| Toggle | What it does |
|---|---|
| **Delays** | Turns on artificial DB latency so skeletons and Suspense boundaries are actually visible |
| **Prefetch** | Disables link prefetching so you can feel the difference |
| **Online** | Simulates offline to exercise offline UI |
| **Client** | Highlights every `'use client'` boundary in the tree |

Implementation is ~40 lines. A cookie read on the server:

```ts
import 'server-only';
import { cookies } from 'next/headers';
export const SLOW = 'slow';
export async function isSlowEnabled() { return (await cookies()).has(SLOW); }
```

…threaded into every query via a shared helper:

```ts
export function delay(ms: number, enabled = true) {
  return enabled ? new Promise(r => setTimeout(r, ms)) : Promise.resolve();
}
```

…and a `<Boundary label="…">` wrapper around each client leaf that draws a labelled outline when the Client toggle is on. Cheap, and it turns the app into its own teaching tool. Ship it behind `process.env.NODE_ENV !== 'production'` if you don't want it public.

---

## 14. Testing

Playwright only. One spec per page, ~5–15 assertions each. No unit-test layer for UI.

```ts
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002',
    trace: 'on-first-retry',
    storageState: {                       // pre-seed the session cookie — no login flow per test
      cookies: [{ name: 'app-user', value: 'e2e', domain: 'localhost', path: '/',
                  httpOnly: false, secure: false, sameSite: 'Lax', expires: -1 }],
      origins: [],
    },
  },
  webServer: {
    command: 'pnpm dev --port 3002',
    url: `${baseURL}/`,
    reuseExistingServer: true,
    stdout: 'pipe',
  },
});
```

Assert on **user-visible behaviour**: role-based locators, that skeletons appear then resolve, that optimistic toggles flip instantly. ⚠️ Next 16 adds `@next/playwright` + the `instant()` API to assert navigations stay instant.

---

## 15. Tooling

**`.prettierrc`**
```json
{
  "printWidth": 120, "tabWidth": 2, "useTabs": false,
  "semi": true, "singleQuote": true, "trailingComma": "all",
  "bracketSpacing": true, "arrowParens": "avoid", "endOfLine": "auto",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**`eslint.config.mjs`** — flat config, `eslint-config-next` + `eslint-config-prettier`, then:
- `@typescript-eslint/consistent-type-imports: warn` (`import type`)
- `import/order` alphabetized, `@/**` in the `parent` group, positioned `before`
- `arrow-body-style: as-needed`, `react/self-closing-comp`, `no-console: warn`
- ignore `generated/**`, `.next/**`

**`tsconfig.json`** — `strict: true`, `moduleResolution: 'bundler'`, `paths: { "@/*": ["./*"] }`, include `.next/types/**/*.ts` for generated route types.

**`package.json` scripts**
```json
{
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint .",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "test:e2e": "playwright test",
  "prisma.push": "prisma db push",
  "prisma.seed": "prisma db seed",
  "prisma.studio": "prisma studio",
  "prisma.reset": "prisma db push --force-reset && pnpm prisma.seed"
}
```

**`lib/db.ts`** — one Prisma singleton, globalThis-cached in dev:
```ts
import 'server-only';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Seeding matters.** A rich `prisma/seed.ts` (dozens of realistic records, varied lengths, timestamps spread over days) is what makes skeleton design and CLS problems visible during development.

---

## 16. Build order

For a new app, or a new feature in an existing one:

1. **Sketch first.** Routes, real domain nouns, static shell, expected loading groups — before any code.
2. **Place the work.** Which feature folder? (§3). Merge into a parent unless all three criteria hold.
3. **Write the query.** `features/<domain>/<domain>-queries.ts`, `import 'server-only'`, map ORM rows to domain types.
4. **Write the action** if there's a mutation. `'use server'` → auth → validate → mutate → invalidate → discriminated union.
5. **Build the component + skeleton** in one file. Async server component taking minimal props; `'use client'` on interactive leaves only; skeleton last.
6. **Compose the page.** Synchronous, `params.then()`, place `<Suspense>` and the error boundary here.
7. **Add interaction.** Pick from §8.1. Don't double up feedback.
8. **Verify** against §18.

### Auditing an existing app — smells, in priority order

- `export default async function Page()` that only awaits `params`/`searchParams`/queries
- `import { getX } from '@/features/…/x-queries'` inside `app/**/page.tsx` or `layout.tsx`
- A feature component prop named `params` or `searchParams`
- Page-local wrappers: `HomeContent`, `PostShell`, `ResultsSection`
- `<Suspense>` inside a feature component
- A feature folder with one query, one action, one button
- `fallback={null}` or a spinner where a shaped skeleton belongs
- `'use client'` on a component that renders server children

---

## 17. Version compatibility matrix

| Pattern | 13.4–14 | 15 | 16 |
|---|---|---|---|
| Feature folders, queries/actions split, skeleton-in-file | ✅ | ✅ | ✅ |
| Pages compose / features fetch / IDs not params | ✅ | ✅ | ✅ |
| Suspense placement, CLS rules, error boundaries | ✅ | ✅ | ✅ |
| Server Actions | ✅ 14 stable | ✅ | ✅ |
| `params`/`searchParams` are Promises | ❌ sync objects | ✅ | ✅ |
| `params.then()` sync-page idiom | n/a — page is already sync, use `params` directly | ✅ | ✅ |
| `PageProps<'/route'>` generated types | ❌ hand-write props | ✅ 15.5+ | ✅ |
| `useFormStatus` | ✅ | ✅ | ✅ |
| `useOptimistic`, `useActionState`, `use()` | React 19 only (`useFormState` on 18) | ✅ | ✅ |
| `useLinkStatus()` | ❌ | ✅ 15.3+ | ✅ |
| `unstable_cache` + `revalidateTag`/`revalidatePath` | ✅ | ✅ | superseded |
| `'use cache'` / `cacheTag` / `cacheLife` | ❌ | canary | ✅ |
| `updateTag` / `revalidateTag(tag,'max')` / `refresh()` | ❌ | ❌ | ✅ |
| Partial Prerendering / `partialPrefetching` | ❌ | experimental | ✅ |
| `prefetch={null}` (shell-only) | ❌ use `false` | ❌ use `false` | ✅ |
| `catchError` from `next/error` | ❌ `react-error-boundary` | ❌ | ✅ 16.3+ |
| React Compiler | opt-in babel plugin | opt-in | ✅ `reactCompiler: true` |
| `<ViewTransition>` | ❌ | experimental | ✅ |
| Tailwind v4 `@theme` | ✅ (tooling-independent) | ✅ | ✅ |

**Portability rule:** §3–§8 are version-independent — build against those. §9 (caching), §11 (prefetch/transitions) and §7.5 (error boundary) are the only sections that need swapping per version.

---

## 18. Review checklist

Copy into PR templates.

- [ ] No page/layout imports a `*-queries` file or defines a route-specific component inline
- [ ] Pages with params are synchronous (`params.then()` on 15+)
- [ ] No feature prop named `params`/`searchParams`; features get IDs/handles/parsed filters/resolved records
- [ ] Every data `<Suspense>` sits in the page; no feature pre-wraps itself
- [ ] Every component has a real `*Skeleton` in the same file, at the end; no alias skeletons
- [ ] Skeleton matches layout, breakpoints, and reserves the real height
- [ ] Every `*-queries.ts` starts with `import 'server-only'`; every `*-actions.ts` with `'use server'`
- [ ] Actions: auth → validate → mutate → invalidate → discriminated union; no `redirect()`, no toasts
- [ ] Cached reads carry tags; mutations invalidate the matching tags (not a blanket `refresh()`)
- [ ] Action files named `<folder>-actions.ts`; no sub-concept has its own folder
- [ ] `'use client'` components are leaves — they import actions/hooks, not async server components
- [ ] Client data-library `queryFn` hits a GET route handler, never a Server Function
- [ ] Feedback isn't doubled (optimistic UI + success toast); destructive actions confirm
- [ ] Queries return domain types, not ORM rows
- [ ] `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` pass

---

## 19. Starter file manifest

The minimum set to reproduce this architecture in a new repo:

```
next.config.ts            # reactCompiler, typedRoutes (+ cacheComponents on 16)
tsconfig.json             # strict, @/* paths
eslint.config.mjs         # §15
.prettierrc               # §15
app/globals.css           # §12 tokens + skeleton shimmer + view-transition recipes
app/layout.tsx            # fonts, ThemeProvider, Toaster, metadata template, h-[100dvh] flex
app/(app)/layout.tsx      # sidebar + main + mobile tab bar + providers
app/error.tsx             # route-segment error
app/not-found.tsx
lib/db.ts                 # Prisma singleton
lib/utils.ts              # cn(), delay(), formatters
components/ui/skeleton.tsx
components/ui/button.tsx        # useFormStatus + variant/size record
components/ui/empty-state.tsx
components/ui/error-boundary.tsx
components/ui/nav-link.tsx      # active + pending
components/ui/prefetch-link.tsx
components/theme/theme-provider.tsx
components/theme/theme-toggle.tsx   # light / dark / system
components/sidebar.tsx
components/mobile-nav.tsx
features/user/user-queries.ts   # getCurrentUser + verifyAuth
prisma/schema.prisma
prisma/seed.ts                  # rich seed data — non-negotiable
playwright.config.ts
```

---

## 20. Further reading

- [Component Architecture for React Server Components](https://aurorascharff.no/posts/component-architecture-for-react-server-components/) — the reasoning behind all of this
- [Error Handling in Next.js with catchError](https://aurorascharff.no/posts/error-handling-in-nextjs-with-catch-error/)
- [`nextjs-app-architecture` skill](https://github.com/aurorascharff/skills/tree/main/skills/nextjs-app-architecture) — the machine-readable version, bundled in `.agents/skills/` in the reference repos
- Next.js docs: Server & Client Components, Caching, Linking & Navigating, Single-Page Applications guide
