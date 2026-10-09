'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Flame,
  Inbox,
  Mail,
  MessageSquare,
  PackageX,
  Pencil,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Star,
  Trash2,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react';

const money = new Intl.NumberFormat('ar-EG', { currency: 'EGP', maximumFractionDigits: 0 });

type Order = {
  id: string;
  customerName: string;
  itemsCount: number;
  items?: Array<{ productId?: string; productName?: string; quantity?: number; lineTotal?: number }>;
  total: number;
  status: string;
  createdAt?: { seconds: number };
};

type Product = { id: string; name: string; categoryId?: string; category?: string; price: number; stock: number; imageUrl?: string; images?: Array<{ url: string }> };

type Customer = { id: string; name: string; ordersCount?: number; totalSpent?: number; updatedAt?: { seconds: number }; createdAt?: { seconds: number } };

type Review = { id: string; customerName: string; productName?: string; productId?: string; rating: number; comment: string; status?: string; createdAt?: { seconds: number } };

type SearchLog = { id: string; term: string; results: number; createdAt?: { seconds: number } };

type ProductStat = { id?: string; productId?: string; productName?: string; views?: number; carts?: number; lastViewedAt?: { seconds: number } };

type DailyStat = { date: string; views?: number; searches?: number; messages?: number; addToCarts?: number; checkoutStarts?: number; whatsappClicks?: number };

type Message = { id: string; name: string; phone?: string; email?: string; message: string; status?: string; createdAt?: { seconds: number } };

type Subscriber = { id: string; email: string; source?: string; createdAt?: { seconds: number } };

type BlogRow = { id: string; title: string; slug?: string; excerpt?: string; content?: string; coverImage?: string; author?: string; readMinutes?: number; tags?: string[]; isPublished?: boolean; publishedAt?: { seconds: number } | string };

type InfoRow = { id: string; title: string; slug?: string; content?: string; group?: string; isPublished?: boolean; updatedAt?: { seconds: number } };

/* ------------------------------------------------------------------ helpers */

function seconds(value?: { seconds: number } | string) {
  if (!value) return 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return (value.seconds ?? 0) * 1000;
}

function formatDate(value?: { seconds: number } | string) {
  const time = seconds(value);
  if (!time) return '—';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(time));
}

function dayKey(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function relativeDays(time: number) {
  if (!time) return '—';
  const diff = Math.max(0, Math.round((Date.now() - time) / 86_400_000));
  if (diff === 0) return 'النهارده';
  if (diff === 1) return 'أمس';
  if (diff < 30) return `من ${diff} يوم`;
  return formatDate(new Date(time).toISOString());
}

function startOfDay(daysBack: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysBack);
  return date.getTime();
}

const validOrders = (orders: Order[]) => orders.filter((order) => order.status !== 'ملغي');

/* ---------------------------------------------------------------- analytics */

type AnalyticsProps = {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  reviews: Review[];
  searchLogs: SearchLog[];
  productStats: ProductStat[];
  dailyStats: DailyStat[];
  messages: Message[];
  onNavigate: (page: string) => void;
};

