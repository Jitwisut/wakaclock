export interface ApiKey {
  api_key: string;
  created_at: string;
  expired_at: string;
  id: number;
  name: string;
  status: 'active' | 'expired' | 'inactive';
}
