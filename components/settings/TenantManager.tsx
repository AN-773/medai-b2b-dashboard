import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { iamService, IamTenant } from '../../services/iamService';

const TenantManager: React.FC = () => {
  const pageSize = 10;
  const [tenantName, setTenantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [tenantLoadError, setTenantLoadError] = useState('');
  const [createdTenant, setCreatedTenant] = useState<IamTenant | null>(null);
  const [createdOwnerName, setCreatedOwnerName] = useState('');
  const [createdOwnerEmail, setCreatedOwnerEmail] = useState('');
  const [tenants, setTenants] = useState<IamTenant[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTenants, setTotalTenants] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalTenants / pageSize));

  const fetchTenants = async (page = currentPage) => {
    setIsLoadingTenants(true);
    setTenantLoadError('');

    try {
      const response = await iamService.listTenants(page, pageSize);
      setTenants(response.items || []);
      setTotalTenants(response.total || 0);
      setCurrentPage(response.page || page);
    } catch (error) {
      console.error('Failed to load tenants:', error);
      setTenantLoadError('Unable to load tenants right now.');
    } finally {
      setIsLoadingTenants(false);
    }
  };

  useEffect(() => {
    fetchTenants(1);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedTenantName = tenantName.trim();
    const normalizedOwnerName = ownerName.trim();
    const normalizedOwnerEmail = ownerEmail.trim();

    if (!normalizedTenantName || !normalizedOwnerName || !normalizedOwnerEmail || !ownerPassword) {
      setSubmitError('Tenant name, owner name, owner email, and password are all required.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const tenant = await iamService.createTenant({
        name: normalizedTenantName,
        userName: normalizedOwnerName,
        userEmail: normalizedOwnerEmail,
        userPassword: ownerPassword,
      });

      setCreatedTenant(tenant);
      setCreatedOwnerName(normalizedOwnerName);
      setCreatedOwnerEmail(normalizedOwnerEmail);
      setTenantName('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPassword('');
      fetchTenants(1);
    } catch (error) {
      console.error('Failed to create tenant:', error);
      setSubmitError('Tenant creation failed. If that owner email already exists, use a different email for now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 font-['Inter']">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold">Tenant Provisioning</h3>
          <p className="text-sm text-slate-500">
            Create a new tenant and provision its primary owner in one step.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchTenants(currentPage)}
          disabled={isLoadingTenants}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoadingTenants ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh Tenants
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-6 mb-6">
        <form
          onSubmit={handleSubmit}
          className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Create Tenant</p>
                <p className="text-xs text-slate-500 mt-1">
                  Set up the institution and its first owner account.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="tenant-name"
                className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
              >
                Tenant Name
              </label>
              <input
                id="tenant-name"
                type="text"
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                placeholder="Acme School of Medicine"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label
                  htmlFor="owner-name"
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
                >
                  Owner Name
                </label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="owner-name"
                    type="text"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="owner-email"
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
                >
                  Owner Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="owner@acme.edu"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="owner-password"
                className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
              >
                Temporary Password
              </label>
              <input
                id="owner-password"
                type="password"
                value={ownerPassword}
                onChange={(event) => setOwnerPassword(event.target.value)}
                placeholder="Create a temporary password"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm">{submitError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
              <p className="text-xs text-slate-500">
                The owner account is created at the same time as the tenant.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Provisioning Tenant
                  </>
                ) : (
                  <>
                    <Building2 size={16} />
                    Create Tenant
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={18} className="text-emerald-600" />
              <p className="text-sm font-bold text-slate-900">What Happens</p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p>A new owner account is provisioned for the tenant during setup.</p>
              <p>The owner is attached immediately so the tenant is ready for onboarding.</p>
              <p>For now, setup stops if that owner email is already in use.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[220px]">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <p className="text-sm font-bold text-slate-900">Provisioning Status</p>
            </div>

            {createdTenant ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-emerald-900">
                  Tenant and owner account created successfully.
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Tenant
                  </p>
                  <p>{createdTenant.name}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Owner
                  </p>
                  <p>{createdOwnerName}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Owner Email
                  </p>
                  <p>{createdOwnerEmail}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    Status
                  </p>
                  <p>Ready for the next onboarding step.</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10">
                <Building2 size={40} className="text-slate-200 mb-4" />
                <p className="font-medium text-slate-900">No tenant created yet</p>
                <p className="text-sm mt-1 max-w-sm">
                  Create a tenant to provision a fresh workspace and its initial owner account.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Tenant Directory</h4>
            <p className="text-xs text-slate-500 mt-1">
              Review current tenants and their primary owners.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {totalTenants} tenant{totalTenants === 1 ? '' : 's'}
          </div>
        </div>

        {tenantLoadError && (
          <div className="mx-6 mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{tenantLoadError}</p>
          </div>
        )}

        {!tenantLoadError && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Owner Email</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingTenants ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Loading tenants
                      </div>
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No tenants found.
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{tenant.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {tenant.ownerName || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {tenant.ownerEmail || 'Unavailable'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {tenant.created ? new Date(tenant.created).toLocaleDateString() : 'Unavailable'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchTenants(currentPage - 1)}
              disabled={currentPage <= 1 || isLoadingTenants}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchTenants(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoadingTenants}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantManager;
