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

// ─── Dummy AI suggestion data ────────────────────────────────────────────────
const DUMMY_AI_SUGGESTIONS = [
  {
    id: "ai-1",
    title: "AI Option 1",
    content:
      "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
    matchPercentage: 98,
  },
  {
    id: "ai-2",
    title: "AI Option 2",
    content:
      "We provide a robust integration framework designed for enterprise-scale deployments. Our system supports RESTful APIs, webhooks, and event-driven architectures with built-in retry logic and circuit breaker patterns for maximum reliability.",
    matchPercentage: 92,
  },
  {
    id: "ai-3",
    title: "AI Option 3",
    content:
      "Our solution includes a developer-friendly API layer with comprehensive documentation, sandbox environments, and SDKs for major programming languages. Authentication is handled via industry-standard OAuth 2.0 flows.",
    matchPercentage: 27,
  },
];

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

  // ─── AI endpoints ────────────────────────────────────────────────────────────
  ai: {
    /**
     * Generate AI suggestions for a given question.
     * Currently returns dummy data with a simulated delay.
     * Replace internals with a real API call later.
     */
    generateSuggestions: async (
      questionId: string,
      tone: string
    ): Promise<{
      suggestions: {
        id: string;
        title: string;
        content: string;
        matchPercentage: number;
      }[];
      tone: string;
    }> => {
      // TODO: Replace with real endpoint call:
      // return fetchWithAuth(`/api/ai/suggestions`, {
      //   method: 'POST',
      //   body: JSON.stringify({ questionId, tone }),
      // });

      // Simulate network delay (2-3 seconds)
      await new Promise((resolve) =>
        setTimeout(resolve, 2000 + Math.random() * 1000)
      );

      // Return dummy data
      return {
        suggestions: DUMMY_AI_SUGGESTIONS,
        tone,
      };
    },

    /**
     * Fetch library matches for a given question.
     * Currently returns dummy data with a simulated delay.
     */
    getLibraryMatches: async (
      questionId: string
    ): Promise<{
      matches: {
        id: string;
        sourceRfp: string;
        date: string;
        rating: string;
        content: string;
        matchPercentage: number;
      }[];
    }> => {
      // TODO: Replace with real endpoint call:
      // return fetchWithAuth(`/api/ai/library-matches`, {
      //   method: 'POST',
      //   body: JSON.stringify({ questionId }),
      // });

      await new Promise((resolve) =>
        setTimeout(resolve, 1500 + Math.random() * 500)
      );

      return {
        matches: [
          {
            id: "lib-1",
            sourceRfp: "From Q3 2024 RFP",
            date: "Sep 15, 2024",
            rating: "9/10 Rated",
            content:
              "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
            matchPercentage: 98,
          },
          {
            id: "lib-2",
            sourceRfp: "From Q3 2024 RFP",
            date: "Sep 15, 2024",
            rating: "9/10 Rated",
            content:
              "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
            matchPercentage: 98,
          },
          {
            id: "lib-3",
            sourceRfp: "From Q3 2024 RFP",
            date: "Sep 15, 2024",
            rating: "9/10 Rated",
            content:
              "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
            matchPercentage: 98,
          },
        ],
      };
    },
  },
};

export default api;