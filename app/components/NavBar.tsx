import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/react-router';
import { Link } from 'react-router';
import { Button as ButtonPrimary } from './Button';
import { ButtonBase } from './design-system';

export function NavBar() {
  return (
    <nav className="w-full">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
          <img
            src="/Webcomic-Studio-logo.svg"
            alt="WebComic Studio"
            className="h-8 w-auto"
          />
          <span className="sr-only">WebComic Studio</span>
        </Link>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <ButtonBase>Log In</ButtonBase>
            </SignInButton>
            <SignUpButton mode="modal">
              <ButtonPrimary size="sm">Sign Up</ButtonPrimary>
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
