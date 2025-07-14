'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, Download, ExternalLink, Trash2, Eye, Copy, Clock, HardDrive, Zap, AlertCircle } from 'lucide-react'

interface UploadedFile {
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

interface CDNManagerProps {
  isOpen: boolean
  onClose: () => void
}

export default function CDNManager({ isOpen, onClose }: CDNManagerProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchFiles()
    }
  }, [isOpen])

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/upload')
      const data = await response.json()
      if (response.ok) {
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files?.[0]) {
      setSelectedFile(files[0])
    }
  }

  const uploadFile = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setUploadProgress(0)
    setUploadStatus('Preparing upload...')

    try {
      const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
      const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE)
      
      if (selectedFile.size <= CHUNK_SIZE) {
        // Small file - use regular upload
        setUploadStatus('Uploading...')
        const formData = new FormData()
        formData.append('file', selectedFile)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()
        if (response.ok) {
          setUploadStatus('Upload completed!')
          setSelectedFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          await fetchFiles()
        } else {
          setUploadStatus(`Error: ${data.error}`)
        }
      } else {
        // Large file - use chunked upload
        setUploadStatus(`Uploading in ${totalChunks} chunks...`)
        
        // Initialize upload
        const initResponse = await fetch('/api/upload-chunked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'init',
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            totalChunks
          })
        })
        
        const initData = await initResponse.json()
        if (!initResponse.ok) {
          throw new Error(initData.error)
        }
        
        const uploadId = initData.uploadId
        
        // Upload chunks
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, selectedFile.size)
          const chunk = selectedFile.slice(start, end)
          
          setUploadStatus(`Uploading chunk ${i + 1}/${totalChunks}...`)
          setUploadProgress((i / totalChunks) * 90)
          
          const chunkFormData = new FormData()
          chunkFormData.append('chunk', chunk)
          chunkFormData.append('uploadId', uploadId)
          chunkFormData.append('chunkIndex', i.toString())
          
          const chunkResponse = await fetch('/api/upload-chunked', {
            method: 'POST',
            body: chunkFormData
          })
          
          if (!chunkResponse.ok) {
            throw new Error('Chunk upload failed')
          }
        }
        
        // Complete upload
        setUploadStatus('Finalizing upload...')
        setUploadProgress(95)
        
        const completeResponse = await fetch('/api/upload-chunked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            uploadId,
            originalName: selectedFile.name,
            mimeType: selectedFile.type,
            totalSize: selectedFile.size
          })
        })
        
        const completeData = await completeResponse.json()
        if (completeResponse.ok) {
          setUploadStatus('Large file uploaded successfully!')
          setSelectedFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          await fetchFiles()
        } else {
          throw new Error(completeData.error)
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        setUploadProgress(0)
        if (!uploadStatus.includes('successfully')) {
          setUploadStatus('')
        }
      }, 3000)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch(`/api/upload?id=${fileId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchFiles()
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatTimeRemaining = (expiryDate: string) => {
    const now = new Date()
    const expiry = new Date(expiryDate)
    const diff = expiry.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) {
      return `${days}d ${hours}h`
    } else if (hours > 0) {
      return `${hours}h`
    } else {
      return 'Expires soon'
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('video/')) {
      return '🎥'
    } else if (mimeType.startsWith('image/')) {
      return '🖼️'
    } else if (mimeType.startsWith('audio/')) {
      return '🎵'
    } else {
      return '📄'
    }
  }

  const getViewUrl = (file: UploadedFile) => {
    if (file.mimeType.startsWith('video/')) {
      return `/player/${file.id}`
    } else {
      return `/api/files/${file.fileName}`
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <HardDrive className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold">CDN File Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
          {/* Upload Section */}
          <div className="lg:w-1/3 space-y-4">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Upload File</span>
            </h3>
            
            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-900/20' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300 mb-2">
                Drop file here or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-500">Up to 2GB via chunked upload • Auto-expires in 14 days</p>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="*/*"
              />
            </div>

            {/* Selected File */}
            {selectedFile && (
              <div className="bg-gray-700 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type}
                </div>
                
                {isLoading && (
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                
                <button
                  onClick={uploadFile}
                  disabled={isLoading}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Upload Status */}
            {uploadStatus && (
              <div className={`p-3 rounded ${
                uploadStatus.startsWith('Error') 
                  ? 'bg-red-900/50 border border-red-700' 
                  : 'bg-green-900/50 border border-green-700'
              }`}>
                <p className="text-sm">{uploadStatus}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900/30 border border-blue-700 rounded p-4 space-y-2">
              <div className="flex items-center space-x-2 text-blue-300">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">CDN Features</span>
              </div>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>• Auto-compression for large files</li>
                <li>• 14-day auto-deletion</li>
                <li>• Direct link sharing</li>
                <li>• Custom video player</li>
                <li>• Discord embed support</li>
              </ul>
            </div>
          </div>

          {/* Files List */}
          <div className="lg:w-2/3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Uploaded Files ({files.length})
              </h3>
              <button
                onClick={fetchFiles}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {files.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No files uploaded yet</p>
                </div>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="bg-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate">{file.originalName}</h4>
                          <div className="flex items-center space-x-4 text-xs text-gray-400">
                            <span>{formatFileSize(file.size)}</span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimeRemaining(file.expiryDate)}</span>
                            </span>
                            {file.compressed && (
                              <span className="flex items-center space-x-1 text-green-400">
                                <Zap className="w-3 h-3" />
                                <span>-{file.compressionRatio}%</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* File Actions */}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={getViewUrl(file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </a>
                      
                      <a
                        href={`/api/files/${file.fileName}`}
                        download={file.originalName}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                      
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/api/files/${file.fileName}`)}
                        className="flex items-center space-x-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Link</span>
                      </button>
                      
                      {file.mimeType.startsWith('video/') && (
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/player/${file.id}`)}
                          className="flex items-center space-x-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Player Link</span>
                        </button>
                      )}
                      
                      {file.githubUrl && (
                        <a
                          href={file.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-600"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>GitHub</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
