import { supabase } from './supabase'

async function testConnection() {
  const { data, error } = await supabase
    .from('wards')
    .select('*')

  if (error) {
    console.log('❌ Connection failed:', error.message)
  } else {
    console.log('✅ Connected! Wards data:', data)
  }
}

testConnection()