import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalSettingsProvider } from "@/contexts/GlobalSettingsContext";
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
import DashboardUpdates from "./pages/dashboard/DashboardUpdates";
import DashboardUpdateDetail from "./pages/dashboard/DashboardUpdateDetail";
import Tables from "./pages/dashboard/Tables";
import Waiters from "./pages/dashboard/Waiters";

// Waiter App
import WaiterLogin from "./pages/waiter/WaiterLogin";
import WaiterDashboard from "./pages/waiter/WaiterDashboard";
import WaiterComandaDetail from "./pages/waiter/WaiterComandaDetail";
import WaiterCatalog from "./pages/waiter/WaiterCatalog";
import TableRedirect from "./pages/waiter/TableRedirect";

import PublicStore from "./pages/PublicStore";
import OrderStatus from "./pages/OrderStatus";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminStores from "./pages/admin/AdminStores";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLandingPage from "./pages/admin/AdminLandingPage";
import AdminClients from "./pages/admin/AdminClients";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminReports from "./pages/admin/AdminReports";
import AdminUpdates from "./pages/admin/AdminUpdates";
import AdminRoute from "./components/admin/AdminRoute";

// Domain configuration
const MAIN_DOMAINS = ["localhost", "127.0.0.1", "frfood.app", "www.frfood.app", "frfood.com.br", "www.frfood.com.br"];

const AppRouter = () => {
  const hostname = window.location.hostname;

  // Check if we are on a subdomain (e.g., pizzaria.localhost or pizzaria.frfood.app)
  const isMainDomain = MAIN_DOMAINS.includes(hostname);
  const isSubdomain = !isMainDomain && MAIN_DOMAINS.some(domain => hostname.endsWith("." + domain));

  if (isSubdomain) {
    // Extract slug: handles store.frfood.app, store.localhost, etc.
    const parts = hostname.split('.');
    const slug = parts[0] === 'www' ? parts[1] : parts[0];

    // Render only the store routes for subdomains
    return (
      <Routes>
        <Route path="/" element={<PublicStore explicitSlug={slug} />} />
        <Route path="/pedido/:id" element={<OrderStatus />} />
        <Route path="/mesa/:id" element={<TableRedirect />} />

        {/* Waiter routes for Subdomains */}
        <Route path="/garcom" element={<WaiterLogin explicitSlug={slug} />} />
        <Route path="/garcom/mesas" element={<WaiterDashboard explicitSlug={slug} />} />
        <Route path="/garcom/comanda/:id" element={<WaiterComandaDetail explicitSlug={slug} />} />
        <Route path="/garcom/comanda/:id/cardapio" element={<WaiterCatalog explicitSlug={slug} />} />

        <Route path="*" element={<PublicStore explicitSlug={slug} />} />
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
        <Route path="tables" element={<Tables />} />
        <Route path="waiters" element={<Waiters />} />
        <Route path="updates" element={<DashboardUpdates />} />
        <Route path="updates/:id" element={<DashboardUpdateDetail />} />
      </Route>
      <Route path="/loja/:slug" element={<PublicStore />} />
      <Route path="/pedido/:id" element={<OrderStatus />} />
      <Route path="/mesa/:id" element={<TableRedirect />} />

      {/* Waiter routes for Main Domain */}
      <Route path="/garcom" element={<WaiterLogin />} />
      <Route path="/loja/:slug/garcom" element={<WaiterLogin />} />
      <Route path="/loja/:slug/garcom/mesas" element={<WaiterDashboard />} />
      <Route path="/loja/:slug/garcom/comanda/:id" element={<WaiterComandaDetail />} />
      <Route path="/loja/:slug/garcom/comanda/:id/cardapio" element={<WaiterCatalog />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute />}>
        <Route index element={<AdminDashboard />} />
        <Route path="stores" element={<AdminStores />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="landing-page" element={<AdminLandingPage />} />
        <Route path="updates" element={<AdminUpdates />} />
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
          <GlobalSettingsProvider>
            <AppRouter />
          </GlobalSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

