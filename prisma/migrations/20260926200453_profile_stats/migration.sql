-- Structured Upwork stats replace free-form highlights.
ALTER TABLE "Profile"
  ADD COLUMN "jobSuccess" INTEGER,
  ADD COLUMN "badge" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "rating" DOUBLE PRECISION,
  ADD COLUMN "reviewCount" INTEGER,
  ADD COLUMN "totalJobs" INTEGER,
  ADD COLUMN "totalHours" INTEGER,
  ADD COLUMN "totalEarned" TEXT NOT NULL DEFAULT '';

-- Carry over what the old highlights already said ("$2K+ earned", "6 jobs", "4 client reviews", "100% Job Success", "Top Rated").
UPDATE "Profile" p SET
  "totalEarned" = COALESCE((SELECT substring(h FROM '^(\$[0-9.,]+[KkMm]?\+?)\s+earned') FROM unnest(p.highlights) h WHERE h ~* '^\$[0-9.,]+[KkMm]?\+?\s+earned' LIMIT 1), ''),
  "totalJobs" = (SELECT substring(h FROM '^([0-9]+)\+?\s+jobs?$')::int FROM unnest(p.highlights) h WHERE h ~* '^[0-9]+\+?\s+jobs?$' LIMIT 1),
  "reviewCount" = (SELECT substring(h FROM '^([0-9]+)\s')::int FROM unnest(p.highlights) h WHERE h ~* '^[0-9]+\s+(client\s+)?reviews?$' LIMIT 1),
  "jobSuccess" = (SELECT substring(h FROM '^([0-9]+)%')::int FROM unnest(p.highlights) h WHERE h ~* '^[0-9]+%\s+job success' LIMIT 1),
  "badge" = COALESCE((SELECT h FROM unnest(p.highlights) h WHERE h ~* '^(top rated( plus)?|rising talent|expert-vetted)$' LIMIT 1), '');

ALTER TABLE "Profile" DROP COLUMN "highlights";
