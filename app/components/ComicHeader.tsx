import { Link } from "react-router";

type Chapter = {
  id: string;
  number: number;
  title: string;
  publishedDate: Date | null;
  pages: { id: string; number: number }[];
};

type SitePage = {
  linkText: string;
  slug: string;
};

type ComicHeaderProps = {
  comic: {
    title: string;
    tagline?: string | null;
    logo?: string | null;
    doubleSpread?: boolean;
  };
  chapters: Chapter[];
  sitePages?: SitePage[];
  currentChapterId?: string;
  currentPageNumber?: number;
  previewParams?: string;
};

export function ComicHeader({
  comic,
  chapters,
  sitePages = [],
  currentChapterId,
  currentPageNumber,
  previewParams = "",
}: ComicHeaderProps) {
  // Filter published chapters: must have a publishedDate and it must not be in the future
  const publishedChapters = chapters.filter(
    (ch) => ch.publishedDate && new Date(ch.publishedDate) <= new Date()
  );

  const queryString = previewParams ? `?${previewParams}` : "";

  return (
    <header className="bg-gray-950 border-b border-gray-800 px-4 py-3">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/${queryString}`}
            className="text-white hover:text-gray-300 transition flex items-center gap-3"
          >
            {comic.logo ? (
              <img src={comic.logo} alt={comic.title} className="max-h-[28px]" />
            ) : (
              <h1 className="text-lg font-semibold">{comic.title}</h1>
            )}
          </Link>
          {comic.tagline && (
            <p className="text-sm text-gray-400 hidden sm:block">
              {comic.tagline.slice(0, 80)}
              {comic.tagline.length > 80 ? "..." : ""}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* Site page links */}
          {sitePages.length > 0 && (
            <>
              {sitePages.map((sp) => (
                <Link
                  key={sp.slug}
                  to={`/${sp.slug}${queryString}`}
                  className="text-gray-300 hover:text-white"
                >
                  {sp.linkText}
                </Link>
              ))}
              {publishedChapters.length > 0 && <span className="text-gray-400">•</span>}
            </>
          )}

          {/* Chapter and page selectors */}
          {publishedChapters.length > 0 && (
            <>
              <select
                value={currentChapterId || publishedChapters[0].id}
                onChange={(e) => {
                  const selectedChapter = publishedChapters.find(
                    (ch) => ch.id === e.target.value
                  );
                  if (selectedChapter && selectedChapter.pages.length > 0) {
                    window.location.href = `/${selectedChapter.id}/1${queryString}`;
                  }
                }}
                className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {publishedChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>
              <span className="text-gray-400">•</span>
              <select
                value={currentPageNumber || ""}
                onChange={(e) => {
                  const chapterId =
                    currentChapterId || publishedChapters[0]?.id;
                  const pageNum = parseInt(e.target.value, 10);
                  if (chapterId && !isNaN(pageNum)) {
                    window.location.href = `/${chapterId}/${pageNum}${queryString}`;
                  }
                }}
                className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">--</option>
                {(() => {
                  const chapter =
                    publishedChapters.find((ch) => ch.id === currentChapterId) ||
                    publishedChapters[0];
                  if (!chapter) return null;

                  if (comic.doubleSpread) {
                    return chapter.pages
                      .filter((p) => (p.number - 1) % 2 === 0)
                      .map((p) => {
                        const maxPage =
                          chapter.pages[chapter.pages.length - 1]?.number ?? p.number;
                        return (
                          <option key={p.number} value={p.number}>
                            {p.number}–{p.number + 1 <= maxPage ? p.number + 1 : ""}
                          </option>
                        );
                      });
                  } else {
                    return chapter.pages.map((p) => (
                      <option key={p.number} value={p.number}>
                        Page {p.number}
                      </option>
                    ));
                  }
                })()}
              </select>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
