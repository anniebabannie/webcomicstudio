import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    // Admin dashboard routes (most specific first)
    route("/dashboard", "routes/dashboard.layout.tsx", [
      index("routes/dashboard.tsx"),
      route("new", "routes/dashboard.new.tsx"),
      route(":comicId", "routes/dashboard.$comicId.tsx"),
      route(":comicId/update", "routes/dashboard.$comicId.update.tsx"),
      route(":comicId/:chapterId", "routes/dashboard.$comicId.$chapterId.tsx"),
    ]),
    // API routes
    route("api/og-image/:comicId", "routes/api.og-image.$comicId.tsx"),
    // Standalone page route
    route("page/:pageNumber", "routes/page.$pageNumber.tsx"),
    // Public comic reader routes (most general last - catch-all)
    route(":chapterId/:pageNumber", "routes/$chapterId.$pageNumber.tsx"),
] satisfies RouteConfig;
