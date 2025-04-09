import { useEffect, useCallback } from 'react';

interface OnlineStatusTrackerProps {
  userId: number | null;
}

export function OnlineStatusTracker({ userId }: OnlineStatusTrackerProps) {
  const updateOnlineStatus = useCallback(async () => {
    if (!userId) return;
    
    try {
      await fetch('/api/admin/online-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error('Failed to update online status:', error);
    }
  }, [userId]);

  useEffect(() => {
    // Update online status immediately when component mounts
    updateOnlineStatus();

    // Update online status periodically
    const interval = setInterval(() => {
      updateOnlineStatus();
    }, 60000); // Every minute

    // Update online status on user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    let activityTimeout: NodeJS.Timeout;

    const handleUserActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        updateOnlineStatus();
      }, 1000); // Debounce for 1 second
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Clean up
    return () => {
      clearInterval(interval);
      clearTimeout(activityTimeout);
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [updateOnlineStatus]);

  // This component doesn't render anything
  return null;
}

export default OnlineStatusTracker; 