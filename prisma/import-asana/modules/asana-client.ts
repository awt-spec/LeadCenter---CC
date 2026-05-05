// Thin Asana REST client tuned for bulk migration. Uses Personal Access Token
// auth (env: ASANA_PAT). Designed to run inside `bun run` from the project
// root — not bundled into Next, so we can use Node fetch + simple concurrency.

const BASE = 'https://app.asana.com/api/1.0';

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  display_value: string | null;
  /// Some custom fields are multi-enum. Asana returns `text_value` for those
  /// with the joined display, but `enum_value`/`multi_enum_values` for the
  /// real picks. We just take display_value as authoritative.
  resource_subtype?: string;
}

export interface AsanaStory {
  gid: string;
  created_at: string;
  created_by: AsanaUser | null;
  type: 'comment' | 'system';
  resource_subtype: string;
  text: string;
  is_pinned?: boolean;
}

export interface AsanaAttachment {
  gid: string;
  created_at: string;
  name: string;
  size: number;
  download_url: string | null;
  permanent_url: string | null;
  host: string;
  resource_subtype?: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  modified_at: string;
  due_on: string | null;
  due_at: string | null;
  start_on: string | null;
  assignee: AsanaUser | null;
  followers: AsanaUser[];
  num_subtasks: number;
  parent: { gid: string; name: string } | null;
  memberships: Array<{ project: { gid: string; name: string }; section: { gid: string; name: string } | null }>;
  custom_fields: AsanaCustomField[];
  /// Populated by the puller, not Asana directly.
  subtasks?: AsanaTask[];
  stories?: AsanaStory[];
  attachments?: AsanaAttachment[];
}

const TASK_OPT_FIELDS = [
  'name',
  'notes',
  'completed',
  'completed_at',
  'created_at',
  'modified_at',
  'due_on',
  'due_at',
  'start_on',
  'num_subtasks',
  'parent.gid',
  'parent.name',
  'assignee.name',
  'assignee.email',
  'followers.name',
  'followers.email',
  'memberships.project.name',
  'memberships.section.name',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.resource_subtype',
].join(',');

const STORY_OPT_FIELDS = [
  'created_at',
  'created_by.name',
  'created_by.email',
  'type',
  'resource_subtype',
  'text',
  'is_pinned',
].join(',');

const ATTACHMENT_OPT_FIELDS = [
  'name',
  'size',
  'download_url',
  'permanent_url',
  'host',
  'resource_subtype',
  'created_at',
].join(',');

export class AsanaClient {
  constructor(private readonly pat: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.pat}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 429) {
      // Rate limited. Asana sends Retry-After in seconds.
      const wait = Number(res.headers.get('Retry-After') ?? '5') * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return this.req<T>(path, init);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asana ${res.status} ${path}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  /// All top-level tasks of a project (no subtasks here — those are fetched
  /// separately because Asana requires per-task calls for subtask trees).
  async listProjectTasks(projectGid: string, completedSince = '1970-01-01T00:00:00Z'): Promise<AsanaTask[]> {
    const out: AsanaTask[] = [];
    let after: string | undefined;
    for (;;) {
      const params = new URLSearchParams({
        opt_fields: TASK_OPT_FIELDS,
        limit: '100',
        completed_since: completedSince,
      });
      if (after) params.set('offset', after);
      const json = await this.req<{
        data: AsanaTask[];
        next_page?: { offset: string } | null;
      }>(`/projects/${projectGid}/tasks?${params.toString()}`);
      out.push(...json.data);
      if (!json.next_page) break;
      after = json.next_page.offset;
    }
    return out;
  }

  async getSubtasks(taskGid: string): Promise<AsanaTask[]> {
    const out: AsanaTask[] = [];
    let after: string | undefined;
    for (;;) {
      const params = new URLSearchParams({
        opt_fields: TASK_OPT_FIELDS,
        limit: '100',
      });
      if (after) params.set('offset', after);
      const json = await this.req<{
        data: AsanaTask[];
        next_page?: { offset: string } | null;
      }>(`/tasks/${taskGid}/subtasks?${params.toString()}`);
      out.push(...json.data);
      if (!json.next_page) break;
      after = json.next_page.offset;
    }
    return out;
  }

  async getStories(taskGid: string): Promise<AsanaStory[]> {
    const out: AsanaStory[] = [];
    let after: string | undefined;
    for (;;) {
      const params = new URLSearchParams({
        opt_fields: STORY_OPT_FIELDS,
        limit: '100',
      });
      if (after) params.set('offset', after);
      const json = await this.req<{
        data: AsanaStory[];
        next_page?: { offset: string } | null;
      }>(`/tasks/${taskGid}/stories?${params.toString()}`);
      out.push(...json.data);
      if (!json.next_page) break;
      after = json.next_page.offset;
    }
    return out;
  }

  async getAttachments(taskGid: string): Promise<AsanaAttachment[]> {
    const out: AsanaAttachment[] = [];
    let after: string | undefined;
    for (;;) {
      const params = new URLSearchParams({
        opt_fields: ATTACHMENT_OPT_FIELDS,
        parent: taskGid,
        limit: '100',
      });
      if (after) params.set('offset', after);
      const json = await this.req<{
        data: AsanaAttachment[];
        next_page?: { offset: string } | null;
      }>(`/attachments?${params.toString()}`);
      out.push(...json.data);
      if (!json.next_page) break;
      after = json.next_page.offset;
    }
    return out;
  }

  /// Stream the binary content of an attachment. Returns null if the
  /// download URL has expired (Asana download_urls expire in ~1 hour).
  async downloadAttachment(att: AsanaAttachment): Promise<{ buffer: Uint8Array; contentType: string } | null> {
    if (!att.download_url) return null;
    const res = await fetch(att.download_url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return { buffer: buf, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
  }
}

/// Run `fn` on items with bounded concurrency. We're going to do thousands
/// of API calls; sequential would take 30+ min, fully parallel would trip
/// rate limits. 8-12 is a sweet spot for Asana's 150 req/min/IP cap.
export async function parallelMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
        done++;
        if (onProgress && done % 25 === 0) onProgress(done, items.length);
      }
    })
  );
  if (onProgress) onProgress(done, items.length);
  return out;
}
