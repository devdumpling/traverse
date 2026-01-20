import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Product Store" },
    { name: "description", content: "Browse our amazing products" },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-4xl px-6 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Discover Amazing Products
          </h1>
          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            Browse our curated collection of high-quality items.
          </p>
          <div className="mt-10">
            <Link
              to="/products"
              className="inline-block rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-700"
              data-testid="browse-products"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
