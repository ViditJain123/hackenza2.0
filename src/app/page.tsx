'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [redirectAttempted, setRedirectAttempted] = useState(false)
  const { userId, isLoaded: authLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    async function checkOnboardingStatus() {
      if (redirectAttempted) return;
      
      try {
        if (!userId) {
          setIsLoading(false)
          return
        }

        setRedirectAttempted(true);
        // Add cache-busting parameter to prevent stale responses
        const response = await fetch(`/api/clinician_onboard/status?clerkId=${userId}&t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json()
        
        console.log('Onboarding status:', data); // Debug output
        
        if (data.isOnboarded) {
          // Immediate redirect for onboarded users
          window.location.href = '/dashboard'; // Using window.location for hard redirect
        } else {
          router.push('/onboard')
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        setIsLoading(false)
      }
    }

    // Only run the check once auth is loaded and we have a userId
    if (authLoaded) {
      if (userId && !redirectAttempted) {
        checkOnboardingStatus()
      } else if (!userId) {
        setIsLoading(false)
      }
    }
  }, [userId, router, redirectAttempted, authLoaded])

  // Show loading indicator while checking status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading your profile...</h2>
          <div className="animate-pulse h-2 w-24 bg-gray-300 rounded mx-auto"></div>
        </div>
      </div>
    )
  }

  // Show a welcome page if not redirecting
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Hackenza</h1>
      <p>Please sign in to continue</p>
    </div>  
  )
}
