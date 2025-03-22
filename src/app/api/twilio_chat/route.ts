import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body if it exists
    const body = await req.json().catch(() => ({}));
    
    // Create a test response
    const response = {
      status: 'success',
      message: 'This is a test route for Twilio chat',
      receivedData: body,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in test route:', error);
    return NextResponse.json(
      { status: 'error', message: 'Test route encountered an error' },
      { status: 500 }
    );
  }
}
