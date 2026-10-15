'use client';

import { Plus, Star, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { deleteTemplate, saveTemplate, setDefaultTemplate } from '@/features/proposal/proposal-actions';
import type { PromptTemplate } from '@/features/proposal/proposal-queries';

const VARIABLES = ['job_post', 'job_url', 'client_name', 'transcript', 'video_url', 'video_title', 'duration'];

export function TemplateList({ templates }: { templates: PromptTemplate[] }) {
  const [adding, setAdding] = useState(templates.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Variables:{' '}
        {VARIABLES.map(v => (
          <code key={v} className="uw-token mr-1 mb-1 font-mono text-xs!">{`{{${v}}}`}</code>
        ))}
      </p>
      {templates.map(t => (
        <TemplateCard key={t.id} template={t} />
      ))}
      {adding ? (
        <TemplateCard template={null} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
          <Plus /> New template
        </Button>
      )}
    </div>
  );
}

function TemplateCard({ template, onDone }: { template: PromptTemplate | null; onDone?: () => void }) {
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [pending, startTransition] = useTransition();
  const dirty = !template || name !== template.name || body !== template.body;

  return (
    <form
      className="uw-card flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveTemplate(template?.id ?? null, { name, body });
          if (!res.ok) return void toast.error(res.error);
          toast.success('Template saved');
          onDone?.();
        });
      }}
    >
      <div className="flex items-center gap-2">
        <input aria-label="Template name" value={name} onChange={e => setName(e.target.value)} placeholder="Template name" className="font-medium" />
        {template?.isDefault ? (
          <span className="uw-badge uw-badge--success shrink-0">Default</span>
        ) : null}
      </div>
      <Textarea
        aria-label="Prompt"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={10}
        className="font-mono text-xs leading-relaxed"
        placeholder="Write the prompt. Use {{job_post}}, {{transcript}}, {{video_url}}…"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant={template ? 'secondary' : 'primary'} disabled={!dirty || pending}>
          {template ? 'Save' : 'Create template'}
        </Button>
        {template && !template.isDefault ? (
          <Button variant="ghost" onClick={() => startTransition(() => setDefaultTemplate(template.id))}>
            <Star /> Make default
          </Button>
        ) : null}
        {template ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="text-danger">
                <Trash2 /> Delete
              </Button>
            }
            title={`Delete “${template.name}”?`}
            confirmLabel="Delete"
            confirmAction={() => deleteTemplate(template.id)}
          />
        ) : (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
