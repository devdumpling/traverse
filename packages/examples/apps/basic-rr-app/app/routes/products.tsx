import { Link } from "react-router";

const products = [
  { id: 1, name: "Wireless Headphones", price: 99, category: "Electronics" },
  { id: 2, name: "Leather Backpack", price: 149, category: "Accessories" },
  { id: 3, name: "Smart Watch", price: 299, category: "Electronics" },
  { id: 4, name: "Running Shoes", price: 129, category: "Footwear" },
  { id: 5, name: "Coffee Maker", price: 79, category: "Home" },
  { id: 6, name: "Desk Lamp", price: 45, category: "Home" },
];

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Products
          </h1>
          <Link
            to="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to Home
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition hover:border-blue-500 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
              data-testid={`product-card-${product.id}`}
            >
              <div className="mb-4 h-32 rounded-lg bg-zinc-100 dark:bg-zinc-700" />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {product.category}
              </span>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-white">
                {product.name}
              </h2>
              <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">
                ${product.price}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
