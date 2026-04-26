'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import { suggestion } from './mention-suggestion';
import { cn } from '@/lib/utils';

type Props = {
  value?: JSONContent | null;
  onChange: (json: JSONContent, text: string) => void;
  placeholder?: string;
  className?: string;
  disableMentions?: boolean;
};

export function ActivityEditor({
  value,
  onChange,
  placeholder,
  className,
  disableMentions,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-sysde-red underline underline-offset-2' },
      }),
      ...(disableMentions
        ? []
        : [
            Mention.configure({
              HTMLAttributes: {
                class:
                  'inline-flex items-center rounded-full bg-sysde-red-light px-2 py-0.5 text-sm font-medium text-sysde-red',
              },
              suggestion,
              renderHTML: ({ options, node }) =>
                `${options.suggestion.char}${
                  node.attrs.label ?? node.attrs.id
                }`,
            } as unknown as Parameters<typeof Mention.configure>[0]),
          ]),
    ],
    content: value ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none min-h-[80px] rounded-lg border border-sysde-border bg-white p-3 text-sm text-sysde-gray',
          '[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const text = editor.getText();
      onChange(json, text);
    },
    immediatelyRender: false,
  });

  // Sync external value updates (e.g., when switching templates)
  useEffect(() => {
    if (!editor) return;
    if (!value) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {placeholder && editor?.isEmpty && (
        <span className="pointer-events-none absolute left-4 top-4 text-sm text-sysde-mid">
          {placeholder}
        </span>
      )}
    </div>
  );
}
