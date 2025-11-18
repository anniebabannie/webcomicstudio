import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import { MarkButton } from './tiptap-ui/mark-button';
import '../styles/RichTextEditor.css';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 hover:text-indigo-700 underline',
        },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none p-4 min-h-[400px] focus:outline-none',
      },
    },
  });

  // Update editor content when prop changes (e.g., on form reset)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <MarkButton type="bold" editor={editor} className="mark-button-custom" />
        <MarkButton type="italic" editor={editor} className="mark-button-custom" />
        <MarkButton type="strike" editor={editor} className="mark-button-custom" />
        <div className="w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 1 }).run();
          }}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('heading', { level: 1 }) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          H1
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('heading', { level: 2 }) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          H2
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('heading', { level: 3 }) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          H3
        </button>
        <div className="w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Bullet List
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('orderedList') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Numbered List
        </button>
        <div className="w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = window.prompt('Enter URL:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('link') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Link
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().unsetLink().run();
          }}
          disabled={!editor.isActive('link')}
          className="px-2 py-1 text-sm rounded bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Unlink
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
