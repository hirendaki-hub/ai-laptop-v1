import React from 'react';
import { ExternalLink, Clock } from 'lucide-react';

interface EvidenceBadgeProps {
  timestamp?: string | null;
  youtubeUrl?: string;
  youtubeVideoId?: string;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  timestamp,
  youtubeUrl,
  youtubeVideoId,
}) => {
  if (!timestamp) {
    return (
      <span className="font-mono text-[10px] text-neutral-400 italic">
        —
      </span>
    );
  }

  // Construct direct timestamp link if video info exists
  let linkUrl: string | null = null;
  const videoId =
    youtubeVideoId || (youtubeUrl ? new URL(youtubeUrl).searchParams.get('v') : null);

  if (videoId && timestamp) {
    // Parse timestamp (e.g., 04:15 or 255)
    let seconds = 0;
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (!isNaN(Number(timestamp))) {
      seconds = Number(timestamp);
    }
    if (seconds > 0) {
      linkUrl = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
    }
  }

  return (
    <div className="inline-flex items-center space-x-1">
      {linkUrl ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open review at timestamp ${timestamp}`}
          className="inline-flex items-center space-x-1 px-1.5 py-0.5 font-mono text-[11px] bg-[#141414] text-white hover:bg-[#F27D26] transition-colors"
        >
          <Clock className="w-3 h-3" />
          <span>{timestamp}</span>
          <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
        </a>
      ) : (
        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 font-mono text-[11px] bg-neutral-200 text-neutral-800">
          <Clock className="w-3 h-3 text-neutral-600" />
          <span>{timestamp}</span>
        </span>
      )}
    </div>
  );
};
