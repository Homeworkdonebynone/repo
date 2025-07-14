'use client'

import { useState, useRef } from 'react'
import { Save, X, Upload, Image as ImageIcon, Eye, Edit3, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type UserRole = 'viewer' | 'admin' | 'super-admin'

interface WikiPage {
  id: string
  title: string
  content: string
  lastModified: string
  category: string
  createdBy: UserRole
}

interface Category {
  id: string
  name: string
  color: string
}

interface WikiEditorProps {
  page: WikiPage
  categories: Category[]
  onSave: (page: WikiPage) => void
  onCancel: () => void
}

export default function WikiEditor({ page, categories, onSave, onCancel }: WikiEditorProps) {
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content)
  const [category, setCategory] = useState(page.category)
  const [isDragging, setIsDragging] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = () => {
    const updatedPage: WikiPage = {
      ...page,
      title,
      content,
      category,
      lastModified: new Date().toISOString(),
    }
    onSave(updatedPage)
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string
          const imageMarkdown = `![${file.name}](${imageUrl})\n\n`
          
          // Insert at cursor position
          const textarea = textareaRef.current
          if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const newContent = content.substring(0, start) + imageMarkdown + content.substring(end)
            setContent(newContent)
            
            // Set cursor position after inserted text
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length
              textarea.focus()
            }, 0)
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleImageUpload(e.dataTransfer.files)
  }

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat?.color || '#8B5CF6'
  }

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-gray-900 text-white">
      {/* Editor Header */}
      <div className="p-4 md:p-6 border-b border-gray-700 bg-gray-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl md:text-2xl font-bold bg-transparent border-none outline-none text-white placeholder-gray-400 flex-1 min-w-0"
            placeholder="Page title..."
          />
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors lg:hidden"
              title="Toggle Preview"
            >
              {showPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              title="Upload Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          </div>
        </div>
        
        {/* Category Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-300">Category:</label>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0" 
              style={{ backgroundColor: getCategoryColor(category) }}
            />
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Markdown Editor */}
        <div 
          className={`flex-1 relative ${isDragging ? 'bg-purple-900/20' : ''} ${showPreview ? 'hidden lg:block' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-4 md:p-6 bg-gray-900 border-none outline-none resize-none font-mono text-sm text-white placeholder-gray-400"
            placeholder="Start writing your content here... You can use Markdown syntax!

# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
`Code`

- List item 1
- List item 2

> Quote

[Link](https://example.com)

![Image](image-url)

Drag and drop images here to upload them!"
          />
          
          {isDragging && (
            <div className="absolute inset-0 bg-purple-500/20 border-2 border-dashed border-purple-500 flex items-center justify-center">
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                <p className="text-lg font-medium text-purple-300">Drop images here to upload</p>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className={`flex-1 border-l border-gray-700 overflow-y-auto ${showPreview ? 'block' : 'hidden lg:block'}`}>
          <div className="p-4 md:p-6 bg-gray-900">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-white break-words">{title || 'Untitled'}</h1>
            <div className="prose prose-invert prose-purple max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold text-purple-400 mb-4 mt-6">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold text-purple-300 mb-3 mt-5">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-medium text-purple-200 mb-2 mt-4">{children}</h3>,
                  p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-400 mb-4">{children}</blockquote>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-300">{children}</li>,
                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                  em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                  code: ({ children }) => <code className="bg-gray-700 text-purple-300 px-1 py-0.5 rounded text-sm">{children}</code>,
                  pre: ({ children }) => <pre className="bg-gray-700 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                  a: ({ href, children }) => <a href={href} className="text-purple-400 hover:text-purple-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                  img: ({ src, alt }) => <img src={src} alt={alt} className="rounded-lg shadow-lg my-4 max-w-full h-auto" />
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleImageUpload(e.target.files)}
        className="hidden"
      />
    </div>
  )
}
