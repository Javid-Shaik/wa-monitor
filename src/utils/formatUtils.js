export function formatDuration(seconds) {
    if (!seconds) return "0 min";
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0) return `${minutes} min ${remainingSeconds} sec`;
    return `${minutes} min `;
}

// Format last seen timestamp into a human-readable string
export function formatLastSeen(offlineTime) {
    if (!offlineTime) return "Online";

    const lastSeenDate = new Date(offlineTime);
    const now = new Date();
    const diffMs = now - lastSeenDate;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
}