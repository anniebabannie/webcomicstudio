import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * usePageArrowNavigation
 * - Navigates to prev/next URLs with ArrowLeft/ArrowRight keys
 * - Pass undefined to disable a direction
 */
export function usePageArrowNavigation(prevUrl?: string, nextUrl?: string) {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && prevUrl) {
        navigate(prevUrl);
      } else if (e.key === "ArrowRight" && nextUrl) {
        navigate(nextUrl);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, prevUrl, nextUrl]);
}
