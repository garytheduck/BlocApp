export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              BlocApp
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Administrare asociații de proprietari
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
