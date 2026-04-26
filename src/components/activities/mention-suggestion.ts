import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { MentionList, type MentionListRef } from './mention-list';
import { searchUsersForMention } from '@/lib/activities/mutations';

type MentionItem = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export const suggestion: Omit<SuggestionOptions<MentionItem>, 'editor'> = {
  char: '@',
  items: async ({ query }) => {
    try {
      const users = await searchUsersForMention(query);
      return users as MentionItem[];
    } catch {
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate: (props) => {
        component?.updateProps(props);
        if (!props.clientRect) return;
        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
        component = null;
        popup = null;
      },
    };
  },
};
