import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }): Promise<Metadata> {
  const { videoId } = await params
  
  // Try to fetch video info for better metadata
  let videoTitle = 'Video'
  let videoDescription = 'Watch this video on Dorps Wiki CDN'
  
  try {
    // Note: This would run on the server, so we need to construct the full URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/upload`)
    const data = await response.json()
    
    if (response.ok && data.files) {
      const file = data.files.find((f: any) => f.id === videoId)
      if (file) {
        videoTitle = file.originalName
        videoDescription = `${file.originalName} - Uploaded to Dorps Wiki CDN`
      }
    }
  } catch (error) {
    console.log('Could not fetch video metadata for Open Graph')
  }
  
  const videoUrl = `/api/files/${videoId}`
  const playerUrl = `/player/${videoId}`
  
  return {
    title: `${videoTitle} - Dorps Wiki CDN`,
    description: videoDescription,
    openGraph: {
      title: videoTitle,
      description: videoDescription,
      type: 'video.other',
      url: playerUrl,
      videos: [
        {
          url: videoUrl,
          width: 1920,
          height: 1080,
        }
      ],
      siteName: 'Dorps Wiki CDN',
    },
    twitter: {
      card: 'player',
      title: videoTitle,
      description: videoDescription,
      players: [
        {
          playerUrl: playerUrl,
          streamUrl: videoUrl,
          width: 1920,
          height: 1080,
        }
      ],
    },
    other: {
      'og:video:type': 'video/mp4',
      'og:video:width': '1920',
      'og:video:height': '1080',
    }
  }
}

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
