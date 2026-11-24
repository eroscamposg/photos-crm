import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto grid min-h-screen max-w-lg content-center px-6"><h1 className="font-serif text-5xl">That page is not here.</h1><Link href="/" className="mt-6 underline">Back to the studio</Link></main>;
}
