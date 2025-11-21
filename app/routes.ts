import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    // Admin dashboard routes (most specific first)
    route("/dashboard", "routes/dashboard.layout.tsx", [
      index("routes/dashboard.tsx"),
      route("new", "routes/dashboard.new.tsx"),
      route(":comicId", "routes/dashboard.$comicId.tsx"),
      route(":comicId/update", "routes/dashboard.$comicId.update.tsx"),
      route(":comicId/sitepage/:sitePageId", "routes/dashboard.$comicId.sitepage.$sitePageId.tsx"),
      route(":comicId/chapter/:chapterId", "routes/dashboard.$comicId.chapter.$chapterId.tsx"),
    ]),
    // API routes
    route("api/og-image/:comicId", "routes/api.og-image.$comicId.tsx"),
    route("api/upload-image", "routes/api.upload-image.tsx"),
    // Standalone page route
    route("page/:pageNumber", "routes/page.$pageNumber.tsx"),
    // Public site page route by slug (single segment)
  // Static legal/help pages (placed before slug catch-all)
  route("terms", "routes/terms.tsx"),
  route("adult-content-guidelines", "routes/adult-content-guidelines.tsx"),
    route(":slug", "routes/$slug.tsx"),
    // Public comic reader routes (most general last - catch-all)
    route(":chapterId/:pageNumber", "routes/$chapterId.$pageNumber.tsx"),
  // Report an issue page
  route("report", "routes/report.tsx"),
] satisfies RouteConfig;
