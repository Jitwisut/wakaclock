import { GithubIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateMeta } from '@/lib/utils';

export function generateMetadata() {
  return generateMeta({
    title: 'Login Page',
    description:
      "A login form with email and password. There's an option to login with Google and a link to sign up if you don't have an account.",
    canonical: '/login/v1',
  });
}

export default function Page() {
  return (
    <div className="flex pb-8 lg:h-screen lg:pb-0">
      <div className="hidden w-1/2 bg-gray-100 lg:block">
        <Image
          alt="shadcn/ui login page"
          className="h-full w-full object-cover"
          height={1000}
          src="/images/extra/image4.jpg"
          unoptimized
          width={1000}
        />
      </div>

      <div className="flex w-full items-center justify-center lg:w-1/2">
        <div className="w-full max-w-md space-y-8 px-4">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-2 text-sm">Please sign in to your account</p>
          </div>

          <form className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="sr-only" htmlFor="email">
                  Email address
                </Label>
                <Input
                  autoComplete="email"
                  className="w-full"
                  id="email"
                  name="email"
                  placeholder="Email address"
                  required
                  type="email"
                />
              </div>
              <div>
                <Label className="sr-only" htmlFor="password">
                  Password
                </Label>
                <Input
                  autoComplete="current-password"
                  className="w-full"
                  id="password"
                  name="password"
                  placeholder="Password"
                  required
                  type="password"
                />
              </div>
              <div className="text-end">
                <Link
                  className="ml-auto inline-block text-sm underline"
                  href="/dashboard/forgot-password"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <Button className="w-full" type="submit">
                Sign in
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-3">
              <div className="w-full border-t" />
              <span className="text-muted-foreground shrink-0 text-sm">or continue with</span>
              <div className="w-full border-t" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button className="w-full" variant="outline">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="currentColor"
                  />
                </svg>
                Google
              </Button>
              <Button className="w-full" variant="outline">
                <GithubIcon />
                GitHub
              </Button>
            </div>

            <div className="mt-6 text-center text-sm">
              Don&apos;t have an account?{' '}
              <Link className="underline" href="/dashboard/register/v1">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
