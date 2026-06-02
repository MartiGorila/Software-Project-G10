import { supabase } from '../index'

export type Visibility = 'public' | 'friends' | 'private'

export type VisibleRecord = {
  creator_id?: string | null
  visibility?: Visibility | null
}

export function normalizeVisibility(value: unknown): Visibility {
  return value === 'friends' || value === 'private' ? value : 'public'
}

export async function getFriendIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set()

  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.friend_id as string))
}

export function canViewRecord(
  record: VisibleRecord,
  viewerId: string | undefined,
  friendIds: Set<string>,
): boolean {
  const visibility = normalizeVisibility(record.visibility)
  if (visibility === 'public') return true
  if (!viewerId) return false
  if (record.creator_id === viewerId) return true
  if (visibility === 'friends' && record.creator_id) return friendIds.has(record.creator_id)
  return false
}

export function filterVisibleRecords<T extends VisibleRecord>(
  records: T[],
  viewerId: string | undefined,
  friendIds: Set<string>,
): T[] {
  return records.filter((record) => canViewRecord(record, viewerId, friendIds))
}
