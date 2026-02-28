import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CreateStore from "./pages/CreateStore";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import StoreSettings from "./pages/dashboard/StoreSettings";
import Categories from "./pages/dashboard/Categories";
import Products from "./pages/dashboard/Products";
import Orders from "./pages/dashboard/Orders";
import Coupons from "./pages/dashboard/Coupons";
import DeliveryZones from "./pages/dashboard/DeliveryZones";
import Reports from "./pages/dashboard/Reports";
import PublicStore from "./pages/PublicStore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/create-store" element={<CreateStore />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="store" element={<StoreSettings />} />
              <Route path="categories" element={<Categories />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="delivery-zones" element={<DeliveryZones />} />
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route path="/loja/:slug" element={<PublicStore />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
