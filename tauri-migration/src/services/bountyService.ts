/**
 * Bounty Service
 * Handles viral demo bounty submissions and payouts
 */

const API_BASE = import.meta.env.VITE_REDIX_CORE_URL || 'http://localhost:4000';

export interface BountySubmission {
  id?: string;
  title: string;
  videoUrl: string;
  platform: 'youtube' | 'x' | 'tiktok' | 'reels' | 'other';
  description?: string;
  upiId: string;
  userId?: string;
}

export interface BountyStatus {
  id: string;
  status: 'pending' | 'verifying' | 'approved' | 'rejected' | 'paid';
  views: number;
  verifiedViews?: number;
  message?: string;
  payoutAmount?: number;
  paidAt?: number;
}

export interface BountyLeaderboardEntry {
  userId: string;
  userName: string;
  totalViews: number;
  totalEarned: number;
  submissionCount: number;
  rank: number;
}

/**
 * Submit a bounty request
 */
export async function submitBounty(submission: BountySubmission): Promise<BountyStatus> {
  try {
    const response = await fetch(`${API_BASE}/bounty/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[BountyService] Submit failed:', error);
    throw error;
  }
}

/**
 * Verify video views via platform API
 */
export async function verifyVideoViews(
  videoUrl: string,
  platform: string
): Promise<{ views: number; verified: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/bounty/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, platform }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[BountyService] Verification failed:', error);
    throw error;
  }
}

/**
 * Get bounty status by ID
 */
export async function getBountyStatus(bountyId: string): Promise<BountyStatus> {
  try {
    const response = await fetch(`${API_BASE}/bounty/status/${bountyId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[BountyService] Get status failed:', error);
    throw error;
  }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(limit: number = 10): Promise<BountyLeaderboardEntry[]> {
  try {
    const response = await fetch(`${API_BASE}/bounty/leaderboard?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[BountyService] Get leaderboard failed:', error);
    return [];
  }
}

/**
 * Get user's bounty submissions
 */
export async function getUserSubmissions(userId: string): Promise<BountyStatus[]> {
  try {
    const response = await fetch(`${API_BASE}/bounty/user/${userId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[BountyService] Get user submissions failed:', error);
    return [];
  }
}
