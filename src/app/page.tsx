'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [redirectAttempted, setRedirectAttempted] = useState(false)
  const { userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    async function checkOnboardingStatus() {
      // Prevent multiple redirect attempts
      if (redirectAttempted) return;
      
      try {
        if (!userId) {
          setIsLoading(false)
          return
        }

        setRedirectAttempted(true); // Mark that we're attempting a redirect
        const response = await fetch(`/api/clinician_onboard/status?clerkId=${userId}`)
        const data = await response.json()

        // Check if user needs to complete onboarding
        if (data.isOnboarded && 
            data.user?.name && 
            data.user?.email && 
            data.user?.specialty) {
          // User is fully onboarded, redirect to dashboard or main page
          router.push('/dashboard')
        } else {
          // User needs to complete onboarding
          router.push('/onboard')
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        setIsLoading(false)
      }
    }

    if (userId && !redirectAttempted) {
      checkOnboardingStatus()
    } else if (!userId) {
      setIsLoading(false)
    }
  }, [userId, router, redirectAttempted])

  if (isLoading) {
    return <div>Loading...</div>
  }

  // Show a welcome page if not redirecting
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Hackenza</h1>
      <p>Loading your profile...</p>
    </div>  
  )
}
