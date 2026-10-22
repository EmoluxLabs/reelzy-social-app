import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
      <div className="text-7xl font-black brand-gradient-text mb-2">404</div>
      <p className="text-obs-dim mb-6">This corner of the Circle is quiet.</p>
      <Link href="/" className="btn-primary">Back home</Link>
    </div>
  );
}
