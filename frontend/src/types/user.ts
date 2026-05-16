export interface User {
  id: string
  username: string
  email?: string
  phone?: string
  role: 'student' | 'admin'
  status: 'active' | 'suspended' | 'deleted'
  created_at: string
  updated_at: string
}

export interface UserProfile {
  user_id: string
  full_name?: string
  university?: string
  major: string
  grade?: string
  learning_goal?: string
  avatar_url?: string
}

export interface UserWithProfile extends User {
  profile?: UserProfile
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
  major: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterResponse {
  student_id: string
  username: string
  message: string
}
