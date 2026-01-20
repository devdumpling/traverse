import Link from "next/link";
import { notFound } from "next/navigation";

const products = [
  { id: 1, name: "Wireless Headphones", price: 99, category: "Electronics", description: "Premium wireless headphones with noise cancellation and 30-hour battery life." },
  { id: 2, name: "Leather Backpack", price: 149, category: "Accessories", description: "Handcrafted genuine leather backpack with laptop compartment." },
  { id: 3, name: "Smart Watch", price: 299, category: "Electronics", description: "Feature-rich smartwatch with health tracking and GPS." },
  { id: 4, name: "Running Shoes", price: 129, category: "Footwear", description: "Lightweight running shoes with responsive cushioning." },
  { id: 5, name: "Coffee Maker", price: 79, category: "Home", description: "Programmable coffee maker with thermal carafe." },
  { id: 6, name: "Desk Lamp", price: 45, category: "Home", description: "Adjustable LED desk lamp with multiple brightness levels." },
];

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = products.find((p) => p.id === parseInt(id));

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/products"
          className="mb-8 inline-block text-blue-600 hover:underline dark:text-blue-400"
          data-testid="back-link"
        >
          ← Back to Products
        </Link>

        <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-6 h-64 rounded-lg bg-zinc-100 dark:bg-zinc-700" />
          
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {product.category}
          </span>
          
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
            {product.name}
          </h1>
          
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            {product.description}
          </p>
          
          <p className="mt-6 text-3xl font-bold text-zinc-900 dark:text-white">
            ${product.price}
          </p>
          
          <button
            className="mt-8 w-full rounded-lg bg-blue-600 py-4 text-lg font-semibold text-white transition hover:bg-blue-700"
            data-testid="add-to-cart"
          >
            Add to Cart
          </button>
        </div>
      </main>
    </div>
  );
}
