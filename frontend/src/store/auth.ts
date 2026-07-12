import { create } from 'zustand'
import type { UserWithProfile } from '../types'

interface AuthState {
  user: UserWithProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  profileCompleted: boolean | null  // null=未知, true=已有画像v2, false=无画像
  setUser: (user: UserWithProfile | null) => void
  setLoading: (loading: boolean) => void
  setProfileCompleted: (completed: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  profileCompleted: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  setProfileCompleted: (completed) => set({ profileCompleted: completed }),
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false, profileCompleted: null })
  },
}))
