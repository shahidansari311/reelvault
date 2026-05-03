/**
 * URL Parser Utility
 * Extracts and classifies Instagram & YouTube URLs from shared text.
 * Handles cases where Instagram/YouTube share text includes extra content
 * alongside the actual URL.
 */

/**
 * Extract a clean URL from shared text.
 * Instagram and YouTube sometimes share text + URL together,
 * e.g. "Check out this reel https://www.instagram.com/reel/ABC123/"
 */
export function extractUrlFromText(text) {
  if (!text) return null;
  const trimmed = text.trim();

  // If the entire text is already a URL, return it
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes(' ')) {
    return trimmed;
  }

  // Pull out the actual URL from mixed text
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = trimmed.match(urlRegex);
  return matches ? matches[0] : trimmed;
}

/**
 * Parse an Instagram URL into its component parts.
 * Returns { type, id, username, url } or null.
 */
export function parseInstagramUrl(url) {
  if (!url) return null;

  // Clean the URL — remove query params and trailing slash
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');

  // Instagram Reel: instagram.com/reel/ABC123 or instagram.com/reels/ABC123
  const reelMatch = cleanUrl.match(/instagram\.com\/reels?\/([A-Za-z0-9_-]+)/);
  if (reelMatch) {
    return {
      type: 'reel',
      id: reelMatch[1],
      username: null,
      url: `https://www.instagram.com/reel/${reelMatch[1]}/`,
    };
  }

  // Instagram Story: instagram.com/stories/USERNAME/STORY_ID
  const storyMatch = cleanUrl.match(
    /instagram\.com\/stories\/([A-Za-z0-9._]+)\/(\d+)/
  );
  if (storyMatch) {
    return {
      type: 'story',
      username: storyMatch[1],
      id: storyMatch[2],
      url: `https://www.instagram.com/stories/${storyMatch[1]}/${storyMatch[2]}/`,
    };
  }

  // Instagram Story (username only, no ID): instagram.com/stories/USERNAME
  const storyUserMatch = cleanUrl.match(
    /instagram\.com\/stories\/([A-Za-z0-9._]+)\/?$/
  );
  if (storyUserMatch) {
    return {
      type: 'story',
      username: storyUserMatch[1],
      id: null,
      url: `https://www.instagram.com/stories/${storyUserMatch[1]}/`,
    };
  }

  // Instagram Post: instagram.com/p/ABC123
  const postMatch = cleanUrl.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
  if (postMatch) {
    return {
      type: 'post',
      id: postMatch[1],
      username: null,
      url: `https://www.instagram.com/p/${postMatch[1]}/`,
    };
  }

  // Instagram profile: instagram.com/USERNAME
  const profileMatch = cleanUrl.match(/instagram\.com\/([A-Za-z0-9._]+)\/?$/);
  if (profileMatch && !['p', 'reel', 'reels', 'stories', 'tv', 'explore', 'accounts'].includes(profileMatch[1])) {
    return {
      type: 'profile',
      username: profileMatch[1],
      id: null,
      url: `https://www.instagram.com/${profileMatch[1]}/`,
    };
  }

  return { type: 'unknown', url, id: null, username: null };
}

/**
 * Parse a YouTube URL into its component parts.
 * Returns { type, id } or null.
 */
export function parseYouTubeUrl(url) {
  if (!url) return null;

  // YouTube Short: youtube.com/shorts/ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/);
  if (shortsMatch) {
    return { type: 'short', id: shortsMatch[1] };
  }

  // YouTube Short URL: youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
  if (shortMatch) {
    return { type: 'video', id: shortMatch[1] };
  }

  // YouTube Video: youtube.com/watch?v=ID
  const videoMatch = url.match(/[?&]v=([A-Za-z0-9_-]+)/);
  if (videoMatch) {
    return { type: 'video', id: videoMatch[1] };
  }

  return { type: 'unknown', id: null };
}

/**
 * Detect platform from a URL string.
 * Returns 'instagram', 'youtube', or 'unknown'.
 */
export function detectPlatform(url) {
  if (!url) return 'unknown';
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

/**
 * Determine which screen to navigate to based on URL content.
 * Returns { screen, params } for navigation.
 */
export function getNavigationTarget(url) {
  if (!url) return null;

  const cleanUrl = extractUrlFromText(url);
  if (!cleanUrl) return null;

  const platform = detectPlatform(cleanUrl);

  if (platform === 'instagram') {
    const parsed = parseInstagramUrl(cleanUrl);

    if (parsed.type === 'story') {
      // Route stories to the Stories screen with the username pre-filled
      return {
        screen: 'Stories',
        params: {
          autoPaste: true,
          initialUrl: cleanUrl,
          initialUsername: parsed.username,
          contentType: 'story',
        },
      };
    }

    // Reels, posts, profiles → Reels screen
    return {
      screen: 'Reels',
      params: {
        autoPaste: true,
        initialUrl: parsed.url || cleanUrl,
        contentType: parsed.type,
      },
    };
  }

  if (platform === 'youtube') {
    const parsed = parseYouTubeUrl(cleanUrl);
    return {
      screen: 'YouTube',
      params: {
        autoPaste: true,
        initialUrl: cleanUrl,
        videoId: parsed?.id || null,
        contentType: parsed?.type || 'video',
      },
    };
  }

  return null;
}
