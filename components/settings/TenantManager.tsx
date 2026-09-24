import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Copy, Eye, EyeOff, Mail, Plus, RefreshCw } from 'lucide-react';
import { iamService, IamTenant } from '../../services/iamService';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  PageHeader,
  SearchInput,
  Spinner,
  cn,
} from '@/components/ui';
import { ListFooter, SuccessNotice, Toast, copyText, shortDate, useToast } from '../admin/AdminFeedback';

interface ProvisionedTenant {
  tenant: IamTenant;
  ownerName: string;
  ownerEmail: string;
}

const TenantManager: React.FC = () => {
  const pageSize = 10;
  const [tenantName, setTenantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [tenantLoadError, setTenantLoadError] = useState('');
  const [provisioned, setProvisioned] = useState<ProvisionedTenant | null>(null);
  const [tenants, setTenants] = useState<IamTenant[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTenants, setTotalTenants] = useState(0);
  const [filter, setFilter] = useState('');
  const { toast, showToast } = useToast();

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
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchTenants(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The API has no search, so this narrows the page that is already loaded.
  const visibleTenants = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.id, tenant.ownerName, tenant.ownerEmail].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [filter, tenants]);

  const openCreate = () => {
    setSubmitError('');
    setIsPasswordVisible(false);
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setSubmitError('');
  };

  const canSubmit = Boolean(
    tenantName.trim() && ownerName.trim() && ownerEmail.trim() && ownerPassword,
  );

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isSubmitting) return;

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

      setProvisioned({
        tenant,
        ownerName: normalizedOwnerName,
        ownerEmail: normalizedOwnerEmail,
      });
      setTenantName('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPassword('');
      setIsCreateOpen(false);
      setFilter('');
      fetchTenants(1);
    } catch (error) {
      console.error('Failed to create tenant:', error);
      setSubmitError('Tenant creation failed. If that owner email already exists, use a different email for now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (text: string, what: string) => {
    if (await copyText(text)) showToast(`${what} copied`);
  };

  const renderTable = () => {
    if (!hasLoadedOnce && isLoadingTenants) {
      return <Spinner label="Loading tenants…" className="py-20" />;
    }
    if (tenants.length === 0) {
      return tenantLoadError ? null : (
        <EmptyState
          icon={Building2}
          title="No tenants yet"
          description="Create a tenant to provision an institution's workspace and its first owner account."
          action={
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New tenant
            </Button>
          }
        />
      );
    }
    if (visibleTenants.length === 0) {
      return (
        <EmptyState
          compact
          icon={Building2}
          title="No tenants on this page match"
          description="The filter only covers the tenants shown on this page."
          action={
            <Button variant="ghost" size="sm" onClick={() => setFilter('')}>
              Clear filter
            </Button>
          }
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Tenant
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Owner
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                Created
              </th>
              <th scope="col" className="w-12 px-2 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody
            className={cn(
              'divide-y divide-stone-100 transition-opacity',
              isLoadingTenants && 'opacity-60',
            )}
          >
            {visibleTenants.map((tenant) => {
              const hasOwner = Boolean(tenant.ownerName || tenant.ownerEmail);
              const isNew = provisioned?.tenant.id === tenant.id;
              return (
                <tr key={tenant.id} className="transition-colors hover:bg-stone-50">
                  <td className="w-[45%] max-w-0 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-medium text-stone-900">{tenant.name}</p>
                      {isNew && <Badge tone="green">New</Badge>}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-stone-400" title={tenant.id}>
                      {tenant.id}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {hasOwner ? (
                      <>
                        <p className="text-stone-800">{tenant.ownerName || 'Unnamed owner'}</p>
                        <p className="mt-0.5 break-all text-xs text-stone-500">
                          {tenant.ownerEmail || 'No email on file'}
                        </p>
                      </>
                    ) : (
                      <Badge tone="amber" dot>
                        No owner
                      </Badge>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums text-stone-600 md:table-cell">
                    {shortDate(tenant.created) || <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Menu
                      size="sm"
                      label={`Actions for ${tenant.name}`}
                      items={[
                        {
                          label: 'Copy tenant ID',
                          icon: Copy,
                          onSelect: () => void handleCopy(tenant.id, 'Tenant ID'),
                        },
                        {
                          label: 'Copy owner email',
                          icon: Mail,
                          disabled: !tenant.ownerEmail,
                          hint: tenant.ownerEmail ? undefined : 'No owner email on file',
                          onSelect: () => {
                            if (tenant.ownerEmail) void handleCopy(tenant.ownerEmail, 'Owner email');
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Institutions on the platform and their primary owners. Creating a tenant provisions its owner account in the same step."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New tenant
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Filter tenants on this page"
          disabled={tenants.length === 0}
          className="w-full sm:w-80"
        />
        <Button
          aria-label="Refresh tenants"
          title="Refresh tenants"
          icon={RefreshCw}
          loading={isLoadingTenants}
          onClick={() => fetchTenants(currentPage)}
          className="w-9 px-0 sm:ml-auto"
        />
      </div>

      <div className="mt-5 space-y-4">
        {provisioned && (
          <SuccessNotice onDismiss={() => setProvisioned(null)}>
            <span className="font-medium">{provisioned.tenant.name}</span> is ready for onboarding.
            The owner, {provisioned.ownerName} ({provisioned.ownerEmail}), can sign in with the
            temporary password you set.
          </SuccessNotice>
        )}

        {tenantLoadError && (
          <InlineAlert
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fetchTenants(currentPage)}
                disabled={isLoadingTenants}
                className="-my-1"
              >
                Try again
              </Button>
            }
          >
            {tenantLoadError}
          </InlineAlert>
        )}

        {!(tenantLoadError && tenants.length === 0) && (
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
            {renderTable()}
            {tenants.length > 0 && (
              <ListFooter
                page={currentPage}
                totalPages={totalPages}
                total={totalTenants}
                noun="tenant"
                disabled={isLoadingTenants}
                onPrevious={() => fetchTenants(currentPage - 1)}
                onNext={() => fetchTenants(currentPage + 1)}
              />
            )}
          </div>
        )}
      </div>

      <Dialog
        open={isCreateOpen}
        onClose={closeCreate}
        dismissible={!isSubmitting}
        width="max-w-lg"
        title="New tenant"
        description="Sets up the institution and its first owner account in one step."
        footer={
          <>
            <Button variant="ghost" onClick={closeCreate} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Provisioning…' : 'Create tenant'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <InlineAlert onDismiss={() => setSubmitError('')}>{submitError}</InlineAlert>
          )}
          <Field label="Tenant name">
            {(id) => (
              <Input
                id={id}
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                placeholder="Acme School of Medicine"
                autoComplete="off"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name">
              {(id) => (
                <Input
                  id={id}
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  placeholder="Alex Morgan"
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label="Owner email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  placeholder="owner@acme.edu"
                  autoComplete="off"
                />
              )}
            </Field>
          </div>

          <Field
            label="Temporary password"
            description="Share it with the owner privately. Setup stops if the owner email is already in use."
          >
            {(id) => (
              <div className="relative">
                <Input
                  id={id}
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  placeholder="Create a temporary password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <IconButton
                  icon={isPasswordVisible ? EyeOff : Eye}
                  label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  size="sm"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                />
              </div>
            )}
          </Field>
          {/* Enter in any field submits. */}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Dialog>

      <Toast message={toast} />
    </div>
  );
};

export default TenantManager;
