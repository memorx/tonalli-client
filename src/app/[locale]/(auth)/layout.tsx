export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      {children}
    </div>
  )
}
