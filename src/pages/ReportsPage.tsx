import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { ChartConfiguration } from 'chart.js';
import { apiRequest } from '../api/client';
import type { ReportsResponse } from '../types/dcms';
import { ChartCanvas, formatCurrency } from '../components/ui/Primitives';

function offsetIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage({
  onNotify,
}: {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const [from, setFrom] = useState(() => offsetIso(-180));
  const [to, setTo] = useState(() => offsetIso(30));
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = async (f: string, t: string) => {
    setLoading(true);
    try {
      const res = await apiRequest<ReportsResponse>(`/api/reports?from=${f}&to=${t}`);
      setData(res);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(from, to);
  }, [from, to]);

  const revenueChart = useMemo<ChartConfiguration>(() => {
    const rows = data?.monthlyRevenue || [];
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.month),
        datasets: [
          {
            label: 'Billed ($)',
            data: rows.map((r) => r.billed),
            backgroundColor: '#CBD5E1',
            borderRadius: 5,
          },
          {
            label: 'Collected ($)',
            data: rows.map((r) => r.collected),
            backgroundColor: '#0F766E',
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } },
        },
      },
    };
  }, [data]);

  const treatmentRevenueChart = useMemo<ChartConfiguration>(() => {
    const rows = data?.treatmentRevenue || [];
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.treatment_name),
        datasets: [
          {
            label: 'Revenue ($)',
            data: rows.map((r) => r.revenue),
            backgroundColor: '#0D9488',
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          y: { grid: { display: false } },
        },
      },
    };
  }, [data]);

  const patientMonthlyChart = useMemo<ChartConfiguration>(() => {
    const rows = data?.monthlyPatients || [];
    return {
      type: 'line',
      data: {
        labels: rows.map((r) => r.month),
        datasets: [
          {
            label: 'New Patients',
            data: rows.map((r) => r.count),
            borderColor: '#0F766E',
            backgroundColor: 'rgba(15, 118, 110, 0.12)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } },
        },
      },
    };
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const lines: string[] = [
      `ClarityDental Report (${data.range.from} to ${data.range.to})`,
      '',
      'Metric,Value',
      `Total Registered Patients,${data.summary.totalPatients}`,
      `New Patients in Range,${data.summary.newPatientsInRange}`,
      `Total Appointments,${data.summary.appointments.total || 0}`,
      `Completed Appointments,${data.summary.appointments.completed || 0}`,
      `Cancelled Appointments,${data.summary.appointments.cancelled || 0}`,
      `No-show Appointments,${data.summary.appointments.no_show || 0}`,
      `Total Billed,${data.summary.revenue.billed}`,
      `Total Collected,${data.summary.revenue.collected}`,
      `Outstanding Balance,${data.summary.revenue.outstanding}`,
      '',
      'Treatment,Quantity,Revenue',
      ...data.treatmentRevenue.map((t) => `"${t.treatment_name}",${t.total_qty},${t.revenue}`),
      '',
      'Dentist,Specialization,Total Appointments,Completed,Cancelled,No-show',
      ...data.dentistAppointments.map(
        (d) => `"${d.dentist_name}","${d.specialization}",${d.total},${d.completed},${d.cancelled},${d.no_show}`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `claritydental-report-${data.range.from}-to-${data.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify('success', 'CSV report downloaded.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dynamic patient, appointment, dentist workload, and revenue performance reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <input
            type="date"
            aria-label="Report start date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            aria-label="Report end date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Calculating analytics...
        </div>
      ) : (
        data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Patients (Total / New)</p>
                <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
                  {data.summary.totalPatients} / +{data.summary.newPatientsInRange}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Appointments (Completed / Total)</p>
                <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
                  {data.summary.appointments.completed || 0} / {data.summary.appointments.total || 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Cancellations & No-Shows</p>
                <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
                  {data.summary.appointments.cancelled || 0} / {data.summary.appointments.no_show || 0}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">Collected Revenue</p>
                <p className="text-2xl font-display font-semibold text-emerald-700 mt-1 font-mono tabular-nums">
                  {formatCurrency(data.summary.revenue.collected)}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Revenue Report (Billed vs Collected)</h2>
                <ChartCanvas config={revenueChart} height={220} />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">New Patients per Month</h2>
                <ChartCanvas config={patientMonthlyChart} height={220} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Treatment-Wise Revenue</h2>
              <ChartCanvas config={treatmentRevenueChart} height={240} />
            </div>

            {/* Dentist-Wise Appointments Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Dentist-Wise Appointment Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-medium">Dentist</th>
                      <th className="py-3 px-4 font-medium">Specialization</th>
                      <th className="py-3 px-4 font-medium text-right">Total</th>
                      <th className="py-3 px-4 font-medium text-right">Completed</th>
                      <th className="py-3 px-4 font-medium text-right">Cancelled</th>
                      <th className="py-3 px-4 font-medium text-right">No-show</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.dentistAppointments.map((d) => (
                      <tr key={d.dentist_name}>
                        <td className="py-3 px-4 font-medium text-slate-900">{d.dentist_name}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{d.specialization}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{d.total}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{d.completed}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700">{d.cancelled}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">{d.no_show}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
