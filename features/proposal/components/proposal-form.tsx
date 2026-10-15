'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { generateProposal, saveProposal } from '@/features/proposal/proposal-actions';
import { CoverLetterPreview } from '@/features/proposal/components/cover-letter-preview';
import { CopyButton } from '@/features/video/components/copy-button';
import type { PromptTemplate, Proposal } from '@/features/proposal/proposal-queries';

export function ProposalForm({
  videoId,
  proposal,
  templates,
  pitch: initialPitch,
}: {
  videoId: string;
  proposal: Proposal | null;
  templates: PromptTemplate[];
  pitch: string;
}) {
  const [jobUrl, setJobUrl] = useState(proposal?.jobUrl ?? '');
  const [jobPost, setJobPost] = useState(proposal?.jobPost ?? '');
  const [clientName, setClientName] = useState(proposal?.clientName ?? '');
  const router = useRouter();
  const [templateId, setTemplateId] = useState(
    proposal?.templateId ?? templates.find(t => t.isDefault)?.id ?? templates[0]?.id ?? '',
  );
  const [body, setBody] = useState(proposal?.body ?? '');
  const [pitch, setPitch] = useState(initialPitch);
  const [generating, startGenerating] = useTransition();
  const [saving, startSaving] = useTransition();
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  // Job info the current draft was written from; editing it regenerates the draft.
  const draftedFrom = useRef({
    jobUrl: proposal?.jobUrl ?? '',
    jobPost: (proposal?.jobPost ?? '').trim(),
    clientName: (proposal?.clientName ?? '').trim(),
  });

  function generate(job = { jobUrl, jobPost, clientName }) {
    startGenerating(async () => {
      const res = await generateProposal(videoId, { ...job, templateId });
      if (!res.ok) return void toast.error(res.error);
      draftedFrom.current = { jobUrl: job.jobUrl, jobPost: job.jobPost.trim(), clientName: job.clientName.trim() };
      setBody(res.body);
      setPitch(res.pitch);
      router.refresh(); // the video title may now start "For <client>:"
      toast.success('Proposal drafted. Review it before sending.');
    });
  }

  useEffect(() => {
    const job = { jobUrl: jobUrl.trim(), jobPost, clientName };
    const changed =
      job.jobUrl !== draftedFrom.current.jobUrl ||
      jobPost.trim() !== draftedFrom.current.jobPost ||
      clientName.trim() !== draftedFrom.current.clientName;
    const urlOk = !job.jobUrl || URL.canParse(job.jobUrl);
    const enough = (job.jobUrl && urlOk) || jobPost.trim().length >= 40;
    // One redraft at a time (server saves in completion order); edits made meanwhile redraft after it.
    if (generating || !changed || !urlOk || !enough || !templateId) return;
    const timer = setTimeout(() => generate(job), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only job edits trigger a redraft
  }, [jobUrl, jobPost, clientName, generating]);

  function save() {
    startSaving(async () => {
      const res = await saveProposal(videoId, { jobUrl, jobPost, clientName, body, templateId: templateId || null, pitch });
      if (res.ok) toast.success('Saved');
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="client-name">Client name</label>
        <input
          id="client-name"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="Curtis"
          maxLength={60}
          autoComplete="off"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Opens the cover letter with &ldquo;Hi {clientName.trim() || 'Curtis'} 👋&rdquo; and adds &ldquo;For{' '}
          {clientName.trim() || 'Curtis'}:&rdquo; to the video title.
        </p>
      </div>
      <div>
        <label htmlFor="job-url">Job URL</label>
        <input
          id="job-url"
          type="url"
          value={jobUrl}
          onChange={e => setJobUrl(e.target.value)}
          placeholder="https://www.upwork.com/jobs/~0…"
        />
      </div>
      <div>
        <label htmlFor="job-post">Job post</label>
        <Textarea
          id="job-post"
          value={jobPost}
          onChange={e => setJobPost(e.target.value)}
          placeholder="Paste the client's job description here"
          rows={6}
          className="max-h-72"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="template">Prompt template</label>
          <select
            id="template"
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
        <Button variant="primary" size="lg" onClick={() => generate()} disabled={generating || !templateId}>
          <Sparkles />
          {generating ? 'Writing…' : body ? 'Regenerate' : 'Generate proposal'}
        </Button>
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">
        Uses the video&apos;s transcript and share link. Editing the job URL or post redrafts it.{' '}
        <Link href="/settings" className="uw-link">
          Edit templates
        </Link>
      </p>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="proposal-body">Cover letter</label>
          <span className="text-muted-foreground text-sm">{words} words</span>
        </div>
        <Textarea
          id="proposal-body"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Generate a draft, or write your own"
          rows={12}
          aria-busy={generating}
          className="leading-relaxed"
        />
      </div>
      <CoverLetterPreview text={body} />
      <div>
        <label htmlFor="proposal-pitch">Why I&apos;m a fit (share page)</label>
        <Textarea
          id="proposal-pitch"
          value={pitch}
          onChange={e => setPitch(e.target.value)}
          placeholder="Written with the proposal from your public profile, matched to this job and video"
          rows={6}
          aria-busy={generating}
          className="leading-relaxed"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Shown to the client under the video. Uses only your profile facts; edit freely, then Save.
        </p>
      </div>
      <div className="flex gap-3">
        <CopyButton text={body} label="Copy cover letter" variant="secondary" />
        <Button variant="tertiary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