export function AnalyticsPanel({ orders, products, customers, reviews, searchLogs, productStats, dailyStats, messages, onNavigate }: AnalyticsProps) {
  const paid = useMemo(() => validOrders(orders), [orders]);

  const stats = useMemo(() => {
    const revenue = paid.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const last7 = paid.filter((order) => seconds(order.createdAt) >= startOfDay(6));
    const last30 = paid.filter((order) => seconds(order.createdAt) >= startOfDay(29));
    const revenue30 = last30.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const previous30 = paid.filter((order) => {
      const time = seconds(order.createdAt);
      return time >= startOfDay(59) && time < startOfDay(29);
    }).reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const growth = previous30 ? Math.round(((revenue30 - previous30) / previous30) * 100) : null;
    const aov = paid.length ? Math.round(revenue / paid.length) : 0;
    const newCustomers = customers.filter((customer) => seconds(customer.createdAt ?? customer.updatedAt) >= startOfDay(29)).length;

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let index = 29; index >= 0; index -= 1) dailyMap.set(dayKey(startOfDay(index)), { date: dayKey(startOfDay(index)), revenue: 0, orders: 0 });
    for (const order of paid) {
      const key = dayKey(seconds(order.createdAt));
      const entry = dailyMap.get(key);
      if (!entry) continue;
      entry.revenue += Number(order.total) || 0;
      entry.orders += 1;
    }
    const series = [...dailyMap.values()];
    const peak = Math.max(...series.map((point) => point.revenue), 1);

    const totals = dailyStats.reduce(
      (acc, day) => ({
        views: acc.views + (day.views ?? 0),
        searches: acc.searches + (day.searches ?? 0),
        carts: acc.carts + (day.addToCarts ?? 0),
        checkoutStarts: acc.checkoutStarts + (day.checkoutStarts ?? 0),
        whatsapp: acc.whatsapp + (day.whatsappClicks ?? 0),
        messages: acc.messages + (day.messages ?? 0),
      }),
      { views: 0, searches: 0, carts: 0, checkoutStarts: 0, whatsapp: 0, messages: 0 },
    );
    const last7Stats = dailyStats.filter((day) => Date.parse(day.date) >= startOfDay(6));
    const views7 = last7Stats.reduce((sum, day) => sum + (day.views ?? 0), 0);
    const viewsPrev7 = dailyStats
      .filter((day) => Date.parse(day.date) >= startOfDay(13) && Date.parse(day.date) < startOfDay(6))
      .reduce((sum, day) => sum + (day.views ?? 0), 0);

    const conversion = totals.carts ? Math.round((paid.length / totals.carts) * 100) : null;

    const productMap = new Map(products.map((product) => [product.id, product]));
    const byProduct = new Map<string, { id: string; name: string; qty: number; revenue: number; category: string; image?: string; stock: number }>();
    for (const order of paid) {
      for (const item of order.items ?? []) {
        const key = item.productId || item.productName || 'unknown';
        const product = item.productId ? productMap.get(item.productId) : undefined;
        const entry = byProduct.get(key) ?? {
          id: key,
          name: item.productName || product?.name || 'قطعة',
          qty: 0,
          revenue: 0,
          category: product?.category || product?.categoryId || '—',
          image: product?.images?.[0]?.url || product?.imageUrl,
          stock: product?.stock ?? 0,
        };
        entry.qty += Number(item.quantity) || 0;
        entry.revenue += Number(item.lineTotal) || 0;
        byProduct.set(key, entry);
      }
    }

    const byCategory = new Map<string, number>();
    for (const entry of byProduct.values()) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.revenue);

    const termMap = new Map<string, { term: string; count: number; misses: number }>();
    for (const log of searchLogs) {
      const term = (log.term || '').trim();
      if (!term) continue;
      const entry = termMap.get(term) ?? { term, count: 0, misses: 0 };
      entry.count += 1;
      if (!log.results) entry.misses += 1;
      termMap.set(term, entry);
    }
    const topTerms = [...termMap.values()].sort((left, right) => right.count - left.count).slice(0, 10);
    const missing = [...termMap.values()].filter((entry) => entry.misses > 0).sort((left, right) => right.misses - left.misses).slice(0, 8);

    const topViews = [...productStats]
      .filter((stat) => (stat.views ?? 0) > 0)
      .sort((left, right) => (right.views ?? 0) - (left.views ?? 0))
      .slice(0, 8)
      .map((stat) => ({ ...stat, id: stat.productId ?? stat.id ?? '', name: stat.productName || productMap.get(stat.productId ?? '')?.name || 'قطعة' }));

    const lowStock = products
      .filter((product) => Number(product.stock) <= 5)
      .sort((left, right) => Number(left.stock) - Number(right.stock))
      .slice(0, 8);

    const statusCounts = paid.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    const repeat = customers.filter((customer) => (customer.ordersCount ?? 0) > 1).length;
    const repeatRate = customers.length ? Math.round((repeat / customers.length) * 100) : 0;

    return {
      revenue,
      revenue30,
      growth,
      aov,
      ordersCount: paid.length,
      orders7: last7.length,
      newCustomers,
      series,
      peak,
      totals,
      views7,
      viewsGrowth: viewsPrev7 ? Math.round(((views7 - viewsPrev7) / viewsPrev7) * 100) : null,
      conversion,
      topProducts: [...byProduct.values()].sort((left, right) => right.revenue - left.revenue).slice(0, 8),
      topCategories: [...byCategory.entries()].map(([name, value]) => ({ name, value })).sort((left, right) => right.value - left.value).slice(0, 6),
      topTerms,
      missing,
      topViews,
      lowStock,
      statusCounts,
      repeatRate,
      pendingReviews: reviews.filter((review) => !review.status || review.status === 'جديدة').length,
      newMessages: messages.filter((message) => !message.status || message.status === 'جديدة').length,
    };
  }, [paid, products, customers, reviews, searchLogs, productStats, dailyStats, messages]);

  return (
    <div className="insights">
      <section className="metric-grid">
        <MetricCard title="إيرادات 30 يوم" value={money.format(stats.revenue30)} note={stats.growth === null ? 'لا توجد مقارنة' : `${stats.growth >= 0 ? '+' : ''}${stats.growth}% عن الشهر السابق`} icon={TrendingUp} tone={stats.growth !== null && stats.growth < 0 ? 'down' : 'up'} />
        <MetricCard title="طلبات 7 أيام" value={String(stats.orders7).padStart(2, '0')} note={`${stats.ordersCount} طلب إجمالاً`} icon={ShoppingBag} />
        <MetricCard title="متوسط الطلب" value={money.format(stats.aov)} note="الدفع عند الاستلام" icon={BarChart3} />
        <MetricCard title="عملاء جدد 30 يوم" value={String(stats.newCustomers).padStart(2, '0')} note={`${stats.repeatRate}% عميل متكرر`} icon={UsersRound} />
        <MetricCard title="مشاهدات 7 أيام" value={String(stats.views7)} note={stats.viewsGrowth === null ? 'بدون مقارنة' : `${stats.viewsGrowth >= 0 ? '+' : ''}${stats.viewsGrowth}%`} icon={Eye} tone={stats.viewsGrowth !== null && stats.viewsGrowth < 0 ? 'down' : 'up'} />
        <MetricCard title="تحويل السلة" value={stats.conversion === null ? '—' : `${stats.conversion}%`} note={`${stats.totals.carts} إضافة للسلة`} icon={Activity} />
      </section>

      <section className="insights-grid">
        <article className="panel insight-panel insight-wide">
          <div className="panel-heading">
            <div><span className="eyebrow">الإيرادات</span><h2>آخر 30 يوم</h2></div>
            <span className="panel-icon"><TrendingUp size={17} /></span>
          </div>
          <RevenueChart series={stats.series} peak={stats.peak} />
          <div className="chart-axis">
            <span>{stats.series[0]?.date.slice(5)}</span>
            <span>{stats.series[15]?.date.slice(5)}</span>
            <span>{stats.series.at(-1)?.date.slice(5)}</span>
          </div>
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">الحركة</span><h2>سلوك الزوار</h2></div>
            <span className="panel-icon"><Activity size={17} /></span>
          </div>
          <ul className="insight-list">
            <InsightRow icon={Eye} label="مشاهدات المنتجات" value={stats.totals.views} />
            <InsightRow icon={Search} label="عمليات البحث" value={stats.totals.searches} />
            <InsightRow icon={ShoppingBag} label="إضافات للسلة" value={stats.totals.carts} />
            <InsightRow icon={BarChart3} label="بدء إتمام الطلب" value={stats.totals.checkoutStarts} />
            <InsightRow icon={MessageSquare} label="نقرات واتساب" value={stats.totals.whatsapp} />
            <InsightRow icon={Mail} label="رسائل التواصل" value={stats.totals.messages || messages.length} />
          </ul>
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">البحث</span><h2>أكثر الكلمات بحثاً</h2></div>
            <span className="panel-icon"><Search size={17} /></span>
          </div>
          {stats.topTerms.length ? (
            <ul className="insight-list">
              {stats.topTerms.map((term) => (
                <li className="insight-row" key={term.term}>
                  <span className="insight-label">{term.term}</span>
                  <span className="insight-bar"><i style={{ width: `${(term.count / (stats.topTerms[0]?.count || 1)) * 100}%` }} /></span>
                  <b>{term.count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="لسه مفيش عمليات بحث مسجلة." />
          )}
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">فرص</span><h2>بحث بدون نتائج</h2></div>
            <span className="panel-icon"><Flame size={17} /></span>
          </div>
          {stats.missing.length ? (
            <div className="chip-cloud">
              {stats.missing.map((term) => (
                <span className="insight-chip insight-chip-warn" key={term.term}>{term.term} <b>{term.misses}</b></span>
              ))}
            </div>
          ) : (
            <EmptyHint text="مفيش بحث بدون نتائج — الكتالوج مغطّي الطلبات." />
          )}
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">المبيعات</span><h2>أعلى القطع مبيعاً</h2></div>
            <span className="panel-icon"><ShoppingBag size={17} /></span>
          </div>
          {stats.topProducts.length ? (
            <ul className="insight-list">
              {stats.topProducts.map((entry) => (
                <li className="insight-row" key={entry.id}>
                  <span className="insight-label" title={entry.name}>{entry.name}</span>
                  <span className="insight-bar"><i style={{ width: `${(entry.revenue / (stats.topProducts[0]?.revenue || 1)) * 100}%` }} /></span>
                  <b>{entry.qty}×</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="لسه مفيش مبيعات مسجلة." />
          )}
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">الأقسام</span><h2>الإيراد حسب القسم</h2></div>
            <span className="panel-icon"><BarChart3 size={17} /></span>
          </div>
          {stats.topCategories.length ? (
            <ul className="insight-list">
              {stats.topCategories.map((entry) => (
                <li className="insight-row" key={entry.name}>
                  <span className="insight-label">{entry.name}</span>
                  <span className="insight-bar"><i style={{ width: `${(entry.value / (stats.topCategories[0]?.value || 1)) * 100}%` }} /></span>
                  <b>{money.format(entry.value)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="لسه مفيش مبيعات حسب الأقسام." />
          )}
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">الاهتمام</span><h2>أعلى القطع مشاهدة</h2></div>
            <span className="panel-icon"><Eye size={17} /></span>
          </div>
          {stats.topViews.length ? (
            <ul className="insight-list">
              {stats.topViews.map((stat) => (
                <li className="insight-row" key={stat.id}>
                  <span className="insight-label" title={stat.name}>{stat.name}</span>
                  <span className="insight-bar"><i style={{ width: `${((stat.views ?? 0) / (stats.topViews[0]?.views || 1)) * 100}%` }} /></span>
                  <b>{stat.views}</b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="لسه مفيش مشاهدات للمنتجات." />
          )}
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">تنبيه</span><h2>مخزون على وشك الانتهاء</h2></div>
            <span className="panel-icon"><PackageX size={17} /></span>
          </div>
          {stats.lowStock.length ? (
            <ul className="insight-list">
              {stats.lowStock.map((product) => (
                <li className="insight-row" key={product.id}>
                  <span className="insight-label" title={product.name}>{product.name}</span>
                  <span className={`stock-pill ${Number(product.stock) === 0 ? 'stock-out' : ''}`}>{product.stock} متبقي</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="المخزون في وضع مريح." />
          )}
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">الطلبات</span><h2>التوزيع حسب الحالة</h2></div>
            <span className="panel-icon"><Check size={17} /></span>
          </div>
          <ul className="insight-list">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <InsightRow key={status} icon={Check} label={status} value={count} />
            ))}
          </ul>
        </article>
      </section>

      <section className="panel alerts-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">محتاج انتباهك</span><h2>تنبيهات سريعة</h2></div>
        </div>
        <div className="alert-row-group">
          {stats.newMessages > 0 ? <AlertItem tone="warn" icon={Inbox} text={`${stats.newMessages} رسالة تواصل جديدة`} onClick={() => onNavigate('messages')} /> : null}
          {stats.pendingReviews > 0 ? <AlertItem tone="warn" icon={Star} text={`${stats.pendingReviews} تقييم بانتظار المراجعة`} onClick={() => onNavigate('reviews')} /> : null}
          {stats.lowStock.length > 0 ? <AlertItem tone="danger" icon={PackageX} text={`${stats.lowStock.length} قطعة مخزونها 5 أو أقل`} onClick={() => onNavigate('products')} /> : null}
          {stats.missing.length > 0 ? <AlertItem tone="info" icon={Search} text={`${stats.missing.length} كلمة بحث بدون نتائج — فرصة لمنتج جديد`} onClick={() => onNavigate('products')} /> : null}
          {!stats.newMessages && !stats.pendingReviews && !stats.lowStock.length ? <EmptyHint text="مفيش تنبيهات — كل حاجة تمام." /> : null}
        </div>
      </section>
    </div>
  );
}



function MetricCard({ title, value, note, icon: Icon, tone }: { title: string; value: string; note?: string; icon: typeof Activity; tone?: 'up' | 'down' }) {
  return (
    <article className="metric insight-metric">
      <span className="insight-metric-icon"><Icon size={17} /></span>
      <strong>{value}</strong>
      <span className="insight-metric-title">{title}</span>
      {note ? <small className={tone ? `insight-note insight-note-${tone}` : 'insight-note'}>{note}</small> : null}
    </article>
  );
}

function InsightRow({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <li className="insight-row">
      <span className="insight-row-label"><Icon size={14} /> {label}</span>
      <b>{value}</b>
    </li>
  );
}

function RevenueChart({ series, peak }: { series: Array<{ date: string; revenue: number; orders: number }>; peak: number }) {
  if (!series.length) return <EmptyHint text="لسه مفيش بيانات." />;
  const width = 720;
  const height = 200;
  const step = width / Math.max(1, series.length - 1);
  const points = series.map((point, index) => `${(index * step).toFixed(1)},${(height - (point.revenue / peak) * (height - 24) - 12).toFixed(1)}`);
  const area = `M0,${height} L${points.join(' L')} L${width},${height} Z`;
  const maxPoint = series.reduce((best, point) => (point.revenue > best.revenue ? point : best), series[0]);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="الإيرادات خلال 30 يوم">
        <defs>
          <linearGradient id="insightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent, #E46A29)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent, #E46A29)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="chart-grid-line" />
        ))}
        <path d={area} fill="url(#insightFill)" />
        <polyline points={points.join(' ')} className="chart-line" />
        <circle cx={(series.indexOf(maxPoint) * step).toFixed(0)} cy={(height - (maxPoint.revenue / peak) * (height - 24) - 12).toFixed(0)} r="4" className="chart-dot" />
      </svg>
      <span className="chart-peak">أعلى يوم: {money.format(maxPoint.revenue)} · {maxPoint.orders} طلب</span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="insight-empty">{text}</p>;
}

function AlertItem({ tone, icon: Icon, text, onClick }: { tone: 'warn' | 'danger' | 'info'; icon: typeof Activity; text: string; onClick?: () => void }) {
  return (
    <button className={`alert-item alert-${tone}`} type="button" onClick={onClick}>
      <Icon size={15} />
      <span>{text}</span>
      {onClick ? <ArrowUpRight size={14} /> : null}
    </button>
  );
}

/* ----------------------------------------------------------------- messages */

type MessagesProps = {
  messages: Message[];
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
};

export function MessagesPanel({ messages, onStatus, onDelete }: MessagesProps) {
  const [query, setQuery] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const sorted = useMemo(
    () => [...messages].sort((left, right) => seconds(right.createdAt) - seconds(left.createdAt)),
    [messages],
  );
  const filtered = sorted.filter((message) => {
    const matchesText = !query.trim() || [message.name, message.message, message.phone, message.email].some((value) => (value ?? '').toLowerCase().includes(query.trim().toLowerCase()));
    const matchesStatus = onlyNew ? !message.status || message.status === 'جديدة' : true;
    return matchesText && matchesStatus;
  });

  return (
    <section className="panel data-panel">
      <div className="table-toolbar">
        <div className="toolbar-info">
          <span className="result-count">{filtered.length} رسالة</span>
          <span className="muted">{messages.filter((message) => !message.status || message.status === 'جديدة').length} جديدة</span>
        </div>
        <div className="toolbar-controls">
          <button className={`chip-toggle ${onlyNew ? 'chip-toggle-active' : ''}`} type="button" onClick={() => setOnlyNew((value) => !value)}>
            الجديدة فقط
          </button>
          <SearchBox value={query} onChange={setQuery} label="البحث في الرسائل" placeholder="ابحث بالاسم أو النص..." />
        </div>
      </div>

      {filtered.length ? (
        <ul className="message-list">
          {filtered.map((message) => {
            const digits = (message.phone ?? '').replace(/\D/g, '');
            return (
              <li className={`message-item ${!message.status || message.status === 'جديدة' ? 'message-new' : ''}`} key={message.id}>
                <div className="message-item-head">
                  <strong>{message.name}</strong>
                  <span className="muted">{relativeDays(seconds(message.createdAt))}</span>
                </div>
                <p>{message.message}</p>
                <div className="message-item-actions">
                  {digits ? (
                    <a className="button button-quiet" href={`https://wa.me/${digits.startsWith('0') ? `20${digits.slice(1)}` : digits}`} target="_blank" rel="noreferrer">
                      <Send size={14} /> واتساب
                    </a>
                  ) : null}
                  <button className="button button-quiet" type="button" onClick={() => onStatus(message.id, message.status === 'تم الرد' ? 'جديدة' : 'تم الرد')}>
                    <Check size={14} /> {message.status === 'تم الرد' ? 'إعادة جديدة' : 'تم الرد'}
                  </button>
                  <button className="icon-button delete-action" type="button" title="حذف" onClick={() => onDelete(message.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Inbox} title="مفيش رسائل" body="الرسايل اللي جاية من صفحة التواصل هتظهر هنا." />
      )}
    </section>
  );
}

/* --------------------------------------------------------------------- blog */

type BlogProps = {
  posts: BlogRow[];
  onSave: (id: string | null, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function BlogPanel({ posts, onSave, onDelete }: BlogProps) {
  const [editing, setEditing] = useState<BlogRow | null | undefined>(undefined);
  const [query, setQuery] = useState('');
  const filtered = posts.filter((post) => !query.trim() || [post.title, post.excerpt, post.author].some((value) => (value ?? '').toLowerCase().includes(query.trim().toLowerCase())));

  return (
    <>
      <section className="panel data-panel">
        <div className="table-toolbar">
          <div className="toolbar-info">
            <span className="result-count">{filtered.length} مقال</span>
            <span className="muted">{posts.filter((post) => post.isPublished !== false).length} منشور</span>
          </div>
          <div className="toolbar-controls">
            <SearchBox value={query} onChange={setQuery} label="البحث في المدونة" placeholder="ابحث بالعنوان..." />
            <button className="button button-dark" type="button" onClick={() => setEditing(null)}>
              <Plus size={15} /> مقال جديد
            </button>
          </div>
        </div>

        {filtered.length ? (
          <ul className="content-list">
            {filtered.map((post) => (
              <li className="content-item" key={post.id}>
                <div>
                  <strong>{post.title}</strong>
                  <small>/blog/{post.slug || post.id} · {formatDate(post.publishedAt)}</small>
                  {post.excerpt ? <p>{post.excerpt}</p> : null}
                </div>
                <div className="content-item-actions">
                  <span className={`state-pill ${post.isPublished !== false ? 'state-on' : 'state-off'}`}>{post.isPublished !== false ? 'منشور' : 'مسودة'}</span>
                  <button className="icon-button" type="button" title="تعديل" onClick={() => setEditing(post)}><Pencil size={15} /></button>
                  <button className="icon-button delete-action" type="button" title="حذف" onClick={() => onDelete(post.id)}><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={BookOpen} title="مفيش مقالات" body="اكتب أول مقال وهينزل على صفحة المدونة في الموقع." />
        )}
      </section>

      {editing !== undefined ? <BlogModal post={editing} onClose={() => setEditing(undefined)} onSave={(data) => onSave(editing?.id ?? null, data)} /> : null}
    </>
  );
}

function BlogModal({ post, onClose, onSave }: { post: BlogRow | null; onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    excerpt: post?.excerpt ?? '',
    content: post?.content ?? '',
    coverImage: post?.coverImage ?? '',
    author: post?.author ?? '',
    readMinutes: String(post?.readMinutes ?? 3),
    isPublished: post?.isPublished !== false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        ...form,
        slug: form.slug.trim() || form.title.trim().replace(/\s+/g, '-'),
        readMinutes: Number(form.readMinutes) || 3,
        publishedAt: post?.publishedAt ?? new Date().toISOString(),
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر الحفظ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div><span className="eyebrow">المدونة</span><h2>{post ? 'تعديل مقال' : 'مقال جديد'}</h2></div>
          <button className="icon-button" type="button" title="إغلاق" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="span-two">العنوان<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="عنوان المقال" /></label>
            <label>الرابط (slug)<input dir="ltr" maxLength={120} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="how-to-style-a-hoodie" /></label>
            <label>الكاتب<input maxLength={60} value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="اختياري" /></label>
            <label className="span-two">المقدمة<textarea rows={2} maxLength={240} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder="سطر مختصر يظهر في بطاقة المقال" /></label>
            <label className="span-two">صورة الغلاف<input dir="ltr" maxLength={300} value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} placeholder="https://res.cloudinary.com/..." /></label>
            <label>دقائق القراءة<input type="number" min={1} max={60} value={form.readMinutes} onChange={(event) => setForm({ ...form, readMinutes: event.target.value })} /></label>
            <label className="catalog-active-toggle">
              <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
              <span><strong>منشور</strong><small>لو مقفول مش هيبان في الموقع</small></span>
            </label>
            <label className="span-two">المحتوى<textarea rows={12} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="اكتب المحتوى، كل سطر بيتحول لفقرة." /></label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button>
            <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ...' : <><Check size={16} /> حفظ</>}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- info pages */

type PagesProps = {
  pages: InfoRow[];
  onSave: (id: string | null, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function PagesPanel({ pages, onSave, onDelete }: PagesProps) {
  const [editing, setEditing] = useState<InfoRow | null | undefined>(undefined);

  return (
    <>
      <section className="panel data-panel">
        <div className="table-toolbar">
          <div className="toolbar-info">
            <span className="result-count">{pages.length} صفحة</span>
            <span className="muted">بتظهر في الفوتر وروابط مهمة</span>
          </div>
          <div className="toolbar-controls">
            <button className="button button-dark" type="button" onClick={() => setEditing(null)}>
              <Plus size={15} /> صفحة جديدة
            </button>
          </div>
        </div>

        {pages.length ? (
          <ul className="content-list">
            {pages.map((page) => (
              <li className="content-item" key={page.id}>
                <div>
                  <strong>{page.title}</strong>
                  <small>/pages/{page.slug || page.id}</small>
                </div>
                <div className="content-item-actions">
                  <span className={`state-pill ${page.isPublished !== false ? 'state-on' : 'state-off'}`}>{page.isPublished !== false ? 'منشورة' : 'مسودة'}</span>
                  <button className="icon-button" type="button" title="تعديل" onClick={() => setEditing(page)}><Pencil size={15} /></button>
                  <button className="icon-button delete-action" type="button" title="حذف" onClick={() => onDelete(page.id)}><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileText} title="مفيش صفحات" body="صفحات الموقع (الشحن، الاسترجاع، الشروط) بتتحمل هنا." />
        )}
      </section>

      {editing !== undefined ? <PageModal page={editing} onClose={() => setEditing(undefined)} onSave={(data) => onSave(editing?.id ?? null, data)} /> : null}
    </>
  );
}

function PageModal({ page, onClose, onSave }: { page: InfoRow | null; onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    title: page?.title ?? '',
    slug: page?.slug ?? '',
    content: page?.content ?? '',
    isPublished: page?.isPublished !== false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ ...form, slug: form.slug.trim() || form.title.trim().replace(/\s+/g, '-'), updatedAt: new Date().toISOString() });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر الحفظ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div><span className="eyebrow">صفحات</span><h2>{page ? 'تعديل صفحة' : 'صفحة جديدة'}</h2></div>
          <button className="icon-button" type="button" title="إغلاق" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="span-two">العنوان<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>الرابط (slug)<input dir="ltr" maxLength={120} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="shipping" /></label>
            <label className="catalog-active-toggle">
              <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
              <span><strong>منشورة</strong><small>بتظهر في الموقع</small></span>
            </label>
            <label className="span-two">المحتوى<textarea rows={14} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="كل سطر = فقرة" /></label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button>
            <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ...' : <><Check size={16} /> حفظ</>}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- newsletter */

type NewsletterProps = {
  subscribers: Subscriber[];
  onDelete: (id: string) => Promise<void>;
};

export function NewsletterPanel({ subscribers, onDelete }: NewsletterProps) {
  const [copied, setCopied] = useState(false);
  const sorted = useMemo(() => [...subscribers].sort((left, right) => seconds(right.createdAt) - seconds(left.createdAt)), [subscribers]);
  const last7 = sorted.filter((subscriber) => seconds(subscriber.createdAt) >= startOfDay(6)).length;

  function exportCsv() {
    const rows = [['email', 'source', 'createdAt'], ...sorted.map((subscriber) => [subscriber.email, subscriber.source ?? '', new Date(seconds(subscriber.createdAt)).toISOString()])];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `r-one-newsletter-${dayKey(Date.now())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel data-panel">
      <div className="table-toolbar">
        <div className="toolbar-info">
          <span className="result-count">{sorted.length} مشترك</span>
          <span className="muted">{last7} انضموا آخر 7 أيام</span>
        </div>
        <div className="toolbar-controls">
          <button className="button button-quiet" type="button" onClick={() => { void navigator.clipboard?.writeText(sorted.map((subscriber) => subscriber.email).join('\n')); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <><Check size={14} /> اتنسخ</> : <><Copy size={14} /> نسخ الإيميلات</>}
          </button>
          <button className="button button-dark" type="button" onClick={exportCsv} disabled={!sorted.length}>
            <Download size={15} /> تصدير CSV
          </button>
        </div>
      </div>

      {sorted.length ? (
        <div className="table-scroll">
          <table>
            <thead><tr><th>البريد</th><th>المصدر</th><th>تاريخ الاشتراك</th><th /></tr></thead>
            <tbody>
              {sorted.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td><strong dir="ltr">{subscriber.email}</strong></td>
                  <td>{subscriber.source || '—'}</td>
                  <td>{formatDate(subscriber.createdAt)}</td>
                  <td>
                    <button className="icon-button delete-action" type="button" title="حذف" onClick={() => onDelete(subscriber.id)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Mail} title="مفيش مشتركين" body="النشرة الإخبارية في الموقع بتجمع الإيميلات هنا." />
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- shared */

export function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return (
    <label className="search-box">
      <Search size={15} />
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value ? <button className="icon-button search-clear" type="button" title="مسح" onClick={() => onChange('')}><X size={13} /></button> : null}
    </label>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={22} /></span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function CalendarHint() {
  return <span className="muted"><CalendarDays size={13} /> آخر 30 يوم</span>;
}