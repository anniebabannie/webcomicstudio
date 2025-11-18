import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/react-router';
import { Link } from 'react-router';

export function NavBar() {
  return (
    <nav className="w-full border-b border-pink-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
          <img
            src="/Webcomic-Studio-logo.svg"
            alt="WebComic Studio"
            className="h-6 w-auto"
          />
          <span className="sr-only">WebComic Studio</span>
        </Link>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 transition">Sign Up</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link to="/dashboard" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline">Dashboard</Link>
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'ring-2 ring-indigo-500' } }} />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
