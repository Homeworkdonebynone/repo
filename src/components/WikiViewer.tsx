'use client'

import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Edit, Trash2, Shield } from 'lucide-react'
import { League_Spartan } from 'next/font/google'
import ImageLightbox from './ImageLightbox'
import { isPageInvincible } from '@/utils/activityLogger'

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-league-spartan',
})

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

interface WikiViewerProps {
  page: WikiPage
  categories: Category[]
  onEdit: () => void
  onDelete: () => void
  userRole: UserRole
}

export default function WikiViewer({ page, categories, onEdit, onDelete, userRole }: WikiViewerProps) {
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [pageIsInvincible, setPageIsInvincible] = useState(false)

  // Check if page is invincible on mount
  useEffect(() => {
    const checkInvincible = async () => {
      try {
        const invincible = await isPageInvincible(page.id)
        setPageIsInvincible(invincible)
      } catch (error) {
        console.error('Error checking page invincibility:', error)
        setPageIsInvincible(false)
      }
    }
    checkInvincible()
  }, [page.id])

  const openLightbox = (imageSrc: string) => {
    // Extract all image URLs from the content
    const imageRegex = /!\[.*?\]\((.*?)\)/g
    const images: string[] = []
    let match

    while ((match = imageRegex.exec(page.content)) !== null) {
      images.push(match[1])
    }

    const currentIndex = images.findIndex(img => img === imageSrc)
    setLightboxImages(images)
    setLightboxIndex(currentIndex >= 0 ? currentIndex : 0)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
  }

  // Function to extract YouTube video ID from various YouTube URL formats
  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }
    return null
  }

  // Function to process content and replace YouTube URLs with embedded videos
  const processContentForYouTube = (content: string): string => {
    // Pattern to match standalone YouTube URLs (not already in markdown links)
    const youtubePattern = /(?<![\(\[])(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)(?![\)\]])/g
    
    return content.replace(youtubePattern, (match) => {
      const videoId = getYouTubeVideoId(match)
      if (videoId) {
        // Replace with a special marker that we'll handle in the paragraph component
        return `[YOUTUBE:${videoId}]`
      }
      return match
    })
  }

  // Function to render YouTube embed
  const renderYouTubeEmbed = (videoId: string) => {
    return (
      <div className="relative w-full h-0 pb-[56.25%] my-6 rounded-lg overflow-hidden shadow-lg bg-gray-800">
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  const processedContent = processContentForYouTube(page.content)
  return (
    <div className={`h-full overflow-y-auto bg-gray-900 text-white ${leagueSpartan.className}`}>
      <div className="max-w-4xl mx-auto p-4 md:p-8 overflow-x-hidden">
        {/* Header with title and actions */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 space-y-4 sm:space-y-0 max-w-full overflow-x-hidden">
          <div className="flex-1 min-w-0 max-w-full overflow-x-hidden">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white break-words max-w-full">{page.title}</h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-400 max-w-full overflow-x-hidden">
              <span className="break-words max-w-full">
                Last modified: {new Date(page.lastModified).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {/* Category badge */}
              {(() => {
                const category = categories.find(c => c.id === page.category)
                return category ? (
                  <div className="flex items-center space-x-1 max-w-full overflow-x-hidden">
                    <div 
                      className="w-2 h-2 md:w-3 md:h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-xs md:text-sm break-words max-w-full">{category.name}</span>
                  </div>
                ) : null
              })()}
              <span className="break-words max-w-full">Created by: {page.createdBy}</span>
            </div>
          </div>
          
          {/* Action buttons (only for admin and super-admin) */}
          {(userRole === 'admin' || userRole === 'super-admin') && (
            <div className="flex items-center space-x-2 flex-shrink-0">
              {pageIsInvincible && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-green-900/50 text-green-300 rounded-lg text-xs">
                  <Shield className="w-3 h-3" />
                  <span className="hidden sm:inline">Protected</span>
                </div>
              )}
              <button
                onClick={onEdit}
                className="flex items-center space-x-1 px-2 md:px-3 py-1.5 md:py-2 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-lg transition-colors text-sm"
              >
                <Edit className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={onDelete}
                className={`flex items-center space-x-1 px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors text-sm ${
                  pageIsInvincible && userRole !== 'super-admin'
                    ? 'text-gray-500 cursor-not-allowed opacity-50' 
                    : 'text-gray-400 hover:text-red-400 hover:bg-gray-800'
                }`}
                disabled={pageIsInvincible && userRole !== 'super-admin'}
                title={
                  pageIsInvincible && userRole !== 'super-admin'
                    ? 'This page is protected and can only be deleted by super admins' 
                    : 'Delete page'
                }
              >
                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          )}
        </div>
        
        <div className="wiki-content max-w-full overflow-x-hidden box-border">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl md:text-3xl font-bold text-purple-400 mb-4 md:mb-6 mt-6 md:mt-8 first:mt-0 break-words">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl md:text-2xl font-semibold text-purple-300 mb-3 md:mb-4 mt-6 md:mt-8 break-words">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg md:text-xl font-medium text-purple-200 mb-2 md:mb-3 mt-4 md:mt-6 break-words">
                  {children}
                </h3>
              ),
              p: ({ children }) => {
                // Check if this paragraph contains YouTube markers
                const textContent = React.Children.toArray(children).join('')
                const youtubeMatch = textContent.match(/\[YOUTUBE:([^\]]+)\]/)
                
                if (youtubeMatch) {
                  const videoId = youtubeMatch[1]
                  return renderYouTubeEmbed(videoId)
                }
                
                return (
                  <p className="text-sm md:text-base text-gray-300 mb-3 md:mb-4 leading-relaxed break-words">
                    {children}
                  </p>
                )
              },
              ul: ({ children }) => (
                <ul className="text-sm md:text-base text-gray-300 mb-3 md:mb-4 pl-4 md:pl-6 space-y-1 md:space-y-2">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="text-sm md:text-base text-gray-300 mb-3 md:mb-4 pl-4 md:pl-6 space-y-1 md:space-y-2 list-decimal">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="mb-1">
                  {children}
                </li>
              ),
              blockquote: ({ children }) => {
                // Convert children to string to check for callouts
                const textContent = React.Children.toArray(children)
                  .map(child => {
                    if (typeof child === 'string') return child
                    if (React.isValidElement(child) && child.props.children) {
                      if (typeof child.props.children === 'string') {
                        return child.props.children
                      }
                      if (Array.isArray(child.props.children)) {
                        return child.props.children.join('')
                      }
                    }
                    return ''
                  })
                  .join('')
                  .trim()
                
                // Check for GitHub-style callouts
                if (textContent.startsWith('[!NOTE]')) {
                  return (
                    <div className="border-l-4 border-blue-500 bg-blue-950/30 p-4 rounded-r-lg mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">ℹ</span>
                        </div>
                        <span className="font-semibold text-blue-300">Note</span>
                      </div>
                      <div className="text-gray-300">{textContent.replace('[!NOTE]', '').trim()}</div>
                    </div>
                  )
                }
                
                if (textContent.startsWith('[!WARNING]')) {
                  return (
                    <div className="border-l-4 border-yellow-500 bg-yellow-950/30 p-4 rounded-r-lg mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center mr-2">
                          <span className="text-black text-xs font-bold">⚠</span>
                        </div>
                        <span className="font-semibold text-yellow-300">Warning</span>
                      </div>
                      <div className="text-gray-300">{textContent.replace('[!WARNING]', '').trim()}</div>
                    </div>
                  )
                }
                
                if (textContent.startsWith('[!INFO]')) {
                  return (
                    <div className="border-l-4 border-cyan-500 bg-cyan-950/30 p-4 rounded-r-lg mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">ℹ</span>
                        </div>
                        <span className="font-semibold text-cyan-300">Info</span>
                      </div>
                      <div className="text-gray-300">{textContent.replace('[!INFO]', '').trim()}</div>
                    </div>
                  )
                }
                
                if (textContent.startsWith('[!TIP]')) {
                  return (
                    <div className="border-l-4 border-green-500 bg-green-950/30 p-4 rounded-r-lg mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">💡</span>
                        </div>
                        <span className="font-semibold text-green-300">Tip</span>
                      </div>
                      <div className="text-gray-300">{textContent.replace('[!TIP]', '').trim()}</div>
                    </div>
                  )
                }
                
                if (textContent.startsWith('[!IMPORTANT]')) {
                  return (
                    <div className="border-l-4 border-purple-500 bg-purple-950/30 p-4 rounded-r-lg mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                        <span className="font-semibold text-purple-300">Important</span>
                      </div>
                      <div className="text-gray-300">{textContent.replace('[!IMPORTANT]', '').trim()}</div>
                    </div>
                  )
                }
                
                if (textContent.startsWith('[!CAUTION]')) {
                  return (
                    <div className="border-l-4 border-red-500 bg-red-950/30 p-4 rounded-r-lg mb-4">
                      <div className="flex items-center mb-2">
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">🔥</span>
                        </div>
                        <span className="font-semibold text-red-300">Caution</span>
                      </div>
                      <div className="text-gray-300">{textContent.replace('[!CAUTION]', '').trim()}</div>
                    </div>
                  )
                }
                
                // Default blockquote
                return (
                  <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-400 mb-4">
                    {children}
                  </blockquote>
                )
              },
              code: ({ children }) => (
                <code className="bg-gray-800 text-purple-300 px-2 py-1 rounded text-sm">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto mb-4">
                  {children}
                </pre>
              ),
              img: ({ src, alt }) => (
                src && src.trim() ? (
                  <img 
                    src={src} 
                    alt={alt} 
                    className="rounded-lg shadow-lg my-6 max-w-full hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => openLightbox(src)}
                  />
                ) : (
                  <div className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 my-6 text-center">
                    <span className="text-gray-400 text-sm">Image URL missing</span>
                    {alt && <p className="text-gray-500 text-xs mt-1">{alt}</p>}
                  </div>
                )
              ),
              a: ({ href, children }) => {
                // Check if this is a YouTube link
                if (href) {
                  const videoId = getYouTubeVideoId(href)
                  if (videoId) {
                    return renderYouTubeEmbed(videoId)
                  }
                }
                
                // Default link behavior
                return (
                  <a 
                    href={href} 
                    className="text-purple-400 hover:text-purple-300 underline transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                )
              },
              strong: ({ children }) => (
                <strong className="font-bold text-purple-200">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic text-purple-200">
                  {children}
                </em>
              ),
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={closeLightbox}
      />
    </div>
  )
}
