import { Button } from '@ship/ui'

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center space-y-6 px-4">
      {/* Ship Logo */}
      <div className="text-center">
        <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-background" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Ship
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Agent that works autonomously in the background
        </p>
      </div>

      {/* Sign in Button */}
      <div className="w-full">
        <a href="/api/auth/github">
          <Button className="w-full">
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Sign in with GitHub
          </Button>
        </a>
      </div>

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
