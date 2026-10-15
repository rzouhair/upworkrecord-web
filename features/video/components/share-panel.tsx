'use client';

import { ExternalLink, Film, ImagePlus, Pencil, Sparkles, WandSparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CopyButton } from '@/features/video/components/copy-button';
import { GifPicker } from '@/features/video/components/gif-picker';
import { UpworkCardPreview } from '@/features/video/components/upwork-card-preview';
import { previewCopy, type Video } from '@/features/video/types/video';
import { refreshVideo, suggestPreview, updatePreview, updateSlug } from '@/features/video/video-actions';
import { toJpeg, uploadAsset } from '@/features/video/video-upload';
import { useFileInput } from '@/hooks/use-file-input';

const GIF_WARN_BYTES = 5 * 1024 * 1024;

export function SharePanel({ video, shareUrl }: { video: Video; shareUrl: string }) {
  const [ogTitle, setOgTitle] = useState(video.ogTitle ?? '');
  const [ogDescription, setOgDescription] = useState(video.ogDescription ?? '');
  const [saving, startSaving] = useTransition();
  const [suggesting, startSuggesting] = useTransition();
  const [editingSlug, setEditingSlug] = useState(false);
  const [slug, setSlug] = useState(video.slug);
  const [savingSlug, startSavingSlug] = useTransition();
  const router = useRouter();
  const linkBase = shareUrl.slice(0, shareUrl.lastIndexOf('/') + 1);
  const [uploading, setUploading] = useState<'gif' | 'poster' | null>(null);
  const [pickingGif, setPickingGif] = useState(false);
  // Bust the browser cache after replacing an image at the same URL.
  const [version, setVersion] = useState(0);

  const fallback = previewCopy({ ...video, ogTitle: null, ogDescription: null });
  const image = video.gifUrl ?? video.posterUrl;
  const dirty = ogTitle !== (video.ogTitle ?? '') || ogDescription !== (video.ogDescription ?? '');

  async function replace(kind: 'gif' | 'poster', file: File) {
    if (kind === 'gif' && file.type !== 'image/gif') return void toast.error('Choose a .gif file');
    if (kind === 'gif' && file.size > GIF_WARN_BYTES) toast.warning('Large GIF: some previews reject images over 5 MB');
    setUploading(kind);
    try {
      await uploadAsset(video.id, kind, kind === 'poster' ? await toJpeg(file) : file);
      await refreshVideo(video.id);
      setVersion(v => v + 1);
      toast.success(kind === 'gif' ? 'Preview GIF updated' : 'Thumbnail updated');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  const [attachGif, openGif] = useFileInput(f => replace('gif', f));
  const [attachPoster, openPoster] = useFileInput(f => replace('poster', f));

  const bust = (url: string | null) => (url && version ? `${url}?v=${version}` : url);
  const embed = `<iframe src="${shareUrl.replace('/v/', '/embed/')}" width="640" height="360" frameborder="0" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  const absoluteGif = video.gifUrl ? new URL(video.gifUrl, shareUrl).toString() : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h3>Share link</h3>
        {editingSlug ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={e => {
              e.preventDefault();
              startSavingSlug(async () => {
                const res = await updateSlug(video.id, slug);
                if (!res.ok) return void toast.error(res.error);
                setSlug(res.slug);
                setEditingSlug(false);
                toast.success('Link updated. The old link still redirects here.');
                router.refresh();
              });
            }}
          >
            <div className="border-input focus-within:outline-foreground flex items-center overflow-hidden rounded-lg border focus-within:outline-2 focus-within:outline-offset-1">
              <span className="text-muted-foreground bg-muted shrink-0 self-stretch px-3 text-sm leading-10 select-none">
                {linkBase.replace(/^https?:\/\//, '')}
              </span>
              <input
                aria-label="Custom link"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                autoFocus
                maxLength={60}
                className="rounded-none! border-0! outline-none!"
              />
            </div>
            <p className="text-muted-foreground text-xs">Letters, numbers and dashes. Links you already sent keep working.</p>
            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="sm" disabled={savingSlug || slug === video.slug}>
                {savingSlug ? 'Saving…' : 'Save link'}
              </Button>
              <Button variant="tertiary" size="sm" onClick={() => { setSlug(video.slug); setEditingSlug(false); }}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <input readOnly value={shareUrl} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
            <CopyButton text={shareUrl} label="Copy link" variant="primary" />
            <Button variant="tertiary" size="icon" onClick={() => setEditingSlug(true)} aria-label="Edit link" title="Edit link">
              <Pencil />
            </Button>
            <Button variant="tertiary" size="icon" asChild>
              <a href={shareUrl} target="_blank" rel="noreferrer" aria-label="Open share page">
                <ExternalLink />
              </a>
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h3>Link preview</h3>
          <p className="text-muted-foreground text-sm">
            What clients see when you paste the link in Upwork Messages. The GIF plays right in the card.
          </p>
        </div>
        <UpworkCardPreview
          image={bust(image)}
          title={ogTitle || fallback.title}
          description={ogDescription || fallback.description}
          durationSec={video.durationSec}
          isGif={!!video.gifUrl}
        />

        {pickingGif ? (
          <GifPicker
            video={video}
            onDone={() => {
              setPickingGif(false);
              setVersion(v => v + 1);
            }}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="tertiary" onClick={() => setPickingGif(true)} disabled={uploading !== null || pickingGif}>
            <Film /> Choose GIF section
          </Button>
          <Button variant="tertiary" onClick={openGif} disabled={uploading !== null}>
            <Sparkles /> {uploading === 'gif' ? 'Uploading…' : video.gifUrl ? 'Replace GIF' : 'Upload GIF'}
          </Button>
          <Button variant="tertiary" onClick={openPoster} disabled={uploading !== null}>
            <ImagePlus /> {uploading === 'poster' ? 'Uploading…' : 'Replace thumbnail'}
          </Button>
        </div>
        {!video.gifUrl ? (
          <p className="text-muted-foreground text-xs">
            No GIF yet: the card shows the still thumbnail. Choose a section of the video to make one.
          </p>
        ) : null}
        <input ref={attachGif} type="file" accept="image/gif" className="hidden" aria-label="Choose GIF" />
        <input ref={attachPoster} type="file" accept="image/*" className="hidden" aria-label="Choose thumbnail" />

        <form
          className="flex flex-col gap-3"
          onSubmit={e => {
            e.preventDefault();
            startSaving(async () => {
              const res = await updatePreview(video.id, { ogTitle, ogDescription });
              if (res.ok) toast.success('Preview saved');
              else toast.error(res.error);
            });
          }}
        >
          <div>
            <label htmlFor="og-title">Card title</label>
            <input id="og-title" value={ogTitle} onChange={e => setOgTitle(e.target.value)} placeholder={fallback.title} maxLength={90} />
          </div>
          <div>
            <label htmlFor="og-description">Card description</label>
            <Textarea
              id="og-description"
              value={ogDescription}
              onChange={e => setOgDescription(e.target.value)}
              placeholder={fallback.description}
              maxLength={200}
              rows={3}
            />
            <p className="text-muted-foreground mt-1 text-right text-xs">{ogDescription.length}/200</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="secondary" disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save preview'}
            </Button>
            <Button
              variant="tertiary"
              disabled={suggesting}
              onClick={() =>
                startSuggesting(async () => {
                  const res = await suggestPreview(video.id);
                  if (!res.ok) return void toast.error(res.error);
                  setOgTitle(res.title);
                  setOgDescription(res.description);
                  toast.success('Drafted from the transcript. Review, then save.');
                })
              }
            >
              <WandSparkles /> {suggesting ? 'Writing…' : 'Write with AI'}
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h3>More ways to share</h3>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={embed} label="Copy embed code" variant="tertiary" />
          {absoluteGif ? (
            <CopyButton
              text={shareUrl}
              html={`<a href="${shareUrl}"><img src="${absoluteGif}" alt="${fallback.title.replace(/"/g, '&quot;')}" width="480" /></a>`}
              label="Copy GIF for email"
              variant="tertiary"
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
