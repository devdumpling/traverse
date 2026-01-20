import { useState } from "react";
import "./index.css";

const products = [
  { id: 1, name: "Wireless Headphones", price: 99, category: "Electronics", description: "Premium wireless headphones with noise cancellation and 30-hour battery life." },
  { id: 2, name: "Leather Backpack", price: 149, category: "Accessories", description: "Handcrafted genuine leather backpack with laptop compartment." },
  { id: 3, name: "Smart Watch", price: 299, category: "Electronics", description: "Feature-rich smartwatch with health tracking and GPS." },
  { id: 4, name: "Running Shoes", price: 129, category: "Footwear", description: "Lightweight running shoes with responsive cushioning." },
  { id: 5, name: "Coffee Maker", price: 79, category: "Home", description: "Programmable coffee maker with thermal carafe." },
  { id: 6, name: "Desk Lamp", price: 45, category: "Home", description: "Adjustable LED desk lamp with multiple brightness levels." },
];

type Page = "home" | "products" | "detail";

function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900">
            Discover Amazing Products
          </h1>
          <p className="mt-6 text-lg text-zinc-600">
            Browse our curated collection of high-quality items.
          </p>
          <div className="mt-10">
            <button
              onClick={() => onNavigate("products")}
              className="inline-block rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-700"
              data-testid="browse-products"
            >
              Browse Products
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProductsPage({ onNavigate, onSelectProduct }: { onNavigate: (page: Page) => void; onSelectProduct: (id: number) => void }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-zinc-900">Products</h1>
          <button
            onClick={() => onNavigate("home")}
            className="text-blue-600 hover:underline"
          >
            Back to Home
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => onSelectProduct(product.id)}
              className="group rounded-xl border border-zinc-200 bg-white p-6 text-left transition hover:border-blue-500 hover:shadow-lg"
              data-testid={`product-card-${product.id}`}
            >
              <div className="mb-4 h-32 rounded-lg bg-zinc-100" />
              <span className="text-sm text-zinc-500">{product.category}</span>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 group-hover:text-blue-600">
                {product.name}
              </h2>
              <p className="mt-2 text-xl font-bold text-zinc-900">
                ${product.price}
              </p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function ProductDetailPage({ productId, onNavigate }: { productId: number; onNavigate: (page: Page) => void }) {
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-xl text-zinc-600">Product not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <button
          onClick={() => onNavigate("products")}
          className="mb-8 inline-block text-blue-600 hover:underline"
          data-testid="back-link"
        >
          ← Back to Products
        </button>

        <div className="rounded-xl border border-zinc-200 bg-white p-8">
          <div className="mb-6 h-64 rounded-lg bg-zinc-100" />
          <span className="text-sm text-zinc-500">{product.category}</span>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900">{product.name}</h1>
          <p className="mt-4 text-lg text-zinc-600">{product.description}</p>
          <p className="mt-6 text-3xl font-bold text-zinc-900">${product.price}</p>
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

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedProduct, setSelectedProduct] = useState<number>(1);

  const handleSelectProduct = (id: number) => {
    setSelectedProduct(id);
    setPage("detail");
  };

  if (page === "home") {
    return <HomePage onNavigate={setPage} />;
  }

  if (page === "products") {
    return <ProductsPage onNavigate={setPage} onSelectProduct={handleSelectProduct} />;
  }

  return <ProductDetailPage productId={selectedProduct} onNavigate={setPage} />;
}

export default App;
