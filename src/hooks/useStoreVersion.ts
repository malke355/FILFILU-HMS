import { useCallback, useEffect, useState } from 'react'

/** Bump to force re-read from services after mutations. */
export function useStoreVersion() {
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const onStore = () => refresh()
    window.addEventListener('filfilu-store', onStore)
    return () => window.removeEventListener('filfilu-store', onStore)
  }, [refresh])

  return { version, refresh }
}
