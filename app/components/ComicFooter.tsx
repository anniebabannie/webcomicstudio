import { Link } from "react-router";

type ComicFooterProps = {
  baseDomain: string;
  comicId: string;
  chapterId?: string;
  pageNumbers?: number[];
};

export function ComicFooter({ baseDomain, comicId, chapterId, pageNumbers }: ComicFooterProps) {
  // Build the report URL with query params
  const params = new URLSearchParams({ comicId });
  if (chapterId) params.append('chapterId', chapterId);
  // Only include the first page number
  if (pageNumbers && pageNumbers.length > 0) {
    params.append('page', pageNumbers[0].toString());
  }
  
  const reportPath = `/report?${params.toString()}`;

  return (
  <footer className="w-full pb-6 px-4 text-sm text-[var(--link)] flex items-center justify-center mt-2">
      Powered by{' '}
      <a
        href={baseDomain.includes('localhost') ? `http://${baseDomain}` : `https://${baseDomain}`}
        target="_blank"
        rel="noopener noreferrer"
  className="hover:text-[var(--link-hover)] underline transition mx-1"
      >
        Webcomic Studio
      </a>
      {' '}|{' '}
      <Link
        to={reportPath}
        target="_blank"
        rel="noopener noreferrer"
  className="hover:text-[var(--link-hover)] underline transition mx-1"
      >
        Report an issue
      </Link>
    </footer>
  );
}
