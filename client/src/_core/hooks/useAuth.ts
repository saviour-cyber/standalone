import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export function useAuth() {
  const [, navigate] = useLocation();
  const query = trpc.auth.me.useQuery(undefined, { retry: false });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      query.refetch();
      navigate("/");
    },
  });
  return {
    user: query.data,
    loading: query.isLoading,
    error: query.error,
    isAuthenticated: Boolean(query.data),
    logout: () => logoutMutation.mutate(),
    startLogin: () => navigate("/login"),
  };
}
