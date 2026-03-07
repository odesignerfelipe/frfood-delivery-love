import { useStore } from "@/hooks/useStore";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Package, DollarSign, TrendingUp, Bell, Plus, Eye, Pencil, Power, Wallet, ArrowRight, User, Clock, LayoutDashboard, Calculator, Receipt, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, checkStoreStatus } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DashboardHome = () => {
  const { store, updateStore } = useStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ orders: 0, products: 0, revenue: 0, todayOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [toggling, setToggling] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [openRegisterOpen, setOpenRegisterOpen] = useState(false);
  const [closeRegisterOpen, setCloseRegisterOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [isProcessingSession, setIsProcessingSession] = useState(false);
  const isOpenNow = checkStoreStatus(store);

  useOrderNotifications(store?.id, (store as any)?.audio_notifications !== false);

  const fetchStats = useCallback(async () => {
    if (!store) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const [ordersRes, productsRes, todayRes, recentRes, sessionRes] = await Promise.all([
      supabase.from("orders").select("id, total").eq("store_id", store.id),
      supabase.from("products").select("id").eq("store_id", store.id),
      supabase.from("orders").select("id, total, delivery_type, status, payment_method").eq("store_id", store.id).gte("created_at", todayStr),
      supabase.from("orders").select("*, table:tables(name), waiter:waiters(name)").eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("cashier_sessions").select("*").eq("store_id", store.id).eq("status", "open").maybeSingle(),
    ]);

    setStats({
      orders: ordersRes.data?.length || 0,
      products: productsRes.data?.length || 0,
      revenue: todayRes.data?.reduce((s, o) => s + (o.total || 0), 0) || 0,
      todayOrders: todayRes.data?.length || 0,
    });
    setRecentOrders(recentRes.data || []);
    setActiveSession(sessionRes.data);
  }, [store]);

  useEffect(() => {
    fetchStats();

    if (!store) return;
    const channel = supabase
      .channel("dashboard-stats-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [store, fetchStats]);

  const toggleStore = async () => {
    if (!store) return;
    setToggling(true);
    const newIsOpen = !store.is_open;
    const newStatusMode = newIsOpen ? "manual_open" : "manual_closed";

    const { error } = await updateStore({
      is_open: newIsOpen,
      status_mode: newStatusMode
    } as any);

    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(store.is_open ? "Loja fechada!" : "Loja aberta!");
    }
    setToggling(false);
  };

  const handleOpenCashier = async () => {
    if (!store) return;
    setIsProcessingSession(true);
    try {
      const { data, error } = await supabase.from("cashier_sessions").insert({
        store_id: store.id,
        opening_balance: Number(openingBalance) || 0,
        status: "open",
        opened_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      setActiveSession(data);
      setOpenRegisterOpen(false);
      toast.success("Caixa aberto com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao abrir caixa");
    } finally {
      setIsProcessingSession(false);
    }
  };

  const handleCloseCashier = async () => {
    if (!activeSession) return;
    setIsProcessingSession(true);
    try {
      const { error } = await supabase.from("cashier_sessions").update({
        status: "closed",
        closing_balance: stats.revenue + activeSession.opening_balance,
        closed_at: new Date().toISOString()
      }).eq("id", activeSession.id);

      if (error) throw error;
      setActiveSession(null);
      setCloseRegisterOpen(false);
      toast.success("Caixa fechado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao fechar caixa");
    } finally {
      setIsProcessingSession(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Frente de Caixa</h2>
        <div className="text-xs text-muted-foreground font-medium hidden sm:block">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
      </div>

      {/* Stats Summary - POS Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign className="w-24 h-24" />
          </div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Vendas Hoje</p>
          <p className="text-3xl font-black text-foreground">{formatCurrency(stats.revenue)}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Em tempo real
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Pedidos Ativos</p>
          <p className="text-3xl font-black text-foreground">{recentOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length}</p>
          <div className="mt-4 flex items-center gap-4 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-orange-500 uppercase"><Clock className="w-3 h-3" /> {recentOrders.filter(o => o.status === 'pending').length} Pendentes</span>
            <span className="flex items-center gap-1 text-blue-500 uppercase"><TrendingUp className="w-3 h-3" /> {recentOrders.filter(o => o.status === 'preparing').length} Preparando</span>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Status do Caixa</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${activeSession ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-lg font-black text-foreground uppercase">{activeSession ? 'Operacional' : 'Fechado'}</p>
            </div>
          </div>
          {activeSession ? (
            <Dialog open={closeRegisterOpen} onOpenChange={setCloseRegisterOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-4 h-9 font-bold border-destructive/30 text-destructive hover:bg-destructive/10">
                  <Calculator className="w-4 h-4 mr-2" /> Encerrar Turno
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted rounded-xl space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Saldo Inicial:</span>
                      <span className="font-bold">{formatCurrency(activeSession.opening_balance)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Vendas do Turno:</span>
                      <span className="font-bold">{formatCurrency(stats.revenue)}</span>
                    </div>
                    <div className="border-t border-border mt-2 pt-2 flex justify-between text-lg font-black">
                      <span>Total em Caixa:</span>
                      <span>{formatCurrency(activeSession.opening_balance + stats.revenue)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic text-center">Ao fechar, o resumo será enviado para os relatórios financeiros.</p>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCloseRegisterOpen(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleCloseCashier} disabled={isProcessingSession}>Confirmar Fechamento</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={openRegisterOpen} onOpenChange={setOpenRegisterOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" size="sm" className="w-full mt-4 h-9 font-bold">
                  <Wallet className="w-4 h-4 mr-2" /> Abrir Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Abertura de Caixa</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Fundo de Caixa (Saldo Inicial)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={openingBalance}
                      onChange={e => setOpeningBalance(e.target.value)}
                      className="text-2xl font-black h-14"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenRegisterOpen(false)}>Cancelar</Button>
                  <Button onClick={handleOpenCashier} disabled={isProcessingSession}>Iniciar Operação</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Loja Online</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${isOpenNow ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-lg font-black text-foreground uppercase">{isOpenNow ? 'Visível' : 'Indisponível'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 p-2 bg-muted/50 rounded-lg">
            <span className="text-xs font-bold text-muted-foreground uppercase">Mudar Status</span>
            <Switch checked={isOpenNow} onCheckedChange={toggleStore} disabled={toggling} />
          </div>
        </div>
      </div>

      {/* POS Monitor */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <Tabs defaultValue="all" className="w-full">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-foreground text-lg uppercase">Monitor de Pedidos</h3>
                </div>
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="all" className="text-xs font-bold uppercase">Todos</TabsTrigger>
                  <TabsTrigger value="waiter" className="text-xs font-bold uppercase">Mesa/Garçom</TabsTrigger>
                  <TabsTrigger value="delivery" className="text-xs font-bold uppercase">Delivery</TabsTrigger>
                  <TabsTrigger value="counter" className="text-xs font-bold uppercase">Balcão</TabsTrigger>
                </TabsList>
              </div>

              <div className="p-0">
                <TabsContent value="all" className="m-0">
                  <OrderList orders={recentOrders} navigate={navigate} />
                </TabsContent>
                <TabsContent value="waiter" className="m-0">
                  <OrderList orders={recentOrders.filter(o => o.delivery_type === 'table')} navigate={navigate} />
                </TabsContent>
                <TabsContent value="delivery" className="m-0">
                  <OrderList orders={recentOrders.filter(o => o.delivery_type === 'delivery' || o.delivery_type === 'pickup')} navigate={navigate} />
                </TabsContent>
                <TabsContent value="counter" className="m-0">
                  <OrderList orders={recentOrders.filter(o => !['table', 'delivery', 'pickup'].includes(o.delivery_type))} navigate={navigate} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Right Sidebar - Shortcuts & Alerts */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <h4 className="font-black text-foreground uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" /> Acesso Rápido
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction icon={<Plus />} label="Novo Pedido" onClick={() => navigate("/dashboard/orders")} color="bg-primary/10 text-primary" />
              <QuickAction icon={<Package />} label="Estoque" onClick={() => navigate("/dashboard/inventory")} color="bg-orange-500/10 text-orange-500" />
              <QuickAction icon={<DollarSign />} label="Financeiro" onClick={() => navigate("/dashboard/financials")} color="bg-emerald-500/10 text-emerald-500" />
              <QuickAction icon={<User />} label="Garçons" onClick={() => navigate("/dashboard/waiters")} color="bg-blue-500/10 text-blue-500" />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <h4 className="font-black text-foreground uppercase tracking-widest text-xs mb-4 flex items-center gap-2 text-orange-500">
              <Bell className="w-4 h-4 animate-bounce" /> Alertas de Caixa
            </h4>
            <div className="space-y-3">
              {recentOrders.filter(o => o.status === 'pending').map(order => (
                <div key={order.id} className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground leading-none">Novo #{order.order_number}</p>
                    <p className="text-[10px] text-muted-foreground uppercase mt-1 font-bold">{order.delivery_type === 'table' ? `MESA: ${order.table?.name}` : 'BALCÃO'}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => navigate("/dashboard/orders")}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {recentOrders.filter(o => o.status === 'pending').length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">Sem novos alertas no momento.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderList = ({ orders, navigate }: { orders: any[], navigate: any }) => {
  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready_for_pickup: "Pronto p/ Retirada",
    delivering: "Em entrega",
    delivered: "Entregue",
    picked_up: "Retirado",
    cancelled: "Cancelado",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-orange-100 text-orange-700",
    confirmed: "bg-blue-100 text-blue-700",
    preparing: "bg-indigo-100 text-indigo-700",
    ready_for_pickup: "bg-emerald-100 text-emerald-700",
    delivering: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    picked_up: "bg-slate-100 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
  };

  const channelIcons: Record<string, any> = {
    table: <Smartphone className="w-4 h-4" />,
    delivery: <ShoppingBag className="w-4 h-4" />,
    pickup: <Package className="w-4 h-4" />,
  };

  if (orders.length === 0) {
    return <div className="p-12 text-center text-muted-foreground text-sm italic">Nenhum pedido encontrado nesta categoria.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {orders.map((order) => (
        <div
          key={order.id}
          className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer group"
          onClick={() => navigate("/dashboard/orders")}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${order.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
              {channelIcons[order.delivery_type] || <Receipt className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-foreground uppercase tracking-tight">#{order.order_number}</p>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${statusColors[order.status]}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {order.delivery_type === "table" ? (order.table?.name || "Mesa") : (order.customer_name || "Cliente Balcão")}
                <span className="mx-2 opacity-30">|</span>
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-primary tracking-tighter">{formatCurrency(order.total)}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{order.payment_method?.replace('_', ' ') || 'A definir'}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const QuickAction = ({ icon, label, onClick, color }: { icon: any, label: string, onClick: () => void, color: string }) => (
  <button
    onClick={onClick}
    className={`${color} rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-sm border border-black/5`}
  >
    <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default DashboardHome;
