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
  try {
    await connectDB();
    
    const formData = await req.formData();
    const body = Object.fromEntries(formData);
    
    const from = body.From as string; // WhatsApp number
    const messageBody = body.Body as string; // Message content
    
    // Check if user exists in the database
    let user = await User.findOne({ phoneNumber: from });
    
    if (messageBody.toLowerCase() === 'hi') {
      if (!user) {
        // Create a new user with initial onboarding status
        user = new User({
          phoneNumber: from,
          onboardingStatus: 'awaiting_name'
        });
        await user.save();
        
        // Ask for name first
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Hello! What is your name?'
        });
      } else if (user.onboardingStatus === 'completed') {
        // User already completed onboarding
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Welcome back, ${user.userName}! How can I help you today?`
        });
      } else {
        // User exists but onboarding not completed - restart onboarding
        user.onboardingStatus = 'awaiting_name';
        await user.save();
        
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Let\'s finish your onboarding. What is your name?'
        });
      }
    } else if (user) {
      // Process based on current onboarding status
      if (user.onboardingStatus === 'awaiting_name') {
        // Save the name and ask for age
        user.userName = messageBody.trim();
        user.onboardingStatus = 'awaiting_age';
        await user.save();
        
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Thanks, ${user.userName}! Now, what is your age?`
        });
      } else if (user.onboardingStatus === 'awaiting_age') {
        // Try to parse age
        const age = parseInt(messageBody.trim());
        
        if (isNaN(age)) {
          // Invalid age format
          await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: 'Please provide a valid number for your age.'
          });
        } else {
          // Save age and complete onboarding
          user.age = age;
          user.onboardingStatus = 'completed';
          await user.save();
          
          await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: `Great! Your profile is complete. We've saved your name (${user.userName}) and age (${user.age}). You can now use our service.`
          });
        }
      } else if (user.onboardingStatus === 'completed') {
        // User has completed onboarding and is sending a regular message
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Hello ${user.userName}! How can I help you today?`
        });
      }
    } else {
      // This should rarely happen - no user record but not saying "hi"
      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: from,
        body: 'Hello! To get started, please send "hi" to begin the registration process.'
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
