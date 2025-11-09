import type { Route } from "./+types/home";
import { SignedOut, SignInButton, SignUpButton } from '@clerk/react-router';
import { Link } from 'react-router';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return(
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Publish your webcomic in minutes
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Create chapters, upload pages, and point your custom domain. We handle the site so you can focus on the story.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className="inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition">
                    Get started — it’s free
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:text-white dark:border-gray-700 dark:hover:bg-gray-800 transition">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
              <Link to="#features" className="text-indigo-600 hover:underline text-base">
                Learn more →
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-950 dark:to-pink-950 p-4">
              <div className="h-full w-full rounded-lg bg-white/70 dark:bg-gray-950/70 border border-gray-200/60 dark:border-gray-800/60 grid place-items-center text-center">
                <div>
                  <p className="text-sm uppercase tracking-widest text-gray-500">Preview</p>
                  <p className="mt-1 font-medium text-gray-700 dark:text-gray-200">Your webcomic homepage & chapter list</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
