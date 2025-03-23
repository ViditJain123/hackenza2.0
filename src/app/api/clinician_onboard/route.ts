import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import dbConnect from '@/utils/dbConnet' 
import User from '@/models/clinicianSchema'

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await req.json()
    const { clerkId, name, email, specialty, phoneNumber } = body

    // Validate clerk ID matches authenticated user
    if (clerkId !== userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!clerkId || !name || !email || !specialty) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Connect to database
    await dbConnect()

    // Check if user already exists
    const existingUser = await User.findOne({ clerkId })
    if (existingUser) {
      // Update existing user
      existingUser.name = name
      existingUser.email = email
      existingUser.specialty = specialty
      existingUser.phoneNumber = phoneNumber
      existingUser.isOnboarded = true
      await existingUser.save()
      
      return NextResponse.json({ message: 'Clinician updated successfully' })
    }

    // Create new user
    await User.create({
      clerkId,
      name,
      email,
      specialty,
      phoneNumber,
      isOnboarded: true
    })

    return NextResponse.json({ message: 'Clinician onboarded successfully' })
  } catch (error: any) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
}
