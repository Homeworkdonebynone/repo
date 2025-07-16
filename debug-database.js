// Debug script to check database state and constraints
import { supabase } from './src/utils/supabase'

async function checkDatabaseState() {
  console.log('=== CHECKING DATABASE STATE ===')
  
  if (!supabase) {
    console.error('Supabase not configured')
    return
  }

  try {
    // Check current wiki pages
    const { data: pages, error: pagesError } = await supabase
      .from('wiki_pages')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
    } else {
      console.log('Current wiki pages:', pages)
      console.log('Number of pages:', pages?.length || 0)
    }

    // Check invincible pages
    const { data: invincible, error: invincibleError } = await supabase
      .from('invincible_pages')
      .select('*')
    
    if (invincibleError) {
      console.error('Error fetching invincible pages:', invincibleError)
    } else {
      console.log('Invincible pages:', invincible)
    }

    // Check table schema constraints
    const { data: tableInfo, error: tableInfoError } = await supabase
      .rpc('get_table_constraints', { table_name: 'wiki_pages' })
    
    if (tableInfoError) {
      console.warn('Could not get table constraints (function might not exist):', tableInfoError)
    } else {
      console.log('Table constraints:', tableInfo)
    }

    // Try to get column information
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, is_nullable, column_default, data_type')
      .eq('table_name', 'wiki_pages')
    
    if (columnsError) {
      console.warn('Could not get column info:', columnsError)
    } else {
      console.log('Wiki pages columns:', columns)
    }

  } catch (error) {
    console.error('Error checking database state:', error)
  }
}

checkDatabaseState()
