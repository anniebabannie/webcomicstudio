type ComicFooterProps = {
  baseDomain: string;
};

export function ComicFooter({ baseDomain }: ComicFooterProps) {
  return (
    <div className="fixed bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400">
      Powered by{" "}
      <a
        href={baseDomain.includes('localhost') ? `http://${baseDomain}` : `https://${baseDomain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-700 dark:hover:text-gray-300 underline transition"
      >
        Webcomic Studio
      </a>
    </div>
  );
}
