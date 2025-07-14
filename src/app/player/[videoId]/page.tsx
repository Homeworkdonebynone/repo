'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Head from 'next/head'
import { Play, Pause, Volume2, VolumeX, Maximize, Download, ExternalLink } from 'lucide-react'

interface FileInfo {
  id: string
  originalName: string
  fileName: string
  size: number
  mimeType: string
  uploadDate: string
  expiryDate: string
  githubUrl?: string
  compressed?: boolean
  compressionRatio?: number
}

export default function VideoPlayerPage() {
  const params = useParams()
  const videoId = params.videoId as string
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoId) {
      fetchFileInfo()
    }
  }, [videoId])

  const fetchFileInfo = async () => {
    try {
      const response = await fetch('/api/upload')
      const data = await response.json()
      
      if (response.ok) {
        const file = data.files.find((f: FileInfo) => f.id === videoId)
        if (file && file.mimeType.startsWith('video/')) {
          setFileInfo(file)
        } else {
          setError('Video not found or file is not a video')
        }
      } else {
        setError(data.error || 'Failed to load video')
      }
    } catch (error) {
      setError('Failed to load video')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayPause = () => {
    if (videoElement) {
      if (isPlaying) {
        videoElement.pause()
      } else {
        videoElement.play()
      }
    }
  }

  const handleMute = () => {
    if (videoElement) {
      videoElement.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoElement) {
      const time = (parseFloat(e.target.value) / 100) * duration
      videoElement.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value) / 100
    setVolume(newVolume)
    if (videoElement) {
      videoElement.volume = newVolume
    }
  }

  const handleFullscreen = () => {
    if (videoElement) {
      if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen()
      }
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading video...</div>
      </div>
    )
  }

  if (error || !fileInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center flex-col space-y-4">
        <div className="text-red-400 text-xl">{error || 'Video not found'}</div>
        <a href="/" className="text-blue-400 hover:text-blue-300 underline">
          Return to Dorps Wiki
        </a>
      </div>
    )
  }

  const videoUrl = `/api/files/${fileInfo.fileName}`
  const shareUrl = `${window.location.origin}/player/${videoId}`

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Video Player */}
      <div className="relative">
        <video
          ref={setVideoElement}
          src={videoUrl}
          className="w-full h-auto max-h-[80vh] bg-black"
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement
            setDuration(video.duration)
          }}
          onTimeUpdate={(e) => {
            const video = e.target as HTMLVideoElement
            setCurrentTime(video.currentTime)
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls={false}
          onClick={handlePlayPause}
        />
        
        {/* Custom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max="100"
              value={duration ? (currentTime / duration) * 100 : 0}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handlePlayPause}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleMute}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume * 100}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="text-sm text-gray-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleFullscreen}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Video Info */}
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{fileInfo.originalName}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">File Size:</span>
              <span>{formatFileSize(fileInfo.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Upload Date:</span>
              <span>{new Date(fileInfo.uploadDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expires:</span>
              <span>{new Date(fileInfo.expiryDate).toLocaleDateString()}</span>
            </div>
            {fileInfo.compressed && (
              <div className="flex justify-between">
                <span className="text-gray-400">Compression:</span>
                <span className="text-green-400">
                  Reduced by {fileInfo.compressionRatio}%
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex flex-col space-y-2">
              <span className="text-gray-400 text-sm">Share this video:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  title="Copy link"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <a
                href={videoUrl}
                download={fileInfo.originalName}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
              
              {fileInfo.githubUrl && (
                <a
                  href={fileInfo.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>GitHub</span>
                </a>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <a 
            href="/"
            className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300 underline"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Visit Dorps Wiki</span>
          </a>
        </div>
      </div>
      
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}
