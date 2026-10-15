// Shared by the server-side Upwork import and the copy-paste prompt for Claude/Codex.

export const PROFILE_JSON_RULES = `Reply with ONE JSON object in exactly this shape. Use ONLY facts present in the Upwork data;
leave a field empty ("" or []) when the data doesn't have it. Never invent or embellish anything.
{"name": string, "headline": string, "bio": string, "photoUrl": string, "profileUrl": string,
 "jobSuccess": number | null, "badge": string, "rating": number | null, "reviewCount": number | null,
 "totalJobs": number | null, "totalHours": number | null, "totalEarned": string, "skills": string[],
 "experiences": [{"title": string, "org": string, "period": string, "summary": string}],
 "certifications": [{"name": string, "issuer": string, "date": string}],
 "reviews": [{"text": string, "rating": number | null, "title": string, "client": string, "date": string}]}
- headline: the profile title. bio: the overview, as written.
- photoUrl: the profile photo URL. profileUrl: the public profile link (https://www.upwork.com/freelancers/~…).
- jobSuccess: Job Success Score as a number (100 for "100%"). badge: "Top Rated", "Top Rated Plus", "Rising Talent" or "Expert-Vetted", else "".
- rating: overall client rating 0-5. reviewCount: number of client reviews/feedbacks. totalJobs, totalHours: numbers.
- totalEarned: as Upwork shows it, e.g. "$2K+".
- skills: max 15. experiences: employment history and notable projects/portfolio, newest first, max 8.
- reviews: client feedback comments with their star rating (0-5) and the job title, newest first, max 10. Skip ratings without a comment.
- dates as written ("2024", "Mar 2025 - now").`;

/** Paste into Claude, Codex or any assistant with the Upwork MCP connected. */
export const UPWORK_PROFILE_PROMPT = `Use the Upwork MCP to read MY OWN freelancer profile.
1. Call list_accounts to find my freelancer account (org_uid).
2. Call get_profile with action "get", then with action "list_highlights" (both with that org_uid).
3. If another Upwork tool returns my work history or client feedback/reviews, call it too.

${PROFILE_JSON_RULES}

Output only the JSON object, no other text.`;
