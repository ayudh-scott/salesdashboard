import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.LEADERBOARD_API_BASE_URL || 'https://leaderboard.sagarfab.com/api/v1';
const API_EMAIL = process.env.LEADERBOARD_API_EMAIL || 'admin@scottinternational.com';
const API_PASSWORD = process.env.LEADERBOARD_API_PASSWORD || 'HiJack!';

interface AuthResponse {
  success: boolean;
  data?: {
    user?: {
      auth_token?: string;
    };
  };
  message?: string;
}

interface CustomerResponse {
  success: boolean;
  data?: any;
  message?: string;
}

/**
 * Authenticate with the leaderboard API and get auth token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('email', API_EMAIL);
    formData.append('password', API_PASSWORD);

    const response = await fetch(`${API_BASE_URL}/auth/authenticate`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Authentication failed:', response.status, response.statusText, errorText);
      return null;
    }

    const data: AuthResponse = await response.json();
    
    console.log('🔐 Auth response:', {
      success: data.success,
      hasUser: !!data.data?.user,
      hasToken: !!data.data?.user?.auth_token
    });
    
    if (data.success && data.data?.user?.auth_token) {
      return data.data.user.auth_token;
    }

    console.error('❌ No auth token in response:', JSON.stringify(data, null, 2));
    return null;
  } catch (error) {
    console.error('Error authenticating:', error);
    return null;
  }
}

/**
 * Fetch customers from the leaderboard API
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const items = searchParams.get('items') || '6';
    const page = searchParams.get('page') || '1';
    const approved = searchParams.get('approved') || 'true';
    const role = searchParams.get('role') || 'Customer';

    // Authenticate and get token
    const authToken = await getAuthToken();
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Failed to authenticate with leaderboard API' },
        { status: 401 }
      );
    }

    // Build query string
    const queryParams = new URLSearchParams({
      items,
      page,
      approved,
      role,
    });

    // Fetch customers
    const response = await fetch(
      `${API_BASE_URL}/customers?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch customers:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch customers: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data: CustomerResponse = await response.json();

    console.log('📥 Customers API response:', {
      success: data.success,
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
      dataStructure: JSON.stringify(data.data, null, 2).substring(0, 500), // First 500 chars
      message: data.message
    });

    if (!data.success) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch customers' },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

