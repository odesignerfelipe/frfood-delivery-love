import { useStore } from "@/hooks/useStore";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Package, DollarSign, TrendingUp, Bell, Plus, Eye, Pencil, Power, Wallet, ArrowRight, User, Clock, LayoutDashboard, Calculator, Receipt, Smartphone, Table2, Search, Minus, Trash2, Send, Check, Printer, ChevronDown, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { printerService } from "@/lib/printer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ManualOrderDialog from "@/components/dashboard/ManualOrderDialog";


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
  const [tables, setTables] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  // Table Management State
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [activeComanda, setActiveComanda] = useState<any>(null);
  const [comandaOrders, setComandaOrders] = useState<any[]>([]);
  const [isLoadingComanda, setIsLoadingComanda] = useState(false);
  const [pixPayments, setPixPayments] = useState<any[]>([]);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);


  // Product Launching State
  const [isLaunching, setIsLaunching] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productVariations, setProductVariations] = useState<Record<string, any[]>>({});
  const [waiters, setWaiters] = useState<any[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [isSendingOrder, setIsSendingOrder] = useState(false);

  // Variation Modal State
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProduct, setVariationProduct] = useState<any>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [itemNotes, setItemNotes] = useState("");
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");

  // Closing Bill State
  const [closingBillOpen, setClosingBillOpen] = useState(false);
  const [discount, setDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [isClosingComanda, setIsClosingComanda] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<any[]>([]);
  const isOpenNow = checkStoreStatus(store);

  // useOrderNotifications(store?.id, (store as any)?.audio_notifications !== false);

  const fetchStats = useCallback(async () => {
    if (!store) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const [statsRes, recentRes, sessionRes, tablesRes, waitersRes, lowStockRes, printerSettingsRes] = await Promise.all([
      supabase.rpc("get_store_stats", { store_id: store.id }),
      supabase.from("orders").select("*, table:tables(name), waiter:waiters(name)").eq("store_id", store.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("cashier_sessions").select("*").eq("store_id", store.id).eq("status", "open").maybeSingle(),
      supabase.from("tables").select("*").eq("store_id", store.id).order("name"),
      supabase.from("waiters").select("*").eq("store_id", store.id).eq("is_active", true),
      supabase.from("inventory_items").select("*").eq("store_id", store.id),
      supabase.from("printer_settings").select("*").eq("store_id", store.id).eq("is_active", true)
    ]);

    setStats(statsRes.data || { orders: 0, products: 0, revenue: 0, todayOrders: 0 });
    setRecentOrders(recentRes.data || []);
    setActiveSession(sessionRes.data);
    setTables(tablesRes.data || []);
    setWaiters(waitersRes.data || []);
    setPrinterSettings(printerSettingsRes.data || []);
    
    // Calculate low stock items
    const inventory = lowStockRes.data || [];
    setLowStockItems(inventory.filter((item: any) => item.current_stock <= item.min_stock));
  }, [store]);

  const fetchCatalog = useCallback(async () => {
    if (!store) return;
    const [cats, prods] = await Promise.all([
      supabase.from("categories").select("*").eq("store_id", store.id).eq("is_active", true).order("sort_order"),
      supabase.from("products").select("*").eq("store_id", store.id).eq("is_active", true).order("sort_order"),
    ]);
    setCategories(cats.data || []);
    setProducts(prods.data || []);

    const productIds = (prods.data || []).map((p: any) => p.id);
    if (productIds.length > 0) {
      const { data: vars } = await supabase.from("product_variations").select("*").in("product_id", productIds).order("sort_order");
      const varMap: Record<string, any[]> = {};
      (vars || []).forEach((v: any) => {
        if (!varMap[v.product_id]) varMap[v.product_id] = [];
        varMap[v.product_id].push(v);
      });
      setProductVariations(varMap);
    }
  }, [store]);

  const fetchComandaDetails = async (comandaId: string) => {
    setIsLoadingComanda(true);
    try {
      const { data: comandaData, error: comandaError } = await supabase
        .from("comandas")
        .select("*")
        .eq("id", comandaId)
        .single();
      if (comandaError) throw comandaError;

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("comanda_id", comandaId)
        .order("created_at", { ascending: false });
      if (ordersError) throw ordersError;

      setActiveComanda(comandaData);
      setComandaOrders(ordersData || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar detalhes da comanda");
    } finally {
      setIsLoadingComanda(false);
    }
  };

  const handleOpenComanda = async () => {
    if (!store || !selectedTable) return;
    setIsLoadingComanda(true);
    try {
      const { data, error } = await supabase
        .from("comandas")
        .insert({
          store_id: store.id,
          table_id: selectedTable.id,
          waiter_id: selectedWaiterId || null,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;
      setActiveComanda(data);
      fetchStats();
      toast.success("Comanda aberta com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao abrir comanda");
    } finally {
      setIsLoadingComanda(false);
    }
  };

  const handleTableClick = (table: any) => {
    const comanda = table.comandas?.find((c: any) => c.status === 'open');
    setSelectedTable(table);
    setActiveComanda(comanda || null);
    setTableModalOpen(true);

    if (comanda) {
      fetchComandaDetails(comanda.id);
    } else {
      setComandaOrders([]);
    }
  };

  const handleAddToCart = (product: any) => {
    if (product.is_sold_out || (product.manage_stock && product.stock_quantity <= 0)) {
      toast.error("Produto esgotado");
      return;
    }

    const vars = productVariations[product.id];
    if (vars && vars.length > 0) {
      setVariationProduct(product);
      setVariationSelections({});
      setItemNotes("");
      setVariationModalOpen(true);
    } else {
      addToCartDirect(product, [], 0, "");
    }
  };

  const addToCartDirect = (product: any, selectedVariations: any[], variationsPrice: number, notes: string) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i =>
        i.product.id === product.id &&
        i.notes === notes &&
        JSON.stringify(i.variations) === JSON.stringify(selectedVariations)
      );

      if (existingIdx >= 0) {
        const newCart = [...prev];
        newCart[existingIdx].quantity += 1;
        return newCart;
      }

      return [...prev, {
        id: crypto.randomUUID(),
        product,
        quantity: 1,
        notes,
        variations: selectedVariations,
        variationsPrice
      }];
    });
    setTableModalOpen(false); // Close table modal temporarily to show toast better or just keep it
    toast.success(`${product.name} adicionado ao rascunho`);
  };

  const confirmVariationSelection = () => {
    if (!variationProduct) return;
    const vars = productVariations[variationProduct.id] || [];

    for (const v of vars) {
      if (v.required) {
        const selected = variationSelections[v.id] || [];
        if (selected.length === 0) {
          toast.error(`Selecione uma opção para "${v.name}"`);
          return;
        }
      }
    }

    const selectedVariations: any[] = [];
    let totalVarPrice = 0;
    for (const v of vars) {
      const selected = variationSelections[v.id] || [];
      if (selected.length > 0) {
        selectedVariations.push({ group: v.name, selected });
        totalVarPrice += selected.reduce((sum, s) => sum + s.price, 0);
      }
    }

    addToCartDirect(variationProduct, selectedVariations, totalVarPrice, itemNotes);
    setVariationModalOpen(false);
    setVariationProduct(null);
  };

  const toggleVariationOption = (variationId: string, option: { name: string; price: number }, maxSelections: number) => {
    setVariationSelections(prev => {
      const current = prev[variationId] || [];
      const exists = current.find(o => o.name === option.name);
      if (exists) {
        return { ...prev, [variationId]: current.filter(o => o.name !== option.name) };
      }
      if (maxSelections === 1) {
        return { ...prev, [variationId]: [option] };
      }
      if (current.length >= maxSelections) {
        toast.error(`Máximo de ${maxSelections} opções`);
        return prev;
      }
      return { ...prev, [variationId]: [...current, option] };
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(i => i.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const getItemPrice = (item: any) => {
    const basePrice = item.product.promotional_price > 0 ? Number(item.product.promotional_price) : Number(item.product.price);
    return basePrice + item.variationsPrice;
  };

  const cartSubtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);

  const handleSendOrder = async () => {
    if (!store || !activeComanda || cart.length === 0) return;
    setIsSendingOrder(true);

    try {
      const orderId = crypto.randomUUID();

      const { error: orderError } = await supabase.from("orders").insert({
        id: orderId,
        store_id: store.id,
        origin: "cashier",
        comanda_id: activeComanda.id,
        table_id: selectedTable.id,
        waiter_id: selectedWaiterId || null,
        subtotal: cartSubtotal,
        total: cartSubtotal,
        status: "pending",
        payment_method: "comanda",
        delivery_type: "table",
        customer_name: posCustomerName || "Mesa " + (selectedTable.name.replace('Mesa ', '')),
        customer_phone: posCustomerPhone || "00000000000"
      });

      if (orderError) throw orderError;

      // Register customer if phone is provided
      if (posCustomerPhone && posCustomerPhone !== "00000000000") {
        try {
          await supabase.rpc('register_customer_from_order', {
            p_store_id: store.id,
            p_name: posCustomerName || "Mesa " + (selectedTable.name.replace('Mesa ', '')),
            p_phone: posCustomerPhone,
            p_address: "",
            p_neighborhood: "",
            p_total_spent: cartSubtotal
          });
        } catch (custErr) {
          console.error("Error registering customer from POS:", custErr);
        }
      }

      const { error: itemsError } = await supabase.from("order_items").insert(
        cart.map((i) => ({
          order_id: orderId,
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: getItemPrice(i),
          subtotal: getItemPrice(i) * i.quantity,
          notes: i.notes,
          variations: (i.variations.length > 0 ? i.variations : []) as any,
        }))
      );

      if (itemsError) throw itemsError;

      toast.success("Pedido enviado para a cozinha!");
      setCart([]);
      setPosCustomerName("");
      setPosCustomerPhone("");
      setIsLaunching(false);
      setTableModalOpen(true);
      fetchComandaDetails(activeComanda.id);

    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar pedido");
    } finally {
      setIsSendingOrder(false);
    }
  };

  const handleCloseBill = async () => {
    if (!activeComanda) return;
    setIsClosingComanda(true);
    const subtotal = comandaOrders
      .filter(o => o.status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total), 0);
    const discountVal = Number(discount) || 0;
    const finalTotal = Math.max(0, subtotal - discountVal);

    try {
      // 1. Update comanda status
      const comandaUpdateData: any = {
        status: "closed",
        subtotal: subtotal,
        discount: discountVal,
        total: finalTotal,
        payment_method: paymentMethod
      };

      const { error: comandaError } = await supabase
        .from("comandas")
        .update({ ...comandaUpdateData, closed_at: new Date().toISOString() })
        .eq("id", activeComanda.id);

      if (comandaError) {
        if (comandaError.message.includes('closed_at')) {
          const { error: retryError } = await supabase
            .from("comandas")
            .update(comandaUpdateData)
            .eq("id", activeComanda.id);
          if (retryError) throw retryError;
        } else {
          throw comandaError;
        }
      }

      // 2. Free up the table - Ultra Resilient Approach
      try {
        const { error: tableError } = await supabase
          .from("tables")
          .update({ status: "available", current_comanda_id: null })
          .eq("id", activeComanda.table_id);

        if (tableError) {
          console.warn("Table update failed, trying fallback:", tableError.message);
          // Fallback: Try without current_comanda_id
          const { error: fallback1 } = await supabase
            .from("tables")
            .update({ status: "available" })
            .eq("id", activeComanda.table_id);

          if (fallback1) {
            console.error("Critical: Table status update failed even with basic columns:", fallback1.message);
            // Non-blocking: Proceed to success toast even if table status update fails due to cache
          }
        }
      } catch (err) {
        console.error("Unexpected error updating table:", err);
      }

      // 3. Record in Financials
      const { error: financialError } = await supabase.from("financial_transactions").insert({
        store_id: store.id,
        description: `Venda Mesa ${selectedTable.name.replace('Mesa ', '')}`,
        amount: finalTotal,
        type: "entry",
        status: "paid",
        paid_at: new Date().toISOString(),
        due_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: paymentMethod
      });

      if (financialError) console.error("Error recording financial transaction:", financialError);

      toast.success("Conta encerrada com sucesso!");
      setClosingBillOpen(false);
      setTableModalOpen(false);
      fetchStats();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao encerrar conta");
    } finally {
      setIsClosingComanda(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm("Deseja realmente cancelar este pedido?")) return;
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled", cancellation_reason: "Cancelado pelo caixa" })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Pedido cancelado");
      fetchComandaDetails(activeComanda.id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar o pedido");
    }
  };

  const handlePrintComanda = async () => {
    if (!activeComanda || !store) return;

    const subtotal = comandaOrders
      .filter(o => o.status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total), 0);
    const discountVal = Number(discount) || 0;
    const total = subtotal - discountVal;

    const html = `
      <html><body style="font-family:monospace; width:300px">
        <h2 style="text-align:center">${store.name}</h2>
        <p style="text-align:center; font-size:12px">MESA: ${selectedTable?.name}</p>
        <p style="text-align:center; font-size:10px">${new Date().toLocaleString()}</p>
        <hr/>
        ${comandaOrders.filter(o => o.status !== 'cancelled').map(o => `
          ${o.order_items.map((i: any) => `
            <div style="display:flex; justify-content:space-between">
              <span>${i.quantity}x ${i.product_name}</span>
              <span>${formatCurrency(i.subtotal)}</span>
            </div>
          `).join('')}
        `).join('')}
        <hr/>
        <div style="display:flex; justify-content:space-between; font-weight:bold">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${discountVal > 0 ? `<div style="display:flex; justify-content:space-between"><span>Desconto</span><span>-${formatCurrency(discountVal)}</span></div>` : ""}
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px; mt-2; border-top:1px solid #000; pt-2">
          <span>TOTAL</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </body></html>
    `;

    const cashierPrinter = printerSettings.find(s => s.type === 'cashier');
    if (cashierPrinter) {
      await printerService.printHTML(cashierPrinter.identifier, html);
    } else {
      const win = window.open("", "_blank", "width=350,height=600");
      if (win) { win.document.write(html); win.document.close(); win.print(); }
    }
  };

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

      // Record in Financials
      const { error: financialError } = await supabase.from("financial_transactions").insert({
        store_id: store.id,
        description: "Abertura de Caixa",
        amount: Number(openingBalance) || 0,
        type: "entry",
        status: "paid",
        paid_at: new Date().toISOString(),
        due_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "dinheiro"
      });

      if (financialError) console.error("Error recording financial transaction:", financialError);

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

      // Record in Financials (Exit of the total balance to "empty" the drawer for the next shift/deposit)
      const { error: financialError } = await supabase.from("financial_transactions").insert({
        store_id: store.id,
        description: "Fechamento de Caixa / Retirada",
        amount: stats.revenue + activeSession.opening_balance,
        type: "exit",
        status: "paid",
        paid_at: new Date().toISOString(),
        due_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "dinheiro"
      });

      if (financialError) console.error("Error recording financial transaction:", financialError);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Frente de Caixa</h2>
          <div className="text-xs text-muted-foreground font-medium">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
        </div>
        <Button 
          variant="hero" 
          className="w-full sm:w-auto px-8 h-12 shadow-lg shadow-primary/20"
          onClick={() => setIsManualOrderOpen(true)}
        >
          <ShoppingBag className="w-5 h-5 mr-2" />
          Venda Rápida (Balcão/Entrega)
        </Button>
      </div>

      {/* Tables Status Grid */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-foreground uppercase tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" /> Mapa de Mesas
          </h3>
          <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Livre</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Ocupada</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {tables.map(table => {
            const hasActiveComanda = table.comandas?.some((c: any) => c.status === 'open');
            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 shadow-sm ${hasActiveComanda
                  ? 'bg-orange-50 border-orange-200 text-orange-700'
                  : 'bg-green-50 border-green-200 text-green-700'
                  }`}
              >
                <span className="text-xl font-black">{table.name.replace('Mesa ', '')}</span>
                <span className="text-[9px] font-bold uppercase tracking-tighter">{hasActiveComanda ? 'Em Uso' : 'Disponível'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Operation Modal */}
      <Dialog open={tableModalOpen} onOpenChange={setTableModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none rounded-3xl overflow-hidden">
          <div className="bg-primary p-6 text-white relative">
            <button
              onClick={() => setTableModalOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors"
            >
              <Trash2 className="w-4 h-4 rotate-45" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Table2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">{selectedTable?.name}</h2>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase text-[10px] font-bold px-2 py-0.5 mt-1">
                  {activeComanda ? "Mesa Ocupada" : "Mesa Disponível"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-6">
            {!activeComanda ? (
              <div className="space-y-6 text-center py-8">
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Vincular Garçom (Opcional)</Label>
                    <Select value={selectedWaiterId} onValueChange={setSelectedWaiterId}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30">
                        <SelectValue placeholder="Selecione um garçom" />
                      </SelectTrigger>
                      <SelectContent>
                        {waiters.map(waiter => (
                          <SelectItem key={waiter.id} value={waiter.id}>{waiter.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full h-14 text-lg font-black uppercase tracking-tight rounded-2xl shadow-lg shadow-primary/20"
                    variant="hero"
                    onClick={handleOpenComanda}
                    disabled={isLoadingComanda}
                  >
                    {isLoadingComanda ? <Clock className="w-6 h-6 animate-spin" /> : "Abrir Nova Comanda"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Resumo da Comanda</h3>
                  <p className="text-xs font-bold text-primary">#{activeComanda.id.split('-')[0].toUpperCase()}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Orders List */}
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-2xl border border-border/50 p-4 max-h-[350px] overflow-y-auto">
                      {isLoadingComanda ? (
                        <div className="flex justify-center py-12"><Clock className="w-8 h-8 animate-spin text-primary" /></div>
                      ) : comandaOrders.length === 0 ? (
                        <div className="text-center py-12 space-y-2">
                          <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                          <p className="text-sm text-muted-foreground italic">Nenhum produto lançado.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {comandaOrders.map(order => (
                            <div key={order.id} className={`space-y-2 ${order.status === 'cancelled' ? 'opacity-50' : ''}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">Pedido #{order.order_number}</span>
                                {order.status !== 'cancelled' && (
                                  <button onClick={() => handleCancelOrder(order.id)} className="text-destructive hover:scale-110 transition-transform">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {order.order_items?.map((item: any) => (
                                <div key={item.id} className="flex justify-between text-sm pl-2 border-l-2 border-primary/20 py-0.5">
                                  <span className="font-medium">{item.quantity}x {item.product_name}</span>
                                  <span className="text-muted-foreground">{formatCurrency(item.subtotal)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex justify-between items-center">
                      <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Total Acumulado</span>
                      <span className="text-2xl font-black text-primary">
                        {formatCurrency(comandaOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0))}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="space-y-3">
                    <Button
                      className="w-full h-16 text-lg font-black uppercase tracking-tight rounded-2xl shadow-md border-2"
                      variant="hero"
                      onClick={() => {
                        fetchCatalog();
                        setIsLaunching(true);
                      }}
                    >
                      <Plus className="w-6 h-6 mr-2" /> Lançar Itens
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={handlePrintComanda}>
                        <Receipt className="w-4 h-4 mr-2" /> Prévia
                      </Button>
                      <Button
                        variant="default"
                        className="h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/10"
                        onClick={() => {
                          setDiscount("0");
                          setClosingBillOpen(true);
                        }}
                      >
                        <Calculator className="w-4 h-4 mr-2" /> Fechar Conta
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Selection Dialog */}
      <Dialog open={isLaunching} onOpenChange={setIsLaunching}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none rounded-3xl overflow-hidden flex flex-col md:flex-row">
          {/* Catalog Part */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <div className="p-6 border-b border-border bg-card/50 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <ScrollArea className="w-full sm:w-auto overflow-hidden">
                <div className="flex gap-2">
                  <Button variant={!activeCategory ? "hero" : "outline"} size="sm" className="rounded-full px-4 h-8 text-[10px] uppercase font-bold" onClick={() => setActiveCategory(null)}>Todos</Button>
                  {categories.map(cat => (
                    <Button key={cat.id} variant={activeCategory === cat.id ? "hero" : "outline"} size="sm" className="rounded-full px-4 h-8 text-[10px] uppercase font-bold" onClick={() => setActiveCategory(cat.id)}>{cat.name}</Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.filter(p => (!search || p.name.toLowerCase().includes(search.toLowerCase())) && (!activeCategory || p.category_id === activeCategory)).map(p => {
                  const isOut = p.is_sold_out || (p.manage_stock && p.stock_quantity <= 0);
                  return (
                    <button
                      key={p.id}
                      disabled={isOut}
                      onClick={() => handleAddToCart(p)}
                      className={`flex gap-3 p-3 bg-card rounded-2xl border border-border hover:border-primary/50 transition-all text-left shadow-sm group ${isOut ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      {p.image_url ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"><img src={p.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /></div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Package className="w-8 h-8 text-muted-foreground/30" /></div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <p className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(p.promotional_price > 0 ? p.promotional_price : p.price)}</p>
                      </div>
                      <div className="self-center w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Cart Part */}
          <div className="w-full md:w-80 bg-muted/30 border-l border-border flex flex-col p-6 space-y-4">
            <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" /> Rascunho do Pedido
            </h3>

            <ScrollArea className="flex-1 -mx-2 px-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-12">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground italic font-medium">Nenhum item adicionado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="bg-card p-3 rounded-xl border border-border/50 shadow-sm space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{item.product.name}</p>
                          <p className="text-[10px] font-black text-primary">{formatCurrency(getItemPrice(item) * item.quantity)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-destructive hover:scale-110 transition-transform">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-1">
                        <button onClick={() => updateCartQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background"><Minus className="w-3 h-3" /></button>
                        <span className="text-xs font-black">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cliente (Opcional)</Label>
                  <Input
                    placeholder="Nome do cliente"
                    value={posCustomerName}
                    onChange={e => setPosCustomerName(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Telefone (Opcional)</Label>
                  <Input
                    placeholder="WhatsApp"
                    value={posCustomerPhone}
                    onChange={e => setPosCustomerPhone(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-background border-border"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="font-bold text-[10px] uppercase text-muted-foreground">Subtotal</span>
                <span className="font-black text-lg">{formatCurrency(cartSubtotal)}</span>
              </div>
              <Button
                className="w-full h-14 font-black uppercase tracking-tighter rounded-2xl shadow-lg shadow-primary/20"
                variant="hero"
                disabled={cart.length === 0 || isSendingOrder}
                onClick={handleSendOrder}
              >
                {isSendingOrder ? <Clock className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Enviar Pedido</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variation Selection Modal */}
      <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 border-none rounded-3xl overflow-hidden">
          {variationProduct && (
            <>
              <div className="bg-primary/5 p-6 border-b border-primary/10">
                <h4 className="text-xl font-black uppercase text-primary">{variationProduct.name}</h4>
                <p className="text-sm font-bold text-muted-foreground mt-1">{formatCurrency(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price)}</p>
              </div>
              <div className="p-6 space-y-6">
                {(productVariations[variationProduct.id] || []).map(v => (
                  <div key={v.id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">{v.name}</p>
                      <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter">
                        {v.required ? "Obrigatório" : "Opcional"} • {v.max_selections === 1 ? "1 opção" : `Até ${v.max_selections}`}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {v.options.map((opt: any, idx: number) => {
                        const isSelected = (variationSelections[v.id] || []).some(s => s.name === opt.name);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleVariationOption(v.id, opt, v.max_selections)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:border-border/80'}`}
                          >
                            <span className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}>{opt.name}</span>
                            <div className="flex items-center gap-2">
                              {opt.price > 0 && <span className="text-[10px] font-black uppercase">+ {formatCurrency(opt.price)}</span>}
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-white' : 'border-muted'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Observações</Label>
                  <textarea
                    className="w-full h-24 p-4 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    placeholder="Ex: Sem cebola, gelo à parte..."
                    value={itemNotes}
                    onChange={e => setItemNotes(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-lg border-b-4 border-primary-dark active:border-b-0 active:translate-y-1 transition-all"
                  variant="hero"
                  onClick={confirmVariationSelection}
                >
                  Confirmar e Adicionar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Closing Bill Dialog */}
      <Dialog open={closingBillOpen} onOpenChange={setClosingBillOpen}>
        <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto p-0 border-none rounded-3xl overflow-hidden">
          <div className="bg-emerald-500 p-6 text-white text-center">
            <h3 className="text-2xl font-black uppercase tracking-tighter">Encerrar Conta</h3>
            <p className="text-sm font-bold opacity-80 mt-1">{selectedTable?.name}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-muted p-4 rounded-2xl flex justify-between items-center shadow-inner">
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Subtotal Acumulado</span>
              <span className="text-xl font-black">{formatCurrency(comandaOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0))}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Desconto (R$)</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="h-12 rounded-xl text-lg font-black text-center"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2 text-right">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Total Final</Label>
                <div className="h-12 flex items-center justify-end font-black text-2xl text-emerald-600">
                  {formatCurrency(Math.max(0, comandaOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0) - Number(discount)))}
                </div>
              </div>
            </div>

            <Separator className="opacity-50" />

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                  { id: 'pix', label: 'PIX', icon: '📱' },
                  { id: 'cartao_credito', label: 'Crédito', icon: '💳' },
                  { id: 'cartao_debito', label: 'Débito', icon: '💳' },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${paymentMethod === method.id ? 'border-emerald-500 bg-emerald-50 text-emerald-600 scale-105 shadow-md' : 'border-border bg-card grayscale opacity-70 hover:opacity-100 hover:grayscale-0'}`}
                  >
                    <span className="text-xl">{method.icon}</span>
                    <span className="text-[9px] font-black uppercase">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'dinheiro' && (
              <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 flex justify-between items-center animate-in slide-in-from-top-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Valor em Espécie</Label>
                  <Input
                    type="number"
                    className="h-10 w-28 font-black text-lg bg-background border-none shadow-sm"
                    value={amountTendered}
                    onChange={e => setAmountTendered(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {Number(amountTendered) > Math.max(0, comandaOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0) - Number(discount)) && (
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Troco</p>
                    <p className="text-xl font-black text-emerald-600">
                      {formatCurrency(Number(amountTendered) - (comandaOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0) - Number(discount)))}
                    </p>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'pix' && (
              <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 space-y-4 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">PIX Automático</span>
                  {pixPayments.length > 0 && pixPayments.every(p => p.status === 'paid') && (
                    <Badge className="bg-emerald-500 text-white border-none py-0.5">✅ PAGO</Badge>
                  )}
                </div>

                {pixPayments.length > 0 ? (
                  <div className="space-y-3">
                    {pixPayments.map((p, idx) => (
                      <div key={p.id} className={`p-3 rounded-xl border-2 transition-all ${p.status === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-xs uppercase">Pagamento {idx + 1}/{pixPayments.length}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${p.status === 'paid' ? 'bg-emerald-200 text-emerald-700' : 'bg-blue-200 text-blue-700 animate-pulse'}`}>
                            {p.status === 'paid' ? 'Confirmado' : 'Aguardando'}
                          </span>
                        </div>
                        {!p.status || p.status === 'pending' ? (
                          <div className="space-y-2">
                            <div className="bg-white p-2 rounded-lg w-32 h-32 mx-auto border shadow-sm flex items-center justify-center">
                              <QRCodeSVG value={p.pix_copia_cola} size={120} level="H" />
                            </div>
                            <Button
                              variant="outline" size="sm" className="w-full text-[10px] h-8 font-bold gap-2"
                              onClick={() => { navigator.clipboard.writeText(p.pix_copia_cola); toast.success("Código PIX copiado!"); }}
                            >
                              <Copy className="w-3 h-3" /> Copiar Código
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-center text-emerald-600 font-bold uppercase py-4 italic">Confirmado via Webhook</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl border-dashed border-2 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                    onClick={async () => {
                      setIsGeneratingPix(true);
                      try {
                        const amount = Math.max(0, comandaOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0) - Number(discount));
                        
                        const { data, error } = await supabase.functions.invoke('pix-order-create', {
                          body: {
                            store_id: store!.id,
                            comanda_id: activeComanda.id,
                            amount: Number(amount.toFixed(2)),
                            description: `${store?.name} - Mesa ${selectedTable?.name}`,
                          }
                        });

                        if (error) throw error;
                        
                        const { data: updatedPix } = await supabase.from("order_payments").select("*").eq("comanda_id", activeComanda.id).eq("payment_method", "pix");
                        setPixPayments(updatedPix || []);
                        toast.success("PIX Dinâmico Gerado!");
                      } catch (err: any) {
                        console.error("PIX Generation Error:", err);
                        toast.error(err.message || "Erro ao gerar PIX");
                      } finally {
                        setIsGeneratingPix(false);
                      }
                    }}
                    disabled={isGeneratingPix}
                  >
                    {isGeneratingPix ? <Clock className="w-4 h-4 animate-spin mr-2" /> : <Smartphone className="w-4 h-4 mr-2" />}
                    Gerar PIX Dinâmico
                  </Button>
                )}
              </div>
            )}

            <Button
              className="w-full h-16 text-lg font-black uppercase tracking-tighter bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 rounded-2xl"
              onClick={handleCloseBill}
              disabled={isClosingComanda || (paymentMethod === 'pix' && pixPayments.length > 0 && !pixPayments.every(p => p.status === 'paid'))}
            >
              {isClosingComanda ? <Clock className="w-6 h-6 animate-spin" /> : (
                paymentMethod === 'pix' && pixPayments.length > 0 && pixPayments.every(p => p.status === 'paid')
                  ? "Finalizar (Pago no PIX)"
                  : "Confirmar Recebimento"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {tables.length === 0 && (
        <div className="col-span-full py-8 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-border/50">
          <p className="text-sm text-muted-foreground italic mb-2">Nenhuma mesa cadastrada.</p>
        </div>
      )}

      {/* Stats Summary - POS Style */}
      < div className="grid grid-cols-1 md:grid-cols-4 gap-4" >
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign className="w-24 h-24" />
          </div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Vendas Hoje</p>
          <p className="text-3xl font-black text-foreground">{formatCurrency(stats.revenue)}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Em tempo real
            </div>
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
      </div >

      {/* POS Monitor */}
      < div className="grid lg:grid-cols-3 gap-6" >
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
              <Bell className="w-4 h-4 animate-bounce" /> Alertas
            </h4>
            
            {lowStockItems.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-3 animate-pulse">
                 <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-red-600" />
                 </div>
                 <div>
                    <p className="text-xs font-black uppercase tracking-tight text-red-700">Estoque Baixo</p>
                    <p className="text-[10px] text-red-600 leading-tight font-medium mt-0.5">
                      {lowStockItems.map(i => i.name).join(', ')} requer reposição imediata.
                    </p>
                    <Button variant="link" className="text-[9px] text-red-700 p-0 h-auto font-bold uppercase mt-1" onClick={() => navigate("/dashboard/inventory")}>
                      Gerenciar Insumos
                    </Button>
                 </div>
              </div>
            )}

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

      {store && (
        <ManualOrderDialog 
          open={isManualOrderOpen} 
          onOpenChange={setIsManualOrderOpen} 
          storeId={store.id} 
          onOrderCreated={() => fetchStats()}
        />
      )}
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
