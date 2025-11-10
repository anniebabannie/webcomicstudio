import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("/dashboard", "routes/dashboard.tsx"),
    route("/dashboard/new", "routes/dashboard.new.tsx"),
    route("/dashboard/:comicId", "routes/dashboard.$comicId.tsx"),
    route("/dashboard/:comicId/update", "routes/dashboard.$comicId.update.tsx"),
] satisfies RouteConfig;
