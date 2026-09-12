import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SPRING } from '../lib/motion'

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={SPRING}
          className="fixed inset-x-0 top-0 z-[60] bg-red-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lift"
        >
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white align-middle" />
          You are offline — showing cached data
        </motion.div>
      )}
    </AnimatePresence>
  )
}
