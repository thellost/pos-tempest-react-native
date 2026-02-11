import Auth from '@/components/Auth'
import { supabase } from '@/lib/supabase'
import { JwtPayload } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import 'react-native-url-polyfill/auto'

export default function LoginScreen() {
  const [claims, setClaims] = useState<JwtPayload | null>(null)

  useEffect(() => {
    supabase.auth.getClaims().then(({ data }) => {
      setClaims(data?.claims ?? null)
    })

    supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data }) => {
        setClaims(data?.claims ?? null)
      })
    })
  }, [])

  return (
    <View>
      <Auth />
      {claims && <Text>{claims.sub}</Text>}
    </View>
  )
}