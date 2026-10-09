import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface CommentAnchor {
  id: number;
  anchorFrom: number;
  anchorTo: number;
  quotedText: string;
}

export interface ResolvedCommentRange {
  id: number;
  from: number;
  to: number;
}

export const commentHighlightsKey = new PluginKey<DecorationSet>('commentHighlights');

// Text between two positions, joined the same way when the comment is created and when it is located again
export function textBetween(doc: ProseMirrorNode, from: number, to: number): string {
  return doc.textBetween(from, to, ' ');
}

// Find where a comment sits in the current document. The saved positions are tried first; if the
// content has changed since, the quoted text is searched for inside a single paragraph.
export function locateComment(doc: ProseMirrorNode, comment: CommentAnchor): ResolvedCommentRange | null {
  const max = doc.content.size;
  if (comment.anchorFrom < comment.anchorTo && comment.anchorTo <= max &&
      textBetween(doc, comment.anchorFrom, comment.anchorTo) === comment.quotedText) {
    return { id: comment.id, from: comment.anchorFrom, to: comment.anchorTo };
  }

  let found: ResolvedCommentRange | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isTextblock) return true;
    const index = node.textContent.indexOf(comment.quotedText);
    if (index === -1) return false;
    // Map the character index inside the block back to a document position
    let offset = 0;
    node.forEach((child, childOffset) => {
      if (found || !child.isText) {
        offset += child.isText ? child.text!.length : 0;
        return;
      }
      const length = child.text!.length;
      if (index >= offset && index < offset + length) {
        const from = pos + 1 + childOffset + (index - offset);
        found = { id: comment.id, from, to: from + comment.quotedText.length };
      }
      offset += length;
    });
    return false;
  });
  return found;
}

export interface CommentHighlightsOptions {
  onCommentClick: { current: ((id: number) => void) | undefined };
}

// Draws comment highlights as decorations, so commenting never changes the document content
export const CommentHighlights = Extension.create<CommentHighlightsOptions>({
  name: 'commentHighlights',

  addOptions() {
    return { onCommentClick: { current: undefined } };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<DecorationSet>({
        key: commentHighlightsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(commentHighlightsKey) as { ranges: ResolvedCommentRange[]; activeId?: number | null } | undefined;
            if (meta) {
              return DecorationSet.create(tr.doc, meta.ranges.map(r =>
                Decoration.inline(r.from, r.to, {
                  class: r.id === meta.activeId ? 'doc-comment-highlight doc-comment-active' : 'doc-comment-highlight',
                  'data-comment-id': String(r.id),
                }, { commentId: r.id })
              ));
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return commentHighlightsKey.getState(state);
          },
          handleClick(view, pos) {
            const set = commentHighlightsKey.getState(view.state);
            const hit = set?.find(pos, pos)[0];
            if (hit) {
              options.onCommentClick.current?.(hit.spec.commentId);
            }
            return false;
          },
        },
      }),
    ];
  },
});
