import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import dbConnect from '@/utils/dbConnet'
import User from '@/models/clinicianSchema'

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get clerk ID from query params
    const clerkId = req.nextUrl.searchParams.get('clerkId')

    // Validate clerk ID matches authenticated user
    if (clerkId !== userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Connect to database
    await dbConnect()

    // Check if user exists and is onboarded
    const user = await User.findOne({ clerkId })
    
    return NextResponse.json({
      isOnboarded: user ? user.isOnboarded : false
    })
  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
}
