'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Image as ImageIcon, Play, Calendar, Clock, Eye, X, Wifi, WifiOff } from 'lucide-react'
import { League_Spartan } from 'next/font/google'
import ImageLightbox from './ImageLightbox'
import { useGalleryItems } from '@/utils/supabaseStorage'
import { isSupabaseConfigured } from '@/utils/supabase'

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-league-spartan',
})

type UserRole = 'viewer' | 'admin' | 'super-admin'

interface GalleryItem {
  id: string
  type: 'image' | 'video'
  url: string
  title: string
  description: string
  addedBy: UserRole | string
  addedAt: string
  thumbnailUrl?: string
}

interface GalleryProps {
  userRole: UserRole
}

export default function Gallery({ userRole }: GalleryProps) {
  const { items, isLoading, error, saveItem, deleteItem } = useGalleryItems()
  const [isSupabaseEnabled] = useState(isSupabaseConfigured())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState({
    type: 'image' as 'image' | 'video',
    url: '',
    title: '',
    description: ''
  })
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

  // Function to extract YouTube video ID
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

  // Function to get YouTube thumbnail
  const getYouTubeThumbnail = (videoId: string): string => {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  }

  const handleAddItem = async () => {
    if (!newItem.url.trim() || !newItem.title.trim()) return

    let processedItem = { ...newItem }
    let thumbnailUrl = ''

    // If it's a video URL, check if it's YouTube and get thumbnail
    if (newItem.type === 'video') {
      const videoId = getYouTubeVideoId(newItem.url)
      if (videoId) {
        thumbnailUrl = getYouTubeThumbnail(videoId)
      }
    }

    const galleryItem: GalleryItem = {
      id: Date.now().toString(),
      ...processedItem,
      thumbnailUrl,
      addedBy: userRole,
      addedAt: new Date().toISOString()
    }

    // Save using supabase storage
    await saveItem(galleryItem)
    
    // Reset form
    setNewItem({
      type: 'image',
      url: '',
      title: '',
      description: ''
    })
    setShowAddForm(false)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (userRole !== 'admin' && userRole !== 'super-admin') return
    
    // Delete using supabase storage
    await deleteItem(itemId)
  }

  const openImageLightbox = (imageUrl: string) => {
    const imageItems = items.filter(item => item.type === 'image')
    const imageUrls = imageItems.map(item => item.url)
    const currentIndex = imageUrls.findIndex(url => url === imageUrl)
    
    setLightboxImages(imageUrls)
    setLightboxIndex(currentIndex >= 0 ? currentIndex : 0)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
  }

  const openVideoModal = (videoId: string) => {
    setSelectedVideo(videoId)
  }

  const closeVideoModal = () => {
    setSelectedVideo(null)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gray-900 text-white flex items-center justify-center ${leagueSpartan.className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Gallery...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white p-4 md:p-6 ${leagueSpartan.className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Gallery</h1>
              <p className="text-gray-400">Image and video collection</p>
            </div>
            
            {(userRole === 'admin' || userRole === 'super-admin') && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            )}
          </div>

          {/* Storage Status */}
          <div className="flex items-center space-x-6 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <ImageIcon className="w-4 h-4" />
              <span>{items.filter(item => item.type === 'image').length} Images</span>
            </div>
            <div className="flex items-center space-x-1">
              <Play className="w-4 h-4" />
              <span>{items.filter(item => item.type === 'video').length} Videos</span>
            </div>
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{items.length} Total Items</span>
            </div>
            <div className="flex items-center space-x-1">
              {isSupabaseEnabled ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Shared Storage</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400">Local Only</span>
                </>
              )}
            </div>
          </div>

          {/* Storage Notice */}
          <div className={`mt-4 p-3 rounded-lg ${
            isSupabaseEnabled 
              ? 'bg-green-950/30 border border-green-500/30' 
              : 'bg-yellow-950/30 border border-yellow-500/30'
          }`}>
            <div className="flex items-start space-x-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                isSupabaseEnabled ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                {isSupabaseEnabled ? (
                  <Wifi className="w-3 h-3 text-white" />
                ) : (
                  <WifiOff className="w-3 h-3 text-white" />
                )}
              </div>
              <div className={`text-sm ${
                isSupabaseEnabled ? 'text-green-200' : 'text-yellow-200'
              }`}>
                {isSupabaseEnabled ? (
                  <>
                    <span className="font-medium">Shared Storage Active:</span> All users can see and access the same gallery items. 
                    Changes are synchronized in real-time.
                  </>
                ) : (
                  <>
                    <span className="font-medium">Local Storage Only:</span> Gallery items are stored locally in your browser. 
                    Each user will only see items they've added. Consider setting up Supabase for shared storage.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Add Item Form */}
        {showAddForm && (userRole === 'admin' || userRole === 'super-admin') && (
          <div className="mb-8 p-6 bg-gray-800 rounded-lg border border-gray-700 animate-fade-in-up">
            <h3 className="text-lg font-medium text-white mb-4">Add New Item</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'image' | 'video' })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="image">Image</option>
                  <option value="video">Video (YouTube)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="Enter title..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {newItem.type === 'image' ? 'Image URL' : 'YouTube URL'}
              </label>
              <input
                type="url"
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                placeholder={newItem.type === 'image' ? 'https://example.com/image.jpg' : 'https://youtube.com/watch?v=...'}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Enter description..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleAddItem}
                disabled={!newItem.url.trim() || !newItem.title.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Item
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => {
              const { date, time } = formatDate(item.addedAt)
              const videoId = item.type === 'video' ? getYouTubeVideoId(item.url) : null

              return (
                <div
                  key={item.id}
                  className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-purple-500/25 animate-fade-in group"
                >
                  {/* Media Preview */}
                  <div className="relative aspect-video bg-gray-900 overflow-hidden">
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.title}
                        className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-300"
                        onClick={() => openImageLightbox(item.url)}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : videoId ? (
                      <div
                        className="relative w-full h-full cursor-pointer group"
                        onClick={() => openVideoModal(videoId)}
                      >
                        <img
                          src={item.thumbnailUrl || getYouTubeThumbnail(videoId)}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all duration-300">
                          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                            <Play className="w-8 h-8 text-white ml-1" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-12 h-12 text-gray-500" />
                      </div>
                    )}
                    
                    {/* Error placeholder (hidden by default) */}
                    <div className="hidden w-full h-full bg-gray-800" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon className="w-12 h-12 text-gray-500 mb-2" />
                      <p className="text-gray-400 text-sm">Failed to load</p>
                    </div>

                    {/* Delete button for admins */}
                    {(userRole === 'admin' || userRole === 'super-admin') && (
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all duration-300 opacity-0 group-hover:opacity-100 z-10 shadow-lg"
                        title="Delete item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    {/* Type indicator */}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-70 rounded-full text-xs text-white flex items-center space-x-1">
                      {item.type === 'image' ? (
                        <ImageIcon className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      <span className="capitalize">{item.type}</span>
                    </div>
                  </div>

                  {/* Item Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-white mb-1 truncate">{item.title}</h3>
                    {item.description && (
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{item.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{time}</span>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">By {item.addedBy}</span>
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        item.addedBy === 'admin' 
                          ? 'bg-purple-900 text-purple-200' 
                          : 'bg-blue-900 text-blue-200'
                      }`}>
                        {item.addedBy}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-16">
            <div className="relative">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50 animate-pulse" />
              <div className="absolute inset-0 w-16 h-16 mx-auto animate-ping">
                <ImageIcon className="w-16 h-16 opacity-20" />
              </div>
            </div>
            <h2 className="text-xl font-medium mb-2 text-gray-300">No items in gallery</h2>
            <p className="mb-4 text-gray-400">
              {(userRole === 'admin' || userRole === 'super-admin')
                ? 'Start building your gallery by adding images and videos'
                : 'The gallery is empty. Check back later for new content!'
              }
            </p>
            {(userRole === 'admin' || userRole === 'super-admin') && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25"
              >
                Add First Item
              </button>
            )}
          </div>
        )}
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4" onClick={closeVideoModal}>
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeVideoModal}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}

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
