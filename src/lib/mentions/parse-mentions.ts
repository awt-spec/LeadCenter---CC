type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

/** Extract mentioned userIds from a Tiptap JSON doc. */
export function parseMentionsFromDoc(doc: unknown): string[] {
  if (!doc || typeof doc !== 'object') return [];
  const ids = new Set<string>();
  walk(doc as TiptapNode, ids);
  return Array.from(ids);
}

function walk(node: TiptapNode, ids: Set<string>) {
  if (!node) return;
  if (node.type === 'mention' && node.attrs && typeof node.attrs.id === 'string') {
    ids.add(node.attrs.id);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, ids);
  }
}

/** Produce a plain-text version of a Tiptap JSON doc (for search index / preview). */
export function plainTextFromDoc(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const out: string[] = [];
  walkText(doc as TiptapNode, out);
  return out.join(' ').trim();
}

function walkText(node: TiptapNode, out: string[]) {
  if (!node) return;
  if (node.type === 'text' && typeof (node as unknown as { text?: string }).text === 'string') {
    out.push((node as unknown as { text: string }).text);
  }
  if (node.type === 'mention' && node.attrs && typeof node.attrs.label === 'string') {
    out.push(`@${node.attrs.label}`);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkText(child, out);
  }
}
