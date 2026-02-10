// src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// Base fetch wrapper with auth
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

export const api = {
  // Auth endpoints
  auth: {
    login: async (email: string, password: string) => {
      return fetchWithAuth('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    
    register: async (name: string, email: string, password: string) => {
      return fetchWithAuth('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
    },
    
    me: async () => {
      return fetchWithAuth('/api/auth/me');
    },
  },
  
  // RFP endpoints
  rfps: {
    list: async () => {
      return fetchWithAuth('/api/rfps');
    },
    
    get: async (rfpId: string) => {
      return fetchWithAuth(`/api/rfps/${rfpId}`);
    },
    
    create: async (data: { title: string; description?: string; company?: string; dueDate?: string }) => {
      return fetchWithAuth('/api/rfps', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    delete: async (rfpId: string) => {
      return fetchWithAuth(`/api/rfps/${rfpId}`, {
        method: 'DELETE',
      });
    },
    
    // Answer endpoints
    getAnswer: async (rfpId: string, questionId: string) => {
      return fetchWithAuth(`/api/rfps/${rfpId}/questions/${questionId}/answer`);
    },
    
    saveAnswer: async (
      rfpId: string, 
      questionId: string, 
      data: { answer: string; answerJson?: object }
    ) => {
      return fetchWithAuth(`/api/rfps/${rfpId}/questions/${questionId}/answer`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
  },
  
  // Collaboration endpoints
  collaboration: {
    getToken: async (rfpId: string) => {
      return fetchWithAuth('/api/collaboration/token', {
        method: 'POST',
        body: JSON.stringify({ rfpId }),
      });
    },
    
    getStatus: async () => {
      return fetchWithAuth('/api/collaboration/status');
    },

    /** Resolve user IDs to names and colors from the database */
    getUsers: async (userIds: string[]) => {
      const ids = userIds.join(',');
      return fetchWithAuth(`/api/collaboration/users?ids=${encodeURIComponent(ids)}`);
    },
  },
};

export default api;