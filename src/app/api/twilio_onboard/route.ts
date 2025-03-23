import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import User from '@/models/userSchema';
import UserQuery from '@/models/userQuerySchema';
import connectDB from '@/utils/dbConnet';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export async function POST(req: NextRequest) {
  console.log('📞 Twilio onboarding route called');
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !accountSid.startsWith('AC')) {
      console.error('❌ Invalid Twilio Account SID:', accountSid);
      throw new Error('Invalid Twilio Account SID. Must start with "AC"');
    }
    
    if (!authToken) {
      console.error('❌ Missing Twilio Auth Token');
      throw new Error('Twilio Auth Token is required');
    }
    
    console.log('✅ Twilio credentials validated');
    // Initialize Twilio client with valid credentials
    const twilioClient = twilio(accountSid, authToken);

    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');
    
    // Parse form data after successful DB connection
    console.log('📄 Parsing form data...');
    const formData = await req.formData();
    const body = Object.fromEntries(formData);
    
    const from = body.From as string; // WhatsApp number
    const messageBody = body.Body as string; // Message content
    
    console.log('📩 Received message:', { from, body: messageBody });
    
    // Check if user exists in the database
    let user = await User.findOne({ phoneNumber: from });
    console.log('👤 User lookup result:', user ? `Found user: ${user.userName || 'unnamed'}` : 'User not found');
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (messageBody.toLowerCase() === 'hi') {
      if (!user) {
        // Create a new user with initial onboarding status
        console.log('➕ Creating new user for:', from);
        user = new User({
          phoneNumber: from,
          onboardingStatus: 'awaiting_name'
        });
        await user.save();
        console.log('✅ New user created');
        
        // Ask for name first
        console.log('📤 Sending name request message');
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Hello! What is your name?'
        });
        console.log('✅ Message sent:', message.sid);
      } else if (user.onboardingStatus === 'completed') {
        // User already completed onboarding
        console.log('👋 Welcoming returning user:', user.userName);
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Welcome back, ${user.userName}! How can I help you today?`
        });
        console.log('✅ Message sent:', message.sid);
      } else {
        // User exists but onboarding not completed - restart onboarding
        console.log('🔄 Restarting onboarding for user:', from);
        user.onboardingStatus = 'awaiting_name';
        await user.save();
        
        console.log('📤 Sending onboarding continuation message');
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Let\'s finish your onboarding. What is your name?'
        });
        console.log('✅ Message sent:', message.sid);
      }
    } else if (user) {
      // Process based on current onboarding status
      if (user.onboardingStatus === 'awaiting_name') {
        // Save the name and ask for age
        console.log('✏️ Saving user name:', messageBody.trim());
        user.userName = messageBody.trim();
        user.onboardingStatus = 'awaiting_age';
        await user.save();
        
        console.log('📤 Sending age request message');
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Thanks, ${user.userName}! Now, what is your age?`
        });
        console.log('✅ Message sent:', message.sid);
      } else if (user.onboardingStatus === 'awaiting_age') {
        // Try to parse age
        const age = parseInt(messageBody.trim());
        console.log('🔢 Parsing age:', messageBody.trim(), '→', age);
        
        if (isNaN(age)) {
          // Invalid age format
          console.log('⚠️ Invalid age format received');
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: 'Please provide a valid number for your age.'
          });
          console.log('✅ Message sent:', message.sid);
        } else {
          // Save age and complete onboarding
          console.log('✅ Completing onboarding, age:', age);
          user.age = age;
          user.onboardingStatus = 'completed';
          await user.save();
          
          console.log('📤 Sending completion message');
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: `Great! Your profile is complete. We've saved your name (${user.userName}) and age (${user.age}). You can now use our service.`
          });
          console.log('✅ Message sent:', message.sid);
        }
      } else if (user.onboardingStatus === 'completed') {
        // User has completed onboarding and is sending a health query
        console.log('💬 Processing health query from user:', user.userName);
        
        try {
          // Save the query to database
          const userQuery = new UserQuery({
            phoneNumber: from,
            query: messageBody,
            status: 'not_verified'
          });
          
          // Fetch previous conversations from the past 24 hours
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const previousQueries = await UserQuery.find({
            phoneNumber: from,
            createdAt: { $gte: twentyFourHoursAgo }
          }).sort({ createdAt: 1 }); // Sort by oldest first
          
          console.log(`📚 Found ${previousQueries.length} previous queries in the last 24 hours`);
          // Build conversation history for context
          const conversationHistory: ChatCompletionMessageParam[] = [];
          
          // Add system message first
          conversationHistory.push({
            role: "system",
            content: `You are a helpful AI assistant that provides medical information. 
                     Always be professional and compassionate. 
                     The user's name is ${user.userName} and they are ${user.age} years old.
                     Remember you're not a doctor, so always include a disclaimer.
                     Determine the most appropriate medical specialty category for the query.
                     Response must be structured with medical explanation and relevant doctor category.
                     Keep responses under 250 words.`
          });
          
          // Add previous conversations as context
          previousQueries.forEach(query => {
            // Add user's previous question
            conversationHistory.push({
              role: "user",
              content: query.query
            });
            
            // If there was a response, add it too
            if (query.response) {
              // Remove the disclaimer from previous responses for cleaner context
              const assistantResponse = query.response.replace(/\n\n\*This response is not yet verified by the doctor\.\*$/, '');
              
              conversationHistory.push({
                role: "assistant",
                content: assistantResponse
              });
            }
          });
          
          // Add the current question
          conversationHistory.push({
            role: "user",
            content: messageBody
          });
          
          // Define schema for structured output
          const outputSchema = z.object({
            response: z.string().describe("The medical information response to the user query"),
            doctorCategory: z.string().describe("The appropriate medical specialty for this query (e.g., Cardiology, Dermatology, Neurology, Pediatrics, etc.)")
          });
          
          // Process query with OpenAI using structured output
          console.log('🤖 Sending to GPT-4o with conversation history for structured output');
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: conversationHistory,
            response_format: zodResponseFormat(outputSchema, "json"),
            max_tokens: 500,
          });
          
          // Extract the structured response
          const content = completion.choices[0].message.content || '{}';
          const structuredResponse = JSON.parse(content);
          console.log('🤖 AI structured response received:', structuredResponse);
          
          // Add disclaimer and save response
          const fullResponse = `${structuredResponse.response}\n\n*This response is not yet verified by the doctor.*`;
          userQuery.response = fullResponse;
          userQuery.doctorCategory = structuredResponse.doctorCategory;
          await userQuery.save();
          
          // Send response to user
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: fullResponse
          });
          console.log('✅ Message sent:', message.sid);
        } catch (aiError) {
          console.error('❌ AI processing error:', aiError);
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: "I'm sorry, I couldn't process your health query at the moment. Please try again later."
          });
          console.log('✅ Error message sent:', message.sid);
        }
      }
    } else {
      // This should rarely happen - no user record but not saying "hi"
      console.log('⚠️ New user not starting with "hi":', from);
      const message = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: from,
        body: 'Hello! To get started, please send "hi" to begin the registration process.'
      });
      console.log('✅ Message sent:', message.sid);
    }
    
    console.log('🎉 Twilio onboarding process completed successfully');
    return NextResponse.json({ 
      status: 'success',
      message: 'Twilio onboarding successful' 
    });
  } catch (error: unknown) {
    console.error('❌ Twilio onboarding error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error type:', typeof error);
    }
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'An error occurred' 
      },
      { status: 500 }
    );
  }
}
