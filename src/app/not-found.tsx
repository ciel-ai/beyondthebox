import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="wrap flex min-h-[80vh] flex-col justify-center pt-28">
        <h1 className="display display-xl">Not found</h1>
        <p className="mt-6 text-muted">That page doesn&apos;t exist, or the link has expired.</p>
        <Link href="/" className="btn btn-leaf mt-8 self-start">Back to the conclave</Link>
      </main>
    </>
  );
}
