import { createClient } from '@/lib/supabase/client';

export function createSupabaseStore<T extends { id: string }>(tableName: string) {
  return {
    async getAll(filter?: Partial<T>): Promise<T[]> {
      const supabase = createClient();
      let query = supabase.from(tableName).select('*');
      if (filter) {
        for (const [key, value] of Object.entries(filter)) {
          if (value !== undefined) query = query.eq(key, value as string);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as T[];
    },

    async getById(id: string): Promise<T | undefined> {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) return undefined;
      return data as T;
    },

    async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
      const supabase = createClient();
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result as T;
    },

    async update(id: string, updates: Partial<T>): Promise<T | undefined> {
      const supabase = createClient();
      const { data: result, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) return undefined;
      return result as T;
    },

    async delete(id: string): Promise<boolean> {
      const supabase = createClient();
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      return !error;
    },
  };
}
