export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sysde-bg px-4 py-12">
      {children}
    </main>
  );
}
