import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect, useRef } from 'react';
import { MarkButton } from './tiptap-ui/mark-button';
import '../styles/RichTextEditor.css';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  userId: string;
  comicId: string;
  sitePageId: string;
}

export function RichTextEditor({ content, onChange, userId, comicId, sitePageId }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 hover:text-indigo-700 underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded',
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

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('userId', userId);
    formData.append('comicId', comicId);
    formData.append('sitePageId', sitePageId);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      editor?.chain().focus().setImage({ src: data.url }).run();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    }
  };

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
            fileInputRef.current?.click();
          }}
          className="px-2 py-1 text-sm rounded bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file);
            }
            e.target.value = '';
          }}
        />
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
