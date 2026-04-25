export function useAdminAuth() {
  return {
    authed: false,
    login: async () => {},
    logout: () => {},
    error: null,
  };
}
