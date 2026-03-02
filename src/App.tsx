import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Checkout from "./pages/Checkout";
import ResetPassword from "./pages/ResetPassword";
import CreateStore from "./pages/CreateStore";
import DemoStore from "./pages/DemoStore";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import StoreSettings from "./pages/dashboard/StoreSettings";
import Categories from "./pages/dashboard/Categories";
import Products from "./pages/dashboard/Products";
import Orders from "./pages/dashboard/Orders";
import Coupons from "./pages/dashboard/Coupons";
import DeliveryZones from "./pages/dashboard/DeliveryZones";
import Reports from "./pages/dashboard/Reports";
import Customers from "./pages/dashboard/Customers";
import PublicStore from "./pages/PublicStore";
import OrderStatus from "./pages/OrderStatus";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminStores from "./pages/admin/AdminStores";
import AdminLandingPage from "./pages/admin/AdminLandingPage";
import AdminRoute from "./components/admin/AdminRoute";

// Domain configuration
const MAIN_DOMAINS = ["localhost", "127.0.0.1", "frfood.app", "www.frfood.app", "frfood.com.br", "www.frfood.com.br"];

const AppRouter = () => {
  const hostname = window.location.hostname;

  // Check if we are on a subdomain (e.g., pizzaria.localhost or pizzaria.frfood.app)
  const isSubdomain = !MAIN_DOMAINS.includes(hostname);

  if (isSubdomain) {
    const slug = hostname.split('.')[0];

    // Render only the store routes for subdomains
    return (
      <Routes>
        <Route path="/" element={<PublicStore explicitSlug={slug} />} />
        <Route path="/pedido/:id" element={<OrderStatus />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Main domain routes
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/create-store" element={<CreateStore />} />
      <Route path="/demo" element={<DemoStore />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="store" element={<StoreSettings />} />
        <Route path="categories" element={<Categories />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="delivery-zones" element={<DeliveryZones />} />
        <Route path="reports" element={<Reports />} />
        <Route path="customers" element={<Customers />} />
      </Route>
      <Route path="/loja/:slug" element={<PublicStore />} />
      <Route path="/pedido/:id" element={<OrderStatus />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute />}>
        <Route index element={<AdminDashboard />} />
        <Route path="stores" element={<AdminStores />} />
        <Route path="landing-page" element={<AdminLandingPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
