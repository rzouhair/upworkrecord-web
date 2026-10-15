'use server';

import { updateTag } from 'next/cache';
import { disconnect, refreshTools } from '@/features/upwork/upwork-mcp';
import { verifyAuth } from '@/lib/auth';

export async function disconnectUpwork() {
  await verifyAuth();
  await disconnect();
  updateTag('upwork');
}

export async function refreshUpworkTools() {
  await verifyAuth();
  try {
    const tools = await refreshTools();
    updateTag('upwork');
    return { ok: true as const, count: tools.length };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
