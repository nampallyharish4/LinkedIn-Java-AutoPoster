const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/config');

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_REST_BASE = 'https://api.linkedin.com/rest';

/**
 * Get the authenticated user's profile info
 */
async function getProfile() {
  try {
    const response = await axios.get(`${LINKEDIN_API_BASE}/userinfo`, {
      headers: {
        Authorization: `Bearer ${config.linkedin.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      '❌ LinkedIn Profile Error:',
      error.response?.data || error.message,
    );
    throw new Error(
      `Failed to get profile: ${error.response?.data?.message || error.message}`,
    );
  }
}

/**
 * Create a text post on LinkedIn using the Posts API (v2)
 */
async function createPost(content) {
  const personUrn = config.linkedin.personUrn;

  if (!personUrn) {
    throw new Error(
      'LinkedIn Person URN is not configured. Please click "Connect LinkedIn Account" on the dashboard.',
    );
  }

  if (!config.linkedin.accessToken) {
    throw new Error(
      'LinkedIn Access Token is not configured. Please click "Connect LinkedIn Account" on the dashboard.',
    );
  }

  try {
    const postBody = {
      author: `urn:li:person:${personUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const contentHash = crypto.createHash('md5').update(content).digest('hex');

    const response = await axios.post(
      `${LINKEDIN_API_BASE}/ugcPosts`,
      postBody,
      {
        headers: {
          Authorization: `Bearer ${config.linkedin.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'X-RestLi-Idempotency-Key': contentHash,
        },
        timeout: 15000,
      },
    );

    return {
      success: true,
      postId: response.headers['x-restli-id'] || response.data?.id,
      message: 'Post published successfully!',
    };
  } catch (error) {
    const errorData = error.response?.data;
    console.error(
      '❌ LinkedIn Post Error:',
      JSON.stringify(errorData, null, 2) || error.message,
    );

    // Handle specific LinkedIn API errors
    if (error.response?.status === 401) {
      throw new Error(
        'LinkedIn access token expired. Please re-authenticate via /auth/linkedin',
      );
    }
    if (error.response?.status === 403) {
      throw new Error(
        'Insufficient permissions. Ensure your LinkedIn app has w_member_social scope.',
      );
    }
    if (error.response?.status === 429) {
      throw new Error('LinkedIn API rate limit reached. Try again later.');
    }

    throw new Error(
      `Failed to publish post: ${errorData?.message || error.message}`,
    );
  }
}

/**
 * Generate the LinkedIn OAuth2 authorization URL
 */
function getAuthUrl(redirectUri) {
  const scopes = ['openid', 'profile', 'w_member_social'].join('%20');
  return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${config.linkedin.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code, redirectUri) {
  try {
    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.linkedin.clientId,
        client_secret: config.linkedin.clientSecret,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      '❌ Token Exchange Error:',
      error.response?.data || error.message,
    );
    throw new Error(
      `Failed to exchange code: ${error.response?.data?.error_description || error.message}`,
    );
  }
}

/**
 * Get the user's Person URN from profile
 */
async function getPersonUrn() {
  try {
    const response = await axios.get(`${LINKEDIN_API_BASE}/userinfo`, {
      headers: {
        Authorization: `Bearer ${config.linkedin.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.sub; // This is the person ID
  } catch (error) {
    throw new Error(`Failed to get Person URN: ${error.message}`);
  }
}

module.exports = {
  getProfile,
  createPost,
  getAuthUrl,
  exchangeCodeForToken,
  getPersonUrn,
};
