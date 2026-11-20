import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Edit3, Eye, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import type {
  AuthUser,
  ClinicSettings,
  Invoice,
  InvoiceItem,
  Patient,
  Treatment,
} from '../types/dcms';
import { ConfirmDialog, EmptyState, Modal, StatusTag, formatCurrency } from '../components/ui/Primitives';

export function BillingPage({
  user,
  invoices,
  patients,
  treatments,
  clinicSettings,
  openCreateOnMount,
  onClearOpenCreate,
  onRefreshData,
  onNotify,
}: {
  user: AuthUser;
  invoices: Invoice[];
  patients: Patient[];
  treatments: Treatment[];
  clinicSettings: ClinicSettings | null;
  openCreateOnMount: boolean;
  onClearOpenCreate: () => void;
  onRefreshData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partially Paid' | 'Pending'>('All');

  const [formOpen, setFormOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);

  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [paymentInv, setPaymentInv] = useState<Invoice | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'Card' as 'Card' | 'Cash' | 'Bank Transfer' | 'Insurance',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: '',
    notes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const defaultTaxRate = clinicSettings?.tax_rate ?? 5;
  const [form, setForm] = useState({
    patient_id: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    discount: 0,
    tax_rate: defaultTaxRate,
    notes: '',
    items: [{ treatment_id: null, description: '', quantity: 1, unit_price: 0 }] as InvoiceItem[],
    initial_payment_amount: 0,
    initial_payment_method: 'Card',
  });

  useEffect(() => {
    if (openCreateOnMount) {
      openNewInvoice();
      onClearOpenCreate();
    }
  }, [openCreateOnMount]);

  const openNewInvoice = () => {
    const trt = treatments[0];
    setEditingInv(null);
    setForm({
      patient_id: String(patients[0]?.id || ''),
      invoice_date: new Date().toISOString().slice(0, 10),
      discount: 0,
      tax_rate: clinicSettings?.tax_rate ?? 5,
      notes: '',
      items: [
        {
          treatment_id: trt?.id || null,
          description: trt?.name || '',
          quantity: 1,
          unit_price: trt?.cost || 0,
        },
      ],
      initial_payment_amount: 0,
      initial_payment_method: 'Card',
    });
    setFormOpen(true);
  };

  const openEditInvoice = (inv: Invoice) => {
    setEditingInv(inv);
    setForm({
      patient_id: String(inv.patient_id),
      invoice_date: inv.invoice_date,
      discount: inv.discount,
      tax_rate: clinicSettings?.tax_rate ?? 5,
      notes: inv.notes || '',
      items: inv.items.map((i) => ({
        treatment_id: i.treatment_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      initial_payment_amount: 0,
      initial_payment_method: 'Card',
    });
    setFormOpen(true);
  };

  // Formula: Subtotal = Sum(items), Total = Subtotal - Discount + Tax, Balance = Total - Paid
  const computedSubtotal = useMemo(
    () => form.items.reduce((acc, i) => acc + Number(i.quantity || 0) * Number(i.unit_price || 0), 0),
    [form.items]
  );
  const computedDiscount = Math.max(0, Math.min(computedSubtotal, Number(form.discount || 0)));
  const computedTax = Number((((computedSubtotal - computedDiscount) * Number(form.tax_rate || 0)) / 100).toFixed(2));
  const computedTotal = Number((computedSubtotal - computedDiscount + computedTax).toFixed(2));

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingInv) {
        await apiRequest(`/api/invoices/${editingInv.id}`, {
          method: 'PUT',
          body: {
            invoice_date: form.invoice_date,
            discount: Number(form.discount),
            tax_rate: Number(form.tax_rate),
            notes: form.notes,
            items: form.items,
          },
        });
        onNotify('success', `Invoice ${editingInv.invoice_number} updated.`);
      } else {
        await apiRequest('/api/invoices', {
          method: 'POST',
          body: {
            patient_id: Number(form.patient_id),
            invoice_date: form.invoice_date,
            discount: Number(form.discount),
            tax_rate: Number(form.tax_rate),
            notes: form.notes,
            items: form.items,
            initial_payment:
              Number(form.initial_payment_amount) > 0
                ? {
                    amount: Number(form.initial_payment_amount),
                    payment_method: form.initial_payment_method,
                  }
                : undefined,
          },
        });
        onNotify('success', 'Invoice created.');
      }
      setFormOpen(false);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const openRecordPayment = (inv: Invoice) => {
    setPaymentInv(inv);
    setPaymentForm({
      amount: inv.balance,
      payment_method: 'Card',
      payment_date: new Date().toISOString().slice(0, 10),
      reference_number: '',
      notes: '',
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInv) return;
    setPaymentSaving(true);
    try {
      await apiRequest(`/api/invoices/${paymentInv.id}/payments`, {
        method: 'POST',
        body: {
          amount: Number(paymentForm.amount),
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          reference_number: paymentForm.reference_number,
          notes: paymentForm.notes,
        },
      });
      onNotify('success', `Recorded payment of ${formatCurrency(Number(paymentForm.amount))} for ${paymentInv.invoice_number}.`);
      setPaymentInv(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/invoices/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify('success', `Deleted invoice ${deleteTarget.invoice_number}.`);
      setDeleteTarget(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete invoice.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'All' && inv.payment_status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.patient_name.toLowerCase().includes(q) ||
        inv.patient_code.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const totals = useMemo(() => {
    return invoices.reduce(
      (acc, i) => {
        acc.billed += i.total;
        acc.collected += i.amount_paid;
        acc.balance += i.balance;
        return acc;
      },
      { billed: 0, collected: 0, balance: 0 }
    );
  }, [invoices]);

  const canManage = ['Administrator', 'Receptionist'].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Billing & Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-mono tabular-nums">
            Billed: {formatCurrency(totals.billed)} · Collected: {formatCurrency(totals.collected)} · Outstanding:{' '}
            {formatCurrency(totals.balance)}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openNewInvoice}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        )}
      </div>

      {/* Printable Invoice View */}
      {printInvoice && (
        <div className="bg-white border border-slate-300 rounded-xl p-8 print-surface space-y-6">
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">
                {clinicSettings?.clinic_name || 'ClarityDental Studio'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">{clinicSettings?.address}</p>
              <p className="text-xs text-slate-600">
                {clinicSettings?.phone} · {clinicSettings?.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-display font-bold text-slate-900">INVOICE</p>
              <p className="text-xs font-mono text-teal-800 mt-0.5">{printInvoice.invoice_number}</p>
              <p className="text-xs font-mono text-slate-600">Date: {printInvoice.invoice_date}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 text-xs">
            <div>
              <p className="text-slate-500">Billed To</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{printInvoice.patient_name}</p>
              <p className="text-slate-600 font-mono">{printInvoice.patient_code}</p>
              <p className="text-slate-600">{printInvoice.patient_phone}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-slate-500 mb-1">Payment Status</p>
              <StatusTag status={printInvoice.payment_status} />
            </div>
          </div>

          <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-medium">Service / Treatment</th>
                <th className="py-2.5 px-4 font-medium text-right">Qty</th>
                <th className="py-2.5 px-4 font-medium text-right">Unit Price</th>
                <th className="py-2.5 px-4 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {printInvoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{item.description}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(printInvoice.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Discount</dt>
                <dd className="font-mono tabular-nums">-{formatCurrency(printInvoice.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tax</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(printInvoice.tax_amount)}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-slate-900">
                <dt>Total</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(printInvoice.total)}</dd>
              </div>
              <div className="flex justify-between text-emerald-700">
                <dt>Amount Paid</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(printInvoice.amount_paid)}</dd>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold text-slate-900">
                <dt>Balance Due</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(printInvoice.balance)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 no-print">
            <button
              type="button"
              onClick={() => setPrintInvoice(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Close Invoice View
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number or patient..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
          />
        </div>

        <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
          {(['All', 'Paid', 'Partially Paid', 'Pending'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-medium">Invoice #</th>
                <th className="py-3 px-4 font-medium">Patient</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
                <th className="py-3 px-4 font-medium text-right">Paid</th>
                <th className="py-3 px-4 font-medium text-right">Balance</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4">
                    <EmptyState
                      title="No invoices found"
                      description="Create an invoice to track treatment charges and patient payments."
                      actionLabel={canManage ? 'Create Invoice' : undefined}
                      onAction={canManage ? openNewInvoice : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{inv.patient_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{inv.patient_code}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatCurrency(inv.balance)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusTag status={inv.payment_status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        {canManage && inv.balance > 0 && (
                          <button
                            type="button"
                            onClick={() => openRecordPayment(inv)}
                            title="Record Payment"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md whitespace-nowrap"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPrintInvoice(inv)}
                          title="View & Print Invoice"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditInvoice(inv)}
                              title="Edit Invoice"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(inv)}
                              title="Delete Invoice"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Invoice Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingInv ? `Edit Invoice · ${editingInv.invoice_number}` : 'Create Invoice'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveInvoice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient <span className="text-red-600">*</span>
              </label>
              <select
                disabled={Boolean(editingInv)}
                value={form.patient_id}
                onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.patient_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Invoice Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={form.invoice_date}
                onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">Line Items</p>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    items: [...f.items, { treatment_id: null, description: '', quantity: 1, unit_price: 0 }],
                  }))
                }
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                + Add Line Item
              </button>
            </div>

            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <select
                  aria-label="Select treatment preset"
                  value={item.treatment_id || ''}
                  onChange={(e) => {
                    const trt = treatments.find((t) => String(t.id) === e.target.value);
                    const next = [...form.items];
                    next[idx] = {
                      ...next[idx],
                      treatment_id: trt ? trt.id : null,
                      description: trt ? trt.name : next[idx].description,
                      unit_price: trt ? trt.cost : next[idx].unit_price,
                    };
                    setForm((f) => ({ ...f, items: next }));
                  }}
                  className="sm:col-span-4 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Custom item...</option>
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatCurrency(t.cost)})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Service description"
                  value={item.description}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[idx] = { ...next[idx], description: e.target.value };
                    setForm((f) => ({ ...f, items: next }));
                  }}
                  className="sm:col-span-4 px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                    setForm((f) => ({ ...f, items: next }));
                  }}
                  className="sm:col-span-1 px-2 py-2 text-xs border border-slate-300 rounded-lg font-mono text-right"
                />
                <div className="sm:col-span-3 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={item.unit_price}
                    onChange={(e) => {
                      const next = [...form.items];
                      next[idx] = { ...next[idx], unit_price: Number(e.target.value) };
                      setForm((f) => ({ ...f, items: next }));
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-mono text-right"
                  />
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                      }
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={form.tax_rate}
                onChange={(e) => setForm((f) => ({ ...f, tax_rate: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-mono tabular-nums">{formatCurrency(computedSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tax:</span>
                <span className="font-mono tabular-nums">{formatCurrency(computedTax)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total:</span>
                <span className="font-mono tabular-nums">{formatCurrency(computedTotal)}</span>
              </div>
            </div>
          </div>

          {!editingInv && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Initial Payment Received ($)
                </label>
                <input
                  type="number"
                  min={0}
                  max={computedTotal}
                  step="0.01"
                  value={form.initial_payment_amount}
                  onChange={(e) => setForm((f) => ({ ...f, initial_payment_amount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={form.initial_payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, initial_payment_method: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Card">Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Insurance">Insurance</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(paymentInv)}
        onClose={() => setPaymentInv(null)}
        title={`Record Payment · ${paymentInv?.invoice_number || ''}`}
        subtitle={
          paymentInv
            ? `Remaining balance for ${paymentInv.patient_name}: ${formatCurrency(paymentInv.balance)}`
            : undefined
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount ($) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={0.01}
                max={paymentInv?.balance}
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
              <select
                value={paymentForm.payment_method}
                onChange={(e) =>
                  setPaymentForm((f) => ({
                    ...f,
                    payment_method: e.target.value as 'Card' | 'Cash' | 'Bank Transfer' | 'Insurance',
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Insurance">Insurance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reference #</label>
              <input
                type="text"
                value={paymentForm.reference_number}
                onChange={(e) => setPaymentForm((f) => ({ ...f, reference_number: e.target.value }))}
                placeholder="Receipt / Txn ID"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPaymentInv(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paymentSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {paymentSaving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Invoice"
        message={`Permanently delete invoice ${deleteTarget?.invoice_number} for ${deleteTarget?.patient_name}?`}
        loading={deleting}
        onConfirm={handleDeleteInvoice}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
