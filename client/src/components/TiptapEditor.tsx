import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Plus,
  Minus,
  Trash2,
  RowsIcon,
  ColumnsIcon,
  Eye,
  Type,
  Wand2,
  SpellCheck,
  Loader2,
  Merge,
  Split,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onPreview?: () => void;
  onAISuggestionsChange?: (suggestions: AISuggestion[]) => void;
}

export interface AISuggestion {
  id: string;
  original: string;
  suggestion: string;
  reason: string;
  applied: boolean;
}

export default function TiptapEditor({ content, onChange, onPreview, onAISuggestionsChange }: TiptapEditorProps) {
  const { toast } = useToast();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState('400');
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');
  const [isRewriting, setIsRewriting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [showRewriteDialog, setShowRewriteDialog] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      TextStyle,
      Underline.configure({
        HTMLAttributes: {
          class: 'underline',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-100 p-2 font-bold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      TextAlign.configure({
        types: ['paragraph', 'heading'],
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none',
        style: 'font-family: Roboto, sans-serif;',
        spellcheck: 'true',
      },
    },
  });

  const handleRewriteWithAI = useCallback(async () => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    
    if (!text.trim()) {
      toast({
        title: "No text selected",
        description: "Please select some text to rewrite",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedText(text);
    setIsRewriting(true);
    setShowRewriteDialog(true);
    
    try {
      const response = await apiRequest('POST', '/api/ai/rewrite', { text });
      const data = await response.json();
      
      setRewrittenText(data.rewritten);
    } catch (error) {
      toast({
        title: "AI Rewrite Failed",
        description: "Could not rewrite the text. Please try again.",
        variant: "destructive",
      });
      setShowRewriteDialog(false);
    } finally {
      setIsRewriting(false);
    }
  }, [editor, toast]);

  const applyRewrittenText = useCallback(() => {
    if (!editor || !rewrittenText) return;
    
    editor.chain().focus().insertContent(rewrittenText).run();
    setShowRewriteDialog(false);
    setRewrittenText('');
    setSelectedText('');
    
    toast({
      title: "Text Replaced",
      description: "The text has been rewritten with improved grammar.",
    });
  }, [editor, rewrittenText, toast]);

  const checkSpelling = useCallback(() => {
    toast({
      title: "Spell Check",
      description: "Browser spell-check is enabled. Misspelled words are underlined in red.",
    });
  }, [toast]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);


  const addLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    setLinkUrl('');
    setShowLinkDialog(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    const width = parseInt(imageWidth) || 400;
    editor.chain().focus().setImage({ 
      src: imageUrl,
      alt: 'Document image',
    }).run();
    setTimeout(() => {
      const images = editor.view.dom.querySelectorAll('img');
      const lastImage = images[images.length - 1] as HTMLImageElement;
      if (lastImage) {
        lastImage.style.width = `${width}px`;
        lastImage.style.cursor = 'nwse-resize';
      }
    }, 100);
    setImageUrl('');
    setImageWidth('400');
    setShowImageDialog(false);
  }, [editor, imageUrl, imageWidth]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    const rows = parseInt(tableRows) || 3;
    const cols = parseInt(tableCols) || 3;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setTableRows('3');
    setTableCols('3');
    setShowTableDialog(false);
  }, [editor, tableRows, tableCols]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PNG and JPEG images are allowed');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  if (!editor) return null;

  return (
    <div className="border rounded-md flex flex-col">
      <div className="bg-gray-50 border-b p-2 flex flex-wrap items-center gap-1 flex-shrink-0">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          data-testid="button-undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          data-testid="button-redo"
        >
          <Redo className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          type="button"
          size="icon"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-testid="button-bold"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-testid="button-italic"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          data-testid="button-underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          data-testid="button-strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          type="button"
          size="icon"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-testid="button-bullet-list"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-testid="button-numbered-list"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          type="button"
          size="icon"
          variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          data-testid="button-align-left"
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          data-testid="button-align-center"
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          data-testid="button-align-right"
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          type="button"
          size="icon"
          variant={editor.isActive('link') ? 'secondary' : 'ghost'}
          onClick={() => setShowLinkDialog(true)}
          data-testid="button-link"
        >
          <LinkIcon className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setShowImageDialog(true)}
          data-testid="button-image"
        >
          <ImageIcon className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setShowTableDialog(true)}
          data-testid="button-table"
        >
          <TableIcon className="w-4 h-4" />
        </Button>

        {editor.isActive('table') && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              title="Add row above"
              data-testid="button-add-row-before"
            >
              <Plus className="w-3 h-3" />
              <RowsIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="Add row below"
              data-testid="button-add-row-after"
            >
              <RowsIcon className="w-3 h-3" />
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().deleteRow().run()}
              title="Delete row"
              data-testid="button-delete-row"
            >
              <Minus className="w-3 h-3" />
              <RowsIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              title="Add column left"
              data-testid="button-add-col-before"
            >
              <Plus className="w-3 h-3" />
              <ColumnsIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="Add column right"
              data-testid="button-add-col-after"
            >
              <ColumnsIcon className="w-3 h-3" />
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              title="Delete column"
              data-testid="button-delete-col"
            >
              <Minus className="w-3 h-3" />
              <ColumnsIcon className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().mergeCells().run()}
              title="Merge cells"
              data-testid="button-merge-cells"
            >
              Merge
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().splitCell().run()}
              title="Split cell"
              data-testid="button-split-cell"
            >
              Split
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="Delete table"
              data-testid="button-delete-table"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </>
        )}

        {onPreview && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onPreview}
              data-testid="button-preview"
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
          </>
        )}
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="max-h-[50vh] overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="w-4 h-4 mr-2" />
            Bold
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="w-4 h-4 mr-2" />
            Italic
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-4 h-4 mr-2" />
            Underline
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor?.chain().focus().toggleStrike().run()}>
            <Strikethrough className="w-4 h-4 mr-2" />
            Strikethrough
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <AlignLeft className="w-4 h-4 mr-2" />
              Alignment
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
                <AlignLeft className="w-4 h-4 mr-2" />
                Align Left
              </ContextMenuItem>
              <ContextMenuItem onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
                <AlignCenter className="w-4 h-4 mr-2" />
                Align Center
              </ContextMenuItem>
              <ContextMenuItem onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
                <AlignRight className="w-4 h-4 mr-2" />
                Align Right
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Type className="w-4 h-4 mr-2" />
              Font Size
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => editor?.chain().focus().setMark('textStyle', { fontSize: '12px' }).run()}>
                Small (12px)
              </ContextMenuItem>
              <ContextMenuItem onClick={() => editor?.chain().focus().setMark('textStyle', { fontSize: '14px' }).run()}>
                Normal (14px)
              </ContextMenuItem>
              <ContextMenuItem onClick={() => editor?.chain().focus().setMark('textStyle', { fontSize: '18px' }).run()}>
                Large (18px)
              </ContextMenuItem>
              <ContextMenuItem onClick={() => editor?.chain().focus().setMark('textStyle', { fontSize: '24px' }).run()}>
                Extra Large (24px)
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          
          {editor?.isActive('table') && (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <TableIcon className="w-4 h-4 mr-2" />
                  Table Actions
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48">
                  <ContextMenuItem onClick={() => editor?.chain().focus().addRowBefore().run()}>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Add Row Above
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => editor?.chain().focus().addRowAfter().run()}>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Add Row Below
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => editor?.chain().focus().addColumnBefore().run()}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Add Column Left
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => editor?.chain().focus().addColumnAfter().run()}>
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Add Column Right
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => editor?.chain().focus().mergeCells().run()}>
                    <Merge className="w-4 h-4 mr-2" />
                    Merge Cells
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => editor?.chain().focus().splitCell().run()}>
                    <Split className="w-4 h-4 mr-2" />
                    Split Cell
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => editor?.chain().focus().deleteRow().run()} className="text-red-600">
                    <Minus className="w-4 h-4 mr-2" />
                    Delete Row
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => editor?.chain().focus().deleteColumn().run()} className="text-red-600">
                    <Minus className="w-4 h-4 mr-2" />
                    Delete Column
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => editor?.chain().focus().deleteTable().run()} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Table
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
          
          <ContextMenuSeparator />
          
          <ContextMenuItem onClick={handleRewriteWithAI}>
            <Wand2 className="w-4 h-4 mr-2" />
            Rewrite with AI Grammar
          </ContextMenuItem>
          
          <ContextMenuItem onClick={checkSpelling}>
            <SpellCheck className="w-4 h-4 mr-2" />
            Check Spelling
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                data-testid="input-link-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            <Button onClick={addLink} data-testid="button-insert-link">Insert Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-upload">Upload Image</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleImageUpload}
                data-testid="input-image-upload"
              />
              <p className="text-xs text-muted-foreground mt-1">Only PNG and JPEG images are allowed</p>
            </div>
            <div>
              <Label htmlFor="image-url">Or enter URL</Label>
              <Input
                id="image-url"
                type="url"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                data-testid="input-image-url"
              />
            </div>
            <div>
              <Label htmlFor="image-width">Width (px)</Label>
              <Input
                id="image-width"
                type="number"
                min="50"
                max="800"
                value={imageWidth}
                onChange={(e) => setImageWidth(e.target.value)}
                data-testid="input-image-width"
              />
            </div>
            {imageUrl && (
              <div className="border rounded p-2">
                <img src={imageUrl} alt="Preview" className="max-w-full max-h-32 mx-auto" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImageDialog(false); setImageUrl(''); }}>Cancel</Button>
            <Button onClick={addImage} disabled={!imageUrl} data-testid="button-insert-image">Insert Image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="table-rows">Rows</Label>
                <Input
                  id="table-rows"
                  type="number"
                  min="1"
                  max="20"
                  value={tableRows}
                  onChange={(e) => setTableRows(e.target.value)}
                  data-testid="input-table-rows"
                />
              </div>
              <div>
                <Label htmlFor="table-cols">Columns</Label>
                <Input
                  id="table-cols"
                  type="number"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={(e) => setTableCols(e.target.value)}
                  data-testid="input-table-cols"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>Cancel</Button>
            <Button onClick={insertTable} data-testid="button-insert-table">Insert Table</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRewriteDialog} onOpenChange={setShowRewriteDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              AI Grammar Rewrite
            </DialogTitle>
            <DialogDescription>
              AI will rewrite your selected text with proper English grammar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Original Text</Label>
              <div className="p-3 bg-muted rounded-md text-sm mt-1">
                {selectedText || "No text selected"}
              </div>
            </div>
            <div>
              <Label>Rewritten Text</Label>
              {isRewriting ? (
                <div className="p-3 bg-muted rounded-md flex items-center gap-2 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">AI is rewriting your text...</span>
                </div>
              ) : rewrittenText ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm mt-1">
                  {rewrittenText}
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground mt-1">
                  Waiting for AI response...
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRewriteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={applyRewrittenText} 
              disabled={isRewriting || !rewrittenText}
              data-testid="button-apply-rewrite"
            >
              {isRewriting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Apply Rewrite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .ProseMirror {
          font-family: 'Roboto', sans-serif;
          min-height: 200px;
          padding: 1rem;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .ProseMirror th,
        .ProseMirror td {
          border: 1px solid #d1d5db;
          padding: 0.5rem;
          min-width: 50px;
        }
        .ProseMirror th {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          cursor: pointer;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
        }
        .ProseMirror p {
          margin: 0.5rem 0;
        }
        .ProseMirror .tableWrapper {
          overflow-x: auto;
        }
        .ProseMirror .selectedCell::after {
          background: rgba(200, 200, 255, 0.4);
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror td.selectedCell,
        .ProseMirror th.selectedCell {
          position: relative;
        }
      `}</style>
    </div>
  );
}
