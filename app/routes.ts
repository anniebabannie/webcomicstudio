import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    // Public comic reader routes
    route("/:chapterId/:pageNumber", "routes/$chapterId.$pageNumber.tsx"),
    route("/page/:pageNumber", "routes/page.$pageNumber.tsx"),
    // Admin dashboard routes
    route("/dashboard", "routes/dashboard.layout.tsx", [
      index("routes/dashboard.tsx"),
      route("new", "routes/dashboard.new.tsx"),
      route(":comicId", "routes/dashboard.$comicId.tsx"),
      route(":comicId/update", "routes/dashboard.$comicId.update.tsx"),
      route(":comicId/:chapterId", "routes/dashboard.$comicId.$chapterId.tsx"),
    ]),
] satisfies RouteConfig;
