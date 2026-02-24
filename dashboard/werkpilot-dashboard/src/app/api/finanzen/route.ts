import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/*  GET /api/finanzen                                                  */
/*  Returns rechnungen, zahlungen, ausgaben, and stats (German format) */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const type = url.searchParams.get('type');

    const [invoices, payments, expenses] = await Promise.all([
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: { payments: true },
      }),
      prisma.payment.findMany({
        orderBy: { paidAt: 'desc' },
        include: { invoice: { select: { invoiceNumber: true, clientName: true } } },
      }),
      prisma.expense.findMany({
        orderBy: { date: 'desc' },
      }),
    ]);

    // Map to German field names expected by the frontend
    const rechnungen = invoices.map((inv) => {
      const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
      return {
        id: inv.id,
        nummer: inv.invoiceNumber,
        kunde: inv.clientName,
        email: inv.clientEmail,
        adresse: inv.clientAddress,
        status: inv.status,
        betrag: inv.subtotal,
        mwstSatz: inv.vatRate,
        mwst: inv.vatAmount,
        total: inv.total,
        faelligAm: inv.dueDate ? inv.dueDate.toISOString() : null,
        notizen: inv.notes,
        positionen: (items as Array<{ description?: string; beschreibung?: string; amount?: number; betrag?: number }>).map(
          (item) => ({
            beschreibung: item.description || item.beschreibung || '',
            betrag: item.amount ?? item.betrag ?? 0,
          })
        ),
        createdAt: inv.createdAt.toISOString(),
      };
    });

    const zahlungen = payments.map((p) => ({
      id: p.id,
      rechnungNummer: p.invoice?.invoiceNumber ?? '',
      kunde: p.invoice?.clientName ?? '',
      betrag: p.amount,
      methode: p.method,
      referenz: p.reference,
      bezahltAm: p.paidAt.toISOString(),
    }));

    const ausgaben = expenses.map((e) => ({
      id: e.id,
      beschreibung: e.description,
      kategorie: e.category,
      betrag: e.amount,
      datum: e.date.toISOString(),
      wiederkehrend: e.recurring,
      notizen: e.notes ?? null,
    }));

    // KPIs in German
    const umsatz = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    const ausstehend = invoices
      .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.total, 0);

    const totalAusgaben = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const stats = {
      umsatz,
      ausstehend,
      ausgaben: totalAusgaben,
      gewinn: umsatz - totalAusgaben,
    };

    // Also include English-format KPIs for the dashboard overview
    const kpis = {
      revenue: umsatz,
      outstanding: ausstehend,
      expenses: totalAusgaben,
      profit: umsatz - totalAusgaben,
      invoiceCount: invoices.length,
      paidCount: invoices.filter((inv) => inv.status === 'paid').length,
      overdueCount: invoices.filter((inv) => inv.status === 'overdue').length,
      draftCount: invoices.filter((inv) => inv.status === 'draft').length,
    };

    // Cashflow: last 6 months of income (paid invoices) vs expenses
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const cashflow: Array<{ monat: string; einnahmen: number; ausgabenMonat: number; saldo: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthIncome = invoices
        .filter((inv) => inv.status === 'paid' && inv.paidAt && inv.paidAt >= monthStart && inv.paidAt <= monthEnd)
        .reduce((sum, inv) => sum + inv.total, 0);

      const monthExpenses = expenses
        .filter((exp) => exp.date >= monthStart && exp.date <= monthEnd)
        .reduce((sum, exp) => sum + exp.amount, 0);

      cashflow.push({
        monat: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        einnahmen: Math.round(monthIncome * 100) / 100,
        ausgabenMonat: Math.round(monthExpenses * 100) / 100,
        saldo: Math.round((monthIncome - monthExpenses) * 100) / 100,
      });
    }

    if (type === 'kpis') return NextResponse.json({ kpis });

    return NextResponse.json({ rechnungen, zahlungen, ausgaben, stats, kpis, cashflow });
  } catch (error) {
    console.error('Finance GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/finanzen                                                 */
/*  Create invoice, payment, expense, or update invoice status         */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, action, ...data } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Missing type field (invoice, payment, expense)' },
        { status: 400 }
      );
    }

    /* ---------- Create Invoice ---------- */
    if (type === 'invoice') {
      const clientName = data.clientName || data.kunde;
      const clientEmail = data.clientEmail || data.email;
      const clientAddress = data.clientAddress || data.adresse;
      const rawItems = data.items || data.positionen;
      const vatRate = data.vatRate ?? data.mwstSatz ?? 8.1;
      const notes = data.notes || data.notizen;
      const dueDate = data.dueDate || data.faelligAm;
      const leadId = data.leadId;

      if (!clientName) {
        return NextResponse.json(
          { error: 'clientName / kunde is required' },
          { status: 400 }
        );
      }

      const rawParsed = typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || []);
      const parsedItems = rawParsed.map((item: Record<string, unknown>) => ({
        description: item.description || item.beschreibung || '',
        amount: Number(item.amount ?? item.betrag ?? 0),
      }));

      const subtotal = parsedItems.reduce(
        (sum: number, item: { amount: number }) => sum + (item.amount || 0),
        0
      );
      const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
      const total = Math.round((subtotal + vatAmount) * 100) / 100;

      const year = new Date().getFullYear();
      const count = await prisma.invoice.count({
        where: { invoiceNumber: { startsWith: `WP-${year}-` } },
      });
      const invoiceNumber = `WP-${year}-${String(count + 1).padStart(3, '0')}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientName,
          clientEmail: clientEmail || null,
          clientAddress: clientAddress || null,
          items: JSON.stringify(parsedItems),
          subtotal,
          vatRate,
          vatAmount,
          total,
          currency: 'CHF',
          status: 'draft',
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes || null,
          leadId: leadId || null,
        },
      });

      return NextResponse.json(invoice, { status: 201 });
    }

    /* ---------- Payment / Invoice actions ---------- */
    if (type === 'payment') {
      // Handle "mark as sent" action
      if (action === 'mark_sent') {
        const invoiceId = data.invoiceId;
        if (!invoiceId) {
          return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
        }
        const updated = await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'sent' },
        });
        return NextResponse.json(updated);
      }

      // Create payment
      const { invoiceId, amount, method, methode, reference, notes: paymentNotes } = data;

      if (!invoiceId || !amount) {
        return NextResponse.json(
          { error: 'invoiceId and amount are required' },
          { status: 400 }
        );
      }

      const payment = await prisma.payment.create({
        data: {
          invoiceId,
          amount: parseFloat(amount),
          method: method || methode || 'bank_transfer',
          reference: reference || null,
          notes: paymentNotes || null,
          paidAt: new Date(),
        },
      });

      // Auto-mark invoice as paid when fully paid
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true },
      });

      if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        if (totalPaid >= invoice.total) {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'paid', paidAt: new Date() },
          });
        }
      }

      return NextResponse.json(payment, { status: 201 });
    }

    /* ---------- Create Expense ---------- */
    if (type === 'expense') {
      const description = data.description || data.beschreibung;
      const category = data.category || data.kategorie;
      const amount = data.amount ?? data.betrag;
      const date = data.date || data.datum;
      const recurring = data.recurring ?? data.wiederkehrend ?? false;
      const notes = data.notes || data.notizen;

      if (!description || !category || !amount) {
        return NextResponse.json(
          { error: 'description, category, and amount are required' },
          { status: 400 }
        );
      }

      const expense = await prisma.expense.create({
        data: {
          description,
          category,
          amount: parseFloat(amount),
          currency: 'CHF',
          date: date ? new Date(date) : new Date(),
          recurring,
          notes: notes || null,
        },
      });

      return NextResponse.json(expense, { status: 201 });
    }

    return NextResponse.json(
      { error: `Unknown type: ${type}. Use invoice, payment, or expense.` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Finance POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create financial record' },
      { status: 500 }
    );
  }
}
