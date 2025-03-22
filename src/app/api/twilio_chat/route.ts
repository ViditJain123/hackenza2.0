import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import User from '@/models/userSchema';
import connectDB from '@/utils/dbConnet';

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  
}

// GET handler is optional but good to have for testing
export async function GET() {
  return NextResponse.json(
    { message: 'Twilio Chat Webhook Endpoint' },
    { status: 200 }
  );
}
